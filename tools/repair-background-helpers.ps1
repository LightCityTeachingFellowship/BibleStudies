param([switch]$Restart)
$ErrorActionPreference='Stop'
$failures=@()
if($Restart){
    $root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
    $targets=@(
        @{Task='LightCity Recorded Audio';Work=(Join-Path $PSScriptRoot 'audio-library/work/automatic-recorded');Worker=(Join-Path $PSScriptRoot 'audio-library/automatic.mjs');Runner=(Join-Path $PSScriptRoot 'audio-library/run-automatic.ps1')},
        @{Task='LightCity Studio Lists';Work=(Join-Path $PSScriptRoot 'audio-library/work/studio-sync');Worker=(Join-Path $PSScriptRoot 'run-studio-sync.mjs');Runner=(Join-Path $PSScriptRoot 'run-studio-sync.ps1')}
    )
    # Validate the registered tasks and exact worker command lines before stopping anything.
    foreach($target in $targets){
        $task=Get-ScheduledTask -TaskName $target.Task -ErrorAction SilentlyContinue
        if($task -and -not($task.Actions.Arguments | Where-Object {$_ -like ('*"'+$target.Runner+'"*')})){throw ('A different task uses '+$target.Task+'. Nothing was stopped.')}
        $heartbeat=Join-Path $target.Work 'process-status.json'
        $target.WorkerProcess=$null
        if(Test-Path -LiteralPath $heartbeat){
            $workerProcessId=[int](Get-Content -LiteralPath $heartbeat -Raw|ConvertFrom-Json).pid
            if($workerProcessId -gt 0){
                $process=Get-CimInstance Win32_Process -Filter ('ProcessId = '+$workerProcessId)
                if($process){
                    if($process.Name -ne 'node.exe' -or $process.CommandLine.IndexOf($target.Worker,[StringComparison]::OrdinalIgnoreCase) -lt 0){throw ('The saved process for '+$target.Task+' no longer matches. Nothing was stopped.')}
                    $target.WorkerProcess=$workerProcessId
                }
            }
        }
    }
    foreach($target in $targets){
        @{disabled=$true;updatedAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $target.Work 'supervisor-disabled.json') -Encoding ascii
    }
    foreach($target in $targets){
        if(Get-ScheduledTask -TaskName $target.Task -ErrorAction SilentlyContinue){Stop-ScheduledTask -TaskName $target.Task}
        if($target.WorkerProcess -and (Get-Process -Id $target.WorkerProcess -ErrorAction SilentlyContinue)){
            Stop-Process -Id $target.WorkerProcess -ErrorAction Stop
            Wait-Process -Id $target.WorkerProcess -Timeout 10 -ErrorAction SilentlyContinue
        }
    }
    $maintenance=Join-Path $PSScriptRoot 'audio-library/work/studio-sync/sync.lock'
    if((Test-Path -LiteralPath $maintenance) -and (Get-Content -LiteralPath $maintenance -Raw).StartsWith('Maintenance: replacement repair in progress.')){Remove-Item -LiteralPath $maintenance}
    Write-Host 'Only the two verified background helpers were stopped. OBS and its live audio relay were not changed.'
}
foreach($helper in @(@{Name='Recorded audio';Script=(Join-Path $PSScriptRoot 'audio-library/start-local.ps1')},@{Name='Studio ID lists';Script=(Join-Path $PSScriptRoot 'start-studio-sync.ps1')})){
    try { & $helper.Script; Write-Host ($helper.Name+': startup and recovery updated.') }
    catch { $failures+=$helper.Name; Write-Warning ($helper.Name+': '+$_.Exception.Message) }
}
if($failures.Count){throw ('Windows could not update: '+($failures -join ', ')+'. Run this script from your normal Windows PowerShell under the account used for setup.')}
Write-Host 'Both helpers start at sign-in and are checked every 3 minutes while you are signed in.'
if($Restart){Write-Host 'Both helpers were restarted with the updated code.'}else{Write-Host 'Active tasks are not interrupted. Extra launches are ignored; intentional pauses are respected.'}
Write-Host 'No Firebase deployment or credential entry is required. Use tools/check-background-helpers.ps1 to inspect health.'
