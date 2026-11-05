param([string]$Source = 'C:\Users\samvi\OneDrive\Documents\LightCity Folder\LightCity Messages\Edited Messages')
$ErrorActionPreference='Stop'
$config=Get-Content -LiteralPath (Join-Path $PSScriptRoot '../audio-library/work/automatic-recorded/config.private.json') -Raw | ConvertFrom-Json
function Unprotect-Value([string]$Value) {
 $secure=ConvertTo-SecureString $Value
 $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
 try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
 finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}
$names=@('R2_AUDIO_ACCOUNT_ID','R2_UPLOAD_ACCESS_KEY_ID','R2_UPLOAD_SECRET_ACCESS_KEY');$previous=@{}
foreach($name in $names){$previous[$name]=[Environment]::GetEnvironmentVariable($name,'Process')}
try {
 $env:R2_AUDIO_ACCOUNT_ID=$config.accountId
 $env:R2_UPLOAD_ACCESS_KEY_ID=Unprotect-Value $config.accessKeyProtected
 $env:R2_UPLOAD_SECRET_ACCESS_KEY=Unprotect-Value $config.secretKeyProtected
 & $config.nodePath (Join-Path $PSScriptRoot 'import.mjs') $Source
 if($LASTEXITCODE -ne 0){throw 'Archive import paused. Originals are safe; inspect the log before restarting.'}
} finally {foreach($name in $names){[Environment]::SetEnvironmentVariable($name,$previous[$name],'Process')}}
