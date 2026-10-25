$ErrorActionPreference = 'Stop'
$previous = [Environment]::GetEnvironmentVariable('LC_YOUTUBE_TEST_KEY', 'Process')
$pointer = [IntPtr]::Zero
try {
    Write-Host 'Use only the key for a separate UNLISTED YouTube test broadcast, with DVR enabled.'
    Write-Host 'Leave OBS on the LightCity Audio Test profile and its existing local stream destination.'
    $secure = Read-Host 'Paste the unlisted YouTube test stream key (hidden)' -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $env:LC_YOUTUBE_TEST_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer).Trim()
    & node (Join-Path $PSScriptRoot 'relay.mjs') --youtube-test
    if ($LASTEXITCODE -ne 0) { throw 'The relay ended with an error. Check the unlisted test in YouTube Studio; never share the stream key.' }
} finally {
    if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    [Environment]::SetEnvironmentVariable('LC_YOUTUBE_TEST_KEY', $previous, 'Process')
}
