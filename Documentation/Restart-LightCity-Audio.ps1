param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
$base = 'C:\Users\samvi\OneDrive\Desktop\LightCityApp_Project'
$oldPath = Join-Path $base 'LightCity-Website'
if (-not (Test-Path -LiteralPath $oldPath -PathType Container)) { throw 'The website project was not found. Nothing was changed.' }
$helpers = @(
    @{ Name='LightCity Recorded Audio'; Runner='tools\audio-library\run-automatic.ps1'; Work='tools\audio-library\work\automatic-recorded' },
    @{ Name='LightCity Studio Lists'; Runner='tools\run-studio-sync.ps1'; Work='tools\audio-library\work\studio-sync' }
)
foreach ($helper in $helpers) {
    try {
        $task = Get-ScheduledTask -TaskName $helper.Name -ErrorAction Stop
        $runner = Join-Path $oldPath $helper.Runner
        if (-not ($task.Actions.Arguments | Where-Object { $_ -like ('*"'+$runner+'"*') })) { throw 'The task does not use the expected audio helper. It was not started.' }
        if (-not $CheckOnly) {
            if ($task.State -eq 'Disabled') { throw 'The task is disabled. Review its settings before enabling it.' }
            if ($task.State -ne 'Running') { Start-ScheduledTask -TaskName $helper.Name -ErrorAction Stop }
        }
        $task = Get-ScheduledTask -TaskName $helper.Name -ErrorAction Stop
        Write-Host ($helper.Name + ': ' + $task.State)
        $heartbeat = Join-Path (Join-Path $oldPath $helper.Work) 'process-status.json'
        if (Test-Path -LiteralPath $heartbeat) {
            $state = Get-Content -LiteralPath $heartbeat -Raw | ConvertFrom-Json
            $age = [Math]::Round(([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() - $state.updatedAt) / 1000)
            Write-Host ('  Last worker heartbeat: ' + $age + ' seconds ago.')
        }
    } catch { Write-Warning ($helper.Name + ': ' + $_.Exception.Message) }
}
Write-Host 'For live audio, check that the LightCity OBS script is loaded in Tools > Scripts and start a normal stream when ready.'
Write-Host 'This script does not change OBS settings, delete recordings, or reset the saved queue.'
