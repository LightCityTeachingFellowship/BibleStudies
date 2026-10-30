$ErrorActionPreference = 'Stop'
$previousTimeout = $env:FUNCTIONS_DISCOVERY_TIMEOUT
Push-Location $PSScriptRoot
try {
    $firebaseCommand = Get-Command firebase -ErrorAction Stop
    $firebaseAuthModule = Join-Path (Split-Path $firebaseCommand.Source -Parent) 'node_modules/firebase-tools/lib/auth.js'
    if (-not (Test-Path -LiteralPath $firebaseAuthModule)) { throw 'Firebase CLI was not found in the usual location. Check its installation.' }
    Write-Host 'Configuring secure browser sign-in for Windows Studio. No keys are displayed or saved.'
    & node .\setup-desktop-signing.mjs $firebaseAuthModule --configure
    if ($LASTEXITCODE -ne 0) { throw 'Windows signing setup did not finish. Review the message above.' }
    $env:FUNCTIONS_DISCOVERY_TIMEOUT = '60'
    & firebase deploy --only functions:lightcity-members:connectChurchStudioDesktop,functions:lightcity-members:getChurchStreamReports --project perceptive-zoo-424115-j6
    if ($LASTEXITCODE -ne 0) { throw 'Windows Studio service deployment did not complete.' }
    Write-Host 'Windows Studio services are ready. Commit and sync the website changes, then install LightCity Studio.'
} finally {
    $env:FUNCTIONS_DISCOVERY_TIMEOUT = $previousTimeout
    Pop-Location
}
