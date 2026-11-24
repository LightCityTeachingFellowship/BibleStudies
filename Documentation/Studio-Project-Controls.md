# Website and Android work in LightCity Studio

Use `LightCity-Website` for the website and shared app interface, and `LightCity-Android` for the native Android project. Keep `LightCity-Release-Keys` separately and never upload it.

In the Windows Studio app, open **Project**:

- **Upload website changes to GitHub** finds changed, new and deleted files, shows the list, and commits and syncs the current branch after you confirm. Private and generated files are skipped. Syncing `master` triggers the website publishing workflow. If the branch has conflicting remote changes, Studio stops and asks you to resolve them; it never force-pushes.
- **Build Android APK** automatically chooses a higher Android version and version code, builds the website, checks and packages it, and builds a signed APK in `LightCity-Android/releases`. It does not upload the APK. A failed build may leave the new version number reserved; the next build advances again.
- **Release app** requires the website project to be synced and selects the APK you already tested. Build that APK from the synced website version first. It checks its package, version and production signature, prepares a GitHub draft, verifies the uploaded file, and asks for final confirmation. On confirmation it publishes the release and updates only the download page and app update metadata. It reports website publication progress. A draft can be left unpublished and resumed by choosing the same APK again.

The Windows Studio installer must be updated for these menu changes to appear. The mobile/web Studio cannot access this computer's files.

The recorded-audio and Studio-list scheduled helpers now run from `LightCity-Website`. Their saved queues and protected local configuration were preserved. The recorded-audio queue is `C:\Users\samvi\Videos\Audio-Queue`, outside OneDrive. Update recording programs and shortcuts to use this new path; old queue paths are not monitored. Keep the old project folder for other tools that may still use it.
