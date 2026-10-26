# Automatic video replacements

Your normal workflow is now simply to edit the existing video ID lists and commit/sync:

- Replace one ID with one new ID in the same public or members list: a silent replacement.
- Add IDs without removing any: new videos, with normal notifications.
- Remove IDs without adding any: removals.
- Reorder IDs or move an existing ID between audiences: not a replacement.

The existing publish workflow compares the successfully published library with the edited lists. It records replacement history in the protected library automatically; there is no replacement command or extra file to maintain for normal single-ID replacements. Old Watch/notification links and saved bookmarks follow the uploaded version after publishing finishes. Public redirect discovery excludes member source IDs and member destinations.

Make one replacement per list at a time. A simultaneous unrelated deletion and addition in the same list will be treated as a replacement under this rule. Mixed batches containing several removals/additions are paused rather than guessed; split those edits or use the optional explicit helper below. Older publish jobs cannot overwrite newer replacement history.

Edited uploads keep their own playback timeline and audio. Old live timestamps are not copied; the automatic audio helper processes the new ID normally.

## One-time activation

Commit and sync the implementation, then deploy these endpoints once before replacing an ID:

```powershell
Set-Location "C:\Users\samvi\OneDrive\Desktop\LightCityApp_Project\LightCity-Website-GitHub\tools\members"
$env:FUNCTIONS_DISCOVERY_TIMEOUT = "60"
firebase deploy --only "functions:lightcity-members:getVideoReplacements,functions:lightcity-members:getMyVideoActivity,functions:lightcity-members:updateMyVideoActivity" --project perceptive-zoo-424115-j6
```

The next successful publish initializes the protected snapshot. No Firestore rule changes or bulk user-account migration are needed. The existing GitHub publish workflow must be allowed to finish after each replacement.

## Optional explicit fallback for mixed batches

Before manually removing the original ID, run from the project root:

```powershell
& .\tools\replace-video.ps1
```

Enter the old and uploaded video links. The helper changes the ID lists and `_data/video_replacements.json`; commit/sync those changes together. Use this only when a mixed batch would be ambiguous. Historical explicit records can stay in place; later automatic replacements preserve the latest destination.
