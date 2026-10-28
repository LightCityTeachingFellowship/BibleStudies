$ErrorActionPreference = 'Stop'
$previousDiscoveryTimeout = $env:FUNCTIONS_DISCOVERY_TIMEOUT
Push-Location $PSScriptRoot
try {
    $env:FUNCTIONS_DISCOVERY_TIMEOUT = '60'
    & firebase deploy --only functions:lightcity-members:manageChurchStudioTest,functions:lightcity-members:publishChurchStudioVideo,functions:lightcity-members:getChurchStudioPublication,functions:lightcity-members:removeChurchStudioVideo,functions:lightcity-members:getStudioHelperLibrary,functions:lightcity-members:getPublicVideoLibrary,functions:lightcity-members:shareChurchVideo,functions:lightcity-members:finishStudioPublication,functions:lightcity-members:checkStudioAudioReady,functions:lightcity-members:getChurchAdminDashboard --project perceptive-zoo-424115-j6 --force
    if ($LASTEXITCODE -ne 0) { throw 'Studio publishing deployment did not complete.' }
    Write-Host 'Studio publishing services deployed. Commit/sync the website changes before using the new form.'
} finally { $env:FUNCTIONS_DISCOVERY_TIMEOUT=$previousDiscoveryTimeout;Pop-Location }