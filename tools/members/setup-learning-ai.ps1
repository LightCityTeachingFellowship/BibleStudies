$ErrorActionPreference = 'Stop'
Write-Host 'Store your OpenAI API key privately in Firebase Secret Manager.'
Write-Host 'This does not enable processing, select a teaching, or make a paid AI request.'
Write-Host 'Paste the key only into the hidden prompt below, never into chat.'
$secure = Read-Host 'OpenAI API key (hidden)' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer).Trim()
    if ($key -notmatch '^sk-[A-Za-z0-9_-]{20,}$') { throw 'Expected an OpenAI API key. Nothing was saved.' }
    Push-Location $PSScriptRoot
    try {
        $key | & firebase functions:secrets:set LEARNING_OPENAI_API_KEY --data-file - --non-interactive --project perceptive-zoo-424115-j6
        if ($LASTEXITCODE -ne 0) { throw 'The API key was not saved. Check Firebase sign-in and retry.' }
    } finally { Pop-Location }
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    $key=$null; $secure=$null
}
Write-Host 'AI key saved privately. Processing remains off until enabled in Studio.'
