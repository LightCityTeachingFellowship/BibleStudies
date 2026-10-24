import { createHash, timingSafeEqual } from 'node:crypto';

export function createMemberHandlers({ auth, db, secret, fail, stamp = () => Date.now(), now = () => Date.now(), audio = null }) {
  const uid = request => {
    if (!request.auth?.uid) throw new fail('unauthenticated', 'Please sign in first.');
    return request.auth.uid;
  };
  async function member(request) {
    const id = uid(request);
    const [record, approval] = await Promise.all([auth.getUser(id), db.doc('churchMembers/' + id).get()]);
    if (record.disabled || !approval.exists || approval.data().active !== true) throw new fail('permission-denied', 'This account does not have church access. Join using the church registration code.');
    if (!record.emailVerified) throw new fail('failed-precondition', 'Please verify your email address, then try again.');
    return id;
  }
  async function device(request) {
    uid(request);
    const token = request.data?.deviceToken;
    if (typeof token !== 'string' || token.length > 10000) throw new fail('invalid-argument', 'Device sign-in is missing.');
    try { return (await auth.verifyIdToken(token, true)).uid; }
    catch { throw new fail('permission-denied', 'Device sign-in could not be verified.'); }
  }
  async function limit(request) {
    const window = Math.floor(now() / 300000);
    const keys = [uid(request), request.rawRequest?.ip || 'unknown'];
    const refs = keys.map((key, index) => db.doc('churchRateLimits/' + createHash('sha256').update(index + ':' + key + ':' + window).digest('hex')));
    await db.runTransaction(async tx => {
      const docs = await Promise.all(refs.map(ref => tx.get(ref)));
      if (docs.some(doc => (doc.data()?.count || 0) >= 20)) throw new fail('resource-exhausted', 'Too many attempts. Please wait five minutes and try again.');
      refs.forEach((ref, index) => tx.set(ref, { count: (docs[index].data()?.count || 0) + 1, expiresAt: new Date(now() + 86400000) }));
    });
  }
  async function validateCode(request) {
    const code = request.data?.code;
    if (typeof code !== 'string' || code.length > 128) throw new fail('invalid-argument', 'Enter the church registration code.');
    await limit(request);
    const expected = secret().trim();
    if (expected.length < 12) throw new fail('failed-precondition', 'Member registration is not ready yet.');
    const hash = value => createHash('sha256').update(value).digest();
    if (!timingSafeEqual(hash(code.trim()), hash(expected))) throw new fail('permission-denied', 'The church registration code is incorrect.');
  }
  async function activate(id) {
    const ref = db.doc('churchMembers/' + id);
    await db.runTransaction(async tx => {
      const existing = await tx.get(ref);
      if (existing.exists && existing.data().active !== true) throw new fail('permission-denied', 'Church access has been removed. Please contact the church.');
      if (!existing.exists) tx.set(ref, { active: true, joinedAt: stamp() });
    });
  }
  return {
    async registerGoogleChurchMember(request) {
      const id = uid(request);
      const record = await auth.getUser(id);
      if (record.disabled || !record.emailVerified || !record.providerData?.some(provider => provider.providerId === 'google.com') || request.auth.token?.firebase?.sign_in_provider !== 'google.com') throw new fail('permission-denied', 'Please sign in with Google first.');
      await validateCode(request);
      await activate(id);
      return { verificationRequired: false };
    },
    async registerChurchMember(request) {
      const id = uid(request), { email, password, code } = request.data || {};
      if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || typeof password !== 'string' || password.length < 8 || password.length > 128 || typeof code !== 'string' || code.length > 128) throw new fail('invalid-argument', 'Enter your email, a password of at least eight characters, and the church registration code.');
      await validateCode(request);
      const record = await auth.getUser(id);
      if (record.disabled || (record.email && record.email.toLowerCase() !== email.trim().toLowerCase())) throw new fail('failed-precondition', 'Please sign out before creating a different account.');
      try { await auth.updateUser(id, { email: email.trim(), password }); }
      catch (error) {
        if (error.code === 'auth/email-already-exists') throw new fail('already-exists', 'An account with this email already exists. Please sign in or reset your password.');
        throw new fail('internal', 'Could not create your account. Please try again.');
      }
      await activate(id);
      return { verificationRequired: !record.emailVerified };
    },
    async getChurchAudio(request) {
      if (!audio) throw new fail('unavailable', 'Audio listening is being prepared. Please try again shortly.');
      const videoId = request.data?.videoId;
      if (videoId === undefined) {
        const includeMembers = request.data?.includeMembers === true;
        if (includeMembers) await member(request);
        return { recordings: audio.catalog.filter(item => item.visibility === 'public' || (includeMembers && item.visibility === 'members')).map(({ videoId, title, durationSeconds }) => ({ videoId, title, durationSeconds })) };
      }
      if (typeof videoId !== 'string' || !/^[\w-]{11}$/.test(videoId)) throw new fail('invalid-argument', 'Choose a recording from the pilot library.');
      const recording = audio.catalog.find(item => item.videoId === videoId);
      if (!recording) throw new fail('not-found', 'This recording is not available in the audio pilot.');
      if (recording.visibility !== 'public') await member(request);
      try {
        const signed = await audio.sign(recording.objectKey);
        if (request.data?.diagnose === true) {
          const [diagnostic, credentials] = await Promise.all([audio.check(signed.url), audio.credentials(recording.objectKey)]);
          return { diagnostic: { ...diagnostic, credentials } };
        }
        return { videoId, title: recording.title, durationSeconds: recording.durationSeconds, ...signed };
      }
      catch { throw new fail('unavailable', 'Audio access could not be prepared. Please try again shortly.'); }
    },
    async getChurchLibrary(request) {
      await member(request);
      const library = await db.doc('churchVideoLibrary/current').get();
      if (!library.exists || !Array.isArray(library.data().videos)) throw new fail('unavailable', 'The video library is being prepared. Please try again shortly.');
      return { videos: library.data().videos };
    },
    async linkChurchDevice(request) {
      const memberUid = await member(request), deviceUid = await device(request);
      await db.doc('churchDevices/' + deviceUid).set({ memberUid, updatedAt: stamp() });
      return { linked: true };
    },
    async unlinkChurchDevice(request) {
      const memberUid = uid(request), deviceUid = await device(request);
      const ref = db.doc('churchDevices/' + deviceUid);
      await db.runTransaction(async tx => {
        const binding = await tx.get(ref);
        if (binding.data()?.memberUid === memberUid) tx.delete(ref);
      });
      return { linked: false };
    }
  };
}
