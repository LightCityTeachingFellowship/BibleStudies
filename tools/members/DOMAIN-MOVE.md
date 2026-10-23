# Move the unified site to lightcityfellowship.com

Prepared source: LightCityTeachingFellowship/BibleStudies, master branch.
Current public domain owner, confirmed in GitHub Pages: LightCityTeachingFellowship/LightCityTeachingFellowship, main branch, root folder. This differs from the stale remote in the local Public checkout; do not use that checkout to manage the domain.

## Prepared locally

- `_config.yml`: HTTPS canonical domain, empty baseurl, both member features enabled.
- `/` opens `/Home/`; article index remains `/Teaching-Articles/`.
- 404 fallback forwards old `/BibleStudies/` links to the corresponding root path, keeping query/hash. This is a browser redirect, not a server 301.
- Firebase authorized domains and callable CORS already include apex/www domain.
- Public video lists remain public; approved accounts retrieve member IDs from Firebase.
- No CNAME has been created locally: GitHub will create it when assigning the domain to the destination repository.

## Coordinated switch

1. Set `WEB_PUSH_ENABLED=false` in BibleStudies (user confirmed). Keep `CHURCH_MEMBERS_ENABLED=true`.
2. In BibleStudies repository variables, set `SITE_URL=https://lightcityfellowship.com/` (trailing slash).
3. Commit/sync the prepared files to BibleStudies. The old project URL may temporarily have incorrect asset paths until the domain reassignment completes; the existing public repository continues serving the public domain until step 4. Do not add new publications during this interval.
4. In the old public repository's Pages settings, Remove the custom domain, then immediately assign `lightcityfellowship.com` to BibleStudies > Settings > Pages. Do not unpublish/delete the old repository. GitHub cannot assign the same custom domain to both repositories.
5. Wait for the Pages build, domain check and HTTPS certificate. Keep/enforce HTTPS when available. Both repositories are under the same organization, so existing GitHub Pages DNS may already be suitable; verify before editing DNS.
6. Pull/sync the GitHub-generated CNAME commit into the working checkout before further commits. Do not overwrite/remove CNAME later.
7. Check apex and www, homepage, public videos/search, member sign-in/code, articles/summaries, direct Watch links, icons/assets, manifest/start URL and both light/dark themes.
8. Run Notify web subscribers > validate against the new SITE_URL. Keep the existing webPushSent/webPushState records. Publication IDs do not contain baseurl, so a domain switch alone should not create new-publication alerts. Do not clear/reinitialize history.
9. Open the new domain on each test device, enable notifications there, and sign in again to link member alerts. Origin-bound sign-ins, installs and push subscriptions from github.io cannot migrate automatically. Old-origin subscriptions may continue receiving their existing alerts; avoid subscribing the same device on both origins if duplicate alerts are unwanted. Old installed apps may need replacing with a new-domain install.
10. Run a single-device video test; verify foreground/background/closed delivery and direct click destination. Then restore WEB_PUSH_ENABLED=true.

## Rollback

Keep the old public repository intact. Pause automatic sends. Remove the custom domain from BibleStudies and restore it on the old public repository, preserving HTTPS/DNS. Restore the previous BibleStudies URL/baseurl for the church site and its former SITE_URL before resuming any automatic notifications. User-confirmed settings/history should be retained; do not reset Firebase member records or notification history.
