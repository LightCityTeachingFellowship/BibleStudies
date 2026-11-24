# Building the website on Windows

The Windows build helper keeps article addresses unchanged and gives generated files Windows-compatible names. Use the preview server's matching filename mapping to preview links with characters such as a colon. Do not upload this Windows-encoded output as the live website; the website's normal Linux publishing workflow creates the live output.

Before a release, reconcile `LightCity-Website` with the current website repository and review local edits. The helper builds whatever is currently in that folder; it does not download or verify the latest published website.

Open PowerShell and run:

```powershell
& "C:\Users\samvi\OneDrive\Desktop\LightCityApp_Project\LightCity-Website\tools\Build-LightCity-Website-Windows.ps1"
```

Wait for `Website build completed successfully.` The helper replaces the previous successful build in the `_windows-build-latest` folder. If a build fails, the previous successful build is kept. Copy that path; do not use a folder from a failed build. The website can take several minutes to build. Warnings about Sass deprecations are not by themselves build errors. Destination conflict warnings can mean that pages overwrite one another and should be investigated.

To prepare the Android app, substitute the printed folder path in both commands below. Type the real path; `PASTE THE BUILD FOLDER PATH HERE` is a placeholder.

```powershell
cd "C:\Users\samvi\OneDrive\Desktop\LightCityApp_Project\LightCity-Android"
python prepare-from-website.py --website-build "PASTE THE BUILD FOLDER PATH HERE" --check-only
python prepare-from-website.py --website-build "PASTE THE BUILD FOLDER PATH HERE"
```

Run the second command only after the first reports success. These commands do not build an APK. For the APK build and signing steps, use `How-to-Build-an-Android-APK.md`.

The helper relies on Ruby, Bundler and the website's installed gems. If Bundler reports missing gems, resolve that error first. If it reports a duplicate destination or another error, keep the printed output and ask for help rather than publishing the incomplete output.

## Automatic local preview

Run this in PowerShell and keep the window open:

```powershell
& "C:\Users\samvi\OneDrive\Desktop\LightCityApp_Project\LightCity-Website\tools\Preview-LightCity-Website.ps1"
```

After the first build finishes, open http://localhost:4297/v2/. Save your changes, wait for regeneration to finish, then refresh the browser. Press Ctrl+C to stop. The preview uses `_windows-build-preview`, separate from the Android build. Changes to `_config.yml` require restarting the preview. The preview does not publish the website. Windows-encoded addresses may not all resolve in the preview server; check unusual article links on the published site.
