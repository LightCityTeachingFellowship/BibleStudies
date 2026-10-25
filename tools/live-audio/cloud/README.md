# Private phone-test gateway

This is the next isolated test stage after audible OBS → HLS → local browser playback. It is **not** the public/member live feature yet. It does not change the existing recorded-audio catalogue, Firebase secrets, production OBS profile, website, DNS, or bucket public access. The Worker needs an R2 binding to the existing `lightcity-audio` bucket; the reviewed routes access only `live-test/session-…/` objects. Binding permissions themselves are bucket-wide, so only deploy code you trust.

## What is prepared

- `worker.mjs`: private upload and playback routes. All audio requires authorization; there is no list/browse/delete route. Both secrets must be configured, and they must differ, before any media route works.
- `publish-test.mjs`: upload completed segments first and publish each growing playlist afterward. Local receipts allow retry without resending successful uploads. Cloudflare verifies SHA-256 and refuses changed segments, timeline rollback, or reopening a completed session. Playlist writes use conditional updates to reject concurrent stale writes.
- An owner-only phone test page using native HLS where available or pinned hls.js 1.7.3 from jsDelivr. The page itself is public, but exposes no catalogue/audio/token. Its playback token arrives in the URL fragment, is kept in memory, and is removed from the address bar. Segment/playlist requests carry the scoped token; responses are private/no-store. Worker observability logging is disabled in the config. Avoid logging or sharing media-request URLs elsewhere.
- A one-hour capability link scoped to one test session. Anyone receiving that link can listen until it expires, so send it only to your own test phone. It is not member authentication or DRM. Rotating `LIVE_PLAYBACK_KEY` invalidates all issued test links. Links cannot be renewed by the phone page; rerun the publisher to generate a new one.

## Deploy manually after reviewing the code

From the project root:

```powershell
& .\tools\live-audio\deploy-test.ps1
```

This uses official `wrangler@4.130.0` from npm (Node 22 or newer), opens Cloudflare's authorization flow when needed, and deploys `lightcity-live-audio-test` in account `af76ef1278d731ac5487d733c0d44cd0`. Version 4.152.0 uploaded this Worker successfully but failed the new `/workers/workers/<name>` lookup with error 10007 before publishing its address. The helper now pins 4.130.0, whose subdomain publishing code uses the established script/subdomain endpoint. The actual deployment must still be retried and verified; a dry run alone cannot verify Cloudflare account routing. Existing keys and the registered account subdomain are reused.

The user completes account authorization. No new paid Workers subscription is requested by this script, but R2/Workers usage remains subject to the account's service limits and charges.

The helper generates independent random upload and playback keys once, saving them to ignored `tools/live-audio/work/cloud-secrets.json` and passing them to Wrangler's `--secrets-file`. They become Worker secret bindings, not plaintext config variables. Do not commit, paste, screenshot, or send the local secrets file. Keep it for subsequent test uploads/deployments. If the keys already exist, the helper reuses them. It does not read or change the existing R2/Firebase playback credentials.

After deployment, note the HTTPS `workers.dev` address. The base address is not secret and can be shared for setup. The uploader deliberately accepts only a workers.dev root URL over HTTPS; it refuses other destinations and redirects rather than risking disclosure of its upload key.

## First phone playback test: existing 35-second capture

```powershell
node tools/live-audio/publish-test.mjs --worker https://lightcity-live-audio-test.YOUR-SUBDOMAIN.workers.dev/ --session tools/live-audio/work/session-1792874042803
```

This transfers only that selected capture. The terminal prints a private one-hour test link after the first successful playlist upload. Open that link on your own phone and press Play. Do not paste the token-bearing link into chat. Test normal playback, changing apps, and locking the screen. This verifies internet/phone delivery of a saved test capture first; it is not proof of a simultaneous live stream or YouTube synchronization.

## Then test while OBS is streaming

1. Keep the separate OBS test profile selected. Start `node tools/live-audio/pilot.mjs --receive-test` in one terminal, then Start Streaming in OBS.
2. In a second terminal, run the publisher with the same worker address and `--latest`. It selects the newest local receiver session, including one still growing. It does not change sessions mid-run.
3. Open its newly issued private phone link. Press Play and speak for at least a minute. Expect buffering delay; this stage does not align with YouTube yet.
4. Stop Streaming in OBS. The uploader publishes the final end marker and exits. The receiver and uploader terminals can then close.

The snapshot size is capped at 4,000 segments (about 4.4 hours at four seconds each); manifests at 256 KB and individual upload bodies at 2 MiB. Sessions remain stored until intentionally removed through R2 administration. No retention/deletion policy is automatically installed. The prototype does not renew phone links during long sessions; that belongs in production authenticated playback.

## Verification and outstanding production work

```powershell
node tools/live-audio/test-cloud.mjs
```

Tests run the actual Worker handler and publisher against a simulated R2 binding, with synthetic keys and no real uploads. They verify unauthorized requests do not touch storage, token scope/expiry/key separation, checksum and immutable-content gates, private response headers/ranges, and safe upload retry. The user subsequently deployed the Worker with Wrangler 4.130.0 and confirmed both saved-capture phone playback and phone playback while OBS was still streaming. Public endpoint: `https://lightcity-live-audio-test.lightcityteachingfellowship.workers.dev`. This validates the private owner-test distribution stage, not production member authorization or YouTube synchronization. See [the simultaneous relay test](../RELAY-TEST.md) for the next stage.

Before enabling live Listen on the site, implement server-side Firebase membership/public-list authorization for session discovery and renewable playback access; choose and test the simultaneous OBS-to-YouTube/audio production feed; calibrate the two timelines per broadcast; handle reconnects/discontinuities/available seek ranges; and integrate that with the existing same-page mode switch. Do not expose these owner-test keys or locally issued owner links as a substitute for membership checks.

References: [R2 Worker bindings and API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/), [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/).
