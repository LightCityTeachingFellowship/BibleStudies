# Automatic live audio alongside normal OBS streaming

This replaces the per-broadcast test-profile, relay, and publish-site commands.
It is a local OBS companion, so the streaming computer must remain running.
It sends a separate 128 kbps AAC audio feed while OBS continues streaming directly to YouTube.
It does not extract audio from YouTube.

## One-time setup

1. Run `tools/live-audio/automatic/setup.ps1` in PowerShell. Enter the YouTube Data API key at the hidden prompt. The script verifies @LightCityTeachingFellowship, saves the key with Windows DPAPI encryption, and prints the Lua script location. Do not send the key in chat. The key must allow YouTube Data API v3 requests from this computer.
2. In the normal **OBS Service Scene** profile and scene collection, open **Tools > Scripts**, press **+**, and add `tools/live-audio/automatic/lightcity-auto.lua` once. Keep the normal YouTube service and stream settings. Do not use the old test relay destination.
3. Deploy the changed gateway and getChurchLiveAudio function, and commit/sync the changed site sources before testing on the published website. Existing deployment scripts still apply. Use FUNCTIONS_DISCOVERY_TIMEOUT=60 if Firebase discovery needs longer on this computer.

The existing private gateway upload setup and local FFmpeg runtime are required. The setup stores configuration under the ignored `tools/live-audio/work/automatic` folder. No key goes into the site, Lua script, source control, or command arguments. Repeat setup if the key changes or the Windows user/computer changes.

## Each broadcast

- Put the intended YouTube video ID in `_includes/video-ids-public.txt` or `_includes/video-ids-members.txt`, then commit/sync as usual. A duplicate in both lists is members-only.
- Click **Start Streaming** in the normal OBS profile.
- Stop Streaming normally when finished.

No separate publisher window, title, audience, or audio-session selection is needed. YouTube supplies the title; the ID files supply access. Matching waits if more than one listed video on the configured channel is live. Unlisted broadcasts work when explicitly listed; private YouTube broadcasts do not.

The site backend checks the published Firestore library before offering a live session, including when upload metadata disagrees about public/member access. A newly edited local ID needs the ordinary site sync before it appears online.

## Timing and operation

Allow time for YouTube to mark the broadcast live, the first audio segments to upload, and the site's next catalogue refresh. An initial scan checks all listed videos in batches of 50, with increasing waits when none is live. Once matched, only that broadcast is checked every 30 seconds. This uses the YouTube API project's quota.

Live switching uses an estimated OBS start-to-audio offset and depends on YouTube DVR availability. It is approximate; this setup does not promise sample-accurate handoff or eliminate YouTube/browser seek limitations. OBS audio capture starts at the current point, so earlier moments are unavailable after a helper restart. Stop ends the audio playlist and registration automatically; an interrupted upload also becomes unavailable after the gateway's stale-feed window.

The helper listens only on 127.0.0.1:19354. It exits after OBS heartbeats disappear. Sanitized local status is `work/automatic/state.json`. Local captured sessions are retained under `work/session-*`; they are ignored by Git and need periodic archival/cleanup for disk space. Normal YouTube streaming remains independent if audio upload or matching fails.

## Validation

- `node tools/live-audio/test-automatic.mjs`: thousand-ID matching, ambiguity/channel checks, access updates, cancellation/list edits, real AAC-to-HLS packaging and decoding.
- `python tools/live-audio/test-automatic-obs.py`: installed OBS API checks and mocked script start/stop/profile lifecycle.
- `node tools/test-live-site-access.mjs`: published access classifications override upload claims, missing library fails closed, existing member/capability checks.

A real normal-profile OBS broadcast is still required to validate the complete companion workflow after one-time installation and deployment.
