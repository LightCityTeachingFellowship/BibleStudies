# How to build a LightCity Android APK

The Android project is at:

`C:\Users\samvi\OneDrive\Desktop\LightCityApp_Project\LightCity-Android`

The app interface project is at:

`C:\Users\samvi\OneDrive\Desktop\LightCityApp_Project\LightCity-App-Website`

The full website working copy, including the unified app files in its `v2` folder, is at:

`C:\Users\samvi\OneDrive\Desktop\LightCityApp_Project\LightCity-Website`

Check the project against the current published GitHub repository before using it for a new release. The `_android-build-2026-11-19` folder contains the website build checked on 19 November 2026, including the shared-link update. It is a snapshot; create a fresh website build after later website changes before building a later release.

The Android build signs releases with the existing production key. The signing credentials remain protected for this Windows account in `C:\Users\samvi\OneDrive\Desktop\LightCityApp_Project\LightCity-Release-Keys`. Keep a secure backup of the key, its alias and passwords; never add them to the project or upload them to GitHub. Replacing the key would prevent Android from updating an existing installation signed with the old key.

## Before you begin

1. Make sure the website changes you want are finished and a fresh, complete Jekyll website build is available. The build folder contains `v2`, `script`, `style`, `category-data.json` and `publication-details.json`. Jekyll usually names it `_site`; the checked copy below has a dated name. A source folder or an old preview is not a substitute for the generated website build.
2. Check that Android Studio and its Android SDK are installed. The release script uses Android Studio's bundled Java and the Gradle dependencies already downloaded on this computer.
3. Open `LightCity-Android\android\app\build.gradle` in an editor. Increase `versionCode` by at least one and set the new `versionName`. For example, after 1.0.2 / code 30, the next version could be 1.0.3 / code 31. Never reuse a version code for a new release.

## Package the current website and build

First follow **Windows-Website-Build-Guide.md** to create a fresh build and copy the build folder path printed when it succeeds. Do not reuse an old dated folder for a new release. Then open PowerShell and run:

```powershell
cd "C:\Users\samvi\OneDrive\Desktop\LightCityApp_Project\LightCity-Android"
$buildFolder = Read-Host "Paste the successful website build folder path"
python prepare-from-website.py --website-build $buildFolder --check-only
```

If validation succeeds, run:

```powershell
python prepare-from-website.py --website-build $buildFolder
python build-release.py
```

The first command copies the unified app, styles and compatibility files into the Android project and updates its cache version. The second builds and signs the release. Wait for **BUILD SUCCESSFUL**. If a command reports an error, stop rather than publishing an older APK.

The APK is created at:

`C:\Users\samvi\OneDrive\Desktop\LightCityApp_Project\LightCity-Android\android\app\build\outputs\apk\release\app-release.apk`

Copy it to a descriptive name, for example `LightCity-1.0.3-production.apk`. Test the APK on a phone with the previous production release installed. Confirm that Android offers to update it without uninstalling, and check signing in, member content, playback and fullscreen. The build does not upload the APK or notify users.


## If Gradle cannot delete a build folder

If a build fails with “Unable to delete directory” inside a `build\intermediates` folder, the generated files may have become read-only when the project was moved or synced with OneDrive. Close programs using those build files, then ask for help clearing the read-only flags on the generated build folders. These are temporary outputs; keep your source files and signing folder untouched. The `flatDir` and deprecated Gradle messages alone are warnings, not the cause of this particular failure.
## Publish after testing

Follow **Android-App-Release-Guide.md** in this Documentation folder for the GitHub release, checking the APK hash, updating the website download link and update information, and confirming the website deployment. Android asks users to approve installation; updates are not silent.

For a future update, use the same production signing key and app ID. If the protected credentials or key cannot be accessed, restore the existing key from backup; do not create a replacement key for the same update path.


