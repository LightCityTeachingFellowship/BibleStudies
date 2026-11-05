# Older message archive

The Audio page has an Older messages section with collection and title/year/series search. This public archive is separate from the YouTube catalogue. Titles come from filenames; folders retain collection, year and series. Exact dates are not guessed.

Start OneDrive and make the source folder available locally. From the project root run `& .\tools\audio-archive\run.ps1`.

Uses existing Windows-encrypted R2 credentials. Uploads unchanged MP3s, verifies stored size and SHA-256 metadata, then publishes each verified entry. Originals are never deleted or renamed. Re-running resumes verified uploads. Keep the computer on and connected. Existing video helpers are unchanged.

Progress and inventory: ignored `tools/audio-library/work/message-archive/`. Avoid simultaneous imports. If forcefully stopped, check the process ID before removing a stale `import.lock`.

Deploy from tools/members: `firebase deploy --only functions:lightcity-members:getChurchAudioArchive --project perceptive-zoo-424115-j6` with FUNCTIONS_DISCOVERY_TIMEOUT=60. Publish the website through normal commit/sync. New verified uploads appear after refreshing the archive, without deployment per message.

## Transcript pilot

Run from the project root. The helper matches the original MP3 to its published archive ID. It runs speech recognition locally and keeps the draft in the ignored transcript work folder. The first run downloads the model.

One-time installation on the computer that has the original MP3s:

~~~powershell
$work = 'tools/audio-library/work/transcripts'
New-Item -ItemType Directory -Force $work | Out-Null
python -m pip install --target "$work/packages-v1" faster-whisper==1.2.1 av==16.1.0
~~~

Generate the Colossians 2 draft:

~~~powershell
$recording = 'Fellowship Days/2018/Colossians Series/Colossians 2 (LightCity).mp3'
python tools/audio-archive/transcribe.py $recording
~~~

Open the draft path printed by the helper. Listen alongside it and correct names, Scripture references and any misheard words. After reviewing, prepare that draft for the normal website commit and sync:

~~~powershell
python tools/audio-archive/transcribe.py $recording --prepare-reviewed
~~~
