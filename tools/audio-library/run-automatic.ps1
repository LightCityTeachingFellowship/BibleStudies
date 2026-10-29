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
    do {
        & $config.nodePath @arguments
        $workerExit = $LASTEXITCODE
        if ($workerExit -eq 0) { break }
        if ($Once) { throw 'Recorded-audio helper stopped. Review setup and queue status.' }
        # Keep a Windows login worker alive after a temporary local/storage failure.
        # Existing per-job receipts and the worker lock prevent duplicate uploads.
        $notice = 'Recorded-audio helper stopped unexpectedly. Retrying in 30 seconds; queue progress is preserved.'
        Write-Warning $notice
        try {
            $status = @{phase='restarting'; updatedAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); sourceMode=$(if ($localMode) {'local'} else {'youtube'}); message=$notice}
            $status | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $work 'runtime-status.json') -Encoding utf8
            Add-Content -LiteralPath (Join-Path $work 'supervisor.log') -Value ([DateTimeOffset]::UtcNow.ToString('o') + ' Worker exit ' + $workerExit + '; retry in 30 seconds.')
        } catch { Write-Warning 'Recovery status could not be saved. The worker will still retry.' }
        Start-Sleep -Seconds 30
    } while (-not $Once)
} finally {
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}
