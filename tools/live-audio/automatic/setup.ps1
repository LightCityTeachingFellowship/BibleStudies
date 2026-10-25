$ErrorActionPreference = 'Stop'
$work = Join-Path $PSScriptRoot '../work/automatic'
New-Item -ItemType Directory -Force -Path $work | Out-Null
$node = (Get-Command node -ErrorAction Stop).Source
if (!(Test-Path -LiteralPath (Join-Path $PSScriptRoot '../work/cloud-secrets.json'))) { throw 'The existing live gateway setup is missing.' }
if (!(Test-Path -LiteralPath (Join-Path $PSScriptRoot '../../audio-pilot/runtime/ffmpeg.exe'))) { throw 'The local audio runtime is missing.' }
$secure = Read-Host 'Paste your YouTube Data API key (hidden)' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer).Trim()
    $result = $plain | & $node (Join-Path $PSScriptRoot 'setup-channel.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Channel verification failed; nothing was saved.' }
    $channel = $result | ConvertFrom-Json
    $protected = ConvertTo-SecureString $plain -AsPlainText -Force | ConvertFrom-SecureString
    $config = @{ version=1; profileName='OBS Service Scene'; channelId=$channel.channelId; workerOrigin='https://lightcity-live-audio-test.lightcityteachingfellowship.workers.dev'; nodePath=$node; youtubeKeyProtected=$protected }
    $config | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $work 'config.private.json') -Encoding ascii
    @{ nodePath=$node; profileName='OBS Service Scene' } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $work 'obs.json') -Encoding ascii
    Write-Host ('Verified channel: ' + $channel.channelTitle)
    Write-Host 'Saved the API key encrypted for your Windows account.'
    Write-Host 'In your normal OBS profile, open Tools > Scripts > + and add:'
    Write-Host (Join-Path $PSScriptRoot 'lightcity-auto.lua')
} finally {
    $plain = $null
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
}
