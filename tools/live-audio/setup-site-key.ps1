$ErrorActionPreference = 'Stop'
$secretsPath = Join-Path $PSScriptRoot 'work/cloud-secrets.json'
if (-not (Test-Path -LiteralPath $secretsPath)) { throw 'The existing gateway setup file is missing. Keep the original private setup file; do not create a replacement key.' }
$keys = Get-Content -Raw -LiteralPath $secretsPath | ConvertFrom-Json
$playback = [string]$keys.LIVE_PLAYBACK_KEY
if ($playback -notmatch '^[a-f0-9]{64}$') { throw 'The existing private playback key could not be validated.' }
Write-Host 'Saving the existing gateway playback key to Firebase Secret Manager for the site backend.'
Write-Host 'The key is piped privately to the Firebase CLI. No new key file is created and the key is not displayed.'
Push-Location (Join-Path $PSScriptRoot '../members')
try {
    $playback | & firebase functions:secrets:set LIVE_AUDIO_PLAYBACK_KEY --data-file - --non-interactive --project perceptive-zoo-424115-j6
    if ($LASTEXITCODE -ne 0) { throw 'Secret setup did not complete. Check Firebase sign-in and project access, then retry.' }
    Write-Host 'Playback key saved. Deploy getChurchLiveAudio next; this helper does not deploy any function.'
} finally {
    $playback = $null
    $keys = $null
    Pop-Location
}
