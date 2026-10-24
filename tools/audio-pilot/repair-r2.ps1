$r2RepairAccess = Read-Host 'Paste Access Key ID (hidden)' -AsSecureString
$r2RepairToken = Read-Host 'Paste Token value from the SAME page (hidden; NOT Secret Access Key)' -AsSecureString
$r2RepairAccessPointer = [IntPtr]::Zero
$r2RepairTokenPointer = [IntPtr]::Zero
try {
    $r2RepairAccessPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($r2RepairAccess)
    $r2RepairTokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($r2RepairToken)
    $r2RepairPayload = @{
        accountId = 'af76ef1278d731ac5487d733c0d44cd0'
        bucket = 'lightcity-audio'
        accessKeyId = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($r2RepairAccessPointer)
        apiTokenValue = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($r2RepairTokenPointer)
    } | ConvertTo-Json -Compress
    $r2RepairPayload | & node (Join-Path $PSScriptRoot 'repair-r2.mjs')
} finally {
    if ($r2RepairAccessPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($r2RepairAccessPointer) }
    if ($r2RepairTokenPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($r2RepairTokenPointer) }
    $r2RepairAccess.Dispose()
    $r2RepairToken.Dispose()
    Remove-Variable r2RepairPayload, r2RepairAccess, r2RepairToken, r2RepairAccessPointer, r2RepairTokenPointer -ErrorAction SilentlyContinue
}
