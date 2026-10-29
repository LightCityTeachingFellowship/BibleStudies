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

## Install Studio separately

The Admin page uses studio.webmanifest with its own /Admin/ identity, start URL
and scope. The main LightCity app continues to use its existing manifest. Studio
shares the existing root service worker but does not show the main application's
notification/install invitations. Installation never grants admin access.

After committing/syncing these changes, open /Admin/ in Chrome or Edge, refresh,
then use Install Studio when offered (or the browser's address-bar install icon).
The installed app is named LightCity Studio and launches the dashboard directly.

## Shared link previews

Studio and Watch sharing now copy /Share/Video/VIDEO_ID/ links. Audio sharing uses
/Share/Audio/VIDEO_ID/. Publishing generates small static HTML preview pages for
published recordings and their replacement aliases. WhatsApp reads the title and
YouTube thumbnail from the HTML; opening the link redirects to the normal Watch
or Listen page. Pending recordings are not given generated preview pages until
published. Sharing a newly prepared stream ID therefore needs its usual ID-list
publication and active stream first.

Article/summary links keep their existing addresses and include Open Graph tags
with the actual publication title and distinct 1200x630 LightCity cards. These
cards can be regenerated with tools/create-share-cards.ps1. The generated video
preview source directory is ignored by Git and is created only in the publishing
checkout, using the approved snapshot and refreshed titles. Do not commit that
source directory. Preview pages are marked noindex and are not put in search
catalogues. Shared previews intentionally expose only the recording title and
thumbnail to anyone receiving that link; they do not contain member content,
credentials, signed audio URLs or access grants.

Commit/sync these changes; no Firebase or Cloudflare deployment is needed. Copy a
new link from Studio or Watch after publishing to test the new preview addresses.
Checks: node tools/test-share-previews.mjs and node tools/test-watch-share.mjs.

## People who have signed in

Open the “People who have signed in” section inside the authorized Studio dashboard. It shows real Firebase sign-in accounts for this project (shared by the LightCity apps), excluding anonymous identities used for notification devices. Names, email addresses, email verification, church membership, disabled-account status, account creation time and last sign-in are available. Last sign-in is authentication history, not current online presence. Existing accounts are included without signing in again.

The new getChurchAdminUsers callable validates the enabled, verified administrator and configured email allowlist before reading Auth users or membership data. It returns only the fields used by the directory, never password hashes, salts, tokens or custom claims. Firestore public/member rules are unchanged. No contact list is written into website build output or localStorage.

The section loads on opening, follows all account pages, sorts newest sign-ins first, searches the complete loaded list and displays 50 matching rows at a time. Refresh people reloads the list; Show more people expands the display. Private rows are cleared on sign-out/account change and stale responses are ignored. The directory is read-only.

Run deploy-admin.ps1 to deploy both getChurchAdminDashboard and getChurchAdminUsers, then commit/sync the frontend changes. No new key setup or Cloudflare deployment is required. Checks: node tools/test-admin-users.mjs and node tools/test-admin-users-ui.mjs, plus the existing admin checks.
