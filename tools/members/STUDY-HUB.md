# Personal study hub

The Study Library (`/MyVideos/`) combines existing saved media/reading stores into History and Saved shelves. Account switching uses the existing Google account selector; cancelling leaves the current account intact. Saves, history and resume positions are preserved. Private titles are cleared on identity changes. Resources are still subject to their current public/member access.

Playlists are private to a verified signed-in account. A playlist can mix videos, audio, articles and summaries. Create, rename, delete, add and remove are supported. Use **Save to playlist** in video/audio/home menus, on Watch, in reading toolbars or library cards. This release organizes resources; it does not automatically play every item in sequence. Limits: 100 playlists/account, 200 resources/playlist. Removed/inaccessible resources are filtered server-side. Replacement IDs resolve to the current video.

The shared header has an account button and notification bell. Settings contains device notification enable/disable and library history clearing. The inbox shows up to 100 recent announcement records from the existing notification sender, filtered to resources available to the current audience. It does not claim to show proof of delivery by the phone OS. Baseline/silent replacements and private Studio test notifications are excluded. Old notifications follow permitted replacement links. Read state syncs for signed-in accounts; guests use their anonymous device identity. Opening the inbox does not mark everything read. Opening an item, viewing its page or explicitly marking all read does. The first inbox activation treats historical announcements as read; new unread counting starts then. A visible page refreshes the count each minute and on foreground push/return. Shared sent-marker reads are cached for 45 seconds per function instance.

Storage is under `churchVideoActivity/{uid}/playlists` and `churchVideoActivity/{uid}/settings/notifications`. The existing rules already exclude that entire server-only collection from browser access. Every callable verifies the Firebase identity; requests cannot choose someone else's account. No rules change is required.

Deploy the four new functions from the project root:

```powershell
& .\tools\members\deploy-study-hub.ps1
```

Then commit/sync the website changes. The helper deploys only the playlist and inbox endpoints. It does not send announcements, publish videos, or alter audio processing.

Validation:

```powershell
node tools/test-personal-hub.mjs
node tools/test-hub-core.mjs
node tools/audio-library/test-video-personal-ui.mjs
node tools/audio-library/test-study-ui.mjs
node tools/test-pwa-prompts.mjs
node tools/test-watch-share.mjs
```

Browser validation covers mobile/desktop, dark/light theme, cancelled account switching, clearing private data on account changes, outside/Escape dismissal, unread counts, playlist create/add/remove and responsive bounds.

## Shared navigation update

The responsive shell uses each page’s existing desktop and mobile link order. Desktop has a centered scoped search and an expandable icon rail; expanded sections show up to five recent resources. Mobile has ordered page tabs and a More panel, with search and notifications in the logo row. Google photos appear for approved church members; the mobile account button is in the bottom navigation.

The shell moves the original search form rather than replacing its handlers. Article and summary category searches retain their parent scope. Audio search retains its existing library filter. Public visitors keep local saves/history, search and notifications, but see no account/sign-in or playlist controls. Private recent titles are cleared on account changes.

This navigation update changes website files only. Commit/sync the website and refresh the app; no Firebase deployment is required. Test with `node tools/test-site-shell.mjs` as well as the existing search and personal-library checks.
