$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'helper-supervisor.ps1')
$temporary=Join-Path ([IO.Path]::GetTempPath()) ('lightcity-helper-test-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temporary | Out-Null
function Assert-True($Value,[string]$Message){if(-not $Value){throw $Message}}
try {
    $work=Join-Path $temporary 'recovery';$counter=@{calls=0}
    Invoke-LightCitySupervisor -Name 'Recovery test' -WorkDirectory $work -RetrySeconds 0 -Attempt {
        $counter.calls++
        if($counter.calls -eq 1){throw 'Configuration temporarily unavailable'}
        if($counter.calls -eq 2){return 7}
        @{disabled=$true}|ConvertTo-Json|Set-Content (Join-Path $work 'supervisor-disabled.json')
        return 0
    }
    Assert-True ($counter.calls -eq 3) 'Startup and worker errors must both recover.'
    $log=Get-Content (Join-Path $work 'supervisor.log') -Raw
    Assert-True ($log.Contains('Configuration temporarily unavailable') -and $log.Contains('code 7')) 'Failure reasons must be logged.'
    Assert-True ((Get-Content (Join-Path $work 'supervisor-status.json') -Raw|ConvertFrom-Json).state -eq 'disabled') 'Deliberate stops must be respected.'
    $zero=Join-Path $temporary 'zero';$counter.calls=0
    Invoke-LightCitySupervisor -Name 'Clean exit test' -WorkDirectory $zero -RetrySeconds 0 -ShouldStop {$counter.calls -ge 2} -Attempt {$counter.calls++;return 0}
    Assert-True ($counter.calls -eq 2) 'A continuous helper must recover after unexpected exit 0.'
    $counter.calls=0;$failed=$false
    try{Invoke-LightCitySupervisor -Name 'Once test' -WorkDirectory (Join-Path $temporary 'once') -Once -Attempt {$counter.calls++;return 9}}catch{$failed=$true}
    Assert-True ($failed -and $counter.calls -eq 1) 'One-time failures must fail once, not loop.'
    $worker=Join-Path $temporary 'worker.cjs'
    [IO.File]::WriteAllText($worker,"console.error('storage unavailable https://example.test/?token=private'); console.log('secret="+('a'*64)+"'); process.exit(9)")
    $code=Invoke-LightCityWorker -Executable (Get-Command node).Source -Arguments @($worker) -WorkDirectory (Join-Path $temporary 'native')
    Assert-True ($code -eq 9) 'Native stderr must retain its real exit code.'
    $nativeLog=Get-Content (Join-Path $temporary 'native/supervisor.log') -Raw
    Assert-True (-not $nativeLog.Contains('https://') -and -not $nativeLog.Contains('a'*64)) 'Credentials and signed URLs must not be logged.'
    # A separate Windows PowerShell process must not enter the same supervisor.
    $child=Join-Path $temporary 'duplicate.ps1';$marker=Join-Path $temporary 'duplicate-ran.txt';$mutexWork=Join-Path $temporary 'mutex'
    [IO.File]::WriteAllText($child,'param($Shared,$Work,$Marker); . $Shared; Invoke-LightCitySupervisor -Name duplicate -WorkDirectory $Work -Once -Attempt {Set-Content -LiteralPath $Marker -Value bad; return 0}')
    Invoke-LightCitySupervisor -Name 'Mutex test' -WorkDirectory $mutexWork -Once -Attempt {
        & "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $child -Shared (Join-Path $PSScriptRoot 'helper-supervisor.ps1') -Work $mutexWork -Marker $marker | Out-Host
        return 0
    }
    Assert-True (-not(Test-Path -LiteralPath $marker)) 'Two processes must not start the same helper.'
    Write-Host 'PASS: startup recovery, nonzero/zero exit recovery, intentional disable/pause, single-run failures, native stderr/exit code, private logs and cross-process duplicate protection.'
} finally {
    $resolved=[IO.Path]::GetFullPath($temporary);$tempRoot=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')+'\'
    if(-not $resolved.StartsWith($tempRoot,[StringComparison]::OrdinalIgnoreCase)){throw 'Unexpected test cleanup path.'}
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
