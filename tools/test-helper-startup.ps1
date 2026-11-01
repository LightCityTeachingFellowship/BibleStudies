$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'helper-startup.ps1')
$script:existing=$null;$script:captured=$null;$script:started=0
# Validate the registration contract without altering a real Windows task.
function Get-ScheduledTask { [CmdletBinding()]param($TaskName); return $script:existing }
function New-ScheduledTaskAction {param($Execute,$Argument,$WorkingDirectory);return @{Execute=$Execute;Arguments=$Argument;WorkingDirectory=$WorkingDirectory}}
function New-ScheduledTaskTrigger {param([switch]$AtLogOn,$User,[switch]$Once,$At,$RepetitionInterval);return @{Login=[bool]$AtLogOn;Once=[bool]$Once;User=$User;At=$At;Interval=$RepetitionInterval}}
function New-ScheduledTaskPrincipal {param($UserId,$LogonType,$RunLevel);return @{User=$UserId;LogonType=$LogonType;RunLevel=$RunLevel}}
function New-ScheduledTaskSettingsSet {param($ExecutionTimeLimit,$MultipleInstances,[switch]$StartWhenAvailable,[switch]$AllowStartIfOnBatteries,[switch]$DontStopIfGoingOnBatteries,$RestartCount,$RestartInterval,[switch]$Hidden);return @{Limit=$ExecutionTimeLimit;Instances=$MultipleInstances;Available=[bool]$StartWhenAvailable;Battery=[bool]$AllowStartIfOnBatteries;KeepOnBattery=[bool]$DontStopIfGoingOnBatteries;RestartCount=$RestartCount}}
function Register-ScheduledTask {param($TaskName,$Action,$Trigger,$Principal,$Settings,$Description,[switch]$Force);$script:captured=@{Name=$TaskName;Action=$Action;Triggers=$Trigger;Principal=$Principal;Settings=$Settings}}
function Start-ScheduledTask {param($TaskName);$script:started++}
function Check($Value,$Message){if(-not $Value){throw $Message}}
$runner=Join-Path $PSScriptRoot 'run-studio-sync.ps1'
Register-LightCityHelperTask -Name 'Test task' -Runner $runner -WorkingDirectory $PSScriptRoot -Description 'Test'
Check ($script:captured.Triggers.Count -eq 2) 'Both sign-in and repeating checks are needed.'
Check ($script:captured.Triggers[0].Login -and $script:captured.Triggers[1].Once) 'Trigger types must match the Windows cmdlet parameter sets.'
Check ($script:captured.Triggers[1].Interval.TotalMinutes -eq 3) 'The recovery check must repeat every 3 minutes.'
Check ($script:captured.Settings.Instances -eq 'IgnoreNew' -and $script:captured.Settings.Limit -eq [TimeSpan]::Zero) 'No duplicate or time-limited workers.'
Check ($script:captured.Settings.Battery -and $script:captured.Settings.KeepOnBattery -and $script:captured.Settings.Available) 'Battery and delayed sign-in must not disable recovery.'
Check ($script:captured.Principal.LogonType -eq 'Interactive' -and $script:captured.Principal.RunLevel -eq 'Limited') 'Run under the signed-in user without elevation.'
Check ($script:captured.Action.Arguments.Contains('-WindowStyle Hidden') -and $script:started -eq 1) 'Start the existing hidden runner.'
$script:existing=@{Actions=@{Arguments='a different application'}};$script:captured=$null;$blocked=$false
try{Register-LightCityHelperTask -Name 'Test task' -Runner $runner -WorkingDirectory $PSScriptRoot}catch{$blocked=$true}
Check ($blocked -and $null -eq $script:captured) 'An unrelated task with the same name must be preserved.'
Write-Host 'PASS: repeated recovery, login startup, no duplicate tasks, no time limit, battery behavior, user-scoped execution and unrelated-task protection.'
