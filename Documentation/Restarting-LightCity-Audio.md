# Restarting LightCity audio services

Recorded audio and live audio use different helpers. The recorded-audio and Studio list helpers run as Windows scheduled tasks; live audio uses an OBS companion while OBS is streaming. The computer must be on, signed in and connected to the internet.

## Restart the background helpers

The recorded-audio and Studio list tasks now run from `LightCity-Website`. Run this in PowerShell:

```powershell
& "C:\Users\samvi\OneDrive\Desktop\LightCityApp_Project\LightCity-Website\Documentation\Restart-LightCity-Audio.ps1"
```

Wait 20–30 seconds, then run the same command with `-CheckOnly` to check the worker heartbeats. If a heartbeat is old, inspect the logs under `LightCity-Website\tools\audio-library\work`.

The recorded-audio helper uses `C:\Users\samvi\Videos\Audio-Queue`, outside OneDrive. Update any recording program or shortcut that used the old website queue; the old location is no longer monitored.

## Recorded audio

Put only the final uploaded video file in `C:\Users\samvi\Videos\Audio-Queue`. The helper watches that folder, prepares and uploads audio, and registers it with the website. As in the existing setup, after successful verification and registration it removes the unchanged queued video and its temporary local audio. Keep your original files outside Audio Queue. Do not place a file there unless it is the final version you intend to process.

## Live audio in OBS

In OBS, select the normal **OBS Service Scene** profile and check **Tools > Scripts** for `lightcity-auto.lua`. The primary LightCity live-audio script now loads from `LightCity-Website/tools/live-audio/automatic/lightcity-auto.lua`. OBS must be reopened to load the updated path. Another existing script entry under `lightcity-publish` was left unchanged. The live helper starts when the configured profile is actively streaming; it cannot be fully tested merely by opening OBS. Do not change the YouTube stream key or start a public broadcast just for a test. Use a separate unlisted test if a full live test is needed.

The normal OBS video stream remains separate from the audio helper. If live audio does not start, inspect the OBS script status and the saved live-audio status in `tools\live-audio\work\automatic` and ask for help with the error. Never post stream keys or passwords in chat.
