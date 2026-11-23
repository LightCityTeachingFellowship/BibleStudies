# LightCity Android app: release guide

**Current workflow:** Use Studio → Project → Release app after testing the signed APK. See `Studio-Project-Controls.md`. The older manual commands and historical paths below are retained for reference; do not reuse a dated build folder.

This guide records how LightCity Android updates are built and published. The website and Android app use the same app interface. An APK is the Android installation file.

## The release process at a glance

1. Build the current website and use its generated files in the Android app.
2. Increase the app's version number and version code.
3. Build the APK with the existing production signing key.
4. Test it on an Android phone, including installing it over the previous version.
5. Upload the APK to a GitHub release and copy its direct download link.
6. Check the APK's SHA-256 hash, then update the website's download page and update information.
7. Wait for the website to publish and verify the download and update on a phone.

## Important files and locations

- New app project: `C:\Users\samvi\OneDrive\Desktop\LightCityApp_Project\LightCity-App-Website`
- Android build project used for version 1.0.4: `C:\Users\samvi\OneDrive\Desktop\LightCityApp_Project\LightCity-Android`
- Full website working copy: `C:\Users\samvi\OneDrive\Desktop\LightCityApp_Project\LightCity-Website-Source` (snapshot; check against the current GitHub repository before building).
- Website and releases: https://github.com/LightCityTeachingFellowship/BibleStudies
- Website download page: https://lightcityfellowship.com/downloads/
- Android update information: https://lightcityfellowship.com/android-update.json

The app project and Android build project are separate folders inside LightCityApp_Project. See How-to-Build-an-Android-APK.md for the build steps at their current locations.

## 1. Prepare and build the APK

The Android build must use the **production signing key** used for the last release. Keep the key file, alias, and passwords backed up securely. Do not upload them to GitHub or put passwords in this document. If the signing key changes, Android will not install the new APK as an update to an app signed with the old key.

The app's version is set in `android/app/build.gradle` inside the Android build project. Each release needs a `versionCode` greater than the previous release; `versionName` is the version people see. For example:

```gradle
versionCode 32
versionName "1.0.4"
```

Build the updated website first, producing a complete Jekyll `_site` folder. Then open PowerShell in the Android build project and use the generated website files:

```powershell
python prepare-from-website.py --website-build "C:\Users\samvi\OneDrive\Desktop\LightCityApp_Project\LightCity-Website-Source\_android-build-2026-11-19" --check-only
python prepare-from-website.py --website-build "C:\Users\samvi\OneDrive\Desktop\LightCityApp_Project\LightCity-Website-Source\_latest-build"
python build-release.py
```

The path above is the actual website snapshot checked on 19 November 2026. After later website changes, replace it with the path to a newly generated build. The first command checks the input; the second copies the website files into Android assets; the last builds the signed release. The build script reads the protected signing credentials stored for this Windows account. If those credentials or the signing key are unavailable, restore them from your secure backup rather than creating a new key.

The resulting APK is at `android\app\build\outputs\apk\release\app-release.apk`. Copy it to a clearly named file such as `LightCity-1.0.3-production.apk`. Before publishing, test on a phone with the last production version installed. Confirm that Android offers an update without asking you to uninstall and check important features, including sign-in and video playback.

## 2. Upload the APK to GitHub

1. Open the repository's **Releases** page and choose **Draft a new release**.
2. Create a tag without spaces, such as `v1.0.3`, and give the release a clear title.
3. Attach the tested APK under **Assets** and publish the release when ready.
4. On the published release page, right-click the APK filename and choose **Copy link address**. This is the direct APK link used in the next steps.

Uploading an APK alone does not change the website's download button or tell existing installations that an update is available.

## 3. Check the file's SHA-256 hash

The hash identifies the exact file and lets the app detect a damaged or different download. In PowerShell, enter `Get-FileHash ` including the space, drag the APK into the window, add ` -Algorithm SHA256`, and press Enter. For example:

```powershell
Get-FileHash "C:\Users\samvi\OneDrive\Desktop\LightCityApp_Project\LightCity-Android> Get-FileHash C:\Users\samvi\OneDrive\Desktop\LightCityApp_Project\LightCity-Android\LightCity-1.0.3-production.apk" -Algorithm SHA256
```

Replace the example path with the real file. Compare the result with the `sha256` digest displayed beside the uploaded GitHub asset. They must match. Use lowercase letters for the hash in `android-update.json`.

## 4. Update the website download page

Open https://github.com/LightCityTeachingFellowship/BibleStudies/blob/master/downloads.html and click the pencil icon. Find the existing APK download URL and replace it with the direct link copied from the new release. Select **Commit changes**. Do not change the member access link.

## 5. Tell installed apps about the update

Open https://github.com/LightCityTeachingFellowship/BibleStudies/blob/master/android-update.json and click the pencil icon. Change all four values to match the new APK:

```json
{
  "versionCode": 30,
  "versionName": "1.0.2",
  "downloadUrl": "https://github.com/LightCityTeachingFellowship/BibleStudies/releases/download/v1.0.2/LightCity-1.0.2-production.apk",
  "sha256": "edd281b61e4998056cb273a1a663c08846892304c9e9d43a3be3016c1fc49821"
}
```

This is the **1.0.2 example**. For a later release, replace the version code, version name, URL and hash with that release's values. Keep the JSON quotation marks and commas. Commit the changes only after the APK is published and the hash matches.

## 6. Confirm publication and the update

1. In the repository, open **Actions** and find **Publish audio-ready website** for the latest commit. Wait for a green check. If it fails, open the run to see the error; do not assume the update is live.
2. Visit the website download page and confirm its button points to the new APK. Check `android-update.json` at the live address above to confirm its values.
3. Open the old installed app on a phone and test the update. It checks when opened, but after a successful check it may wait up to six hours before checking again. Android asks the user to approve installation and may ask permission to install apps from LightCity. The update is not installed silently.

## Release record

| Release | Version code | Notes |
| --- | --- | --- |
| 1.0.1 | 29 | Previous production APK. |
| 1.0.2 | 30 | Signed with the same production key as 1.0.1; includes the updated website interface and fullscreen changes. |

Add each new production release here after verifying it. Record its version code and release link, but never record signing passwords or private keys in this file.
