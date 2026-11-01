$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'helper-supervisor.ps1')
$work=Join-Path $PSScriptRoot 'audio-library/work/studio-sync'
Invoke-LightCitySupervisor -Name 'Studio ID lists' -WorkDirectory $work -Attempt {
    $node=(Get-Command node -ErrorAction Stop).Source
    Invoke-LightCityWorker -Executable $node -Arguments @((Join-Path $PSScriptRoot 'run-studio-sync.mjs')) -WorkDirectory $work
}
