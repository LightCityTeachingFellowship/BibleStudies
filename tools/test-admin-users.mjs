import assert from 'node:assert/strict';
import {createAdminUsers} from './members/functions/admin-users.mjs';
class Fail extends Error{constructor(code,message){super(message);this.code=code;}}
let owner={uid:'admin',email:'owner@example.com',emailVerified:true,providerData:[{providerId:'google.com'}]},calls=[],membershipReads=[];
const people=[{uid:'person1',displayName:'<script>Alice</script>',email:'alice@example.com',emailVerified:true,providerData:[{providerId:'google.com'}],metadata:{creationTime:'2026-01-01T00:00:00Z',lastSignInTime:'2026-10-29T07:00:00Z'},passwordHash:'PRIVATE',passwordSalt:'PRIVATE',customClaims:{admin:true}},
 {uid:'device',providerData:[],metadata:{lastSignInTime:'2026-10-29T07:00:00Z'}},
 {uid:'person2',email:'bob@example.com',emailVerified:false,disabled:true,providerData:[{}],metadata:{lastSignInTime:'invalid'}}];
const deps={fail:Fail,emails:()=>owner.email,auth:{getUser:async()=>owner,listUsers:async(size,token)=>{calls.push({size,token});return {users:people,pageToken:'next-page'};}},db:{doc:path=>({path}),getAll:async(...refs)=>{membershipReads.push(...refs.map(r=>r.path));return refs.map((_,i)=>({exists:i===0,data:()=>({active:true})}));}}};
const handler=createAdminUsers(deps),request={auth:{uid:'admin'},data:{accountUid:'admin'}};
await assert.rejects(handler({}),e=>e.code==='unauthenticated');assert.equal(calls.length,0);
await assert.rejects(handler({...request,data:{accountUid:'other'}}),e=>e.code==='permission-denied');
const allowedEmail=deps.emails;deps.emails=()=> 'different@example.com';const denied=createAdminUsers(deps);await assert.rejects(denied(request),e=>e.code==='permission-denied');assert.equal(calls.length,0);deps.emails=allowedEmail;
for(const patch of [{disabled:true},{emailVerified:false},{providerData:[]}]){const before=owner;owner={...owner,...patch};await assert.rejects(handler(request),e=>e.code==='permission-denied');owner=before;}
for(const token of ['',42,'x'.repeat(4097)])await assert.rejects(handler({...request,data:{pageToken:token}}),e=>e.code==='invalid-argument');assert.equal(calls.length,0);
const result=await handler(request);assert.equal(result.users.length,2,'anonymous notification identities are excluded');assert.deepEqual(membershipReads,['churchMembers/person1','churchMembers/person2']);assert.equal(result.users[0].membership,'active');assert.equal(result.users[1].membership,'none');assert.equal(result.users[1].disabled,true);assert.equal(result.users[1].lastSignInAt,null);assert.equal(result.users[0].lastSignInAt,Date.parse('2026-10-29T07:00:00Z'));assert.ok(!JSON.stringify(result).includes('PRIVATE'));assert.ok(!JSON.stringify(result).includes('customClaims'));assert.equal(result.nextPageToken,'next-page');
await handler({...request,data:{pageToken:'next-page'}});assert.deepEqual(calls.at(-1),{size:250,token:'next-page'});
const empty=createAdminUsers({...deps,auth:{...deps.auth,listUsers:async()=>({users:[{uid:'anon',providerData:[]}],pageToken:'next'})},db:{...deps.db,getAll:async()=>{throw Error('No member reads needed');}}});assert.equal((await empty(request)).nextPageToken,'next','anonymous-only pages must not hide following real accounts');
const removed=createAdminUsers({...deps,db:{...deps.db,getAll:async(...refs)=>refs.map(()=>({exists:true,data:()=>({active:false})}))}});assert.equal((await removed(request)).users[0].membership,'removed');
console.log('PASS: server admin authorization before directory reads, pagination, anonymous-device exclusion, membership state, date parsing and no password/claims leakage.');
