const validId = id => /^[\w-]{11}$/.test(id || '');
export const resumeSeconds = row => row && !row.completed && row.seconds > 5 ? row.seconds : 0;
export function createVideoStore({ storage, now = Date.now, changed = () => {} } = {}) {
  let scope = 'device', state, sequence = 0;
  const key = () => 'lc-video-activity:v1:' + scope;
  function load() {
    try { const raw = JSON.parse(storage?.getItem(key())); state = raw?.version === 1 ? raw : null; } catch {}
    state ||= { version: 1, saved: {}, history: {}, outbox: {} };
    for (const group of ['saved', 'history', 'outbox']) if (!state[group] || typeof state[group] !== 'object' || Array.isArray(state[group])) state[group] = {};
  }
  function persist() { try { storage?.setItem(key(), JSON.stringify(state)); } catch {} changed(); }
  function write(action, row) {
    if (scope !== 'device') state.outbox[(action === 'save' || action === 'unsave' ? 'saved:' : 'history:') + row.videoId] = { action, ...row, sequence: ++sequence };
    persist();
  }
  load();
  return {
    get scope() { return scope; },
    get signedIn() { return scope !== 'device'; },
    setIdentity(uid) { const next = uid ? 'user:' + uid : 'device'; if (scope === next) return false; scope = next; state = null; load(); changed(); return true; },
    saved(id) { return Object.hasOwn(state.saved,id); },
    history(id) { return Object.hasOwn(state.history,id) ? state.history[id] : null; },
    rows(view) { return Object.values(state[view] || {}).filter(r => validId(r.videoId)).sort((a,b) => b.updatedAt - a.updatedAt); },
    save(id, title, wanted) {
      if (!validId(id)) return;
      const row = { videoId: id, title: String(title || id).slice(0,300), updatedAt: now() };
      if (wanted) state.saved[id] = row; else delete state.saved[id];
      write(wanted ? 'save' : 'unsave', row);
    },
    progress(row) {
      if (!validId(row.videoId) || !Number.isFinite(row.seconds) || row.seconds < 0 || row.seconds > 172800 || !['audio','video'].includes(row.mode)) return;
      const duration = Number.isFinite(row.duration) && row.duration > 0 && row.duration <= 172800 ? row.duration : 0;
      const value = { videoId: row.videoId, title: String(row.title || row.videoId).slice(0,300), seconds: row.seconds, duration, mode: row.mode, rate: row.rate >= 0.25 && row.rate <= 4 ? row.rate : 1,
        completed: row.completed === true || (duration > 0 && row.seconds >= duration - Math.min(10, duration * 0.02)), updatedAt: now() };
      state.history[row.videoId] = value;
      const ordered = Object.values(state.history).sort((a,b) => b.updatedAt-a.updatedAt);
      for (const old of ordered.slice(2000)) delete state.history[old.videoId];
      write('progress', value);
    },
    removeHistory(id) { delete state.history[id]; write('removeHistory', { videoId: id, updatedAt: now() }); },
    clearHistory() { state.history = {}; for (const k of Object.keys(state.outbox)) if (k.startsWith('history:')) delete state.outbox[k]; if (scope !== 'device') state.outbox['history:clear'] = { action: 'clearHistory', updatedAt: now(), sequence: ++sequence }; persist(); },
    replaceSaved(replacements,titleFor=id=>id) {
      let dirty=false;
      for(const [from,to] of replacements){if(!validId(from)||!validId(to)||from===to)continue;
        const old=state.saved[from],current=state.saved[to];
        if(old){if(!current||old.updatedAt>current.updatedAt)state.saved[to]={...old,videoId:to,title:String(titleFor(to)||old.title||to).slice(0,300)};delete state.saved[from];dirty=true;}
        const key='saved:'+from,op=state.outbox[key],next=state.outbox['saved:'+to];
        if(op){if(!next||op.updatedAt>next.updatedAt||(op.updatedAt===next.updatedAt&&op.sequence>next.sequence))state.outbox['saved:'+to]={...op,videoId:to,title:String(titleFor(to)||op.title||to).slice(0,300),sequence:++sequence};delete state.outbox[key];const winner=state.outbox['saved:'+to];if(winner?.action==='unsave')delete state.saved[to];else if(winner?.action==='save'&&!state.saved[to])state.saved[to]={videoId:to,title:winner.title,updatedAt:winner.updatedAt};dirty=true;}
        // Edited uploads have a different timeline. Never send old live progress into them.
        if(state.outbox['history:'+from]?.action==='progress'){delete state.outbox['history:'+from];dirty=true;}
      }
      if(dirty)persist();return dirty;
    },
    pending() { return Object.entries(state.outbox); },
    acknowledge(k, op) { if (state.outbox[k] === op) { delete state.outbox[k]; persist(); } },
    hydrate(view, rows) {
      const pending = new Map(Object.values(state.outbox).filter(op => view === 'saved' ? ['save','unsave'].includes(op.action) : ['progress','removeHistory'].includes(op.action)).map(op => [op.videoId,op]));
      const next = {};
      for (const r of rows) if (validId(r.videoId) && !pending.has(r.videoId) && !(view === 'history' && state.outbox['history:clear'])) next[r.videoId] = r;
      for (const [id] of pending) if (state[view][id]) next[id] = state[view][id];
      state[view] = next; persist();
    },
    acceptSaved(id, wanted, title) { if (!validId(id) || state.outbox['saved:'+id]) return; if(wanted)state.saved[id] = state.saved[id] || {videoId:id,title:title || id,updatedAt:now()};else delete state.saved[id];persist(); },
    mergeRows(view, rows) { const merged = new Map(this.rows(view).map(r=>[r.videoId,r])); for(const r of rows)if(!merged.has(r.videoId)||r.updatedAt>=merged.get(r.videoId).updatedAt)merged.set(r.videoId,r);this.hydrate(view,[...merged.values()]); },
    acceptHistory(row) { if (!row || !validId(row.videoId)) return; const local = state.history[row.videoId]; if (!local || (!state.outbox['history:' + row.videoId] && row.updatedAt > local.updatedAt)) { state.history[row.videoId] = row; persist(); } }
  };
}
