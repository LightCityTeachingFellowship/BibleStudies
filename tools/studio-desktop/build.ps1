$ErrorActionPreference = 'Stop'
$beforeCache = $env:electron_config_cache
$beforeBuilder = $env:ELECTRON_BUILDER_CACHE
Push-Location $PSScriptRoot
try {
    $env:electron_config_cache = Join-Path $PSScriptRoot 'work/electron-cache'
    $env:ELECTRON_BUILDER_CACHE = Join-Path $PSScriptRoot 'work/builder-cache'
    New-Item -ItemType Directory -Force -Path $env:electron_config_cache,$env:ELECTRON_BUILDER_CACHE | Out-Null
    & npm.cmd ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Desktop dependencies could not be installed.' }
    & node node_modules/electron/install.js
    if ($LASTEXITCODE -ne 0) { throw 'The Windows app runtime could not be downloaded.' }
    & npm.cmd test
    if ($LASTEXITCODE -ne 0) { throw 'Desktop checks did not pass.' }
    & npm.cmd run dist
    if ($LASTEXITCODE -ne 0) { throw 'The Windows installer could not be built.' }
    Write-Host "Installer ready in $PSScriptRoot\dist"
} finally {
    $env:electron_config_cache = $beforeCache
    $env:ELECTRON_BUILDER_CACHE = $beforeBuilder
    Pop-Location
}
