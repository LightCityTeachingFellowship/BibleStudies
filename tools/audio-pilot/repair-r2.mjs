import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { repairCredentials } from './repair-core.mjs';
import { createAudioSigner, checkAudioLink } from '../members/functions/audio.mjs';
function firstJson(text) {
  for (let i = 0; i < text.length; i++) if (text[i] === '}') {
    try { return JSON.parse(text.slice(0, i + 1)); } catch {}
  }
  return null;
}
try {
  let input = '';
  for await (const chunk of process.stdin) { input += chunk; if (input.length > 10000) throw Error('INPUT'); }
  const config = Object.fromEntries(Object.entries(JSON.parse(input)).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));
  input = '';
  if (config.accountId !== 'af76ef1278d731ac5487d733c0d44cd0' || config.bucket !== 'lightcity-audio') throw Error('INPUT');
  await repairCredentials(config, {
    verify: async settings => {
      const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${settings.accountId}/tokens/verify`, { headers: { Authorization: 'Bearer ' + settings.apiTokenValue }, redirect: 'error', signal: AbortSignal.timeout(15000) });
      const answer = await response.json();
      if (!answer.success) throw Error('TOKEN');
      console.log('Cloudflare token verified.');
      return answer.result;
    },
    read: async settings => {
      const signed = await createAudioSigner(() => settings)('audio/0xma1jqVwsg.m4a');
      const check = await checkAudioLink(signed.url);
      console.log(check.ok ? 'Corrected R2 read: OK.' : 'Corrected R2 read: failed (HTTP ' + Number(check.status) + '). Firebase unchanged.');
      return check;
    },
    save: async (name, value) => {
      const result = spawnSync('firebase.cmd', ['functions:secrets:set', name, '--data-file', '-', '--project', 'perceptive-zoo-424115-j6', '--json', '--non-interactive'], { shell: true, encoding: 'utf8', input: value, timeout: 90000, cwd: fileURLToPath(new URL('../members/', import.meta.url)) });
      const answer = firstJson(result.stdout || '');
      if (answer?.status !== 'success') {
        if (/Authentication Error|credentials are no longer valid/i.test((result.stdout || '') + (result.stderr || ''))) throw Error('LOGIN');
        throw Error('SAVE');
      }
      console.log('Saved ' + name + ' to Firebase.');
    }
  });
  console.log('Repair complete. Deploy getChurchAudio to load the corrected pair.');
} catch (error) {
  const messages = {
    INPUT: 'Input could not be read. Copy Access Key ID and Token value at the two hidden prompts.',
    TOKEN: 'Cloudflare could not verify a matching active token. Firebase was not changed.',
    READ: 'Storage still rejected the corrected credentials. Firebase was not changed.',
    LOGIN: 'Firebase sign-in needs refreshing. Run firebase login --reauth, then run this helper again.',
    SAVE: 'Firebase could not save the full pair. Run this helper again after checking Firebase access.'
  };
  console.log(messages[error.message] || 'The repair could not finish. No credential details have been displayed.');
  process.exitCode = 1;
}
