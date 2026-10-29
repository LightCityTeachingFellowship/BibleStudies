$ErrorActionPreference='Stop'
$previousTimeout=$env:FUNCTIONS_DISCOVERY_TIMEOUT
Push-Location $PSScriptRoot
try{
 $env:FUNCTIONS_DISCOVERY_TIMEOUT='60'
 & firebase deploy --only 'functions:lightcity-members:getMyStudyCollections,functions:lightcity-members:updateMyStudyCollections,functions:lightcity-members:getMyNotificationInbox,functions:lightcity-members:updateMyNotificationInbox' --project perceptive-zoo-424115-j6
 if($LASTEXITCODE -ne 0){throw 'The study hub deployment did not complete.'}
 Write-Host 'Private playlists and notification inbox deployed. Commit/sync website changes, then refresh the app.'
}finally{$env:FUNCTIONS_DISCOVERY_TIMEOUT=$previousTimeout;Pop-Location}
