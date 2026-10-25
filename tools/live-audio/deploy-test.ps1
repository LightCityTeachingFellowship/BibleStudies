$ErrorActionPreference = 'Stop'
$work = Join-Path $PSScriptRoot 'work'
$secretsPath = Join-Path $work 'cloud-secrets.json'
New-Item -ItemType Directory -Path $work -Force | Out-Null
if (-not (Test-Path -LiteralPath $secretsPath)) {
    function New-PrivateKey {
        $bytes = New-Object byte[] 32
        $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
        try { $rng.GetBytes($bytes); return ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant() }
        finally { $rng.Dispose() }
    }
    @{ LIVE_UPLOAD_KEY = New-PrivateKey; LIVE_PLAYBACK_KEY = New-PrivateKey } | ConvertTo-Json | Set-Content -LiteralPath $secretsPath -Encoding ascii
}
Write-Host 'Deploying the private live-audio gateway to your Cloudflare account.'
Write-Host 'This binds the existing lightcity-audio bucket. Its public access remains disabled.'
Write-Host 'Private keys stay in the ignored local work folder and Cloudflare secrets; do not share that file.'
# 4.152.0 uploads successfully but its new /workers/workers/<name> lookup
# returned 10007 for this account. Use the established script/subdomain route.
& npx --yes wrangler@4.130.0 deploy --config (Join-Path $PSScriptRoot 'cloud/wrangler.jsonc') --secrets-file $secretsPath
if ($LASTEXITCODE -ne 0) { throw 'Deployment did not complete. Keep the local secrets file and retry after resolving the displayed Cloudflare error.' }
