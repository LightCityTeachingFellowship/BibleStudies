# Live same-page timing test

Confirmed before this stage: the user hears the same relayed OBS feed on YouTube and the private phone audio player at once. The current unlisted broadcast is `BaqEiXEDE5A` (the earlier `A0u9ZYzKMy4` belongs to a different test). This stage measures and tests the relationship between the YouTube and HLS timelines. It does not modify the website or deploy any function/Worker.

## Open the operator page

Keep the current OBS test relay running, and keep its publisher running for phone checks. In another PowerShell terminal:

```powershell
Set-Location "C:\Users\samvi\OneDrive\Desktop\LightCityApp_Project\LightCity-Website-GitHub"
node tools/live-audio/timing-server.mjs --video BaqEiXEDE5A
```

Open `http://127.0.0.1:4021/timing?video=BaqEiXEDE5A` on the computer and use headphones. This separate loopback server does not interfere with the older preview on port 4011. It reads only local test segments; it does not read cloud secrets or stream keys. The YouTube IFrame API and pinned hls.js library require internet access.

The newest local audio session is selected initially. It is then pinned until you explicitly select another: a calibration must never silently attach to a different capture. Check that it is the current relay session, not an earlier local/phone-only test. Changing the selected session or reloading the page resets timing to provisional zero. No offset is shared across different broadcasts/sessions.

## First check

If an earlier page showed a readiness timeout with disabled Watch/Listen controls, refresh the timing page with Ctrl+Shift+R. Keep OBS, the relay, publisher, and timing server running. The timing client now prefers hls.js over Chromium's ambiguous native HLS support, accepts finite buffered/playlist ranges after media readiness, and reports startup failures directly. The hls.js live latency settings specify both required count values. Initial decoding can take up to a minute on a long retained test feed. Readiness and a playing switch to Listen were checked against the running local feed in the browser; spoken alignment and the return seek still require the operator check.

1. Play the YouTube video using its normal Play button. Speak a clear sequence of words or numbers through OBS.
2. During a sentence, choose **Listen**. The video viewport becomes an audio viewport; the outgoing video pauses.
3. Choose **Watch**. The native audio pauses, and YouTube seeks to the corresponding video position.
4. Check both directions for repeated/skipped words, then test while paused. Playback state/rate are carried when supported.

Zero offset is only the first test assumption, not a claim that live synchronization has been established. Shared source packets, elapsed stream durations, and audio program-date-time tags do not alone prove that YouTube uses the same timeline origin.

If the corresponding position is not available in the audio seekable ranges, the controller keeps/restores the outgoing player and displays a waiting message; it does not clamp to the live edge. For video, the documented API exposes duration but no exact DVR seekable range. Duration is not treated as a DVR boundary: an intermittent rejection was reported on `k6Spw8uaHMI` while the hidden video was paused. The client restores the video surface and attempts the requested seek, then verifies the actual YouTube current time within 1.5 seconds. An unavailable/clamped seek fails and restores audio with a retry message. YouTube keyframe seeking can be approximate. Audio seek completion is checked within 0.25 seconds. These tolerances do not establish sample-accurate synchronization.

## Adjust and confirm

The operator subsequently reported that repeated switches resumed each player's former position. Single-sample seek acknowledgement is therefore insufficient: audio now waits for decoded buffered media and a settled paused position, and YouTube also requires a settled paused seek (700ms). After Play, each handoff monitors the requested position and expected advancement for 1.2 seconds. A reversion fails the switch and restores the outgoing player, and failed verification does not count toward timing confirmation. Tests include an optimistic seek response that reverts, repeated round trips, and rollback when a player returns to its old position after Play.

Repeated live browser check after this correction: first video-to-audio handoff at about 2352.3s, audio-to-video at 2369.8s, second video-to-audio at 2383.4s (rather than the previous audio position 2369.8s), and second audio-to-video at 2396.8s (rather than the previous video position 2383.4s). Each target continued advancing after playback and passed the post-play check. This confirms numeric handoff behavior for these cycles, not spoken-content alignment; the user still needs to listen across repeated switches. Paused seek tolerance is 0.75s for video and 0.25s for audio; the post-play monitor allows 1.5s and 0.75s respectively around expected advancement.

When returning to Watch beyond the paused iframe's last reported live edge, the client briefly wakes the visible video muted to refresh its timeline. It keeps the decoder active and silent while seeking, then pauses at the verified position before restoring the requested play/pause and mute settings. Refresh is bounded and cancellable; a failed refresh/seek restores audio rather than jumping to the live edge. Tests cover stale duration (57s) with an audio target at 74s, updated timelines that need no wake, and mute restoration after failure.

If the ordinary seek does not reach the requested position within 2.5 seconds, the client uses the official `loadVideoById` operation for the same broadcast and `startSeconds`, then verifies the resulting position for up to twelve seconds. A fresh load resets the playback rate, so the client reapplies the carried rate. The client never substitutes the current live edge for the requested content position. Normal successful seeks do not reload the broadcast.

Browser verification on `k6Spw8uaHMI`: YouTube's native rewind worked, confirming DVR was available. The old return failed after extended audio listening even with a timeline wakeup and repeated seek commands. The fresh-load fallback then returned from audio at about 1125 seconds after roughly 30 seconds of listening, reached the verified video position, and resumed advancing video automatically with audio paused. Spoken-word alignment remains an operator check; this does not establish production readiness on every device.

Unresolved live check on `k6Spw8uaHMI`: after about 25 seconds in audio, the requested return position was still not reached during the bounded browser retry. The player correctly restored playing audio. Do not describe this intermittent return-to-Watch case as resolved or publish live switching as complete. The prior `8ETbllCYRPI` resume check and the user's successful shorter switches do not cover this longer paused-iframe case. Also recheck content alignment for this new broadcast; zero offset remains provisional.

Open **Adjust timing if words repeat or get skipped** only if needed. The offset is `audio currentTime − video currentTime` for the same content moment. A positive offset seeks further forward in audio when switching from video. The test offers half-second earlier/later buttons and a numeric adjustment; adjustments pause both sources and invalidate any previous confirmation.

Test both Watch → Listen and Listen → Watch after each adjustment. Then choose **Timing matches in both directions** only after you have heard that the content continues correctly. The page requires both directions to have been exercised and displays a small report with the video ID, session ID, offset, and confirmation time. This is an operator confirmation kept in that page, not automatic audio matching, a permanent server calibration, or proof of alignment on every browser.

The hls.js path invalidates confirmation when a discontinuity counter changes or a fatal audio error occurs. Native HLS has no equivalent hls.js event hook; full restart/gap detection still needs the production session layer. Any relay/source reconnect, FIFO overflow, changed timeline, YouTube broadcast change, or other discontinuity requires a fresh timing check. The relay's optional audio branch can drop packets under overload; this must not silently retain a production synchronization guarantee.

## Tests and remaining integration

```powershell
node tools/live-audio/test-sync.mjs
node tools/live-audio/test-readiness.mjs
node tools/live-audio/test-resume.mjs
node tools/live-audio/test-preview.mjs
```

Tests cover fractional offset mapping both directions, pause/rate preservation, rejection of unavailable positions without clamping, seek and autoplay failures, rapid flips, cancellation/disposal, per-session confirmation/invalidation, and the server routes. Real YouTube live seeking and browser behavior still require the operator test above. No phone timing confirmation has yet been claimed.

After timing is established: implement authenticated live session registration/discovery and renewable playback tokens, persist a verified mapping per active broadcast with discontinuity handling, normalize/check timeline behavior across native HLS and hls.js, and connect this adapter to the existing production same-page Watch/Listen player. The existing recorded-video switching remains unchanged.

Live operator check on `8ETbllCYRPI`: the user confirmed the timing in both directions, but returning to Watch initially required pressing Play. The client now waits for the seek's pause acknowledgement and confirms YouTube reaches its playing state, with one bounded retry for a delayed pause. Browser verification against this live broadcast successfully switched to playing audio and back to advancing video without another Play click; audio remained paused. A browser autoplay-block event keeps the prepared position and asks for Play rather than claiming playback started. Pending playback waits share switch cancellation. See the [YouTube iframe events reference](https://developers.google.com/youtube/iframe_api_reference#Events).
