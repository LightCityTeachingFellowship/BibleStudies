param([switch]$Once)
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$script=Join-Path $PSScriptRoot 'run-studio-sync.mjs'
$node=(Get-Command node -ErrorAction Stop).Source
if($Once){& $node $script --once;return}
. (Join-Path $PSScriptRoot 'helper-startup.ps1')
$work=Join-Path $PSScriptRoot 'audio-library/work/studio-sync'
New-Item -ItemType Directory -Path $work -Force | Out-Null
@{disabled=$false;updatedAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $work 'supervisor-disabled.json') -Encoding ascii
Register-LightCityHelperTask -Name 'LightCity Studio Lists' -Runner (Join-Path $PSScriptRoot 'run-studio-sync.ps1') -WorkingDirectory $root -Description 'Keep Studio and local ID lists synchronized and recover stopped workers.'
Write-Host 'Studio list sync is enabled: sign-in startup plus a restart check every 3 minutes.'
Write-Host 'Save your text-file edits. While running, changes sync about every 15 seconds.'
