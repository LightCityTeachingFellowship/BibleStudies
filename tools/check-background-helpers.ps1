$ErrorActionPreference='Stop'
foreach($helper in @(@{Name='LightCity Recorded Audio';Work=(Join-Path $PSScriptRoot 'audio-library/work/automatic-recorded')},@{Name='LightCity Studio Lists';Work=(Join-Path $PSScriptRoot 'audio-library/work/studio-sync')})){
    Write-Host $helper.Name
    try{$task=Get-ScheduledTask -TaskName $helper.Name -ErrorAction Stop;$info=Get-ScheduledTaskInfo -TaskName $helper.Name -ErrorAction Stop;Write-Host ('  Windows task: '+$task.State+'; last result: '+$info.LastTaskResult+'; triggers: '+$task.Triggers.Count)}catch{Write-Host '  Windows task information is unavailable in this session.'}
    $heartbeat=Join-Path $helper.Work 'process-status.json'
    if(Test-Path -LiteralPath $heartbeat){try{$state=Get-Content -LiteralPath $heartbeat -Raw|ConvertFrom-Json;$age=[Math]::Round(([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()-$state.updatedAt)/1000);if($age -gt 60){Write-Host ('  NO RECENT HEARTBEAT: last seen '+$age+' seconds ago; saved state '+$state.state+' is not current.')}else{Write-Host ('  Worker: '+$state.state+'; heartbeat '+$age+' seconds ago; PID '+$state.pid)};if($state.phase){Write-Host ('  Phase: '+$state.phase)}}catch{Write-Host '  Worker heartbeat could not be read; retry shortly.'}}else{Write-Host '  No heartbeat from the updated worker yet.'}
    $path=Join-Path $helper.Work 'supervisor-status.json'
    if(Test-Path -LiteralPath $path){try{$state=Get-Content -LiteralPath $path -Raw|ConvertFrom-Json;Write-Host ('  Recovery: '+$state.state+'; '+$state.message)}catch{}}
    Write-Host ('  Log: '+(Join-Path $helper.Work 'supervisor.log'))
}
