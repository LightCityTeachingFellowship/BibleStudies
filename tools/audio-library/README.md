# Expand the audio library

This importer extends the working Watch/Listen player. It does not download from YouTube, change OBS, publish the website, or deploy Firebase. Existing playback credentials remain read-only. Run one importer command at a time. Sources, generated audio, progress, and local reports in `work/` are ignored by Git and excluded from the website.

## 1. Recover the recordings

Use [Google Takeout](https://takeout.google.com/) signed into the account that owns the channel. Deselect other products, select YouTube and YouTube Music, and include uploaded videos and accompanying video metadata. Choose a one-time export split into manageable ZIP archives. If the channel belongs to a Brand Account, ensure the export is for that channel. Google's export preparation and the downloads can take substantial time.

Extract one archive/batch into a local folder. Keep metadata beside recordings and retain the original names. Do not put the exported media in a tracked website folder. The importer scans extracted files, not ZIP archives. Import commands keep originals; the separate optional cleanup step is described below. You do not need all archives extracted at once, but keep each batch until its upload is verified.

## 2. Scan without changing playback

From the repository root:

```powershell
node tools/audio-library/import.mjs plan --input "D:\YouTube Export\Takeout\YouTube and YouTube Music\videos"
```

It matches exact video IDs in filenames or adjacent JSON metadata, then unique normalized titles from the website's current video lists. Filename and metadata IDs must not conflict. Ambiguous, duplicate, or unknown files go into `tools/audio-library/work/review.json`; nothing is guessed. The six registered pilot recordings are skipped.

`missing.json` lists website recordings not yet registered or ready in this batch. Recordings absent from the website lists cannot be imported. Member IDs take priority if an ID occurs in both access lists.

For a renamed file, create `tools/audio-library/work/mapping.json` with explicit full-path-to-ID mappings, then run the scan again:

```json
{
  "D:\\YouTube Export\\recording.mp4": "R42uVd9spDw"
}
```

For duplicate files matching one ID, move the unwanted duplicate outside this batch's input folder and scan again. Do not rename all files manually. Takeout metadata formats vary; unmatched formats remain in review until explicitly mapped.

## 3. Prepare audio in batches

```powershell
node tools/audio-library/import.mjs prepare --limit 10
```

Uses the existing pilot FFmpeg tools, one recording at a time. Existing AAC is copied without re-encoding, preserving its actual quality (including the pilot's 128 kbps AAC). Other codecs are converted to AAC at 128 kbps; this does not restore quality missing from a source. There is no trimming or intentional timeline shift. Each output is checked for one AAC audio stream, no video, and duration matching its source within one second. Output files are named by video ID.

Rerun to continue with the next ten. Completed unchanged preparations are skipped using source/output file information. Every output's full SHA-256 is checked again before upload. Partial conversion files are replaced on retry; no original recordings are overwritten. Full input hashes are recorded on preparation.

## 4. Confirm timeline alignment

Source/output duration equality cannot detect a video trimmed on YouTube after the source was recorded. Check that the export corresponds to the current YouTube version: compare the beginning, a middle point, and the end. Exclude edited/misaligned recordings until a time mapping is implemented. After checking a recording:

```powershell
node tools/audio-library/import.mjs confirm --id VIDEO_ID
```

`confirm --all` is available only when you have established that all prepared files match their current YouTube timelines. This is your confirmation, not automatic proof of synchronization. Unconfirmed recordings are not uploaded or registered.

## 5. Upload to private R2

The existing playback token is read-only. For this local importer, create a separate **Object Read & Write** R2 token scoped only to `lightcity-audio`. Keep the bucket private. Keep the Access Key ID and its matching Secret Access Key from the same token. Do not change Firebase's existing playback secrets or put credentials in chat, Git, screenshots, or command arguments.

```powershell
& .\tools\audio-library\upload.ps1 -Limit 10
```

The helper prompts for the Cloudflare Account ID and hidden upload credentials, supplies them only to the child process, and restores the prior process environment afterward. The importer uses the already-installed AWS SDK under `tools/members/functions`; it does not install packages.

Uploads use streaming bodies and Content-MD5, followed by a remote size/SHA-256-metadata check. Existing matching objects are verified and skipped. Different or legacy objects without matching metadata are never overwritten. The original six are skipped at planning, so their legacy metadata is unaffected. A failed file restarts on retry; completed files do not upload again. This is resume between files, not within an interrupted file. Single files at or above 5 GiB are blocked pending multipart support. At 128 kbps, normal teaching recordings should be far smaller.

## 6. Register and publish a completed batch

```powershell
node tools/audio-library/import.mjs register
```

Only timeline-confirmed recordings with a matching verified-upload receipt enter the local catalogue. The command rereads the current website access lists, reconciles existing visibility, removes catalogue IDs no longer on the site, and writes a backup plus preview in `work/`. Review the catalogue diff before deployment. A receipt records the last successful remote check; do not delete/change an R2 object after verification.

Then publish the updated catalogue:

```powershell
Set-Location tools/members
$env:FUNCTIONS_DISCOVERY_TIMEOUT = "60"
firebase deploy --only functions:lightcity-members:getChurchAudio --project perceptive-zoo-424115-j6
```

Refresh the website and test a guest/public recording and an approved member recording. The existing same-page Listen buttons discover newly available audio automatically. No player changes or website sync are required just to add catalogue entries. Commit catalogue changes through the usual workflow for version control; no media or credentials belong in Git.

## Subsequent batches and new recordings

Keep `work/state.json`: it records completed preparations and verified uploads. Scan the next extracted batch, then repeat prepare → confirm → upload → register → deploy. Alternatively use a separate `--work PATH` for each batch; custom work folders must also be ignored by Git if inside the repository. The upload helper uses the default work folder. The Node upload command supports a custom work folder with credentials supplied through its process environment.

For future OBS recordings, retain the local recording or an aligned audio export. Add its video ID to the normal website list, then use the same importer. This is a reusable batch workflow; it does not automatically monitor OBS or YouTube. Live streaming remains a separate project.

## Verification

```powershell
node tools/test-audio-library.mjs
```

Tests cover ambiguous/conflicting matches, current public/member rules, real FFmpeg conversion and unchanged AAC packet hashes, interrupted-work resume, upload checks, rejection of remote conflicts, and registration gates. Cloudflare upload calls are simulated; a real new upload still needs the scoped write credential and an actual export batch.

## Release local storage after publishing

The input folder is temporary staging, not a permanent archive. Process manageable batches. Once each batch has been deployed, test Listen and seeking on the published site before confirming completion:

```powershell
node tools/audio-library/cleanup.mjs confirm-playback --id VIDEO_ID --playback-tested
```

Use `--all` instead of `--id VIDEO_ID` only after testing every prepared recording in this work folder. This records your confirmation; the tool cannot prove that you listened or that a deployment completed.

Preview cleanup without deleting anything or entering credentials:

```powershell
& .\tools\audio-library\cleanup.ps1
```

Remove the generated local audio copies after a fresh R2 check:

```powershell
& .\tools\audio-library\cleanup.ps1 -Apply
```

Source recordings are kept by default. To explicitly remove those as well, first preview with `-DeleteSources`, then apply:

```powershell
& .\tools\audio-library\cleanup.ps1 -DeleteSources
& .\tools\audio-library\cleanup.ps1 -Apply -DeleteSources
```

Add `-Id VIDEO_ID` to limit cleanup to one recording. Apply prompts privately for R2 credentials with read access to the bucket; existing importer write credentials also work. The tool never deletes or changes R2 objects. It checks current catalogue registration, timeline and playback confirmations, upload receipts, fresh remote size/checksum metadata, and unchanged local file hashes. A failed check keeps the affected recording's local files. It deletes only individual files recorded by this importer, never entire folders, metadata, or unrelated recordings.

Keep `state.json` and the small reports. Interrupted cleanup can be rerun; already removed files are skipped. Sources can only be removed if they belong to the current input plan, so clean a completed batch before scanning the next input folder. Cleanup does not remove downloaded Takeout ZIPs, other archive copies, cloud-sync backups, or the computer's recycle bin. Deletion is permanent for the selected local files; keep a separate original backup if you need one. There is no background retention timer or unattended source deletion.

For a separately uploaded video, add its ID to the normal site list and use a filename such as `VIDEO_ID.mp4` in a temporary input folder (for example `tools/audio-library/work/input`). Run plan → prepare → confirm timeline → upload → register → deploy, then test playback and clean the batch as above. Nothing needs to accumulate indefinitely on this computer. The importer does not watch the folder automatically.

Cleanup checks:

```powershell
node tools/audio-library/test-cleanup.mjs
```

## YouTube-ID download trial

This is a bounded proof of the proposed ID-only workflow for final uploaded videos. It does not yet enable automatic publishing, change OBS, replace live audio, edit the catalogue, or deploy anything. It reads the normal website ID lists, preserves member/public visibility, skips existing audio catalogue entries, and accepts only the two LightCity channels already used in the pilot. Live/upcoming/processing broadcasts are deferred; final separately uploaded videos use their own IDs.

One-time local downloader setup (Python and Node 22+ are required):

```powershell
node tools/audio-library/setup-downloader.mjs
```

This downloads the official yt-dlp zip executable and verifies its published SHA-256. Everything stays under the already ignored `work/downloader` folder. It does not install global packages, read browser cookies, or sign into YouTube. Rerun the setup explicitly to update the downloader; each trial checks the installed file against the saved checksum. YouTube changes can still require maintenance.

Check up to three currently unregistered website recordings, without downloading media:

```powershell
node tools/audio-library/youtube-trial.mjs --limit 3
```

Download and validate one selected recording:

```powershell
node tools/audio-library/youtube-trial.mjs --id VIDEO_ID --limit 1 --download
```

Or use `--limit 2 --download` to test the first two unregistered IDs in website order. This is not necessarily publication-date order; it follows the current site lists. The trial prefers the existing AAC audio-only stream, preserving it when available; other audio formats are converted to AAC at 128 kbps. It checks one audio stream, no video, channel/ID, and duration within one second of YouTube metadata. These checks do not prove word-for-word synchronization; listen and compare positions before relying on the workflow. Later YouTube-side trims need separate change detection.

Completed files and small verification receipts are under `tools/audio-library/work/youtube-trial/VIDEO_ID/`. They can be opened locally. A repeat run reuses unchanged verified audio. The latest `report.json` contains only selected metadata and safe status messages; it never stores signed media URLs or browser credentials. Existing different output files are kept for review. Individual downloads are limited to 500 MB and 20 minutes in this trial. Failures are reported with a suggested retry time; no scheduler or automatic retry loop is installed yet.

The trial intentionally does not register or delete files automatically. The next integration step is a durable queue plus upload/registration service, audience checks against the current published lists, retries, and cleanup after a verified remote copy. That integration must be tested before the routine can truly be just adding an ID; this trial alone does not provide that unattended workflow. Until then the existing manual importer and live audio continue working.

```powershell
node tools/audio-library/test-youtube-trial.mjs
```

## Automatic recorded audio after the successful trial

The local automatic worker watches changes to the same public/member ID files you already edit. It runs independently of OBS. When a new ID appears, it downloads audio from that final YouTube upload, verifies it, uploads to private R2, registers the recording through the existing gateway, and removes only its generated local audio. The website discovers it through the existing audio refresh; there is no per-recording Firebase deployment. Live audio still uses the separate existing OBS helper.

The first setup snapshots the current library so it does not unexpectedly download the thousand-video backlog. By default it seeds only `CwSrbPtbUOw`, the Day 27 audio already downloaded and checked. Existing recordings remain for Takeout. New IDs added after initialization are queued automatically. IDs removed during processing are not registered. If an ID occurs in both access lists, members wins.

### One-time deployment

Deploy the updated gateway from the repository root:

```powershell
& .\tools\live-audio\deploy-test.ps1
```

Then deploy the updated recorded-audio backend (the existing playback secret is additionally bound to this function):

```powershell
Set-Location tools/members
$env:FUNCTIONS_DISCOVERY_TIMEOUT = "60"
firebase deploy --only functions:lightcity-members:getChurchAudio --project perceptive-zoo-424115-j6
Set-Location ../..
```

No website frontend change is required for this integration. Commit the source changes for version control. This deployment supports both existing bundled Takeout/pilot catalogue entries and newly registered recordings. The server always applies the current **published** video-list policy from Firestore before issuing playback links; the uploader cannot make a member recording public or enable an ID absent from the published library. The existing site publishing workflow must still sync those lists as it does for live audio.

### One-time computer setup

Use a separate **Object Read & Write** token scoped only to `lightcity-audio`. Existing playback credentials remain read-only and are not replaced. Keep the Access Key ID and matching Secret Access Key together. The setup prompts privately and saves the pair encrypted for this Windows account in ignored `work/automatic-recorded/config.private.json`.

For a controlled first upload, without installing a startup task:

```powershell
& .\tools\audio-library\setup-automatic.ps1 -ManualStart
& .\tools\audio-library\run-automatic.ps1 -Once
```

The first command verifies the updated gateway and existing bucket read access; write permission is exercised by the first actual upload. The second runs one queued job. Verify Day 27 Listen on the site with the appropriate account. Its source YouTube ID remains unchanged. Remote registration must succeed before the generated local audio is removed.

After the first upload/playback succeeds, enable startup using the saved encrypted credentials to install and start the `LightCity Recorded Audio` Windows sign-in task:

```powershell
& .\tools\audio-library\setup-automatic.ps1 -EnableStartup
```

The task runs hidden under the current signed-in user, with no administrator privileges requested. It starts on Windows sign-in; closing OBS or the browser does not stop it. This computer must be on, signed in, and online. Sleep/offline time delays imports; queued jobs resume afterward. It does not run in the cloud. Existing queues and completed jobs are preserved when setup is rerun.

Normal routine after setup: upload the finished edited video, add/replace its ID in the usual website file, then commit/sync as usual. The background helper handles recorded audio. Merely seeing an ID cannot prove that someone will never edit that same video inside YouTube later; later YouTube-side trims are not detected automatically yet and need an explicit replacement workflow. Edits made **before** uploading are included because the audio comes from the uploaded version.

Status and maintenance:

```powershell
node tools/audio-library/automatic.mjs status
node tools/audio-library/automatic.mjs retry --id VIDEO_ID
```

Status records and receipts remain small. Processing replays wait ten minutes between checks. Other failures retry with increasing delays, then pause for review after six attempts. A retained downloaded file blocks further new downloads until it is published or reviewed, preventing upload outages from accumulating large files. Downloads also pause below 2 GB free space. The helper does not access browser cookies or auto-update its downloader. If YouTube changes require an update, rerun `setup-downloader.mjs`; this does not change the encrypted upload credentials.

To disable future automatic starts, disable `LightCity Recorded Audio` in Windows Task Scheduler. Its queue and files are retained. Never commit `work/`, encrypted credential files, media, or gateway secrets.

Integration checks:

```powershell
node tools/audio-library/test-automatic-recorded.mjs
node tools/audio-library/test-recorded-site.mjs
```

Tests simulate remote uploads/registration. The earlier download trial used a real uploaded YouTube recording; the first real R2 upload and new backend deployment still need the one-time setup above.

If diagnostics show the Access Key ID matches the active token but its Secret Access Key does not, the upload-only setup can derive the matching secret from the Token value on that same creation page:

```powershell
& .\tools\audio-library\setup-automatic.ps1 -ManualStart -UseTokenValue
```

This mode asks for Account ID, Access Key ID, and Token value (not the mismatched secret). It derives the R2 secret locally using Cloudflare's SHA-256 token convention, verifies the token's active identity through Cloudflare, then verifies actual bucket access before saving the derived pair encrypted for this Windows account. The Token value is used transiently and is not saved. Firebase playback secrets are not modified. Do not use the older audio-pilot repair script for this upload-only setup, because that script updates Firebase playback credentials.
