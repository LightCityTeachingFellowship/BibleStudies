const validId = id => typeof id === 'string' && /^[\w-]{11}$/.test(id);
export function createVideoActivity({ auth, db, fail, now = Date.now }) {
  async function identity(request) {
    const uid = request.auth?.uid;
    if (!uid) throw new fail('unauthenticated', 'Sign in to sync saved videos and history.');
    if (request.data?.accountUid !== undefined && request.data.accountUid !== uid) throw new fail('permission-denied', 'The signed-in account changed. Please try again.');
    const user = await auth.getUser(uid);
    if (user.disabled || !user.emailVerified || !user.providerData?.length) throw new fail('permission-denied', 'Use a verified account to sync your videos.');
    return uid;
  }
  async function allowed(uid) {
    const [snapshot, approval] = await Promise.all([db.doc('churchVideoLibrary/current').get(), db.doc('churchMembers/' + uid).get()]);
    if (!snapshot.exists || !Array.isArray(snapshot.data()?.videos)) throw new fail('unavailable', 'Your video library could not be checked.');
    const member = approval.exists && approval.data()?.active === true;
    const access = new Map();
    for (const v of snapshot.data().videos) if (validId(v.id)) {
      const old = access.get(v.id);
      access.set(v.id, { title: String(v.title || v.id).slice(0, 300), private: old?.private || v.visibility !== 'public', replaces:[...new Set([...(old?.replaces||[]),...(Array.isArray(v.replaces)?v.replaces.filter(validId):[])])] });
    }
    const visible=new Map([...access].filter(([,v])=>!v.private||member));visible.cleanup=new Map();for(const [id,v]of access)for(const old of v.replaces)if(!access.has(old))visible.cleanup.set(old,id);visible.replacements=new Map();for(const [id,v]of visible)for(const old of v.replaces)if(!access.has(old))visible.replacements.set(old,id);return visible;
  }
  const collection = (uid, view) => db.collection(`churchVideoActivity/${uid}/${view}`);
  const canonical=(access,id)=>access.has(id)?id:access.replacements.get(id)||id;
  const family=(access,id)=>[id,...(access.get(id)?.replaces||[]).filter(old=>access.replacements.get(old)===id)];
  const row = (doc, access, id=doc.id) => {
    const value = doc.data();
    return { videoId: id, title: access.get(id).title === id ? String(value.title || id).slice(0,300) : access.get(id).title, updatedAt: Number(value.updatedAt) || 0,
      ...(value.seconds !== undefined ? { seconds: value.seconds, duration: value.duration, mode: value.mode, completed: value.completed === true, rate: value.rate || 1 } : {}) };
  };
  return {
    async getMyVideoActivity(request) {
      const uid = await identity(request), data = request.data || {}, access = await allowed(uid);
      if (data.videoId !== undefined) {
        const id=canonical(access,data.videoId);if(!validId(data.videoId)||!access.has(id))throw new fail('not-found','This video is not available.');
        const [saved,history]=await Promise.all([Promise.all(family(access,id).map(alias=>collection(uid,'saved').doc(alias).get())),collection(uid,'history').doc(id).get()]);
        return {saved:saved.some(doc=>doc.exists),history:history.exists?row(history,access):null};
      }
      const view = data.view;
      if (!['saved', 'history'].includes(view)) throw new fail('invalid-argument', 'Choose Saved or History.');
      let query = collection(uid, view).orderBy('updatedAt', 'desc').orderBy('__name__', 'desc');
      if (data.cursor) {
        if (!validId(data.cursor.videoId) || !Number.isSafeInteger(data.cursor.updatedAt) || data.cursor.updatedAt < 0) throw new fail('invalid-argument', 'Invalid page.');
        query = query.startAfter(data.cursor.updatedAt, data.cursor.videoId);
      }
      const page = await query.limit(100).get(), last = page.docs.at(-1);
      const rows=new Map();for(const doc of page.docs){const id=view==='saved'?canonical(access,doc.id):doc.id;if(!access.has(id))continue;const value=row(doc,access,id);if(!rows.has(id)||value.updatedAt>rows.get(id).updatedAt)rows.set(id,value);}
      return { rows:[...rows.values()],cursor: page.size === 100 ? { videoId: last.id, updatedAt: last.data().updatedAt } : null };
    },
    async updateMyVideoActivity(request) {
      const uid = await identity(request), data = request.data || {};
      if (data.action === 'clearHistory') {
        const docs = await collection(uid, 'history').limit(200).get();
        if (docs.size) { const batch = db.batch(); for (const doc of docs.docs) batch.delete(doc.ref); await batch.commit(); }
        return { more: docs.size === 200 };
      }
      if (!validId(data.videoId) || !['save', 'unsave', 'progress', 'removeHistory'].includes(data.action)) throw new fail('invalid-argument', 'Invalid video action.');
      const view = ['save', 'unsave'].includes(data.action) ? 'saved' : 'history';
      if(data.action==='removeHistory'){await collection(uid,view).doc(data.videoId).delete();return {ok:true};}
      const access=await allowed(uid),id=view==='saved'?canonical(access,data.videoId):data.videoId;
      if(data.action==='unsave'){const target=access.cleanup.get(data.videoId)||data.videoId;const ids=[target,...[...access.cleanup].filter(([,to])=>to===target).map(([from])=>from)];await Promise.all(ids.map(alias=>collection(uid,'saved').doc(alias).delete()));return {ok:true};}
      const ref=collection(uid,view).doc(id);
      if(!access.has(id))throw new fail('permission-denied','This video is no longer available to your account.');
      const updatedAt = now();
      if (data.action === 'save') { await ref.set({ updatedAt, title:String(data.title || access.get(id).title).slice(0,300) }); return { ok: true, updatedAt }; }
      if (!Number.isFinite(data.seconds) || data.seconds < 0 || data.seconds > 172800 || !Number.isFinite(data.duration) || data.duration < 0 || data.duration > 172800 || !['video', 'audio'].includes(data.mode) || !Number.isFinite(data.rate) || data.rate < 0.25 || data.rate > 4) throw new fail('invalid-argument', 'Invalid playback position.');
      await ref.set({ title:String(data.title || access.get(id).title).slice(0,300), seconds: data.seconds, duration: data.duration, mode: data.mode, completed: data.completed === true, rate: data.rate, updatedAt });
      return { ok: true, updatedAt };
    }
  };
}
