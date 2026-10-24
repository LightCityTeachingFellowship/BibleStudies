# Credentials go to the local checker through stdin only, never command arguments or files.
$r2DiagnosticAccess = Read-Host 'Paste the R2 Access Key ID (hidden)' -AsSecureString
$r2DiagnosticSecret = Read-Host 'Paste its matching Secret Access Key (hidden)' -AsSecureString
$r2DiagnosticToken = Read-Host 'Paste Token value from the SAME creation page for pair verification (hidden; Enter to skip)' -AsSecureString
$r2DiagnosticAccessPointer = [IntPtr]::Zero
$r2DiagnosticSecretPointer = [IntPtr]::Zero
$r2DiagnosticTokenPointer = [IntPtr]::Zero
try {
    $r2DiagnosticAccessPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($r2DiagnosticAccess)
    $r2DiagnosticSecretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($r2DiagnosticSecret)
    $r2DiagnosticTokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($r2DiagnosticToken)
    $r2DiagnosticPayload = @{
        accountId = 'af76ef1278d731ac5487d733c0d44cd0'
        bucket = 'lightcity-audio'
        accessKeyId = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($r2DiagnosticAccessPointer)
        secretAccessKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($r2DiagnosticSecretPointer)
        apiTokenValue = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($r2DiagnosticTokenPointer)
    } | ConvertTo-Json -Compress
    $r2DiagnosticPayload | & node (Join-Path $PSScriptRoot 'check-r2.mjs')
} finally {
    if ($r2DiagnosticAccessPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($r2DiagnosticAccessPointer) }
    if ($r2DiagnosticSecretPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($r2DiagnosticSecretPointer) }
    if ($r2DiagnosticTokenPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($r2DiagnosticTokenPointer) }
    $r2DiagnosticAccess.Dispose()
    $r2DiagnosticSecret.Dispose()
    $r2DiagnosticToken.Dispose()
    Remove-Variable r2DiagnosticPayload, r2DiagnosticAccess, r2DiagnosticSecret, r2DiagnosticToken, r2DiagnosticAccessPointer, r2DiagnosticSecretPointer, r2DiagnosticTokenPointer -ErrorAction SilentlyContinue
}
