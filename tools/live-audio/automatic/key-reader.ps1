$ErrorActionPreference = 'Stop'
try {
    $path = Join-Path $PSScriptRoot '../work/automatic/config.private.json'
    $config = Get-Content -Raw -LiteralPath $path | ConvertFrom-Json
    $secure = ConvertTo-SecureString -String $config.youtubeKeyProtected
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { [Console]::Out.Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
} catch { [Console]::Error.WriteLine('The local encrypted lookup key could not be opened.'); exit 1 }
