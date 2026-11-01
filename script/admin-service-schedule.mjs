export function setupAdminServiceSchedule({document,window,api=()=>globalThis.LightCityMembers}={}){
 const get=id=>document.getElementById(id),panel=get('admin-service-panel');if(!panel)return;
 let schedule=null,owner=null,generation=0,busy=false,dirty=false;
 const status=message=>{get('admin-service-status').textContent=message;};
 const create=(tag,attrs={})=>{const el=document.createElement(tag);for(const [key,value]of Object.entries(attrs)){if(key==='text')el.textContent=value;else if(key==='value')el.value=value;else el.setAttribute(key,value);}return el;};
 function field(label,input){const wrap=create('label'),name=create('span',{text:label});wrap.append(name,input);return wrap;}
 function row(value){
  const item=create('div',{'class':'studio-service-row'}),name=create('input',{type:'text',maxlength:'80',required:'',value:value.name}),day=create('select'),time=create('input',{type:'time',required:'',value:value.time}),enabled=create('input',{type:'checkbox'});
  name.dataset.field='name';day.dataset.field='day';time.dataset.field='time';enabled.dataset.field='enabled';enabled.checked=value.enabled;item.dataset.serviceId=value.id;
  ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].forEach((label,index)=>day.append(create('option',{value:String(index),text:label})));day.value=String(value.day);
  const remove=create('button',{type:'button',text:'Remove','aria-label':'Remove this service time'});remove.addEventListener('click',()=>{item.remove();dirty=true;});
  item.append(field('Service',name),field('Day',day),field('Nigeria time',time),field('Enabled',enabled),remove);get('admin-service-weekly').append(item);
 }
 function render(value){
  schedule=value;dirty=false;get('admin-service-heading').value=value.heading;get('admin-service-message').value=value.message;get('admin-service-starting').value=value.startingMessage;get('admin-service-hold').value=value.holdMinutes;
  get('admin-service-weekly').replaceChildren();value.weekly.forEach(row);
  const override=value.override&&Date.parse(value.override.local+'+01:00')+value.holdMinutes*60000>Date.now()?value.override:null;get('admin-service-override').checked=!!override;get('admin-service-one-name').value=override?.name||'Special service';get('admin-service-one-time').value=override?.local||'';overrideFields();get('admin-service-form').hidden=false;
 }
 function overrideFields(){const on=get('admin-service-override').checked;get('admin-service-one-fields').hidden=!on;get('admin-service-one-name').required=on;get('admin-service-one-time').required=on;}
 function clear(){++generation;schedule=null;owner=null;dirty=false;busy=false;get('admin-service-save').disabled=false;get('admin-service-reload').disabled=false;get('admin-service-form').hidden=true;status('Open this section to load the service times.');}
 async function load(){if(busy)return;busy=true;const ticket=++generation,uid=api()?.user?.uid;
  try{await api()?.ready;if(!uid||api()?.user?.uid!==uid)return;if(!api().getServiceSchedule)throw Error();const result=await api().getServiceSchedule();if(ticket!==generation||api()?.user?.uid!==uid)return;owner=uid;render(result.schedule);status('All service times below are Nigeria time (WAT). Viewers see their own local time automatically.');}
  catch{if(ticket===generation)status('Service settings could not load. Deploy the service countdown functions if this is the first setup, then reload.');}
  finally{if(ticket===generation){busy=false;get('admin-service-reload').disabled=false;}}
 }
 panel.addEventListener('toggle',()=>{if(panel.open&&!schedule)void load();});
 get('admin-service-reload').addEventListener('click',()=>{if(dirty&&!window.confirm('Reload service times and discard your unsaved changes?'))return;void load();});
 get('admin-service-add').addEventListener('click',()=>{if(get('admin-service-weekly').children.length>=14){status('Use up to 14 weekly times.');return;}row({id:'service-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6),name:'Service',day:0,time:'08:00',enabled:true});dirty=true;});
 get('admin-service-form').addEventListener('input',()=>{dirty=true;});get('admin-service-override').addEventListener('change',overrideFields);
 get('admin-service-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!schedule||api()?.user?.uid!==owner)return;const ticket=generation,uid=owner;busy=true;get('admin-service-save').disabled=true;status('Saving service times…');
  const weekly=[...get('admin-service-weekly').children].map(item=>({id:item.dataset.serviceId,name:item.querySelector('[data-field="name"]').value,day:Number(item.querySelector('[data-field="day"]').value),time:item.querySelector('[data-field="time"]').value,enabled:item.querySelector('[data-field="enabled"]').checked}));
  const value={heading:get('admin-service-heading').value,message:get('admin-service-message').value,startingMessage:get('admin-service-starting').value,holdMinutes:Number(get('admin-service-hold').value),weekly,override:get('admin-service-override').checked?{name:get('admin-service-one-name').value,local:get('admin-service-one-time').value}:null};
  try{const result=await api().saveServiceSchedule(value,schedule.revision);if(ticket!==generation||api()?.user?.uid!==uid)return;render(result.schedule);status('Saved. Open countdown screens pick up changes within 30 seconds.');}
  catch(error){if(ticket===generation)status(error?.code==='functions/aborted'?'Another device changed the schedule. Reload before saving your changes.':error?.code==='functions/invalid-argument'?error.message:'Service times could not save. Your edits are kept; try again.');}
  finally{if(ticket===generation){busy=false;get('admin-service-save').disabled=false;}}
 });
 window.addEventListener('lightcity-members-changed',()=>{if(owner&&owner!==api()?.user?.uid)clear();if(panel.open&&!schedule)void Promise.resolve(api()?.ready).then(load);});clear();return {load,clear};
}
if(typeof document!=='undefined')setupAdminServiceSchedule({document,window});
