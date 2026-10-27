$ErrorActionPreference = 'Stop'
$work = Join-Path $PSScriptRoot 'work/automatic-recorded'
New-Item -ItemType Directory -Path $work -Force | Out-Null
@{ paused=$true; reason='Paused while switching backlog processing to Takeout'; pausedAt=[DateTime]::UtcNow.ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $work 'downloads-paused.json') -Encoding ascii
$taskName = 'LightCity Recorded Audio'
$expectedRunner = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'run-automatic.ps1'))
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($task) {
    if (-not ($task.Actions.Arguments | Where-Object { $_.Contains('"' + $expectedRunner + '"') })) { throw 'A different task has this name. Pause saved, but that task was not changed.' }
    Disable-ScheduledTask -TaskName $taskName | Out-Null
    Stop-ScheduledTask -TaskName $taskName
}
$lockPath = Join-Path $work 'worker.lock'
if (Test-Path -LiteralPath $lockPath) {
    $workerProcessId = [int](Get-Content -LiteralPath $lockPath)
    if ($workerProcessId -lt 1) { throw 'Invalid worker lock. Pause saved; no unrelated process was stopped.' }
    if (Get-Process -Id $workerProcessId -ErrorAction SilentlyContinue) {
        $expectedWorker = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'automatic.mjs'))
        $info = Get-CimInstance Win32_Process -Filter "ProcessId = $workerProcessId"
        $pattern = '(?i)(?:^|\s)"?' + [regex]::Escape($expectedWorker) + '"?\s+run(?:\s|$)'
        if ($info.Name -ne 'node.exe' -or $info.CommandLine -notmatch $pattern) { throw 'Worker identity could not be verified. Pause saved; no unrelated process was stopped.' }
        & "$env:SystemRoot\System32\taskkill.exe" /PID $workerProcessId /T /F | Out-Null
        if ($LASTEXITCODE -ne 0 -and (Get-Process -Id $workerProcessId -ErrorAction SilentlyContinue)) { throw 'The audio worker could not stop. Pause remains saved.' }
    }
}
Write-Host 'Recorded YouTube downloader stopped and automatic startup disabled. Backlog and new-upload downloads stay paused.'
Write-Host 'Completed audio, queued progress, credentials, and live OBS audio are preserved.'