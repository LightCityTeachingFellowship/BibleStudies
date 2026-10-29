# Saved videos and viewing history

The website now provides Save/Saved buttons on video-library cards and Watch, plus a `/MyLibrary/` page with Saved and History tabs, progress, Continue/Start over links, individual removal, and Clear history. Video and audio share a canonical YouTube timeline; ordinary recorded audio uses the same timestamp, while live/replay audio accounts for the known capture offset. Only actual playback is recorded, not loading a thumbnail. History begins with playback after this update; it cannot recover past YouTube viewing history.

Guests store activity on this browser/device. Verified signed-in accounts sync privately through two callable functions. A Google sign-in button on My Videos supports public viewers without granting church access. Users may explicitly copy their device saves/history into their account. Account caches are separated by UID; sign-out returns to the guest scope. Membership and current published video lists still govern which private recordings can be shown or updated. Removed/revoked entries are hidden. Bookmarks remain when history is cleared.

Positions save locally during playback (roughly every five seconds) and on pause/end. Account writes are coalesced about every 30 seconds and on pause, with durable local pending changes and retry on reconnect. A browser/process kill can therefore leave the last few seconds unsaved locally or up to the sync interval absent on another device. Browser storage must be available for on-device persistence. Saved history contains IDs, display titles, times and playback mode/rate; no signed audio URLs or credentials are stored. Completed recordings restart at the beginning. Explicit Continue/Start over links carry the selected timestamp. Unavailable live positions are still subject to the captured range.

## Activation order — privacy rules first

The deployed rules were read before preparing `firestore-personal.rules`. The existing app has a broad signed-in collection grant with an exclusion list. The prepared file adds only `churchVideoActivity` to that list, so browsers cannot directly read/write anyone's history. Existing Flutter content and notification rules remain unchanged. Admin SDK callable handlers perform owner and access checks. Adding a separate `allow ... if false` block alone would not override the existing broad allow; the exclusion is necessary.

If you change Firestore rules elsewhere before activation, merge this one exclusion into the latest rules rather than overwriting newer changes with this snapshot.

From the repository root:

```powershell
firebase deploy --only firestore:rules --config tools/members/firebase-personal.json --project perceptive-zoo-424115-j6
```

Then deploy the two new callable functions:

```powershell
Set-Location tools/members
$env:FUNCTIONS_DISCOVERY_TIMEOUT = "60"
firebase deploy --only "functions:lightcity-members:getMyVideoActivity,functions:lightcity-members:updateMyVideoActivity" --project perceptive-zoo-424115-j6
Set-Location ../..
```

Finally commit/sync the website changes and reload once. No Cloudflare, R2-token, or OBS updates are needed for this feature. No new Firebase secrets or composite indexes are required. Guest device activity works without the callable functions, but deploy the privacy rules before enabling account synchronization.

## Implementation and checks

- `script/video-personal-store.mjs`: scoped local cache, pending changes, completion, removals.
- `script/video-personal.js`: controls, personal page, account sync and audio activity.
- `script/media-switch.js` and `script/live-media.js`: video/audio timestamps and resume.
- `tools/members/functions/video-activity.mjs`: private per-user Saved/History endpoints with current-access filtering and paginated reads.
- Collections: `churchVideoActivity/{uid}/saved/{videoId}` and `churchVideoActivity/{uid}/history/{videoId}`. Callers never choose the owner UID; an expected account UID rejects requests caught in an account switch.

```powershell
node tools/audio-library/test-video-personal-store.mjs
node tools/audio-library/test-video-activity.mjs
node tools/audio-library/test-video-personal-ui.mjs
node tools/audio-library/test-video-history-player.mjs
node tools/audio-library/test-video-personal-page.mjs
node tools/test-member-client.mjs
node tools/test-live-media.mjs
node tools/test-media-switch.mjs
node tools/test-listening-session.mjs
node tools/test-listening-restore.mjs
node tools/test-video-visibility.mjs
```

These checks cover rendering, privacy/access, pagination, offline changes, exact timestamp handoffs and lifecycle. New cloud functions/rules still need the one-time deployment and an actual account test on two devices. The page-render check also confirms the full rules snapshot preserves all previous grants except the added exclusion.
