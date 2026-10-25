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

## Immediate replay after a normal OBS live broadcast

Completed live capture now stays available as an audio replay for seven days, under the original YouTube live video ID. This bridges YouTube replay processing without extracting or downloading the video again. Existing listeners keep the same playlist URL and position; the final playlist contains ENDLIST, so it naturally finishes. New listeners start at the beginning of the captured audio. The LIVE badge is removed and the audio panel is labelled AUDIO REPLAY. Public/member access is still checked against the current published website list for every playback-link request.

The automatic OBS helper waits for the capture to finish and the final segments/playlist to upload before closing the live registration. If YouTube ends first, it stops and awaits capture finalization before publishing the replay. An interrupted final upload is retried while the helper remains running. A power loss or unavailable upload connection can still interrupt finalization; keeping OBS/computer open briefly after ending allows the last segments to finish. Existing playlists and segments remain private in R2; seven days is catalogue availability, not an automatic physical deletion policy for R2 objects.

The new automatic recorded-audio helper can later retrieve the completed YouTube version and publish permanent audio under the same ID. New page loads then prefer permanent audio, while a person already listening to the temporary replay retains the current source. When the operator replaces the live ID with a separately uploaded edited ID, only audio belonging to that new upload is used. Captured replay audio is never assigned to the edited upload ID.

Activation after updating sources:

1. Deploy the gateway with `deploy-test.ps1`.
2. Deploy `functions:lightcity-members:getChurchLiveAudio` from `tools/members` using the existing project. The existing playback key is reused.
3. Commit/sync the frontend changes, then load the updated site once.
4. When not broadcasting, close and reopen OBS once so its local helper loads the new finalization code. No OBS profile/stream-key/audio-script setup changes are needed.

This applies to broadcasts captured after the update. An old completed broadcast without retained replay metadata is not automatically backfilled. The existing Takeout plan remains for the older backlog.

Verification includes `node tools/live-audio/test-replay.mjs`, `node tools/live-audio/test-automatic.mjs`, `node tools/test-live-site-access.mjs`, `node tools/test-live-media.mjs`, and `node tools/test-audio-links.mjs`.
