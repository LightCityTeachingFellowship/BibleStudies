$ErrorActionPreference='Stop'
$previousTimeout=$env:FUNCTIONS_DISCOVERY_TIMEOUT
Push-Location $PSScriptRoot
try{
 $env:FUNCTIONS_DISCOVERY_TIMEOUT='60'
 & firebase deploy --only functions:lightcity-members:reportChurchStreamIssue,functions:lightcity-members:getChurchStreamReports,functions:lightcity-members:resolveChurchStreamReport,functions:lightcity-members:notifyChurchStreamIssueOnWrite,functions:lightcity-members:getChurchStreamMessageTargets,functions:lightcity-members:sendChurchStreamMessage,functions:lightcity-members:getMyChurchStreamMessages --project perceptive-zoo-424115-j6
 if($LASTEXITCODE -ne 0){throw 'Stream reporting deployment did not complete.'}
 Write-Host 'Stream feedback, private replies and messages to everyone watching deployed. Commit/sync the website changes, then refresh Watch and Studio. The Windows installer does not need rebuilding.'
}finally{$env:FUNCTIONS_DISCOVERY_TIMEOUT=$previousTimeout;Pop-Location}
