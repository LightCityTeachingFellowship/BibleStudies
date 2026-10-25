# Live Listen on the site

The source integration is prepared; it is not deployed by editing these files. Existing recorded audio remains separate. Live mode uses the shared timing controller tested on the operator page, with settled seeks and post-play checks. Live timing is approximate and can require a retry. This is a usable first integration, not a claim of perfect synchronization or a validated unattended broadcast relay.

## One-time deployment

1. Deploy the updated private gateway using `deploy-test.ps1`. It now accepts authenticated broadcast registration and a server-only catalogue. The bucket stays private. The existing upload and playback keys are reused; keep the ignored `work/cloud-secrets.json` private.
2. Save that existing `LIVE_PLAYBACK_KEY` as the Firebase secret `LIVE_AUDIO_PLAYBACK_KEY` using the setup helper. Deploy only `functions:lightcity-members:getChurchLiveAudio` from `tools/members`, for project `perceptive-zoo-424115-j6`. `LIVE_AUDIO_GATEWAY` defaults to the existing gateway address. The new function checks verified, approved, non-disabled member status for member broadcasts and issues session-scoped links lasting at most one hour. Public broadcasts require no sign-in.
3. Commit/sync the reviewed website source and wait for the usual site deployment. The website automatically checks live availability about every 45 seconds while visible. The backend caches only catalogue metadata for ten seconds; it still rechecks membership before issuing a new member playback link.

The exact setup commands, in order, are:

```powershell
& "C:\Users\samvi\OneDrive\Desktop\LightCityApp_Project\LightCity-Website-GitHub\tools\live-audio\deploy-test.ps1"
& "C:\Users\samvi\OneDrive\Desktop\LightCityApp_Project\LightCity-Website-GitHub\tools\live-audio\setup-site-key.ps1"
Set-Location "C:\Users\samvi\OneDrive\Desktop\LightCityApp_Project\LightCity-Website-GitHub\tools\members"
firebase deploy --only functions:lightcity-members:getChurchLiveAudio --project perceptive-zoo-424115-j6
```

Stop after any failure and resolve it before the next command. These setup commands do not commit or sync the website. The setup-key helper pipes the existing private key through stdin to Firebase without displaying it or creating another key file.

Do not register an old test broadcast as public or assume that a YouTube Unlisted setting grants access to its separate audio. The publishing command explicitly chooses the audio audience, with members as the default.

## Each broadcast

Keep using the separate OBS relay profile until production relay reconnect/fallback behavior is validated. Start the relay before OBS as in `RELAY-TEST.md`. Once the correct broadcast is live and audible, run:

```powershell
& "C:\Users\samvi\OneDrive\Desktop\LightCityApp_Project\LightCity-Website-GitHub\tools\live-audio\publish-site.ps1"
```

Enter its YouTube watch/share link, title, audience, and timing adjustment (zero unless calibrated for this specific session). It pins the newest local session once at startup, uploads completed segments first, then registers the matching broadcast. Use a full `--session` path with `publish-site.mjs` if the newest session is not the intended one. It never silently changes sessions. Keep the publisher open while streaming. It replaces the private phone-test publisher for that session.

The site offers Watch/Listen on matching video cards, the featured video, and `/Watch/?v=VIDEO_ID`. Registration does not add a new video to the normal video library; that video must already appear there through the existing library workflow, or be opened using its Watch link. Different/restarted sessions dispose the old player and require a new timing adjustment. New broadcasts do not inherit timing from earlier ones.

On a normal end, the final playlist is uploaded and registration is closed. A halted publisher stops advertising live availability after 90 seconds plus cache/poll delay. Registrations expire after twelve hours and must be restarted for longer broadcasts. The gateway supports up to twenty simultaneous active registrations and scans at most five metadata pages; old registrations are filtered from metadata without downloading their playlists. Archived recordings still need the regular audio-library workflow.

## Playback and access

The same viewport changes modes without navigation. Only one player has audio at once. Preparing a video seek may take a moment; the video is silent until its requested position has settled. A failed seek/access lookup restores the outgoing mode and its play/pause state. Playback links are held in memory, renewed through the access gate before expiry, and are never written to progress storage. A renewed source may briefly buffer. Membership changes reset the mounted players; already issued bearer links remain valid until their expiry.

Background/lock-screen playback uses normal browser audio and Media Session controls, subject to the device/browser behavior already tested in the pilot. Navigating to another page disposes the inline player. Continuous playback across navigation is not included.

## Validation

Run `tools/test-live-site-access.mjs`, `tools/test-live-media.mjs`, `tools/test-audio-links.mjs`, `tools/test-media-switch.mjs`, `tools/test-members.mjs`, and the timing/Worker tests under `tools/live-audio`. They use synthetic keys and fixtures and never read the real local secret file.

After deployment, test a registered public broadcast signed out, a member broadcast with an approved verified account, a denied private request, repeated switches, and a stopped upload. Confirm on a phone while live before using this for normal broadcasts. No production deployment or real-secret transfer is performed by the tests.
