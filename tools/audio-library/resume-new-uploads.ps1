$ErrorActionPreference = 'Stop'
# Stop the old process before lifting the persistent pause.
& (Join-Path $PSScriptRoot 'stop-automatic.ps1')
$taskName = 'LightCity Recorded Audio'
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction Stop
$runner = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'run-automatic.ps1'))
if (-not ($task.Actions.Arguments | Where-Object { $_.Contains('"' + $runner + '"') })) { throw 'Task does not match this helper. Downloads remain paused.' }
$work = Join-Path $PSScriptRoot 'work/automatic-recorded'
@{ includeBacklog=$false; newUploadsOnly=$true; dailyDownloadLimit=2 } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $work 'schedule-policy.json') -Encoding ascii
@{ paused=$false } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $work 'downloads-paused.json') -Encoding ascii
Enable-ScheduledTask -TaskName $taskName | Out-Null
Start-ScheduledTask -TaskName $taskName
Write-Host 'New-upload and replacement audio enabled: maximum TWO download attempts per rolling 24 hours, including retries.'
Write-Host 'Backlog downloads remain paused. Existing bot-check cooldowns and saved progress are preserved.'