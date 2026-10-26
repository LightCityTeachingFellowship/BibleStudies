import {validResourceId} from './study-core.mjs';
export function createStudyStore({storage,now=Date.now,changed=()=>{}}={}){
 let scope='device',state,seq=0;
 const key=()=> 'lc-study-activity:v1:'+scope;
 function load(){try{state=JSON.parse(storage?.getItem(key()));}catch{}if(state?.version!==1)state={version:1,saved:{},history:{},outbox:{}};for(const v of ['saved','history','outbox'])if(!state[v]||Array.isArray(state[v])||typeof state[v]!=='object')state[v]={};}
 function persist(){try{storage?.setItem(key(),JSON.stringify(state));}catch{}changed();}
 function write(action,row={}){if(scope!=='device')state.outbox[action==='clearHistory'?'history:clear':(['save','unsave'].includes(action)?'saved:':'history:')+row.resourceId]={action,...row,sequence:++seq};persist();}
 load();
 return {get scope(){return scope;},get signedIn(){return scope!=='device';},setIdentity(uid){const next=uid?'user:'+uid:'device';if(scope===next)return;scope=next;state=null;load();changed();},
 saved:id=>Object.hasOwn(state.saved,id),history:id=>state.history[id]||null,rows:view=>Object.values(state[view]||{}).filter(r=>validResourceId(r.resourceId)).sort((a,b)=>b.updatedAt-a.updatedAt),pending:()=>Object.entries(state.outbox),
 save(id,wanted){if(!validResourceId(id))return;const row={resourceId:id,updatedAt:now()};if(wanted)state.saved[id]=row;else delete state.saved[id];write(wanted?'save':'unsave',row);},
 progress(row){if(!validResourceId(row.resourceId)||!Number.isFinite(row.fraction)||row.fraction<0||row.fraction>1||!Number.isInteger(row.section)||row.section<0||row.section>100000)return;const r={resourceId:row.resourceId,fraction:row.fraction,section:row.section,completed:row.completed===true,updatedAt:now()};state.history[r.resourceId]=r;for(const old of Object.values(state.history).sort((a,b)=>b.updatedAt-a.updatedAt).slice(2000))delete state.history[old.resourceId];write('progress',r);},
 removeHistory(id){delete state.history[id];write('removeHistory',{resourceId:id,updatedAt:now()});},clearHistory(){state.history={};for(const k of Object.keys(state.outbox))if(k.startsWith('history:'))delete state.outbox[k];write('clearHistory');},
 acknowledge(k,op){if(state.outbox[k]===op){delete state.outbox[k];persist();}},
 hydrate(view,rows){const pending=new Set(Object.values(state.outbox).filter(op=>view==='saved'?['save','unsave'].includes(op.action):['progress','removeHistory'].includes(op.action)).map(op=>op.resourceId));const next={};for(const r of rows)if(validResourceId(r.resourceId)&&!pending.has(r.resourceId)&&!(view==='history'&&state.outbox['history:clear']))next[r.resourceId]=r;for(const id of pending)if(state[view][id])next[id]=state[view][id];state[view]=next;persist();}
 };
}
