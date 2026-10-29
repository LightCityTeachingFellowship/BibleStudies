export function setupAdminUsers({document,api=()=>globalThis.LightCityMembers}){
 const get=id=>document.getElementById(id),panel=get('admin-users-panel');if(!panel)return null;
 const list=get('admin-users-list'),status=get('admin-users-status'),search=get('admin-users-search'),filter=get('admin-users-filter'),refresh=get('admin-users-refresh'),more=get('admin-users-more');
 let users=[],version=0,limit=50,loading=false,owner=null;
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const date=value=>value?new Date(value).toLocaleString():'Not available';
 function clear(){++version;users=[];owner=null;loading=false;list.replaceChildren();status.textContent='Open this section to load signed-in accounts.';search.value='';filter.value='all';refresh.disabled=false;more.hidden=true;limit=50;}
 function render(){
  const q=search.value.trim().toLocaleLowerCase(),mode=filter.value;
  const selected=users.filter(u=>(mode==='all'||mode==='members'&&u.membership==='active'||mode==='others'&&u.membership!=='active'||mode==='disabled'&&u.disabled)&&(!q||[u.name,u.email].some(v=>v.toLocaleLowerCase().includes(q))));
  list.replaceChildren();more.hidden=selected.length<=limit;
  status.textContent=loading?'Loading signed-in accounts… '+users.length+' found so far.':users.length+' signed-in accounts · '+selected.length+' matching'+(selected.length?' · Showing '+Math.min(limit,selected.length):'');
  for(const u of selected.slice(0,limit)){
   const row=node('article',undefined,'studio-person'),identity=node('div',undefined,'studio-person-identity');
   identity.appendChild(node('h3',u.name||u.email||'Account without a display name'));identity.appendChild(node('p',u.email||'No email address'));
   const badges=node('div');badges.appendChild(node('span',u.membership==='active'?'Church member':u.membership==='removed'?'Church access removed':'Other signed-in account','studio-badge'));
   if(u.email)badges.appendChild(node('span',u.emailVerified?'Email verified':'Email not verified','studio-badge'));
   if(u.disabled)badges.appendChild(node('span','Account disabled','studio-badge pending'));identity.appendChild(badges);row.appendChild(identity);
   const dates=node('dl',undefined,'studio-person-dates');for(const [label,value]of [['Last sign-in',u.lastSignInAt],['Account created',u.createdAt]]){const pair=node('div');pair.appendChild(node('dt',label));pair.appendChild(node('dd',date(value)));dates.appendChild(pair);}row.appendChild(dates);list.appendChild(row);
  }
  if(!loading&&!selected.length)list.appendChild(node('p',q||mode!=='all'?'No accounts match this search.':'No signed-in accounts found.','muted'));
 }
 async function load(){
  if(!panel.open)return;
  const ticket=++version,uid=api()?.user?.uid;if(!uid){clear();return;}owner=uid;users=[];limit=50;loading=true;refresh.disabled=true;render();
  const seenUsers=new Map(),tokens=new Set();let pageToken;
  try{
   do{
    const result=await api().getAdminUsers(pageToken?{pageToken}:{});if(ticket!==version||api()?.user?.uid!==uid)return;
    for(const user of result.users)seenUsers.set(user.uid,user);
    users=[...seenUsers.values()].sort((a,b)=>(b.lastSignInAt||0)-(a.lastSignInAt||0)||(a.name||a.email).localeCompare(b.name||b.email));render();
    pageToken=result.nextPageToken;if(pageToken){if(tokens.has(pageToken))throw Error('Repeated account page');tokens.add(pageToken);}
   }while(pageToken);
   loading=false;render();
  }catch{
   if(ticket!==version||api()?.user?.uid!==uid)return;users=[];list.replaceChildren();more.hidden=true;status.textContent='The account list could not load. Refresh this section to retry. If this is your first use, deploy the updated admin services.';
  }finally{if(ticket===version){loading=false;refresh.disabled=false;}}
 }
 panel.addEventListener('toggle',()=>{if(panel.open&&!loading&&!owner)void load();});
 refresh.addEventListener('click',()=>void load());search.addEventListener('input',()=>{limit=50;render();});filter.addEventListener('change',()=>{limit=50;render();});more.addEventListener('click',()=>{limit+=50;render();});
 clear();return {clear,load};
}
