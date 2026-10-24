# Public and member listening pilot

Five member recordings use the preserved AAC 128 kbps stereo audio. The bucket stays private. The separate `/audio-pilot/` page is not linked in navigation. Visitors can list and play recordings explicitly marked `public` in the server catalogue without signing in. Additional member recordings require approved, verified church membership. All five current uploads remain members-only; a public recording still needs to be prepared and added before public listening can be tested live.

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
