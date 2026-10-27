# Publish recorded videos with audio ready

Normal workflow after activation: add or replace an ID in the usual public or
members file, then commit and sync. Keep the Windows audio helper running.
The source lists describe desired content. The deployed site uses the last
approved library until the matching audio registration is verified.

New recorded IDs stay hidden while audio is pending. Replacements keep the
currently published version and its existing notification/saved links. Once the
replacement audio is registered, the new version and its aliases publish together
without a second notification. Edited replacements never borrow the old audio.
Existing published videos are grandfathered; enabling this does not hide the
older library still being processed. Fresh active live-audio feeds can publish
without waiting for a permanent recording. Upcoming streams wait for active audio.

The gateway verifies the object, byte count and checksum before registering audio.
The publishing workflow reads that private registered catalogue and the fresh live
catalogue using the playback key. Unavailable catalogues fail closed: the existing
deployment stays available. A pending ID never appears in the public build,
search, homepage, publication feed or protected browsing snapshot. Private aliases
remain in the protected snapshot; the public build gets public aliases only.

## One-time activation

1. Commit and sync the changes, including the new workflow. The new workflow is
   disabled by default; the current publishing setup continues normally.
2. In the repository, open **Settings > Secrets and variables > Actions > Secrets**.
   Add repository secret **LIVE_AUDIO_PLAYBACK_KEY** using the existing key:

   ```powershell
   & .\tools\audio-library\copy-publication-key.ps1
   ```

   Paste the copied value directly into GitHub's secret field, save, then clear
   your clipboard. Do not paste it into chat or a tracked file. The existing
   FIREBASE_SERVICE_ACCOUNT secret must remain configured. Alternatively the
   workflow can read the existing Firebase secret if that service account has
   Secret Manager Secret Accessor on that one secret.
3. Open **Actions > Publish audio-ready website > Run workflow**, select
   **validate**, and run it. This checks access and prepares a disposable build
   copy; it does not deploy, send notifications or change the published snapshot.
4. After validation succeeds, open **Settings > Pages > Build and deployment**.
   Change **Source** to **GitHub Actions**. Keep the existing custom domain.
5. Under **Settings > Secrets and variables > Actions > Variables**, add repository
   variable **AUDIO_READY_PUBLISHING** with value **true**. Run the new workflow
   again with **publish** to complete the switch.

The legacy notification workflow is disabled by that variable, so it cannot publish
raw desired IDs or send early notifications. The new workflow sends notifications
only after the approved site deploys and its protected library is synchronized.
No Firebase function or Cloudflare Worker deployment is needed for this change.

## Timing and recovery

The worker checks local IDs every five seconds while idle. New IDs use the urgent
lane. Once uploaded and registered, the publishing workflow checks every five
minutes; GitHub scheduling can be delayed, and building/deploying adds time. Audio
is already available when the recorded video is released; publication itself is not
instant. The computer must be on and online for audio preparation. Real YouTube
cooldowns, processing, failures or full daily capacity keep recorded IDs pending.

The workflow never commits generated files back to the repository, so there is no
additional merge/sync step and no background Git writes on your computer. It uses
only disposable build copies of the ID files and metadata. A private desired
snapshot tracks replacements across several commits while recordings are pending.

If a build or deployment fails, inspect the workflow logs and rerun **publish**.
The previous deployment and published library remain the baseline until success.
If deployment succeeds but synchronization or notification fails, rerun **publish**;
saved notification markers prevent duplicates and replacement mappings are retained.
Do not manually run the legacy sync with the raw desired lists while this mode is
active. To revert, disable the variable and restore Pages source to the previous
branch configuration; pending raw IDs will then become publishable again.

Verification: `node tools/audio-library/test-publication-gate.mjs` and
`node tools/test-automatic-replacements.mjs`.
