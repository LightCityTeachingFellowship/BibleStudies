# Simultaneous YouTube and audio relay test

Status: the user confirmed OBS audio → local browser, private saved-capture phone playback, private phone playback while OBS was still streaming, and then simultaneous YouTube picture/sound plus private phone audio through the relay. The current YouTube test is `BaqEiXEDE5A`. The next [same-page timing test](TIMING-TEST.md) is prepared locally; synchronized live Watch/Listen is not enabled on the main website yet.

## Local verification completed

`node tools/live-audio/test-relay.mjs` generates a short synthetic H.264/AAC clip, sends it over local RTMP to the relay, captures the forwarded video at a separate loopback receiver, and validates the HLS audio. Encoded video packet hashes match the original: no video re-encoding. The test then kills the separate audio packager during a second run and checks that the complete video still reaches its destination. Both cases pass. The original file-to-HLS test also passes after the shared packager change.

Video output preserves incoming video/audio packets. A separate FIFO-backed audio-only MPEG-TS connection feeds the 128 kbps AAC packager over loopback TCP. Audio-side back pressure is bounded with a drop-on-overflow queue, and audio failure does not abort the video muxer. TCP EOF lets a normally stopped session finalize its HLS playlist. The main input is fixed to `rtmp://127.0.0.1:19350/live/audio-test`, so the existing separate OBS test profile keeps its local destination.

The only remote destination accepted by the test helper is the primary encrypted YouTube ingest endpoint `rtmps://a.rtmps.youtube.com:443/live2/<TEST_KEY>`. Raw FFmpeg diagnostics are suppressed because they can contain the key. The helper reads the key through a hidden prompt and retains it only in process memory/environment for the running command; it does not save it to disk. The selected FFmpeg build reports TLS peer verification enabled by default. Local tests do not exercise YouTube authentication, rate/codec acceptance, or a real internet disconnect.

## Prepare a separate unlisted broadcast

In YouTube Studio, create or schedule a separate encoder broadcast named **LightCity Live Audio Test**. Set visibility to **Unlisted**, enable **DVR**, and select a **new, separate test stream key**. Do not reuse a key assigned to the normal church broadcast. Keep the key private. Disable automatic start if you want to inspect the incoming preview before choosing Go Live manually.

The YouTube watch URL/video ID is needed for the later timing test; it is different from the stream key. Share only the watch URL for setup. Nothing in this local relay config changes the YouTube broadcast's visibility or DVR settings automatically.

## Connect the two outputs

1. Keep OBS on **LightCity Audio Test**, with its existing Custom server `rtmp://127.0.0.1:19350/live` and local key `audio-test`. Keep all earlier receiver commands stopped: the relay replaces that one receiver and needs the same port. Do not edit the normal OBS profile.
2. From the project root run:

   ```powershell
   & .\tools\live-audio\youtube-test.ps1
   ```

3. Paste only the **new unlisted YouTube test stream key** into its hidden prompt. When the relay says it is waiting, Start Streaming in the separate OBS test profile.
4. Verify the incoming picture and sound in the intended unlisted broadcast's YouTube Studio preview. Check Stream Health. If automatic start is disabled, choose Go Live there when ready to test the unlisted watch page.
5. In another PowerShell window publish the newest audio session with the existing gateway:

   ```powershell
   Set-Location "C:\Users\samvi\OneDrive\Desktop\LightCityApp_Project\LightCity-Website-GitHub"
   node tools/live-audio/publish-test.mjs --worker https://lightcity-live-audio-test.lightcityteachingfellowship.workers.dev/ --latest
   ```

6. Open its new private phone link. Use headphones to prevent feedback. Confirm both YouTube picture/sound and the separate phone audio work at the same time. Different delivery delays are expected at this stage.
7. End the unlisted broadcast in YouTube Studio, Stop Streaming in OBS, and keep the relay/publisher terminals open long enough to finalize the audio session. Switch back to the normal profile afterward.

## Limits before production

This introduces a relay process into the YouTube video path. A relay crash or YouTube connection failure can stop the video feed; only audio-branch failure isolation has been verified locally. Do not use it for normal church broadcasts until the actual unlisted YouTube test, restart/reconnect behavior, codec compatibility, and fallback to direct OBS streaming are validated. If audio packets are dropped on overload, timestamp continuity/alignment must be rechecked before synchronization is enabled.

Live mode switching also needs a verified per-broadcast mapping between YouTube player seconds and the HLS timeline. Shared source packets and program-date-time tags alone do not establish YouTube's timeline origin or delivery delay. Never call this synchronized based only on hearing both outputs. The next stage must measure alignment, reject unavailable seek positions, and invalidate calibration on reconnect/discontinuity. Public/member session discovery and token renewal remain separate production work.

References: [YouTube encoder setup](https://support.google.com/youtube/answer/2907883), [YouTube RTMPS](https://support.google.com/youtube/answer/10364924), [FFmpeg tee/FIFO output options](https://ffmpeg.org/ffmpeg-formats.html#tee).
