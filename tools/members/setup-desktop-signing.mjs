import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
// Use the already signed-in Firebase CLI privately; never print or write access tokens.
const modulePath=process.argv[2],configure=process.argv.includes('--configure');
const project='perceptive-zoo-424115-j6',account='792419084813-compute@developer.gserviceaccount.com';
try{
 if(!modulePath)throw Error('Firebase CLI location is missing. Run deploy-studio-desktop.ps1.');
 const cli=createRequire(import.meta.url)(resolve(modulePath));
 const signed=cli.getProjectDefaultAccount(resolve(dirname(fileURLToPath(import.meta.url))))||cli.getGlobalDefaultAccount();
 if(!signed?.tokens?.refresh_token)throw Error('Run firebase login, then try again.');
 cli.setActiveAccount({},signed);
 const credentials=await cli.getAccessToken(signed.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform']);
 if(!credentials?.access_token)throw Error('Firebase login needs to be refreshed. Run firebase login --reauth.');
 async function request(url,body){const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+credentials.access_token,'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(30000)});if(!response.ok){await response.body?.cancel();throw Error('Google Cloud setup returned HTTP '+response.status+'. Your account needs permission to manage this project’s service-account signing.');}return response.json();}
 if(configure)for(const service of ['iam.googleapis.com','iamcredentials.googleapis.com'])await request('https://serviceusage.googleapis.com/v1/projects/'+project+'/services/'+service+':enable',{});
 const resource='https://iam.googleapis.com/v1/projects/-/serviceAccounts/'+account;
 const policy=await request(resource+':getIamPolicy',{options:{requestedPolicyVersion:3}}),role='roles/iam.serviceAccountTokenCreator',member='serviceAccount:'+account;
 const binding=policy.bindings?.find(b=>b.role===role&&!b.condition);
 if(binding?.members.includes(member)){console.log('Windows sign-in token signing is already configured.');process.exitCode=0;}
 else if(!configure)throw Error('Windows sign-in token signing needs one-time setup.');
 else{
  const bindings=policy.bindings||[];if(binding)binding.members.push(member);else bindings.push({role,members:[member]});
  await request(resource+':setIamPolicy',{policy:{...policy,bindings}});
  console.log('Configured token signing on the existing runtime service account only.');
 }
}catch(error){console.error(error.message||'Desktop signing setup failed.');process.exitCode=1;}
