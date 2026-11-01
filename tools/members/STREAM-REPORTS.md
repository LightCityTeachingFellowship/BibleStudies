# Livestream issue reports

Watch offers “Report a stream issue” while the live catalogue identifies an accessible active stream, and for two hours after that browser last observed the same live video. The initial options are “The stream has ended” and “The speaker volume is too low”. Viewing a recording does not turn on the report button.

## Enable

From the project folder:

```powershell
& .\tools\members\setup-stream-reports.ps1
& .\tools\members\deploy-stream-reports.ps1
```

Setup reads the existing Windows-encrypted OBS YouTube API key and pipes it privately to the new YOUTUBE_STREAM_STATUS_KEY secret. If the OBS setup is missing it asks for a hidden server-compatible key. No key appears in chat, command arguments, Git or frontend source. Use a YouTube Data API v3 key that allows server requests, not a website-referrer-only key.

Commit/sync the website files and refresh Watch and Studio. Studio shows a Stream reports inbox with grouped reports and Mark handled. Push alerts use the phone/computer registered under Private test notifications. Enable notifications and register both devices if not already done. With no registered devices, reports remain in the inbox and show a setup reminder. FCM acceptance cannot guarantee the OS displays an alert.

## Verification and limits

- The callable validates a signed Firebase device identity, current site video ID and public/member access before contacting YouTube. Guest viewers use the separate anonymous device identity; their member account is not changed.
- The server reads YouTube videos.list snippet and liveStreamingDetails only when a viewer reports an issue. Actual end time overrides a stale live flag. If no end time exists, it rechecks after seven seconds and checks that the trusted live-audio playlist is fresh and advancing. A stalled or completed audio feed alone is never proof that the video ended.
- Ended reports alert only after an actual YouTube end timestamp is available, and only within two hours of that timestamp. Older finished broadcasts return guidance. Still-live results offer Refresh. Uncertain results offer Refresh and Check again, with no ended alert. Google status propagation can delay confirmation; the feature cannot guarantee instant or infallible detection. See https://developers.google.com/youtube/v3/docs/videos#liveStreamingDetails.actualEndTime .
- Low volume and No sound are viewer reports, not automatic audio measurements. YouTube is checked for a confirmed end; an unavailable audio relay or uncertain YouTube status does not block these reports. Ended-stream reports still require full end verification.
- A 30-second per-device/video limit and a 15-attempt/5-minute IP limit apply. Status results are shared briefly to reduce API usage. Reports for the same video and issue within a five-minute bucket are grouped. Inbox data is under the existing server-only churchStudioPublications tree; no broad Firestore rule is added.
- Push delivery has per-target receipts. Persistent network errors retry through the Firestore trigger; invalid tokens are removed. Delivery is not guaranteed exactly once if a process fails between FCM acceptance and saving a receipt, but a stable notification tag reduces duplicate popups.

## Checks

```powershell
node tools/test-stream-reports.mjs
node tools/test-stream-reports-ui.mjs
```

These use simulated YouTube/relay/FCM responses. After deployment, run a real stream test: a still-live ended report must offer Refresh without an admin ended alert; a volume request must arrive in Studio and on registered admin devices; after ending the stream, the ended report must wait for confirmed YouTube end status.

## Named questions, answers and custom messages

Private test previews at `/Admin/?test=VIDEO_ID` include the same feedback form.
They do not enter the public/member video lists. The server verifies the active
admin and a test record belonging to that admin before accepting feedback.
Reports carry a private-test label; only their owner can retrieve/handle them,
and their push alerts target only that owner's registered test devices.
The Windows app receives them through its existing inbox polling.
Ended-stream reports still require real end verification. Private volume requests
can use YouTube's live state without a public audio relay. A custom message is the
quickest test of the alert path because it does not wait for live-status checks.
Deploy `deploy-stream-reports.ps1` and publish the website changes for this update;
the Windows installer does not need rebuilding.

Studio's Stream reports container turns pale red with a slow pulsing red glow
while unresolved reports exist. The warning persists across refresh failures and
stops after the last report is handled (including on another device). Reduced
motion preferences keep the red highlight without animation. No sound reports
include readable fault text for compatibility with the installed Windows panel.

The feedback form also offers “Question, answer or other message”, up to 2000 characters. This sends private feedback directly to Studio without a YouTube-status check. Each message gets an independent record and alert; different questions are never grouped away. The same access and anti-spam checks apply.

The server obtains the display name from a verified, enabled account when available and ignores an attempted client override. Otherwise, a name is required and is explicitly labelled “Visitor-provided name” in Studio and “visitor” in alerts. An account display name is a profile label, not proof of a person's real-world identity. Sender names also accompany the two preset reports; grouped preset reports retain up to 20 distinct recent sender labels. Text is displayed with textContent, including preserved message line breaks, never interpreted as HTML.

Redeploy using deploy-stream-reports.ps1, then commit/sync and refresh. The YouTube key setup needs no repeat if already completed. Viewer messages stay private; the admin can now reply privately or send a separate message to everyone watching.

## Existing HTTP function name

The Firestore notification handler is deployed as notifyChurchStreamIssueOnWrite. Some projects already have an HTTPS function called notifyChurchStreamIssue; Firebase cannot change that function's trigger type in place. The deployment helper uses the distinct background-handler name so no deletion or replacement of the existing HTTP function is required. Viewer and Studio callable names are unchanged. If deployment failed with the trigger-type error, rerun deploy-stream-reports.ps1 after updating these files. No secret setup needs repeating.
## Persistent admin feedback alerts

Feedback push messages request requireInteraction:true in both the automatic Firebase background notification and the service-worker foreground/data-only display paths. This asks supporting browsers to keep the popup visible until it is clicked or dismissed; browser and operating-system settings can override the request. This does not prevent dismissal or guarantee an always-visible desktop popup. Ordinary publication alerts are unaffected. Reports remain stored in the private Studio inbox and can be marked handled there.

After updating, deploy-stream-reports.ps1 deploys the notification change. Commit/sync service-worker.js and refresh the installed app to load its new worker before testing the foreground path. PowerToys Always On Top can pin the Studio window over OBS (default shortcut Windows+Ctrl+T); a web page cannot itself force an operating-system window to stay on top.

## Private replies and stream announcements

Select **Reply** on a report in Studio. The composer defaults to **Original sender only**. For grouped reports, choose one of the original senders. To reply to the whole stream, choose **Everyone watching this stream**; only the admin-written text is broadcast, never the original question or sender name. The same composer sends standalone announcements by selecting a stream without selecting a report. Mark handled remains separate from replying.

Messages appear below the Watch player or private-test player, or as a dismissible panel while playing live video/audio in a library. They arrive on the next visible-page check (normally within 10 seconds) without reloading or pausing playback. Checks pause in the background and resume on return; this is in-app delivery, not a new system push notification. Messages are available for 24 hours, up to the latest 30 broadcasts and 30 private replies per stream. Dismissal is remembered for the browser session. Signed-in recipients receive replies on devices using the same account; visitors receive them only in the original browser/device identity.

Only the verified configured admin can send. The backend derives private recipients from the original report and authenticated viewer identity, verifies current public/member/test access on every read, and scopes broadcasts to one stream. Private test broadcasts stay inside their owner's test preview. Sending uses retry-safe IDs and a 20-message/minute admin limit. Data stays in the already server-only churchStudioPublications tree; no Firestore rules, API keys or new secrets are required.

Run deploy-stream-reports.ps1, commit/sync the website changes, and refresh Studio and viewer pages. The Windows app loads the same web UI, so its installer needs no rebuild. Test a private reply with two different viewer accounts, then a stream announcement, and verify an unrelated stream cannot see either.
