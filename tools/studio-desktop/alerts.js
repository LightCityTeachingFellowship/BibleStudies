const api=window.StudioAlerts,$=id=>document.getElementById(id);
let busy=new Set();
function action(id,type,value){$(id).onclick=()=>void api.action(type,value);}
action('open','open');action('copy','copy');action('dismiss','dismiss-ready');action('retry','retry');action('hide','hide');
for(const key of ['sound','alwaysOnTop','openAtLogin'])$(key).onchange=()=>void api.action('settings',{[key]:$(key).checked});
function node(tag,text,cls){const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;}
function ring(){try{const audio=new AudioContext();for(const [delay,freq]of [[0,660],[.22,880]]){const o=audio.createOscillator(),g=audio.createGain();o.connect(g);g.connect(audio.destination);o.frequency.value=freq;g.gain.setValueAtTime(.12,audio.currentTime+delay);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+delay+.25);o.start(audio.currentTime+delay);o.stop(audio.currentTime+delay+.3);}setTimeout(()=>void audio.close(),900);}catch{}}
api.onState(state=>{
 $('status').textContent=state.notice||(state.lastSync?'Last checked '+new Date(state.lastSync).toLocaleTimeString():'Sign in to Studio to receive alerts.');
 $('ready').hidden=!state.ready;if(state.ready){$('ready-title').textContent=state.ready.title;$('ready-url').value=state.ready.url;}
 $('empty').hidden=state.reports.length>0;$('reports').replaceChildren();
 for(const row of state.reports){const card=node('article'),h=node('h2',row.issue==='ended'?'Stream ended — confirmed':row.issue==='volume'?'Speaker volume request':'Stream message');card.append(h,node('p',row.title),node('p','From: '+row.sender,'sender'));if(row.message)card.append(node('p',row.message,'message'));card.append(node('small',new Date(row.createdAt).toLocaleString()+' · '+row.count+' report(s)'));const done=node('button','Mark handled','primary');done.disabled=busy.has(row.id);done.onclick=async()=>{busy.add(row.id);done.disabled=true;try{await api.action('handled',row.id);}finally{setTimeout(()=>{busy.delete(row.id);if(done.isConnected)done.disabled=false;},5000);}};card.append(node('div','','actions'));card.lastChild.append(done);$('reports').append(card);}
 for(const key of ['sound','alwaysOnTop','openAtLogin'])$(key).checked=state.settings[key];if(state.ring&&state.settings.sound)ring();
});
