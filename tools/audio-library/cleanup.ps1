param([switch]$Apply, [switch]$DeleteSources, [string]$Id)
$ErrorActionPreference = 'Stop'
$arguments = @((Join-Path $PSScriptRoot 'cleanup.mjs'), 'cleanup')
if ($Id) { $arguments += @('--id', $Id) }
if ($DeleteSources) { $arguments += '--delete-sources' }
# Always show the candidate files before requesting credentials or removing anything.
& node @arguments
if ($LASTEXITCODE -ne 0) { throw 'Cleanup preview failed. Nothing was deleted.' }
if (-not $Apply) { Write-Host 'Preview only. Add -Apply to remove the verified files. Source recordings are kept unless -DeleteSources is also supplied.'; return }
$names = @('R2_AUDIO_ACCOUNT_ID','R2_UPLOAD_ACCESS_KEY_ID','R2_UPLOAD_SECRET_ACCESS_KEY')
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
function Read-Hidden([string]$Prompt) {
    $secure = Read-Host $Prompt -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer).Trim() }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}
try {
    $env:R2_AUDIO_ACCOUNT_ID = Read-Host 'Cloudflare Account ID'
    $env:R2_UPLOAD_ACCESS_KEY_ID = Read-Hidden 'R2 Access Key ID with read access to lightcity-audio (hidden)'
    $env:R2_UPLOAD_SECRET_ACCESS_KEY = Read-Hidden 'Its matching Secret Access Key (hidden)'
    & node @arguments --apply
    if ($LASTEXITCODE -ne 0) { throw 'Cleanup stopped. Check the report; files without completed checks were kept.' }
} finally {
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}
