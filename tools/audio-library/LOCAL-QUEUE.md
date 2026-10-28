# Local final-video audio queue

Machine folder: Audio Queue/ at the website repository root. It is excluded from Git and Jekyll. Only place the FINAL video file uploaded to YouTube here, including all edits. Other Videos folders are never scanned or cleaned.

Local settings and per-ID preparation receipts remain in ignored tools/audio-library/work/. YouTube media downloading stays paused. Local preparation ignores download rate limits/cooldowns and makes no media requests to YouTube. An optional oEmbed metadata request obtains the displayed title when needed; it never fetches audio/video.

New or replacement IDs in the normal source lists (including Studio additions) become urgent jobs. Files match by configured explicit mapping, video ID in the filename, unique exact normalized title, or one final file for one pending ID. Multiple plausible files/IDs remain waiting; include the ID in the filename to resolve ambiguity. A file must be unchanged for at least 60 seconds before processing. Do not edit or replace it after processing starts.

AAC audio is copied without re-encoding; other formats convert to AAC 128 kbps. Duration is checked against the source. The source is hashed and its size and timestamp captured. The audio upload is verified by R2 metadata and size, and registration must acknowledge the exact recording/hash before cleanup is allowed.

Once upload AND registration succeed, the unchanged queued VIDEO and generated local audio are deleted automatically. Originals outside Audio Queue are never deleted. Changed files, ambiguous matches, partial conversions, failed uploads and failed registration keep their source for retry/review. Cleanup is individual-file-only, not recursive. The uploaded audio remains stored in R2.

There is no permanent local media buildup. Small JSON receipts remain for recovery and audit. Registration can precede website build completion; source cleanup means verified audio is safely stored, not proof that a user has listened or that the site has finished building.

Run start-local.ps1 once to enable/restart the existing Windows login task with local mode. The computer must remain on, signed in, and connected. Do not run multiple workers. Status: node tools/audio-library/automatic.mjs status --id VIDEO_ID.

After successful audio registration, the helper requests the lightcity-audio-ready GitHub repository event through its authenticated backend. Commit/sync the workflow change once and deploy getStudioHelperLibrary before this automatic trigger is available. If the network/build fails or the trigger is not yet installed, the helper retries; publication checks also retain their scheduled fallback. Existing replacement notification behavior remains silent.

OBS live audio uses its existing capture path and is unchanged. Don't place unedited OBS footage here if you uploaded an edited version.