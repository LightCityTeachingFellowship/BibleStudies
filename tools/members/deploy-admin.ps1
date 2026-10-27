$ErrorActionPreference = 'Stop'
$previousDiscoveryTimeout = $env:FUNCTIONS_DISCOVERY_TIMEOUT
Push-Location $PSScriptRoot
try {
    $env:FUNCTIONS_DISCOVERY_TIMEOUT = '60'
    Write-Host 'Deploying the private LightCity Studio catalogue service.'
    Write-Host 'Admin account: lightcityteachingfellowship@gmail.com (CHURCH_ADMIN_EMAILS).'
    & firebase deploy --only functions:lightcity-members:getChurchAdminDashboard --project perceptive-zoo-424115-j6
    if ($LASTEXITCODE -ne 0) { throw 'Admin service deployment did not complete. Review the Firebase message above.' }
    Write-Host 'Admin service deployed. Commit and sync the website files, then open https://lightcityfellowship.com/Admin/.'
} finally {
    $env:FUNCTIONS_DISCOVERY_TIMEOUT = $previousDiscoveryTimeout
    Pop-Location
}
