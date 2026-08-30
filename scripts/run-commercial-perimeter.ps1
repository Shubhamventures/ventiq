# VENTIQ commercial perimeter helper (Windows)
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$perimeter = Join-Path $root "scripts\W1G5_1_final_perimeter_audit.mjs"

if (-not (Test-Path $perimeter)) { throw "W1G5.1 perimeter audit not found." }

$listener = New-Object System.Net.Sockets.TcpListener([Net.IPAddress]::Loopback, 0)
$listener.Start()
$port = ([Net.IPEndPoint]$listener.LocalEndpoint).Port
$listener.Stop()

$serverLog = Join-Path $env:TEMP ("ventiq_perimeter_server_" + [guid]::NewGuid().ToString("N") + ".txt")
$auditLog = Join-Path $env:TEMP ("ventiq_perimeter_audit_" + [guid]::NewGuid().ToString("N") + ".txt")
$serverCmd = 'npm run start -- -H 127.0.0.1 -p ' + $port + ' > "' + $serverLog + '" 2>&1'
$server = $null
$oldUrl = $env:VENTIQ_APP_URL

try {
    $server = Start-Process -FilePath "cmd.exe" -ArgumentList "/d","/s","/c",$serverCmd `
        -WorkingDirectory $root -PassThru -WindowStyle Hidden

    $ready = $false
    $deadline = (Get-Date).AddSeconds(60)

    while ((Get-Date) -lt $deadline) {
        if ($server.HasExited) { break }
        try {
            $response = Invoke-WebRequest -Uri ("http://127.0.0.1:{0}/" -f $port) `
                -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 3 -ErrorAction Stop
            if ([int]$response.StatusCode -gt 0) { $ready = $true; break }
        } catch {
            Start-Sleep -Milliseconds 700
        }
    }

    if (-not $ready) {
        Write-Host "FAIL - local production server did not become ready"
        if (Test-Path $serverLog) { Get-Content $serverLog -Tail 20 }
        exit 2
    }

    $env:VENTIQ_APP_URL = ("http://127.0.0.1:{0}" -f $port)
    & node $perimeter 1> $auditLog 2>&1
    $auditExit = $LASTEXITCODE

    if ($auditExit -ne 0) {
        Write-Host "FAIL - W1G5.1 perimeter regression"
        Get-Content $auditLog -Tail 30
        exit $auditExit
    }

    Write-Host "PASS - W1G5.1 perimeter regression"
    Get-Content $auditLog |
        Where-Object {
            $_ -match '^Pages discovered:' -or
            $_ -match '^APIs discovered:' -or
            $_ -match '^Failures:' -or
            $_ -match '^PASS - W1G5\.1 FINAL PERIMETER PASSED'
        } |
        ForEach-Object { Write-Host ("  " + $_) }

    exit 0
}
finally {
    $env:VENTIQ_APP_URL = $oldUrl
    if ($server -and -not $server.HasExited) {
        & taskkill.exe /PID $server.Id /T /F *> $null
    }
    Remove-Item $serverLog -Force -ErrorAction SilentlyContinue
    Remove-Item $auditLog -Force -ErrorAction SilentlyContinue
}
