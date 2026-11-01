function Register-LightCityHelperTask {
    param([string]$Name,[string]$Runner,[string]$WorkingDirectory,[string]$Description)
    $runnerPath=[IO.Path]::GetFullPath($Runner)
    $arguments='-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "'+$runnerPath+'"'
    $existing=Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue
    if($existing -and -not($existing.Actions.Arguments -contains $arguments)){throw 'A different task uses this name; it was kept unchanged.'}
    $identity=[Security.Principal.WindowsIdentity]::GetCurrent().Name
    $action=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments -WorkingDirectory $WorkingDirectory
    $login=New-ScheduledTaskTrigger -AtLogOn -User $identity
    # No repetition duration: the check remains enabled on subsequent days.
    $check=New-ScheduledTaskTrigger -Once -At ((Get-Date).AddMinutes(1)) -RepetitionInterval (New-TimeSpan -Minutes 3)
    $principal=New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
    $settings=New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -Hidden
    Register-ScheduledTask -TaskName $Name -Action $action -Trigger @($login,$check) -Principal $principal -Settings $settings -Description $Description -Force | Out-Null
    Start-ScheduledTask -TaskName $Name
}
