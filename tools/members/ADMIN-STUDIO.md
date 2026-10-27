# LightCity Studio

Open https://lightcityfellowship.com/Admin/ after publishing the website changes.
Sign in with lightcityteachingfellowship@gmail.com. Ordinary membership does not
provide access: every admin catalogue request validates the current Firebase user,
verified email, enabled account and server-configured CHURCH_ADMIN_EMAILS allowlist.
The page shell is public, but its content comes only from the authorized callable.
The public site navigation and search do not advertise the admin page.

## Activate

From the project root, run:

```powershell
& .\tools\members\deploy-admin.ps1
```

If Firebase asks for CHURCH_ADMIN_EMAILS, keep the configured default admin email.
Then commit and sync all changed/new files. No Cloudflare deployment is required.
Bookmark the Admin link to return directly to the dashboard.

## Sharing

Search or filter recordings, audio, articles, summaries, live broadcasts, pending
publications and site pages. Copy link and Share use LightCity URLs. Audio links
open the matching recording in /Listen/. A quick-link form converts YouTube IDs
or links into /Watch/ links without opening the recording page.

Pending items are clearly labelled and do not offer an Open action. Preparing or
copying a link does not publish content, bypass membership or create audio. For a
new livestream, continue adding its ID to the existing source lists and starting
OBS as usual. Pending metadata is the last desired snapshot checked by publishing;
changes that have not been committed/synced will not appear on the dashboard.

Refresh rechecks content/status on demand. Failed status sources show a warning;
they do not take away working content lists. Private dashboard data is kept in
memory, cleared on account change/sign-out, and never stored in localStorage.

This first version is a content and sharing dashboard. Editing ID lists,
publication text, deletion and user management still use the existing workflow.

## Verification

node tools/test-admin.mjs
node tools/test-admin-ui.mjs

Checks cover authorization before private reads, blocked/unverified accounts,
private/public metadata, URL validation, search, native sharing, copy links,
sign-out cleanup and late responses after account changes.
