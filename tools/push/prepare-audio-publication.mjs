import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { writeFile, appendFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { refreshVideoTitles } from '../video-title-refresh.mjs';
import { loadVideoLibrary, categoryMatcher } from '../video-library.mjs';
import { loadReplacements, reconcileReplacements } from '../video-replacements.mjs';
import { audioReadyPublication } from '../audio-library/publication-gate.mjs';

export async function preparePublication({ root, previous, desired, recordings, live, declared, revision, intent, force = false, output = async () => {} }) {
  const intended = reconcileReplacements(intent?.videos || previous.videos, desired, declared).videos;
  const plan = audioReadyPublication(previous.videos, intended, { recordings, live, planned: true });
  const changed = JSON.stringify(plan.videos) !== JSON.stringify(previous.videos);
  const publish = force || changed || previous.revision !== revision;
  if (publish) {
    await mkdir(join(root, 'tools/audio-library/work'), { recursive: true });
    await writeFile(join(root, 'tools/audio-library/work/publication.json'), JSON.stringify({ videos: plan.videos }));
    // These are build-only copies. The checkout is disposable; the user's source
    // ID files remain desired input for the Windows helper and later builds.
    for (const audience of ['public', 'members']) await writeFile(join(root, `_includes/video-ids-${audience}.txt`), plan.videos.filter(v => (v.visibility === 'public' ? 'public' : 'members') === audience).map(v => v.id).join('\n') + '\n');
    // Only public-source/public-destination aliases belong in the public artifact.
    const aliases = plan.videos.filter(v => v.visibility === 'public').flatMap(v => (v.replaces || []).filter(from => v.replacementVisibility?.[from] === 'public').map(from => ({ from, to: v.id, visibility: 'public' })));
    await writeFile(join(root, '_data/video_replacements.json'), JSON.stringify(aliases, null, 2) + '\n');
    // Members aliases and IDs must not leak through Jekyll's public site.data.
    await writeFile(join(root, '_data/videos.json'), JSON.stringify(plan.videos.map(({replaces, replacementVisibility, ...v}) => v), null, 2) + '\n');
  }
  await output(`publish=${publish}\npending=${plan.pending.length}\n`);
  return { ...plan, publish, intended };
}

async function main() {
  if (process.env.GITHUB_ACTIONS !== 'true') throw Error('This prepares a disposable GitHub Actions checkout only.');
  const root = fileURLToPath(new URL('../..', import.meta.url));
  let desired = await loadVideoLibrary(root);
  const declared = await loadReplacements(root);
  const credential = cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
  initializeApp({ credential });
  const db = getFirestore();
  const snapshot = await db.doc('churchVideoLibrary/current').get();
  const intent = await db.doc('churchVideoLibrary/desired').get();
  if (!snapshot.exists) throw Error('Publish the existing library baseline before enabling this workflow.');
  let playbackKey = process.env.LIVE_AUDIO_PLAYBACK_KEY;
  if (!playbackKey) {
    const project = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT).project_id;
    const token = await credential.getAccessToken();
    const response = await fetch(`https://secretmanager.googleapis.com/v1/projects/${project}/secrets/LIVE_AUDIO_PLAYBACK_KEY/versions/latest:access`, {
      headers: { Authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(20000), redirect: 'error'
    });
    if (!response.ok) throw Error('Cannot read the playback key. Grant the GitHub service account Secret Manager Secret Accessor on LIVE_AUDIO_PLAYBACK_KEY, or add that key as a GitHub Actions secret.');
    playbackKey = Buffer.from((await response.json()).payload.data, 'base64').toString('utf8').trim();
  }
  if (!/^[a-f0-9]{64}$/.test(playbackKey)) throw Error('Invalid playback key configuration.');
  const origin = new URL(process.env.LIVE_AUDIO_GATEWAY || 'https://lightcity-live-audio-test.lightcityteachingfellowship.workers.dev');
  if (origin.protocol !== 'https:' || !origin.hostname.endsWith('.workers.dev') || origin.pathname !== '/') throw Error('Invalid audio gateway origin.');
  const catalogue = async path => {
    const response = await fetch(new URL(path, origin), { headers: { Authorization: `Bearer ${playbackKey}` }, signal: AbortSignal.timeout(30000), redirect: 'error' });
    if (!response.ok) throw Error('Audio readiness could not be verified. The existing deployment is preserved.');
    const body = await response.json();
    if (!Array.isArray(body.recordings)) throw Error('Invalid readiness catalogue.');
    return body.recordings;
  };
  const [recordings, live] = await Promise.all([catalogue('/recordings/catalog'), catalogue('/catalog')]);
  const titleRef = db.doc('churchVideoLibrary/titleMetadata');
  const savedTitles = await titleRef.get();
  const refreshed = await refreshVideoTitles(desired, savedTitles.exists ? savedTitles.data() : {}, { apiKey: process.env.YOUTUBE_DATA_API_KEY || '', classify: await categoryMatcher() });
  desired = refreshed.videos;
  if (process.env.PUBLICATION_VALIDATE_ONLY !== 'true' && refreshed.refreshed) {
    await titleRef.set(refreshed.cache);
    console.log(`Daily titles checked: ${refreshed.successes} refreshed; ${refreshed.failures} unavailable titles kept their previous values.`);
  }
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const plan = await preparePublication({ root, previous: snapshot.data(), desired, recordings, live, declared, revision, intent: intent.exists ? intent.data() : null, force: process.env.FORCE_PUBLICATION === 'true',
    output: text => process.env.GITHUB_OUTPUT ? appendFile(process.env.GITHUB_OUTPUT, text) : Promise.resolve() });
  if (process.env.PUBLICATION_VALIDATE_ONLY !== 'true') await db.doc('churchVideoLibrary/desired').set({ videos: plan.intended, revision });
  console.log(`Audio-ready publishing: ${plan.videos.length} available; ${plan.pending.length} waiting. ${plan.publish ? 'Build required.' : 'No publication changes.'}`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
