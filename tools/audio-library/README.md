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
