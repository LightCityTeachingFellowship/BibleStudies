$ErrorActionPreference='Stop'
$previousTimeout=$env:FUNCTIONS_DISCOVERY_TIMEOUT
Push-Location $PSScriptRoot
try {
 $env:FUNCTIONS_DISCOVERY_TIMEOUT='60'
 & firebase deploy --only functions:lightcity-members:getChurchCalendar,functions:lightcity-members:getMyPrayerGroup,functions:lightcity-members:preparePrayerJoin,functions:lightcity-members:manageChurchPrayerGroups,functions:lightcity-members:sendChurchPrayerReminders,functions:lightcity-members:getMyNotificationInbox --project perceptive-zoo-424115-j6
 if($LASTEXITCODE -ne 0){throw 'Prayer calendar deployment did not complete. Check the function results above.'}
} finally {$env:FUNCTIONS_DISCOVERY_TIMEOUT=$previousTimeout;Pop-Location}
