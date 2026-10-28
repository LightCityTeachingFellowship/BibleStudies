$ErrorActionPreference='Stop'
& (Get-Command node -ErrorAction Stop).Source (Join-Path $PSScriptRoot 'run-studio-sync.mjs')
if($LASTEXITCODE -ne 0){throw 'Studio list synchronization stopped. Run start-studio-sync.ps1 to retry.'}