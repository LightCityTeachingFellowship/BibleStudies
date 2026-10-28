$ErrorActionPreference = 'Stop'
$settingsPath = Join-Path $PSScriptRoot 'work/automatic-recorded/local-source.json'
if (-not (Test-Path -LiteralPath $settingsPath)) { throw 'Local Audio Queue setup has not been completed.' }
$settings = Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json
$expected = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../Audio Queue'))
if ($settings.mode -ne 'local' -or [IO.Path]::GetFullPath($settings.input) -ne $expected -or -not $settings.deleteSourceAfterUpload) { throw 'The dedicated local queue settings need review.' }
& (Join-Path $PSScriptRoot 'setup-automatic.ps1') -EnableStartup
Write-Host 'LOCAL FILE MODE: only Audio Queue is processed. YouTube media downloading remains paused.'
Write-Host 'Queued video files are deleted only after verified audio upload and registration. No local source daily limit applies.'