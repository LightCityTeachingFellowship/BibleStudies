$ErrorActionPreference='Stop'
$previousTimeout=$env:FUNCTIONS_DISCOVERY_TIMEOUT
Push-Location $PSScriptRoot
try{
 $env:FUNCTIONS_DISCOVERY_TIMEOUT='60'
 & firebase deploy --only functions:lightcity-members:reportChurchStreamIssue,functions:lightcity-members:getChurchStreamReports,functions:lightcity-members:resolveChurchStreamReport,functions:lightcity-members:notifyChurchStreamIssueOnWrite --project perceptive-zoo-424115-j6
 if($LASTEXITCODE -ne 0){throw 'Stream reporting deployment did not complete.'}
 Write-Host 'Stream reporting deployed, including private Admin test feedback. Commit/sync the website changes, then refresh Watch and Studio. The Windows installer does not need rebuilding.'
}finally{$env:FUNCTIONS_DISCOVERY_TIMEOUT=$previousTimeout;Pop-Location}
