<#
.SYNOPSIS
    Boot build/kernel.bin in QEMU.
.DESCRIPTION
    Modes:
      (default)  QEMU window, COM1 on stdio. Type protocol lines by hand, e.g. ">hello".
      -Headless  No window; COM1 -> build/serial.log; verifies the kernel reached
                 its READY handshake. Exit 0 (pass) / 1 (fail).
      -Chat      QEMU window, COM1 exposed as a TCP server on 127.0.0.1:Port. QEMU
                 waits for one gateway to connect, then boots. Pair with FastAPI for
                 the browser demo or bridge.ps1 for the standalone terminal demo.
.EXAMPLE
    ./run.ps1
.EXAMPLE
    ./run.ps1 -Headless
.EXAMPLE
    ./run.ps1 -Chat
#>
[CmdletBinding()]
param(
    [switch]$Headless,
    [switch]$Chat,
    [int]$Port = 4555,
    [int]$TimeoutSec = 3,
    [string]$OutDir = "build"
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Find-Tool($name, $fallback) {
    $c = Get-Command $name -ErrorAction SilentlyContinue
    if ($c) { return $c.Source }
    if (Test-Path $fallback) { return $fallback }
    throw "Could not find '$name'. Install QEMU:  winget install -e --id SoftwareFreedomConservancy.QEMU"
}

$qemu   = Find-Tool "qemu-system-i386" "C:\Program Files\qemu\qemu-system-i386.exe"
$kernel = Join-Path $OutDir "kernel.bin"
if (-not (Test-Path $kernel)) { throw "kernel not built: $kernel  (run ./build.ps1 first)" }

if ($Headless) {
    $log = Join-Path $OutDir "serial.log"
    if (Test-Path $log) { Remove-Item $log -Force }
    Write-Host "Running QEMU headless for ${TimeoutSec}s; COM1 -> $log"
    $qargs = @("-kernel", $kernel, "-serial", "file:$log", "-display", "none", "-no-reboot")
    $p = Start-Process -FilePath $qemu -ArgumentList $qargs -PassThru
    Start-Sleep -Seconds $TimeoutSec
    if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force }

    if (-not (Test-Path $log)) { Write-Host "VERIFY: FAIL (no serial log produced)"; exit 1 }
    $out = Get-Content $log -Raw
    if ($null -eq $out) { $out = "" }
    Write-Host "----- COM1 serial output -----"
    Write-Host $out.TrimEnd()
    Write-Host "------------------------------"
    if ($out -match "READY") { Write-Host "VERIFY: PASS (kernel booted; serial loop alive)"; exit 0 }
    Write-Host "VERIFY: FAIL (READY handshake not seen)"; exit 1
}
elseif ($Chat) {
    Write-Host "QEMU: COM1 is a TCP server on 127.0.0.1:$Port. It waits for a gateway,"
    Write-Host "then boots. In a second terminal run one gateway:"
    Write-Host "    python -m uvicorn api.main:app --reload --port 8000  # web demo"
    Write-Host "    ./bridge/bridge.ps1 -Port $Port          # real OpenAI"
    Write-Host "    ./bridge/bridge.ps1 -Port $Port -Mock     # offline, no key"
    & $qemu -kernel $kernel -serial "tcp:127.0.0.1:$Port,server"
}
else {
    Write-Host "Launching QEMU window; COM1 on stdio. Try typing:  >hello"
    & $qemu -kernel $kernel -serial stdio
}
