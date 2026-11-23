param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
$website = Split-Path -Parent $PSScriptRoot
$android = Join-Path (Split-Path -Parent $website) 'LightCity-Android'
$gradleFile = Join-Path $android 'android\app\build.gradle'
$releaseScript = Join-Path $android 'build-release.py'
$packager = Join-Path $android 'prepare-from-website.py'
$websiteBuilder = Join-Path $PSScriptRoot 'Build-LightCity-Website-Windows.ps1'
foreach ($file in @($gradleFile, $releaseScript, $packager, $websiteBuilder)) {
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Required file is missing: $file" }
}
$gradle = Get-Content -LiteralPath $gradleFile -Raw
if ($gradle -notmatch '(?m)^\s*versionCode\s+(\d+)\s*$') { throw 'Android version code was not found.' }
$oldCode = [int]$Matches[1]
if ($gradle -notmatch '(?m)^\s*versionName\s+"(\d+)\.(\d+)\.(\d+)"\s*$') { throw 'Android version must use the format 1.2.3.' }
$major=[int]$Matches[1]; $minor=[int]$Matches[2]; $patch=[int]$Matches[3]
$update = Get-Content -LiteralPath (Join-Path $website 'android-update.json') -Raw | ConvertFrom-Json
if ($update.versionName -match '^(\d+)\.(\d+)\.(\d+)$') {
  $publishedMajor=[int]$Matches[1]; $publishedMinor=[int]$Matches[2]; $publishedPatch=[int]$Matches[3]
  if ($publishedMajor -gt $major -or ($publishedMajor -eq $major -and $publishedMinor -gt $minor)) { $major=$publishedMajor; $minor=$publishedMinor; $patch=$publishedPatch }
  elseif ($publishedMajor -eq $major -and $publishedMinor -eq $minor) { $patch=[Math]::Max($patch,$publishedPatch) }
}
$code = [Math]::Max($oldCode, [int]$update.versionCode) + 1
$releaseFolder = Join-Path $android 'releases'
do {
  $patch++
  $version = "$major.$minor.$patch"
  $finalApk = Join-Path $releaseFolder "LightCity-$version-production.apk"
} while (Test-Path -LiteralPath $finalApk)
if ($CheckOnly) { Write-Host "Next Android version: $version (code $code). No files changed."; return }
$updated = [regex]::Replace($gradle, '(?m)^(\s*versionCode\s+)\d+(\s*)$', ('$'+'{1}'+$code+'$'+'{2}'))
$updated = [regex]::Replace($updated, '(?m)^(\s*versionName\s+)"[^"]+"(\s*)$', ('$'+'{1}'+[char]34+$version+[char]34+'$'+'{2}'))
[System.IO.File]::WriteAllText($gradleFile, $updated, [System.Text.UTF8Encoding]::new($false))
Write-Host "Building Android version $version (code $code)."
$buildFolder = Join-Path $website '_windows-build-latest'
& $websiteBuilder
if (-not (Test-Path -LiteralPath (Join-Path $buildFolder 'v2\index.html') -PathType Leaf)) { throw 'Website build did not finish.' }
& python $packager --website-build $buildFolder --check-only
if ($LASTEXITCODE -ne 0) { throw 'Website validation failed.' }
& python $packager --website-build $buildFolder
if ($LASTEXITCODE -ne 0) { throw 'Could not prepare Android assets.' }
& python $releaseScript
if ($LASTEXITCODE -ne 0) { throw 'The signed Android build failed.' }
$builtApk = Join-Path $android 'android\app\build\outputs\apk\release\app-release.apk'
if (-not (Test-Path -LiteralPath $builtApk -PathType Leaf)) { throw 'Android build finished without an APK.' }
New-Item -ItemType Directory -Force -Path $releaseFolder | Out-Null
Copy-Item -LiteralPath $builtApk -Destination $finalApk
Write-Host "APK ready: $finalApk"
