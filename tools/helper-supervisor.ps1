# Shared by the two Windows helpers. Credentials are never stored in these logs.
function ConvertTo-LightCityLogText([string]$Text) {
    $value = $Text -replace 'https?://\S+', '[address omitted]'
    $value = $value -replace '(?i)(Bearer\s+|(?:secret|token|api[_-]?key|password)\s*[:=]\s*)\S+', '$1[hidden]'
    $value = $value -replace '(?i)\b(?:[a-f0-9]{32,}|AIza[\w-]{20,}|gh[pousr]_[\w-]{20,}|github_pat_[\w-]{20,}|eyJ[\w.-]{30,})\b', '[hidden]'
    $value = $value -replace '[\r\n]+', ' '
    return $value.Substring(0, [Math]::Min($value.Length, 1200))
}
function Write-LightCityHelperLog([string]$WorkDirectory, [string]$Event, [string]$Message) {
    try {
        New-Item -ItemType Directory -Path $WorkDirectory -Force | Out-Null
        $path = Join-Path $WorkDirectory 'supervisor.log'
        if ((Test-Path -LiteralPath $path) -and (Get-Item -LiteralPath $path).Length -gt 1MB) {
            [IO.File]::WriteAllLines($path, @(Get-Content -LiteralPath $path -Tail 200), [Text.UTF8Encoding]::new($false))
        }
        $entry = @{at=[DateTimeOffset]::UtcNow.ToString('o'); event=$Event; message=(ConvertTo-LightCityLogText $Message)} | ConvertTo-Json -Compress
        [IO.File]::AppendAllText($path, $entry + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
    } catch { Write-Warning 'Helper log could not be saved; automatic recovery will still retry.' }
}
function Set-LightCityHelperState([string]$WorkDirectory, [string]$Name, [string]$State, [int]$Attempts, [string]$Message) {
    try {
        New-Item -ItemType Directory -Path $WorkDirectory -Force | Out-Null
        @{name=$Name; state=$State; updatedAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); supervisorPid=$PID; attempts=$Attempts; message=(ConvertTo-LightCityLogText $Message)} |
            ConvertTo-Json | Set-Content -LiteralPath (Join-Path $WorkDirectory 'supervisor-status.json') -Encoding utf8
    } catch { Write-Warning 'Helper recovery status could not be saved.' }
}
function Test-LightCityHelperDisabled([string]$WorkDirectory) {
    $path = Join-Path $WorkDirectory 'supervisor-disabled.json'
    return (Test-Path -LiteralPath $path) -and (Get-Content -LiteralPath $path -Raw | ConvertFrom-Json).disabled -eq $true
}
function Invoke-LightCityWorker([string]$Executable, [string[]]$Arguments, [string]$WorkDirectory) {
    $command = Get-Command $Executable -ErrorAction Stop
    $before = $ErrorActionPreference
    try {
        # Native stderr must not terminate Windows PowerShell before its exit is logged.
        $ErrorActionPreference = 'Continue'
        & $command.Source @Arguments 2>&1 | ForEach-Object {
            $line = ConvertTo-LightCityLogText ([string]$_)
            Write-Host $line
            Write-LightCityHelperLog $WorkDirectory 'worker-output' $line
        }
        if ($null -eq $LASTEXITCODE) { throw 'The worker could not be started.' }
        return [int]$LASTEXITCODE
    } finally { $ErrorActionPreference = $before }
}
function Invoke-LightCitySupervisor {
    param([string]$Name, [string]$WorkDirectory, [scriptblock]$Attempt, [scriptblock]$ShouldStop, [switch]$Once, [int]$RetrySeconds=30)
    $hasher = [Security.Cryptography.SHA256]::Create()
    try { $key = [BitConverter]::ToString($hasher.ComputeHash([Text.Encoding]::UTF8.GetBytes([IO.Path]::GetFullPath($WorkDirectory).ToLowerInvariant()))).Replace('-', '') }
    finally { $hasher.Dispose() }
    $mutex = [Threading.Mutex]::new($false, 'Local\LightCityHelper-' + $key)
    $held = $false; $attempts = 0
    try {
        try { $held = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $held = $true }
        if (-not $held) { Write-Host "$Name is already running. A second helper was not started."; return }
        Write-LightCityHelperLog $WorkDirectory 'supervisor-start' "$Name recovery wrapper started."
        while ($true) {
            try {
                if (Test-LightCityHelperDisabled $WorkDirectory) {
                    Set-LightCityHelperState $WorkDirectory $Name 'disabled' $attempts 'Stopped deliberately. Enable the helper to resume.'
                    return
                }
                if ($ShouldStop -and (& $ShouldStop)) {
                    Set-LightCityHelperState $WorkDirectory $Name 'paused' $attempts 'The configured processing pause is respected.'
                    return
                }
                $attempts++
                Set-LightCityHelperState $WorkDirectory $Name 'running' $attempts 'Starting the worker; its separate heartbeat records ongoing activity.'
                Write-LightCityHelperLog $WorkDirectory 'worker-start' "Starting attempt $attempts."
                $code = [int](& $Attempt)
                Write-LightCityHelperLog $WorkDirectory 'worker-exit' "Worker exited with code $code."
                if ($Once) {
                    Set-LightCityHelperState $WorkDirectory $Name 'finished' $attempts "One-time run exited with code $code."
                    if ($code -ne 0) { throw "Worker exited with code $code. Review supervisor.log." }
                    return
                }
            } catch {
                $reason = $_.Exception.GetType().Name + ': ' + $_.Exception.Message
                Write-LightCityHelperLog $WorkDirectory 'worker-error' $reason
                if ($Once) { Set-LightCityHelperState $WorkDirectory $Name 'failed' $attempts $reason; throw }
            }
            Set-LightCityHelperState $WorkDirectory $Name 'retrying' $attempts "Worker stopped. Retrying in $RetrySeconds seconds; saved progress is preserved."
            # A continuous worker's exit 0 is also unexpected unless deliberately paused.
            Start-Sleep -Seconds $RetrySeconds
        }
    } finally {
        if ($held) { Write-LightCityHelperLog $WorkDirectory 'supervisor-stop' 'Recovery wrapper stopped.'; $mutex.ReleaseMutex() }
        $mutex.Dispose()
    }
}
