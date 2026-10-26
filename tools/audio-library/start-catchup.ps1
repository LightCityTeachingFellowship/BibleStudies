$ErrorActionPreference = 'Stop'
$taskName = 'LightCity Recorded Audio'
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction Stop
$expectedRunner = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'run-automatic.ps1'))
if (-not ($task.Actions.Arguments | Where-Object { $_.Contains('"' + $expectedRunner + '"') })) { throw 'The scheduled task does not match this audio helper. Nothing was stopped.' }
$lockPath = Join-Path $PSScriptRoot 'work/automatic-recorded/worker.lock'
$expectedWorker = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'automatic.mjs'))
# A scheduled PowerShell launcher can stop while its Node child keeps running.
# Identify only this helper's exact Node command before stopping its process tree.
$workerProcessId = $null
if (Test-Path -LiteralPath $lockPath) {
    $workerProcessId = [int](Get-Content -LiteralPath $lockPath)
    if ($workerProcessId -lt 1) { throw 'Invalid worker lock; nothing was stopped.' }
    if (Get-Process -Id $workerProcessId -ErrorAction SilentlyContinue) {
        $workerInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $workerProcessId" -ErrorAction Stop
        $workerPattern = '(?i)(?:^|\s)"?' + [regex]::Escape($expectedWorker) + '"?\s+run(?:\s|$)'
        if ($workerInfo.Name -ne 'node.exe' -or $workerInfo.CommandLine -notmatch $workerPattern) {
            throw 'The lock does not identify this audio worker. Nothing was stopped.'
        }
    } else { $workerProcessId = $null }
}
if ($task.State -eq 'Running') { Stop-ScheduledTask -TaskName $taskName }
if ($null -ne $workerProcessId -and (Get-Process -Id $workerProcessId -ErrorAction SilentlyContinue)) {
    & "$env:SystemRoot\System32\taskkill.exe" /PID $workerProcessId /T /F | Out-Null
    if ($LASTEXITCODE -ne 0 -and (Get-Process -Id $workerProcessId -ErrorAction SilentlyContinue)) {
        throw 'The identified audio worker could not stop. Saved queue progress is unchanged.'
    }
}
Start-ScheduledTask -TaskName $taskName
Write-Host 'Recorded-audio helper restarted. Saved progress and any YouTube cooldown are preserved. No keys are required again.'
Write-Host 'It downloads/uploads one recording at a time. Keep the computer on, signed in, and online.'
Write-Host 'Check progress with: node tools/audio-library/automatic.mjs status'
