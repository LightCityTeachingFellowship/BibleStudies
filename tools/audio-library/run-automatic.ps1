param([switch]$Once)
$ErrorActionPreference = 'Stop'
$work = Join-Path $PSScriptRoot 'work/automatic-recorded'
$localFile=Join-Path $work 'local-source.json'
$localMode=(Test-Path -LiteralPath $localFile) -and (Get-Content -LiteralPath $localFile -Raw|ConvertFrom-Json).mode -eq 'local'
$pauseFile = Join-Path $work 'downloads-paused.json'
if (-not $localMode -and (Test-Path -LiteralPath $pauseFile) -and (Get-Content -LiteralPath $pauseFile -Raw | ConvertFrom-Json).paused) {
    Write-Host 'Recorded YouTube downloads are paused. Existing audio, queued progress, and live streaming are preserved.'
    return
}
$config = Get-Content -LiteralPath (Join-Path $work 'config.private.json') -Raw | ConvertFrom-Json
function Unprotect-Value([string]$Value) {
    $secure = ConvertTo-SecureString $Value
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}
$names = @('R2_AUDIO_ACCOUNT_ID','R2_UPLOAD_ACCESS_KEY_ID','R2_UPLOAD_SECRET_ACCESS_KEY','LIGHTCITY_PYTHON')
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
try {
    $env:R2_AUDIO_ACCOUNT_ID = $config.accountId
    $env:R2_UPLOAD_ACCESS_KEY_ID = Unprotect-Value $config.accessKeyProtected
    $env:R2_UPLOAD_SECRET_ACCESS_KEY = Unprotect-Value $config.secretKeyProtected
    $env:LIGHTCITY_PYTHON = $config.pythonPath
    $arguments = @((Join-Path $PSScriptRoot 'automatic.mjs'), 'run')
    if ($Once) { $arguments += '--once' }
    & $config.nodePath @arguments
    if ($LASTEXITCODE -ne 0) { throw 'Recorded-audio helper stopped. Review setup and queue status.' }
} finally {
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}
