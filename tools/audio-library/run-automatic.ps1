param([switch]$Once)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../helper-supervisor.ps1')
$work = Join-Path $PSScriptRoot 'work/automatic-recorded'
function Unprotect-Value([string]$Value) {
    $secure = ConvertTo-SecureString $Value
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}
$pause = {
    $localFile = Join-Path $work 'local-source.json'
    $localMode = (Test-Path -LiteralPath $localFile) -and (Get-Content -LiteralPath $localFile -Raw | ConvertFrom-Json).mode -eq 'local'
    $pauseFile = Join-Path $work 'downloads-paused.json'
    return (-not $localMode -and (Test-Path -LiteralPath $pauseFile) -and (Get-Content -LiteralPath $pauseFile -Raw | ConvertFrom-Json).paused)
}
$attempt = {
    # Reads and decryption are inside recovery, including errors during sign-in/startup.
    $config = Get-Content -LiteralPath (Join-Path $work 'config.private.json') -Raw | ConvertFrom-Json
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
        return Invoke-LightCityWorker -Executable $config.nodePath -Arguments $arguments -WorkDirectory $work
    } finally {
        foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
    }
}
Invoke-LightCitySupervisor -Name 'Recorded audio' -WorkDirectory $work -Attempt $attempt -ShouldStop $pause -Once:$Once
