$ErrorActionPreference = 'Stop'
$path = Join-Path $PSScriptRoot '../live-audio/work/cloud-secrets.json'
$keys = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
$key = [string]$keys.LIVE_PLAYBACK_KEY
if ($key -notmatch '^[a-f0-9]{64}$') { throw 'The existing playback key is missing or invalid. Nothing was copied.' }
Set-Clipboard -Value $key
$key = $null
$keys = $null
Write-Host 'The existing playback key is on your clipboard; it has not been printed or saved to another file.'
Write-Host 'Paste it into the GitHub Actions repository secret named LIVE_AUDIO_PLAYBACK_KEY, then clear the clipboard.'
