# Direct video publishing

Publish new streams and uploaded videos from **LightCity Studio → Publish a video or stream**.

- Studio saves the selected audience and video ID directly in Firestore. GitHub availability does not gate playback.
- The OBS/local audio helper reads pending Studio IDs immediately. A recorded upload waits for verified matching audio; a stream waits for its fresh active audio feed.
- Public pages request only public records. Members still need verified active church membership. Background refresh pauses while a library player is mounted.
- Ready share previews use `https://auth.lightcityfellowship.com/Share/Video/ID/` (or `Audio`). Firebase Hosting serves metadata dynamically and opens the main website Watch page. Existing main-domain share URLs continue working.
- New publications notify eligible devices through Firebase. Replacements stay silent and retain their old link/bookmark aliases. The same notification marker is shared with GitHub to prevent a second announcement.
- GitHub receives an asynchronous backup of the selected source ID file. A failed backup retries without withdrawing the already published video.
- The publishing workflow merges Studio entries and rechecks them transactionally at sync time so a build started earlier cannot erase a newly published video. Once the source list has acknowledged a backed-up ID, later deliberate source edits/removals take effect normally.

## Deploy once

1. `tools/members/deploy-studio-publishing.ps1` deploys the Studio APIs, public catalogue, dynamic share endpoint, background notification/backup trigger and readiness scheduler.
2. Deploy the rules with `firebase deploy --only firestore:rules --config firebase-personal.json --project perceptive-zoo-424115-j6` from `tools/members`.
3. Deploy the share Hosting rewrite with `firebase deploy --only hosting --project perceptive-zoo-424115-j6` from `tools/members`.
4. Commit/sync the frontend and workflow changes once. Older Studio clients retain their existing GitHub flow until the updated frontend loads.

The notification trigger uses the existing default function service account. It needs Firebase Messaging delivery permission, Firestore access and access to the existing GitHub token secret. No browser receives that token, the playback secret or member-only ID lists.
## Studio removal and local text-file sync

- Use **Remove** beside a video in Studio. The published and pending catalogues are updated immediately; GitHub removes the ID in the background. Saved/history lists no longer expose a removed video. The YouTube upload and stored audio object are kept.
- Run `tools/start-studio-sync.ps1` once on the streaming computer. It installs the hidden **LightCity Studio Lists** login task, using the existing local helper key; there are no new credentials to enter.
- While this computer is signed in, on and connected, its two `_includes/video-ids-*.txt` files synchronize about every 15 seconds. Save an ID removal to apply it online. No commit is needed to remove it from the live catalogue.
- First sync imports the online list without treating an older local copy as a removal. Local-only additions and deliberate reordering are preserved. Missing/invalid files and simultaneous saves pause synchronization rather than overwriting edits. More than 25 removals in one pass require review.
- A removed video stays removed even if an older website build finishes later. A later explicit re-publication in Studio can restore it; stale local removal requests cannot delete that new publication.
- The helper changes tracked ID files, so they may appear in VS Code Source Control. Normal Git sync remains available for website code updates; it does not control live removal.