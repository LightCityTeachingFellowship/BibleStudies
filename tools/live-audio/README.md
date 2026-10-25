# Live audio: pilot and prepared site integration

**Normal OBS workflow:** the [automatic companion](automatic/README.md) replaces the manual relay/publisher steps for everyday broadcasts. Its source and local checks are prepared; one-time key setup, OBS script installation, deployment updates, and a real normal-profile broadcast test are still required. The instructions below describe the earlier manual test tools.

The same-page site integration, access gate, and broadcast publisher are now prepared. Follow [SITE-SETUP.md](SITE-SETUP.md) for deployment and per-broadcast registration. Source preparation does not mean the integration is deployed. The user considers live timing usable with occasional differences; repeated switching still requires real-device checks. The earlier prototype stages below remain useful for isolated testing.

The recorded-video audio feature stays unchanged. The bulk export can be prepared in parallel. The local pilot produces seekable AAC HLS segments with clock timestamps from a local file or a loopback OBS test feed. Audible OBS ingestion, local captured playback, and local playback while streaming have now been confirmed by the user. The next [private phone-test gateway](cloud/README.md) is prepared separately and is not deployed automatically. The local pilot does not forward to YouTube or enable a Listen button for a live video.

## Proposed production route

One common OBS audio mix must feed YouTube video and an audio-only HLS stream. Retain audio segments throughout the broadcast so listeners can switch from a delayed video without jumping forward. Distribution should keep member audio private, using server-issued access and the existing video visibility lists. R2 can store completed segments; a live-serving layer must serve/update playlists and authorize segment requests. Do not make the existing bucket public.

The [simultaneous relay prototype](RELAY-TEST.md) now passes local full-video/audio and audio-failure-isolation tests. It forwards the original video without re-encoding while the separate audio process packages AAC HLS. It adds a failure point to the video path and still needs an actual unlisted YouTube test and reconnect/fallback validation before production. Existing normal OBS streaming/recording settings have not been edited. No second-output plugin has been installed.

## Timing requirement

YouTube and HLS use different timeline origins, and their delivery delays can change. `EXT-X-PROGRAM-DATE-TIME` timestamps are useful for the audio timeline, but do not prove alignment with YouTube. A real test must establish the relationship between YouTube player seconds and source audio seconds, then test reconnects, stream restarts, and delayed viewers. Store a verified offset per broadcast/session and invalidate it on discontinuities. Do not reuse a fixed offset across broadcasts or simply subtract two live durations.

YouTube DVR must be enabled for switching back to an earlier video position. At an unavailable target position, the player should explicitly wait or explain the limit rather than silently jump to the live edge. The production player will need HLS playback support on Chrome/Android as well as native HLS on supported Apple browsers. Background/lock-screen playback still needs real-device checks.

## Completed local stage

`pilot.mjs` uses the existing FFmpeg installation to create four-second audio-only HLS segments, a growing EVENT playlist, and program-date-time tags. It runs local recordings at real-time speed and retains the full session for seeking. The final playlist receives an end marker. It uses 128 kbps AAC stereo. Each session has its own new folder under ignored `work/`; existing sessions and original recordings are not overwritten or deleted. It does not create a public web server.

```powershell
node tools/live-audio/pilot.mjs --input "C:\path\to\short-test-recording.mp4"
```

Use a short recording, since this runs at playback speed. Long sessions retain all segments and consume local disk space until intentionally archived/removed.

## Separate OBS test (not the real broadcast profile)

Only when no production broadcast is running:

1. In OBS, duplicate the current profile and name the copy **LightCity Audio Test**. Verify the copy is selected. Do not alter the original profile's stream destination.
2. Start the local receiver:

   ```powershell
   node tools/live-audio/pilot.mjs --receive-test
   ```

3. In the test profile only, use Custom streaming service with server `rtmp://127.0.0.1:19350/live` and stream key `audio-test`. This is a local test label, not your private YouTube stream key. Do not paste the YouTube key here or into chat.
4. Start Streaming in this separate profile, speak for about 30 seconds, then Stop Streaming. This sends only to this computer; it does not go to YouTube or the website. The command validates the final playlist and segments.
5. Switch back to the original OBS profile before any real broadcast.

The receiver binds only to `127.0.0.1`; no firewall opening, port forwarding, cloud credentials, or bucket changes are needed. If OBS/Windows requests unexpected permissions, stop and review instead of changing network security settings. A real OBS feed has not yet been verified by the automated test.

## Tests and remaining work

### Listen locally in a browser

Run `node tools/live-audio/preview.mjs` and open `http://127.0.0.1:4011/`. Keep that terminal open. The newest capture loads automatically; press Play. The player supports native HLS where available and uses pinned hls.js 1.7.3 from jsDelivr on browsers requiring Media Source playback. Loading that library needs internet access; the captured audio itself stays on this computer. No recordings are uploaded by the preview.

For a live test, keep the browser/player terminal open, use a second PowerShell terminal to start `node tools/live-audio/pilot.mjs --receive-test`, and then Start Streaming in the separate OBS test profile. The preview follows the newest feed after its first segment appears. Use headphones to avoid desktop-audio feedback. This loopback preview is not accessible from a phone or the public website.

Additional check: `node tools/live-audio/test-preview.mjs` tests the local server and restricted media routes. It does not claim YouTube synchronization or browser/phone background validation.

```powershell
node tools/test-live-audio.mjs
```

The test generates a short synthetic recording, checks a growing playlist while the process is running, verifies completed segment paths and timestamps, and decodes the finished playlist as AAC audio. No cloud or OBS configuration is changed. Next: actual OBS ingestion, choose/validate the production second-feed route, private live distribution, timeline calibration, browser player integration, then reconnect/background/member tests. No live-audio service is deployed and no recurring service has been provisioned.

References: [OBS recording while streaming](https://obsproject.com/kb/standard-recording-output-guide), [FFmpeg HLS](https://ffmpeg.org/ffmpeg-formats.html#hls-2), [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference), [YouTube DVR](https://support.google.com/youtube/answer/9296823).
