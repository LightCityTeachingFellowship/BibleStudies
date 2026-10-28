# Studio publishing: one-time connection

Studio can add a new video ID to the members/public source file and commit directly to master. Only the configured, verified admin Google account can submit or check publication. A repository-scoped GitHub token stays in Firebase Secret Manager; it is never sent to the browser or stored in Git.

## Activate

1. Create a fine-grained GitHub personal access token. Select resource owner LightCityTeachingFellowship, repository BibleStudies ONLY, and repository Contents: Read and write (Metadata read is implicit). Use an expiry you can renew. Organization approval may be required. Actions must already be enabled with AUDIO_READY_PUBLISHING=true. Branch rules must permit this account's normal fast-forward commits; Studio never force-pushes or bypasses protection.
2. Run tools/members/setup-studio-publishing.ps1 in PowerShell. Paste the token only into its hidden prompt. Never paste it into chat.
3. Run tools/members/deploy-studio-publishing.ps1. This deploys publishChurchStudioVideo, getChurchStudioPublication, and getStudioHelperLibrary. Keep the existing LIVE_AUDIO_PLAYBACK_KEY; do not generate a new one.
4. Commit and sync these website changes. Pull the latest changes before editing ID files locally after using Studio, because Studio now creates remote commits.
5. Restart the existing recorded helper with tools/audio-library/resume-new-uploads.ps1, and stop/start the next OBS stream so its helper loads the new code. OBS settings do not change.

## Daily flow

Start the normal OBS stream. The helper attempts to find a single live stream on the configured YouTube channel through the official YouTube Data API and copy its YouTube link to the Windows clipboard. It does not read Studio browser tabs or access cookies. Unlisted streams, simultaneous streams, newly starting streams not yet visible in the API, or quota/network failures may require the usual manual Copy link in YouTube Studio. No guessed link is copied.

Open Studio, paste the link, choose Church members (default) or Everyone, then Publish and prepare link. The backend prepends a new ID in the chosen source list and creates a regular GitHub commit. Already-listed IDs are idempotent. Existing IDs in the other audience are rejected rather than silently moved or exposed. This form adds new IDs; it does not replace an old livestream automatically. Existing file-based replacement support remains available.

The OBS and recorded helpers securely read the latest GitHub declarations through an authenticated backend; the computer no longer needs a manual pull for those helpers to discover Studio additions. They do not modify the local checkout. The protected helper endpoint accepts only the existing playback key via HTTPS, not ordinary member credentials; it returns IDs and audience, not GitHub credentials.

Live streams publish once the existing live-audio/publication pipeline is ready. Recorded videos still wait for matching audio. The two-attempt rolling daily cap and genuine bot-check cooldowns remain in effect: Studio does not bypass them. Adding an ID is not a promise of instant audio or an instant build. GitHub build duration, action delays, a computer being off, or missing live audio can postpone readiness.

Studio checks both the published protected catalogue and the actual share page before displaying a ready link. Keep the Studio page/app open; background checks can be delayed by the browser or operating system. A ready dialog and a short chime are attempted, plus a system notification if permission is granted. Silent mode, notification settings, background suspension, or closing Studio can prevent/delay an alert. Pending publication is remembered for the same signed-in account so reopening Studio checks again. Use Copy link in the ready popup: automatic clipboard writes after a background wait are restricted in some browsers, so no auto-copy is promised.

Members-only playback is checked before mounting the Watch iframe. This controls access through LightCity, not the underlying YouTube hosting: a public YouTube video remains public on YouTube, and someone who knows an unlisted YouTube URL can open it there. Share preview pages also contain the title and thumbnail by design. Do not use an ordinary YouTube embed for content requiring confidential, authenticated video hosting.

No GitHub publishing token is installed by these source changes. Publishing stays unavailable until the setup and deployment above are complete. Do not remove the existing publishing workflows.

## Checks

node tools/test-studio-publishing.mjs
node tools/test-studio-publishing-ui.mjs
node tools/test-studio-helper.mjs
node tools/test-admin.mjs
node tools/test-admin-ui.mjs
## Private test notifications

Studio has an “Only my devices (private test)” audience. Test videos are held separately under the existing server-only churchStudioPublications tree. They never enter churchVideoLibrary, either TXT list, GitHub backups, the audio helper queue or the normal notification sender. A test notification opens an authenticated video preview at /Admin/?test=VIDEO_ID. It does not enable testing audio playback; regular public/member Watch and Listen publishing remains unchanged.

Deploy with tools/members/deploy-studio-publishing.ps1, then commit/sync the website files. No new secret or Firestore rule is needed: the existing private churchStudioPublications exclusion covers the test records and device subcollections.

On each intended phone/computer, enable notifications in LightCity, open Studio in the same browser/installed app, sign in with the approved admin account, expand “Private test notifications — set up my devices”, and register that device. No other account can register test recipients or open the preview. Tokens are resolved from the registered, cryptographically verified anonymous device identity; user-supplied roles or tokens are not used for selecting recipients. Missing/expired subscriptions never cause fallback to the normal subscriber list. Remove a device with the adjacent button on that device.

Paste a video/stream URL, choose the private test audience and publish. A 30-second rate limit protects against repeated/concurrent sends. FCM acceptance counts do not guarantee physical display (device permissions and OS settings still apply).
