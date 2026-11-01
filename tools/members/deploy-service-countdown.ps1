$ErrorActionPreference='Stop'
$previousTimeout=$env:FUNCTIONS_DISCOVERY_TIMEOUT
Push-Location $PSScriptRoot
try{
 $env:FUNCTIONS_DISCOVERY_TIMEOUT='60'
 & firebase deploy --only functions:lightcity-members:getChurchServiceSchedule,functions:lightcity-members:manageChurchServiceSchedule --project perceptive-zoo-424115-j6
 if($LASTEXITCODE -ne 0){throw 'Service countdown deployment did not complete.'}
 Write-Host 'Service schedule deployed. Commit/sync the countdown screen and Studio settings, then open Studio > Service countdown.'
}finally{$env:FUNCTIONS_DISCOVERY_TIMEOUT=$previousTimeout;Pop-Location}
