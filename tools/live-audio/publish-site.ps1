$ErrorActionPreference = 'Stop'
$watchUrl = Read-Host 'YouTube watch/share link for the broadcast that is live now'
$title = Read-Host 'Broadcast title'
$audience = Read-Host 'Who may listen? Enter members or public (default: members)'
if ([string]::IsNullOrWhiteSpace($audience)) { $audience = 'members' }
$audience = $audience.Trim().ToLowerInvariant()
if ($audience -notin @('members', 'public')) { throw 'Enter members or public.' }
$offsetText = Read-Host 'Audio timing adjustment in seconds (default: 0)'
if ([string]::IsNullOrWhiteSpace($offsetText)) { $offsetText = '0' }
Write-Host 'Publishing the newest local relay session. Keep this window open while broadcasting.'
& node (Join-Path $PSScriptRoot 'publish-site.mjs') --latest --video $watchUrl --title $title --visibility $audience --offset $offsetText
if ($LASTEXITCODE -ne 0) { throw 'Live publishing did not complete. Check the displayed setup message.' }
