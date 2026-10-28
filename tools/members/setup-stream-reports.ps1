$ErrorActionPreference='Stop'
$configPath=Join-Path $PSScriptRoot '../live-audio/work/automatic/config.private.json'
$pointer=[IntPtr]::Zero
try{
 if(Test-Path -LiteralPath $configPath){
  $settings=Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
  $secure=ConvertTo-SecureString $settings.youtubeKeyProtected
 }else{$secure=Read-Host 'Paste a server-compatible YouTube Data API key (hidden)' -AsSecureString}
 $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
 $value=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer).Trim()
 if($value -notmatch '^AIza[\w-]{30,}$'){throw 'The saved YouTube key could not be validated. Review the OBS helper setup.'}
 Write-Host 'Saving the existing YouTube key privately for report verification. The key is not displayed.'
 Push-Location $PSScriptRoot
 try{
  $value | & firebase functions:secrets:set YOUTUBE_STREAM_STATUS_KEY --data-file - --non-interactive --project perceptive-zoo-424115-j6
  if($LASTEXITCODE -ne 0){throw 'Stream-status key setup did not complete.'}
  Write-Host 'Key saved. Run deploy-stream-reports.ps1 next.'
 }finally{Pop-Location}
}finally{$value=$null;$settings=$null;if($pointer -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)}}
