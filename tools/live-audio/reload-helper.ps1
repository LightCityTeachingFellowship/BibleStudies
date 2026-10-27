$ErrorActionPreference = 'Stop'
$statePath = Join-Path $PSScriptRoot 'work/automatic/state.json'
if (-not (Test-Path -LiteralPath $statePath)) { throw 'No automatic live-audio helper status was found.' }
$state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
$helperProcessId = [int]$state.pid
if ($state.app -ne 'lightcity-automatic-audio' -or $helperProcessId -lt 1) { throw 'Helper identity is invalid. Nothing was stopped.' }
if (Get-Process -Id $helperProcessId -ErrorAction SilentlyContinue) {
    $expected = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'automatic/helper.mjs'))
    $info = Get-CimInstance Win32_Process -Filter "ProcessId = $helperProcessId"
    $pattern = '(?i)(?:^|\s)"?' + [regex]::Escape($expected) + '"?(?:\s|$)'
    if ($info.Name -ne 'node.exe' -or $info.CommandLine -notmatch $pattern) { throw 'The process is not the expected audio helper. Nothing was stopped.' }
    & "$env:SystemRoot\System32\taskkill.exe" /PID $helperProcessId /T /F | Out-Null
    if ($LASTEXITCODE -ne 0 -and (Get-Process -Id $helperProcessId -ErrorAction SilentlyContinue)) { throw 'The audio helper could not restart.' }
}
Write-Host 'The separate live-audio helper was stopped. OBS will reconnect it automatically within about 20 seconds while streaming.'
Write-Host 'Your main YouTube stream and OBS recording settings were not changed. Live audio may briefly reconnect.'