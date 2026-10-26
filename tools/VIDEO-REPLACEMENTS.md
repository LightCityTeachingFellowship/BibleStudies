# Replace a livestream with its uploaded recording

Use the helper **before** manually replacing/removing the original ID:

```powershell
& .\tools\replace-video.ps1
```

Paste the livestream's ID/link, then the uploaded recording's ID/link. It updates the website ID lists and `_data/video_replacements.json` together. Commit and sync all three changed files in one commit. No notification is sent for the replacement. Unrelated newly added videos still notify normally.

Old LightCity Watch links, including links in already-delivered livestream notifications, open the uploaded recording. The old notification's displayed text is not rewritten. The replacement stays saved for users who saved the livestream, including device saves and account saves on other devices. Removing that save removes its old aliases too.

Edited uploads start with their own playback history and audio. Livestream timestamps are not copied because edits can change the timeline. The automatic audio helper processes the new ID as usual.

The same helper can replace the uploaded version again; every older link keeps pointing directly to the latest version. Do not remove historical replacement records while you still want old links and bookmarks to work. The helper keeps the original audience and refuses to merge IDs already listed for different audiences. Replacement metadata for member recordings is not embedded in public pages.

## One-time activation

Before registering the first replacement, deploy the updated saved-video endpoints:

```powershell
Set-Location "C:\Users\samvi\OneDrive\Desktop\LightCityApp_Project\LightCity-Website-GitHub\tools\members"
$env:FUNCTIONS_DISCOVERY_TIMEOUT = "60"
firebase deploy --only "functions:lightcity-members:getMyVideoActivity,functions:lightcity-members:updateMyVideoActivity" --project perceptive-zoo-424115-j6
```

Commit and sync the implementation first. The existing publish workflow syncs replacement metadata with the protected video library and suppresses replacement notifications automatically. No Firestore rules changes, bulk rewrite of user accounts, or notification resend are required. To return to the project root afterwards, run `Set-Location ../..`.
