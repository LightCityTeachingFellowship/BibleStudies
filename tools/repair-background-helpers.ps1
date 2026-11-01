$ErrorActionPreference='Stop'
$failures=@()
foreach($helper in @(@{Name='Recorded audio';Script=(Join-Path $PSScriptRoot 'audio-library/start-local.ps1')},@{Name='Studio ID lists';Script=(Join-Path $PSScriptRoot 'start-studio-sync.ps1')})){
    try { & $helper.Script; Write-Host ($helper.Name+': startup and recovery updated.') }
    catch { $failures+=$helper.Name; Write-Warning ($helper.Name+': '+$_.Exception.Message) }
}
if($failures.Count){throw ('Windows could not update: '+($failures -join ', ')+'. Run this script from your normal Windows PowerShell under the account used for setup.')}
Write-Host 'Both helpers start at sign-in and are checked every 3 minutes while you are signed in.'
Write-Host 'Active tasks are not interrupted. Extra launches are ignored; intentional pauses are respected.'
Write-Host 'No Firebase deployment or credential entry is required. Use tools/check-background-helpers.ps1 to inspect health.'
