param([switch]$Once)
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$script=Join-Path $PSScriptRoot 'run-studio-sync.mjs'
$node=(Get-Command node -ErrorAction Stop).Source
if($Once){& $node $script --once;return}
$taskName='LightCity Studio Lists'
$arguments='-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "'+(Join-Path $PSScriptRoot 'run-studio-sync.ps1')+'"'
$identity=[Security.Principal.WindowsIdentity]::GetCurrent().Name
$existing=Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if($existing -and $existing.Actions.Arguments -ne $arguments){throw 'A different task uses this name; it was kept unchanged.'}
$action=New-ScheduledTaskAction -Execute powershell.exe -Argument $arguments -WorkingDirectory $root
$trigger=New-ScheduledTaskTrigger -AtLogOn -User $identity
$principal=New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$settings=New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -Hidden
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Sync LightCity Studio video IDs with the local text files and apply saved removals.' -Force|Out-Null
Start-ScheduledTask -TaskName $taskName
Write-Host 'Studio list sync is enabled and starts when you sign in. This computer must be on and connected.'
Write-Host 'Save your text-file edits. Changes sync about every 15 seconds. YouTube uploads and stored audio files are kept.'