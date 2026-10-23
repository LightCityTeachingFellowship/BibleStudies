# Member access — activation guide

The signup page is `/members/`. No public navigation links to it. Signup and filtering are OFF in `_config.yml` until the setup below is finished. The church registration code must never go in a website file, GitHub variable, browser script or this guide.

## What is already prepared

- Signup with email, password and a server-checked church code; email verification before access.
- Google sign-in with a server-checked church code on first activation; existing approved members do not enter the code again. Revoked members cannot reactivate themselves with the code.
- Persistent sign-in, password reset, verification resend and sign-out.
- A server-only member library that updates the homepage, video tabs and search after sign-in.
- Public/shared watch links remain playable without sign-in.
- Member push delivery checks active membership and a verified, enabled Firebase account. Signing out unlinks this device from member alerts; public alerts remain subscribed.
- A separate named Firebase Auth instance for members preserves the existing anonymous device identity used by notifications, including on multiple devices.
- Public/member ID text files remain the editing interface. GitHub updates the private library automatically after publication; new titles/categories can load in the browser without running a local command.

## One-time Firebase setup

Before activation, revoke and renew the saved Firebase CLI authorization: an account-check command included authentication tokens in tool output. Do not reuse or copy that output. Remove the CLI's access through Google Account connections, then sign the CLI in again. Keep all debug logs out of Git; they are now ignored.

Use the existing `perceptive-zoo-424115-j6` Firebase project. The project owner must enable Cloud Functions deployment if it is not already available. Do not change billing or payment settings without the owner's approval.

1. In Authentication, enable Email/Password and Google. For Google, select the church support email and save. Google sign-in uses a popup to work with the current GitHub Pages/custom-domain hosting; allow popups if the browser blocks it. Include `localhost` explicitly in authorized domains for local tests. Keep Anonymous enabled for notification devices and signup sessions. Add `lightcityfellowship.com`, `www.lightcityfellowship.com` and the existing GitHub Pages hostname to the authorized domains. Review the verification/password-reset email templates and their sender identity.
2. Review the **current** Firestore rules before merging `firestore-rules.fragment`. These four collections must have no browser read/write access. Remove overlapping broad grants for them; a `false` rule does not override another matching `true` rule. Preserve the existing Flutter and web-push rules. The backend uses Admin credentials and remains able to access these collections.
3. From `tools/members`, install the Functions dependencies and use the Firebase CLI with the explicit existing project:

   ```powershell
   npm --prefix functions ci
   firebase functions:secrets:set CHURCH_REGISTRATION_CODE --project perceptive-zoo-424115-j6
   firebase deploy --only functions:lightcity-members --project perceptive-zoo-424115-j6
   ```

   Enter a long random code (at least 12 characters; a random multi-word code is easier to share). The CLI prompts privately. Do not put the code in the command line. Deploying functions is an external change and should be done only when activation is authorized. Changing the code later does not remove existing members.
4. In the BibleStudies GitHub repository, set `CHURCH_MEMBERS_ENABLED` to `true`. The existing `FIREBASE_SERVICE_ACCOUNT` secret must have Firestore write access. Run **Notify web subscribers → sync-members** once. This uploads the ID lists to the protected database and sends no notifications. Later successful site deployments sync the list automatically.
5. Turn `members_enabled` on first while keeping `video_visibility_enabled` off. Restart local Jekyll when changing configuration. Test Google signup with wrong/correct codes, returning Google members, popup cancellation and revoked-account rejection. Test email signup with wrong/correct codes, email verification, sign-in, password reset and sign-out against Firebase. Never use real member credentials in automated tests.
6. Once those live checks pass, turn `video_visibility_enabled` on. Test a signed-out browser (81 initial public videos), a signed-in member (938 initial videos), search and the featured video. Verify anonymous devices receive public alerts only and signed-in devices receive both. Shared direct Watch links must remain playable.

## Before enabling the public filter

- Rules are merged and confirmed on the actual project. The fragment is intentionally not connected to a blanket `firebase deploy`, which could replace unrelated Flutter rules.
- Backend functions are deployed in `us-central1`; the protected library is synced.
- Both feature switches and the GitHub variable are coordinated. Keep the current church site accessible until these checks pass.
- The custom-domain change, redirects, base URL and existing PWA subscriptions are a separate migration step. Do not change domains during signup testing.
- A public GitHub repository still exposes its source ID files. These checks protect browsing through the website, not access to public repository source or shared YouTube links. If the ID lists themselves must also be private, review repository visibility/hosting before launch.

## Administration

Set `churchMembers/{uid}.active` to `false` to remove access, or disable the Firebase Auth account. New library requests and member-alert batches check these records again. Already shared YouTube links remain watchable by design.

The backend rate-limits code attempts per account and IP. `churchRateLimits` documents carry `expiresAt`; enable Firestore TTL on that field to clean up expired counters. Do not expose these records to clients.

## Local checks (no accounts, emails or remote writes)

From the repository root:

```powershell
node tools/test-members.mjs
node tools/test-member-client.mjs
node tools/test-member-browsing.mjs
node tools/test-home-search.mjs
node tools/test-video-categories.mjs
node tools/test-video-visibility.mjs
node tools/test-pwa-prompts.mjs
```

Only mocked/local checks have been performed so far. Actual Firebase rules, mail delivery, deployed functions and end-to-end member notifications require the activation checks above.
