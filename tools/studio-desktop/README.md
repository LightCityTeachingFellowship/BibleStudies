# LightCity Studio for Windows

The Windows app displays the existing private Studio. The phone continues using
https://lightcityfellowship.com/Admin/ (installable on its home screen).
Both sign in to the same admin account and use the same Firebase services.

## First-time activation

1. From the project root, run `& .\tools\members\deploy-studio-desktop.ps1`.
   It configures token signing for the existing Firebase runtime service account
   and deploys only desktop connection and unresolved-report retrieval.
   It uses the existing Firebase CLI login; no service-account key is downloaded.
2. Commit and sync the website changes. Wait for website publishing to finish.
3. Run `& .\tools\studio-desktop\build.ps1` in your normal PowerShell window,
   then install `tools/studio-desktop/dist/LightCity-Studio-Setup-0.1.1.exe`.
4. Open Studio and select Sign in. Your normal browser opens. Compare the
   connection code shown in Windows, sign in with your admin Google account,
   then approve. Return to the Windows app.

The initial installer is unsigned; Windows may display a publisher warning.
Only approve an installer built from your own reviewed project.

When upgrading, choose Quit from Studio's tray menu first. Version 0.1.1 fixes
the Windows connection being absent at page startup and prevents Google sign-in
from falling back to a browser-only popup inside the desktop app. Commit/sync
the accompanying website changes as well; no additional backend deployment is
needed for this upgrade.

## Daily use

- Closing the Studio window hides it in the tray beside the Windows clock.
  Studio keeps checking for reports while the computer is awake and online.
- New reports open the alerts panel without taking keyboard focus from OBS.
  Native Windows banners are also requested; Windows notification settings apply.
- Reports remain in Firebase and the panel until Mark handled succeeds.
  Handling on the phone removes the same report in Windows at the next check.
  A network failure retains existing alerts instead of acknowledging them.
- Reports refresh every 10 seconds; the content catalogue every 30 seconds,
  and immediately on returning to Studio. This is shared-state synchronisation,
  not instant mirroring of unsaved form text.
- A ready share link appears in the panel and can be copied there.
- Desktop settings control sound, start with Windows and keeping the main window
  above other windows. They are local to this computer. The alerts panel itself
  stays above other windows until hidden.
- Choose Quit from the tray menu to stop Studio. No desktop alerts are delivered
  while Windows is shut down/asleep or the app has been quit. Existing phone
  push notifications continue using the web app's existing setup.

## Development and updates

Run `& .\tools\studio-desktop\build.ps1` to build a new installer. Runtime and
packaging caches and installers are ignored by Git and excluded from the website.
Do not commit generated installers or node_modules.
The hosted Studio interface updates with the website; native Electron security
updates require rebuilding and reinstalling the desktop app. An automatic
installer updater and code-signing certificate are not configured in this version.

Remote Studio has no Node.js access. The renderer is sandboxed and isolated;
native actions accept only the top-level production Admin page. Google sign-in
uses the normal browser and a short-lived, admin-approved, verifier-bound,
one-use Firebase connection. No password, token or verifier is placed in a URL.
