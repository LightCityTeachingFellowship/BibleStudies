param([switch]$IncludeAI)
$ErrorActionPreference = 'Stop'
$previousDiscoveryTimeout = $env:FUNCTIONS_DISCOVERY_TIMEOUT
Push-Location $PSScriptRoot
try {
    $env:FUNCTIONS_DISCOVERY_TIMEOUT = '60'
    $targets = @('getChurchLearning','manageChurchLearning','manageMyChurchQuiz','getChurchQuizLeaderboard','changeChurchVideoPrivacy','releaseChurchLearning','notifyChurchLearning','getChurchAdminDashboard','getMyNotificationInbox','updateMyNotificationInbox','getMyReadingActivity','updateMyReadingActivity','getMyStudyCollections','updateMyStudyCollections')
    if ($IncludeAI) { $targets += @('manageChurchLearningAI','prepareChurchLearning') }
    $selection = ($targets | ForEach-Object { 'functions:lightcity-members:' + $_ }) -join ','
    & firebase deploy --only $selection --project perceptive-zoo-424115-j6 --force
    if ($LASTEXITCODE -ne 0) { throw 'The learning services were not fully deployed. Review the deployment output before retrying.' }
    Write-Host 'Learning services deployed. Publish the website changes to use the new Studio controls.'
    Write-Host 'Only selected teachings are processed. Drafts require approval. Existing quizzes are not regenerated.'
} finally {
    $env:FUNCTIONS_DISCOVERY_TIMEOUT=$previousDiscoveryTimeout
    Pop-Location
}
