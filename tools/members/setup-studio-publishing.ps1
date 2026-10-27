$ErrorActionPreference = 'Stop'
Write-Host 'Create a fine-grained GitHub token for LightCityTeachingFellowship/BibleStudies only, with Contents: Read and write. No account-wide token is needed.'
Write-Host 'Paste it only into this hidden prompt. It is sent to Firebase Secret Manager, not saved in the website.'
$secure = Read-Host 'Studio GitHub token (hidden)' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer).Trim()
    if ($token -notmatch '^github_pat_[A-Za-z0-9_]{20,}$') { throw 'Expected a fine-grained GitHub token. Nothing was saved.' }
    Push-Location $PSScriptRoot
    try {
        $token | & firebase functions:secrets:set STUDIO_GITHUB_TOKEN --data-file - --non-interactive --project perceptive-zoo-424115-j6
        if ($LASTEXITCODE -ne 0) { throw 'Studio GitHub connection was not saved.' }
    } finally { Pop-Location }
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    $token=$null;$secure=$null
}
Write-Host 'Publishing connection saved. Run deploy-studio-publishing.ps1 next.'