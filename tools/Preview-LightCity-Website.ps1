param([int]$Port = 4297)
$ErrorActionPreference = 'Stop'
$source = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$plugin = Join-Path $source 'tools\windows-jekyll'
$destination = Join-Path $source '_windows-build-preview'
$oldGemfile = $env:BUNDLE_GEMFILE
$oldJekyllEnv = $env:JEKYLL_ENV
try {
  $env:BUNDLE_GEMFILE = Join-Path $source 'tools\pages\Gemfile'
  $env:JEKYLL_ENV = 'production'
  Push-Location $source
  try {
    Write-Host "The first build can take a few minutes. Keep this window open."
    Write-Host "When ready, visit http://localhost:$Port/v2/"
    Write-Host 'Save changes, wait for regeneration to finish, then refresh the browser.'
    Write-Host 'Press Ctrl+C to stop the preview.'
    & bundle exec jekyll serve --destination $destination --plugins $plugin --host 127.0.0.1 --port $Port --watch --force_polling
    if ($LASTEXITCODE -ne 0) { throw "Preview stopped with an error (exit code $LASTEXITCODE)." }
  } finally { Pop-Location }
} finally {
  $env:BUNDLE_GEMFILE = $oldGemfile
  $env:JEKYLL_ENV = $oldJekyllEnv
}
