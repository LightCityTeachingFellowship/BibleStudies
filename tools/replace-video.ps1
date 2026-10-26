$ErrorActionPreference = 'Stop'
$previousVideo = Read-Host 'Livestream video ID or YouTube link being replaced'
$uploadedVideo = Read-Host 'Uploaded recording video ID or YouTube link'
& node (Join-Path $PSScriptRoot 'replace-video.mjs') --from $previousVideo --to $uploadedVideo --apply
if ($LASTEXITCODE -ne 0) { throw 'Replacement was not completed. Read the error above before retrying.' }
