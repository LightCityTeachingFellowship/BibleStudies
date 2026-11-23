param([string]$Destination = '')
$ErrorActionPreference = 'Stop'
$source = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot)).TrimEnd('\')
$latest = Join-Path $source '_windows-build-latest'
if ($Destination -and [IO.Path]::GetFullPath($Destination).TrimEnd('\') -ine $latest) { throw 'Website builds must use the _windows-build-latest folder.' }
$plugin = Join-Path $source 'tools\windows-jekyll'
$gemfile = Join-Path $source 'tools\pages\Gemfile'
if (Test-Path -LiteralPath (Join-Path $source '_plugins')) { throw 'Website plugins need to be included in the Windows build helper before building.' }
function Assert-SafeBuildFolder([string]$Path) {
  $absolute = [IO.Path]::GetFullPath($Path).TrimEnd('\')
  if ((Split-Path -Parent $absolute) -ine $source -or (Split-Path -Leaf $absolute) -notmatch '^_windows-build-(latest|pending-[a-f0-9]{32}|backup-[a-f0-9]{32}|\d{8}-\d{6})$') { throw "Unsafe build folder: $absolute" }
  if (Test-Path -LiteralPath $absolute) {
    $item = Get-Item -LiteralPath $absolute -Force
    if (-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Build folder is a link or is not a folder: $absolute" }
    if (Get-ChildItem -LiteralPath $absolute -Recurse -Force -Attributes ReparsePoint -ErrorAction Stop | Select-Object -First 1) { throw "Build folder contains a link: $absolute" }
  }
  return $absolute
}
function Remove-SafeBuildFolder([string]$Path) { $checked=Assert-SafeBuildFolder $Path; if(Test-Path -LiteralPath $checked){Remove-Item -LiteralPath $checked -Recurse -Force -ErrorAction Stop} }
$id = [Guid]::NewGuid().ToString('N')
$pending = Assert-SafeBuildFolder (Join-Path $source "_windows-build-pending-$id")
$backup = Assert-SafeBuildFolder (Join-Path $source "_windows-build-backup-$id")
$latest = Assert-SafeBuildFolder $latest
$lockPath = Join-Path $source '_windows-build.lock'
try { $lock = [IO.File]::Open($lockPath,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None) } catch { throw 'A website build is already running.' }
$oldGemfile = $env:BUNDLE_GEMFILE; $oldJekyllEnv = $env:JEKYLL_ENV
$movedOld = $false
try {
  $env:BUNDLE_GEMFILE=$gemfile; $env:JEKYLL_ENV='production'
  Push-Location $source
  try {
    Write-Host "Building website into a temporary folder."
    & bundle exec jekyll build --destination $pending --plugins $plugin
    if ($LASTEXITCODE -ne 0) { throw "Website build failed (exit code $LASTEXITCODE). The previous build was kept." }
    if (-not (Test-Path -LiteralPath (Join-Path $pending 'v2\index.html') -PathType Leaf)) { throw 'Website build is incomplete. The previous build was kept.' }
    [void](Assert-SafeBuildFolder $pending)
    if (Test-Path -LiteralPath $latest) { [IO.Directory]::Move($latest, $backup); $movedOld=$true }
    try { [IO.Directory]::Move($pending, $latest) } catch { if($movedOld){[IO.Directory]::Move($backup, $latest);$movedOld=$false}; throw }
    if($movedOld){Remove-SafeBuildFolder $backup; $movedOld=$false}
    Get-ChildItem -LiteralPath $source -Directory -Force | Where-Object { $_.Name -match '^_windows-build-(?:\d{8}-\d{6}|pending-[a-f0-9]{32}|backup-[a-f0-9]{32})$' } | ForEach-Object { Remove-SafeBuildFolder $_.FullName }
    Write-Host 'Website build completed successfully.'
    Write-Host "Build folder: $latest"
  } finally { Pop-Location }
} finally {
  $env:BUNDLE_GEMFILE=$oldGemfile; $env:JEKYLL_ENV=$oldJekyllEnv
  try { if (Test-Path -LiteralPath $pending) { Remove-SafeBuildFolder $pending } } finally { $lock.Dispose() }
}
