param([int]$Limit = 10)
$ErrorActionPreference = 'Stop'
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
    $env:R2_AUDIO_ACCOUNT_ID = Read-Host 'Cloudflare Account ID (not the Access Key ID)'
    $env:R2_UPLOAD_ACCESS_KEY_ID = Read-Hidden 'R2 upload Access Key ID (hidden)'
    $env:R2_UPLOAD_SECRET_ACCESS_KEY = Read-Hidden 'Its matching Secret Access Key (hidden)'
    & node (Join-Path $PSScriptRoot 'import.mjs') upload --limit $Limit
    if ($LASTEXITCODE -ne 0) { throw 'Some uploads failed. Completed uploads are saved; rerun to resume.' }
} finally {
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}
