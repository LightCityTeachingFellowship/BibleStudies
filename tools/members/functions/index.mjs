import {createAdminUsers} from './admin-users.mjs';
import {publishAudioReadyVideo} from './helper-publication.mjs';
import {createStreamReports,notifyStreamReport} from './stream-reports.mjs';
import {createStudioTests} from './studio-tests.mjs';
import {syncStudioBackup} from './studio-removal.mjs';
import {createDirectPublishing} from './direct-publishing.mjs';
import {finishDirectPublication} from './direct-notifications.mjs';
import {publicVideoLibrary} from './direct-library.mjs';
import {serveVideoShare} from './video-share.mjs';
import {getMessaging} from 'firebase-admin/messaging';
import {onDocumentWritten} from 'firebase-functions/v2/firestore';
import {onSchedule} from 'firebase-functions/v2/scheduler';
import {githubPublisher,createStudioPublishing,validHelperBearer,markStudioSelection} from './studio-publishing.mjs';
import { createAdminDashboard } from './admin.mjs';
import { createReadingActivity } from './reading-activity.mjs';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import { createMemberHandlers } from './core.mjs';
import { createVideoActivity } from './video-activity.mjs';
import { createAudioSigner, createAudioCredentialCheck, checkAudioLink } from './audio.mjs';
import { createLiveAudio } from './live-audio.mjs';
import { createRecordedCatalog } from './recorded-catalog.mjs';
import { readFileSync } from 'node:fs';
initializeApp();
const registrationCode = defineSecret('CHURCH_REGISTRATION_CODE');
const r2Account = defineString('R2_AUDIO_ACCOUNT_ID');
const r2Bucket = defineString('R2_AUDIO_BUCKET', { default: 'lightcity-audio' });
const r2Access = defineSecret('R2_AUDIO_ACCESS_KEY_ID');
const r2Secret = defineSecret('R2_AUDIO_SECRET_ACCESS_KEY');
const livePlaybackKey = defineSecret('LIVE_AUDIO_PLAYBACK_KEY');
const liveGateway = defineString('LIVE_AUDIO_GATEWAY', { default: 'https://lightcity-live-audio-test.lightcityteachingfellowship.workers.dev' });
const live = createLiveAudio(() => ({ origin: liveGateway.value(), secret: livePlaybackKey.value() }));
const audioConfig = () => ({ accountId: r2Account.value(), bucket: r2Bucket.value(), accessKeyId: r2Access.value(), secretAccessKey: r2Secret.value() });
const audio = {
  credentials: createAudioCredentialCheck(audioConfig),
  check: checkAudioLink,
  catalog: createRecordedCatalog(() => ({ origin: liveGateway.value(), secret: livePlaybackKey.value() }), {
    staticCatalog: JSON.parse(readFileSync(new URL('./audio-catalog.json', import.meta.url), 'utf8')),
    library: async () => { const snapshot = await getFirestore().doc('churchVideoLibrary/current').get(); return snapshot.exists ? snapshot.data()?.videos : null; }
  }),
  sign: createAudioSigner(audioConfig)
};
const handlers = createMemberHandlers({ audio, live, auth: getAuth(), db: getFirestore(), secret: () => registrationCode.value(), fail: HttpsError, stamp: () => FieldValue.serverTimestamp() });
// Browsers must reach the callable handler; it verifies Firebase identity and church membership.
const options = { invoker: 'public', region: 'us-central1', maxInstances: 5, cors: ['https://lightcityfellowship.com', 'https://www.lightcityfellowship.com', 'https://lightcityteachingfellowship.github.io', /^http:\/\/localhost(:\d+)?$/] };
export const registerChurchMember = onCall({ ...options, secrets: [registrationCode] }, handlers.registerChurchMember);
export const getChurchLibrary = onCall(options, handlers.getChurchLibrary);
export const linkChurchDevice = onCall(options, handlers.linkChurchDevice);
export const unlinkChurchDevice = onCall(options, handlers.unlinkChurchDevice);

export const registerGoogleChurchMember = onCall({ ...options, secrets: [registrationCode] }, handlers.registerGoogleChurchMember);

export const getChurchAudio = onCall({ ...options, secrets: [r2Access, r2Secret, livePlaybackKey] }, handlers.getChurchAudio);
export const getChurchLiveAudio = onCall({ ...options, secrets: [livePlaybackKey] }, handlers.getChurchLiveAudio);

const activity = createVideoActivity({ auth: getAuth(), db: getFirestore(), fail: HttpsError });
export const getVideoReplacements = onCall(options, activity.getVideoReplacements);
export const getMyVideoActivity = onCall(options, activity.getMyVideoActivity);
export const updateMyVideoActivity = onCall(options, activity.updateMyVideoActivity);

const readingActivity = createReadingActivity({auth:getAuth(),db:getFirestore(),fail:HttpsError,privateCatalog:JSON.parse(readFileSync(new URL('./reading-private-catalog.json',import.meta.url),'utf8')).publications});
export const getMyReadingActivity = onCall(options, readingActivity.getMyReadingActivity);
export const updateMyReadingActivity = onCall(options, readingActivity.updateMyReadingActivity);

const adminEmails = defineString('CHURCH_ADMIN_EMAILS', { default: 'lightcityteachingfellowship@gmail.com' });
const adminDashboard = createAdminDashboard({ auth:getAuth(), db:getFirestore(), fail:HttpsError, emails:()=>adminEmails.value(), audio:audio.catalog, live,
 privateReadings:JSON.parse(readFileSync(new URL('./reading-private-catalog.json',import.meta.url),'utf8')).publications });
export const getChurchAdminDashboard = onCall({ ...options, secrets:[livePlaybackKey] }, adminDashboard);
export const getChurchAdminUsers=onCall(options,createAdminUsers({auth:getAuth(),db:getFirestore(),fail:HttpsError,emails:()=>adminEmails.value()}));
const studioGitHubToken=defineSecret('STUDIO_GITHUB_TOKEN');
const studioGitHub=githubPublisher({token:()=>studioGitHubToken.value()});
const legacyStudioPublishing=createStudioPublishing({auth:getAuth(),db:getFirestore(),fail:HttpsError,emails:()=>adminEmails.value(),github:studioGitHub});
const studioPublishing=createDirectPublishing({auth:getAuth(),db:getFirestore(),fail:HttpsError,emails:()=>adminEmails.value(),live,recordings:()=>audio.catalog.registered()});
const studioTests=createStudioTests({auth:getAuth(),db:getFirestore(),fail:HttpsError,emails:()=>adminEmails.value(),messaging:getMessaging()});
export const manageChurchStudioTest=onCall(options,studioTests.manage);
export const publishChurchStudioVideo=onCall({...options,secrets:[livePlaybackKey,studioGitHubToken],timeoutSeconds:180},request=>request.data?.visibility==='test'?studioTests.publish(request):request.data?.direct===true?studioPublishing.publish(request):legacyStudioPublishing.publish(request));
export const removeChurchStudioVideo=onCall(options,request=>studioPublishing.remove(request));
export const getChurchStudioPublication=onCall({...options,secrets:[livePlaybackKey]},request=>request.data?.visibility==='test'?studioTests.status(request):studioPublishing.status(request));
// Only the trusted local upload helper can read the desired source lists.

export const getStudioHelperLibrary=onRequest({...options,secrets:[studioGitHubToken,livePlaybackKey]},async(req,res)=>{

 res.set('Cache-Control','no-store');
 if(req.method!=='POST'||!validHelperBearer(req.get('authorization'),livePlaybackKey.value())){res.status(403).json({error:'Access denied'});return;}
 try{
  if(req.body?.removeVideoId){
   await studioPublishing.removeFromHelper(req.body.removeVideoId,req.body.expectedVersion);
   res.json(await studioPublishing.listState());return;
  }
  if(req.body?.publishReady){
   const id=req.body.publishReady;if(!/^[\w-]{11}$/.test(id)){res.status(400).json({error:'Invalid video ID'});return;}
   res.json(await publishAudioReadyVideo(id,{db:getFirestore(),studio:studioPublishing,recordings:()=>audio.catalog.registered(),kick:()=>studioGitHub.kick()}));
   return;
  }
  const [state,requests]=await Promise.all([studioPublishing.listState(),getFirestore().collection('churchStudioPublications').orderBy('requestedAt','desc').limit(1).get()]);
  res.json({...state,videos:markStudioSelection(state.videos,requests.docs[0]?.data())});
 }catch(error){res.status(error.code==='aborted'?409:503).json({error:error.code==='aborted'?'Video changed; refresh the local lists.':'Source library unavailable'});}
});
export const getPublicVideoLibrary=onCall(options,async()=>({videos:await publicVideoLibrary(getFirestore())}));
export const shareChurchVideo=onRequest({...options,cors:false},(req,res)=>serveVideoShare(req,res,getFirestore()));
export const finishStudioPublication=onDocumentWritten({document:'churchStudioPublications/{videoId}',region:'us-central1',secrets:[studioGitHubToken],retry:true,timeoutSeconds:180,maxInstances:3},async event=>{
  const after=event.data?.after.data(),before=event.data?.before.data();
 if(after?.state==='removed'){
  if(before?.state==='removed'&&before?.operationId===after.operationId)return;
  await syncStudioBackup({id:event.params.videoId,db:getFirestore(),github:studioGitHub});return;
 }
 if(after?.state!=='ready'||before?.state==='ready')return;
 await finishDirectPublication({id:event.params.videoId,db:getFirestore(),auth:getAuth(),messaging:getMessaging(),github:studioGitHub});
});
export const checkStudioAudioReady=onSchedule({schedule:'every 1 minutes',region:'us-central1',secrets:[livePlaybackKey],timeoutSeconds:120,maxInstances:1},async()=>{
 const pending=await getFirestore().collection('churchStudioPublications').where('state','==','pending').limit(100).get();
 for(const job of pending.docs.sort((a,b)=>(b.data().requestedAt||0)-(a.data().requestedAt||0)).slice(0,10))try{await studioPublishing.promote(job.id);}catch{console.warn('Studio audio readiness will retry.');}
});
const streamStatusKey=defineSecret('YOUTUBE_STREAM_STATUS_KEY');
const streamReports=createStreamReports({auth:getAuth(),db:getFirestore(),fail:HttpsError,emails:()=>adminEmails.value(),key:()=>streamStatusKey.value().trim(),live});
export const reportChurchStreamIssue=onCall({...options,secrets:[streamStatusKey,livePlaybackKey],timeoutSeconds:60},streamReports.submit);
export const getChurchStreamReports=onCall(options,streamReports.inbox);
export const resolveChurchStreamReport=onCall(options,streamReports.resolve);
export const notifyChurchStreamIssueOnWrite=onDocumentWritten({document:'churchStudioPublications/stream-issues/reports/{reportId}',region:'us-central1',retry:true,timeoutSeconds:120,maxInstances:1},async event=>{
 const after=event.data?.after.data(),before=event.data?.before.data();if(!after||after.resolved||after.delivery!=='pending'||before?.delivery==='pending')return;
 await notifyStreamReport({id:event.params.reportId,db:getFirestore(),auth:getAuth(),messaging:getMessaging(),emails:()=>adminEmails.value()});
});