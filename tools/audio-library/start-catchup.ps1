$ErrorActionPreference = 'Stop'
$taskName = 'LightCity Recorded Audio'
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction Stop
$expectedRunner = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'run-automatic.ps1'))
if (-not ($task.Actions.Arguments | Where-Object { $_.Contains('"' + $expectedRunner + '"') })) { throw 'The scheduled task does not match this audio helper. Nothing was stopped.' }
if ($task.State -eq 'Running') {
    Stop-ScheduledTask -TaskName $taskName
    $lockPath = Join-Path $PSScriptRoot 'work/automatic-recorded/worker.lock'
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        if (-not (Test-Path -LiteralPath $lockPath)) { break }
        $workerProcessId = [int](Get-Content -LiteralPath $lockPath)
        if (-not (Get-Process -Id $workerProcessId -ErrorAction SilentlyContinue)) { break }
        Start-Sleep -Seconds 1
    }
    if ((Test-Path -LiteralPath $lockPath) -and (Get-Process -Id ([int](Get-Content -LiteralPath $lockPath)) -ErrorAction SilentlyContinue)) { throw 'The previous worker is still finishing. Wait briefly before running this command again.' }
}
Start-ScheduledTask -TaskName $taskName
Write-Host 'Recorded-audio helper restarted with the prepared catch-up batch. No keys are required again.'
Write-Host 'It downloads/uploads one recording at a time. Keep the computer on, signed in, and online.'
Write-Host 'Check progress with: node tools/audio-library/automatic.mjs status'
