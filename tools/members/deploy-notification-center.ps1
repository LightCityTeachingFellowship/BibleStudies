$ErrorActionPreference = 'Stop'
$previousTimeout = $env:FUNCTIONS_DISCOVERY_TIMEOUT
Push-Location $PSScriptRoot
try {
  $env:FUNCTIONS_DISCOVERY_TIMEOUT = '60'
  & firebase deploy --only "functions:lightcity-members:manageChurchNotifications,functions:lightcity-members:manageChurchStudioTest,functions:lightcity-members:churchNotificationImage,functions:lightcity-members:finishStudioPublication,functions:lightcity-members:notifyChurchLearning,functions:lightcity-members:manageChurchPrayerGroups,functions:lightcity-members:sendChurchPrayerReminders,functions:lightcity-members:notifyChurchStreamIssueOnWrite,functions:lightcity-members:getMyNotificationInbox" --project perceptive-zoo-424115-j6
  if ($LASTEXITCODE -ne 0) { throw 'Notification service deployment did not complete. Check the results above.' }
  Write-Host 'Notification services deployed. Upload the website changes to make the Studio page available.'
} finally {
  $env:FUNCTIONS_DISCOVERY_TIMEOUT = $previousTimeout
  Pop-Location
}
