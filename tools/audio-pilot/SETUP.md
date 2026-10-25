# Public and member listening pilot

For bulk imports and future recordings, use [the audio library importer](../audio-library/README.md). It supports reviewed matching, resumable batches, preserved AAC extraction, verified private R2 uploads, and catalogue registration. This pilot remains the original comparison workflow.

Five member recordings and one public recording use the preserved AAC 128 kbps stereo audio. The bucket stays private. Visitors can list and play recordings explicitly marked `public` in the server catalogue without signing in. Additional member recordings require approved, verified church membership. The user confirmed member playback, phone background/lock-screen playback, and guest playback of `R42uVd9spDw`. See `PUBLIC-RECORDING.md`.

## Main website integration

Video cards, the featured homepage teaching, and the Watch page offer Watch/Listen mode buttons for recordings with available audio. The same viewport changes between a visible YouTube player and a native audio player. Switching pauses the outgoing source, transfers its current content timestamp and supported speed, and preserves playing/paused state. YouTube is controlled through the official IFrame API (`getCurrentTime`, `pauseVideo`, `seekTo`, `playVideo`); it stays paused while audio plays. Rapid changes cancel stale loads. Category copies contain previews, not duplicated active players or audio sources.

`/Listen/?v=VIDEO_ID` selects the matching accessible recording in the audio library. Its Watch/Listen toggle also works inside the same viewport. The homepage links to this library for browsing. Availability and audio links are fetched from the server for the current audience; signed URLs and private catalogue metadata are not written to persistent storage. Only listening position and rate are saved. Signing out clears member controls and playback; late responses cannot restore them. Playback continues with the screen locked in audio mode, subject to browser support, but navigating to another page still ends that page's player.

Audio copies must align with the YouTube content timeline: these six files are untrimmed stream copies. Future recordings with trimmed intros or edited versions need an explicit time mapping before mode synchronization is enabled. YouTube seeking can land at a nearby keyframe; this is not frame-accurate editing synchronization.

These are website changes: sync through the usual GitHub Pages workflow. No Firebase deployment is needed for this integration alone. Future audio catalogue changes still require deploying `getChurchAudio`. The original `/audio-pilot/` remains available for comparison.

## Connect storage

1. Create an R2 API token named `lightcity-audio-playback`, with **Object Read only**, scoped only to `lightcity-audio`. Keep its Access Key ID and Secret Access Key private. Do not put credentials in Git, chat or screenshots.
2. From `tools/members`, enter credentials into Firebase's hidden prompts:

```powershell
firebase functions:secrets:set R2_AUDIO_ACCESS_KEY_ID --project perceptive-zoo-424115-j6
firebase functions:secrets:set R2_AUDIO_SECRET_ACCESS_KEY --project perceptive-zoo-424115-j6
```

3. Deploy only the new function. If prompted, supply the Cloudflare Account ID (32 hexadecimal characters) for `R2_AUDIO_ACCOUNT_ID`, and `lightcity-audio` for `R2_AUDIO_BUCKET`. These two settings are not secret. Never supply an API key as the Account ID.

```powershell
$env:FUNCTIONS_DISCOVERY_TIMEOUT = "60"
firebase deploy --only functions:lightcity-members:getChurchAudio --project perceptive-zoo-424115-j6
```

4. Sync the website changes through the usual GitHub Pages publishing process. Visit `/audio-pilot/` on the local or live site. Keep the bucket public access disabled.

The bucket CORS policy allows GET/HEAD from the apex/www site and `http://localhost:4000`, with `Range` allowed and `Accept-Ranges`, `Content-Range`, `Content-Length`, `ETag` exposed. No domain/DNS change is needed. R2 credentials are attached only to the new function.

## Verify on actual phones

- Approved member: five titles load; each plays and seeks; sound is acceptable.
- Guest or unapproved account: only public recordings appear and play; direct requests for member audio are denied.
- Switch apps, lock the screen, resume using lock-screen controls; test Samsung Internet, Chrome/installed PWA and Safari where available. Support depends on browser and OS.
- Try speed changes, a long listening session, lost/restored connectivity, and reload/resume. Only playback position and rate are saved locally; signed links stay in memory.
- Sign out in another tab: playback stops when the existing membership listener reports sign-out. Navigating away stops this separate pilot player.

## Access and costs

Requests for member catalogues and member playback check current Firebase account verification, disabled status and active church membership on the server. Public listings return only explicitly public entries, and public playback needs no sign-in. Only keys in `functions/audio-catalog.json` can be signed; clients cannot choose storage paths or change visibility. Unknown visibility values cannot be publicly listed. The audio is streamed directly from private R2 using an eight-hour signed GET link, long enough for the longest pilot recording at half speed.

When adding an audio recording, copy its visibility from the authoritative website video lists. Do not change member content to public just to fill the pilot. Public audio still uses the read-only server credential and private bucket; no public R2 bucket is required.

Anyone holding an issued link can use it until it expires, including after membership is revoked. This is temporary access, not DRM; revocation blocks new links. Do not log or persist these URLs. The page title/noindex are not access controls.

The measured five files total about 720 MB. Roughly 1,000 similar recordings would occupy 144 GB; ongoing uploads require extending the approved catalogue and uploading matching files. This pilot does not yet automate future ingestion. R2 storage/requests and Firebase callable requests may incur usage charges.

## Local checks

```powershell
node tools/test-audio-pilot.mjs
node tools/test-members.mjs
node tools/test-member-client.mjs
```

Offline checks verify authorization and URL signing; they do not confirm live R2 permissions/CORS or phone background playback.
