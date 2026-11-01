param([string]$SeedId = 'CwSrbPtbUOw', [switch]$ManualStart, [switch]$EnableStartup, [switch]$UseTokenValue)
$ErrorActionPreference = 'Stop'
$work = Join-Path $PSScriptRoot 'work/automatic-recorded'
$node = (Get-Command node -ErrorAction Stop).Source
$python = (Get-Command python -ErrorAction Stop).Source
$runPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'run-automatic.ps1'))
if (-not $EnableStartup) {
& $node (Join-Path $PSScriptRoot 'setup-downloader.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Downloader setup failed; no background task was installed.' }
function Read-Hidden([string]$Prompt) {
    $secure = Read-Host $Prompt -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer).Trim() }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}
$account = (Read-Host 'Cloudflare Account ID').Trim()
$access = Read-Hidden 'R2 Object Read & Write Access Key ID for lightcity-audio (hidden)'
$tokenValue = $null
if ($UseTokenValue) {
    $tokenValue = Read-Hidden 'Token value from the SAME creation page (hidden; used only to derive and verify the upload secret)'
    if ($tokenValue -notmatch '^[A-Za-z0-9_-]{20,200}$') { throw 'Unexpected Token value format. Nothing was installed.' }
    $hash = [Security.Cryptography.SHA256]::Create()
    try { $secret = ([BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($tokenValue)))).Replace('-', '').ToLowerInvariant() }
    finally { $hash.Dispose() }
} else {
    $secret = Read-Hidden 'Its matching Secret Access Key (hidden)'
}
if ($account -notmatch '^[a-fA-F0-9]{32}$' -or $access -notmatch '^[a-fA-F0-9]{32}$' -or $secret -notmatch '^[a-fA-F0-9]{64}$') { throw 'Unexpected key format. Nothing was installed.' }
$names = @('R2_AUDIO_ACCOUNT_ID','R2_UPLOAD_ACCESS_KEY_ID','R2_UPLOAD_SECRET_ACCESS_KEY','R2_UPLOAD_TOKEN_VALUE')
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
try {
    $env:R2_AUDIO_ACCOUNT_ID = $account
    $env:R2_UPLOAD_ACCESS_KEY_ID = $access
    $env:R2_UPLOAD_SECRET_ACCESS_KEY = $secret
    $env:R2_UPLOAD_TOKEN_VALUE = $tokenValue
    & $node (Join-Path $PSScriptRoot 'check-automatic-setup.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Verification failed; no background task was installed.' }
    New-Item -ItemType Directory -Force -Path $work | Out-Null
    $config = @{ version=1; accountId=$account; nodePath=$node; pythonPath=$python; origin='https://lightcity-live-audio-test.lightcityteachingfellowship.workers.dev'; accessKeyProtected=(ConvertTo-SecureString $access -AsPlainText -Force | ConvertFrom-SecureString); secretKeyProtected=(ConvertTo-SecureString $secret -AsPlainText -Force | ConvertFrom-SecureString) }
    $config | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $work 'config.private.json') -Encoding ascii
    & $node (Join-Path $PSScriptRoot 'automatic.mjs') init --id $SeedId
    if ($LASTEXITCODE -ne 0) { throw 'Queue initialization failed.' }
} finally {
    $access = $null; $secret = $null; $tokenValue = $null
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}
if ($ManualStart) { Write-Host 'Setup saved. Run run-automatic.ps1 -Once for the first upload test. No startup task was installed.'; return }
} else {
    if (-not (Test-Path -LiteralPath (Join-Path $work 'config.private.json')) -or -not (Test-Path -LiteralPath (Join-Path $work 'queue.json'))) { throw 'Complete setup and the first upload test before enabling automatic startup.' }
}
. (Join-Path $PSScriptRoot '../helper-startup.ps1')
@{disabled=$false;updatedAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $work 'supervisor-disabled.json') -Encoding ascii
Register-LightCityHelperTask -Name 'LightCity Recorded Audio' -Runner $runPath -WorkingDirectory ([IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))) -Description 'Watch final local recordings, upload verified audio, register Listen, and recover stopped workers.'
Write-Host 'Automatic recorded audio startup and recovery are enabled for this Windows account.'
Write-Host 'Windows starts it at sign-in and checks every 3 minutes. Active copies are not duplicated.'
Write-Host 'This computer must be on and signed in. Existing queue progress and encrypted credentials are preserved.'
