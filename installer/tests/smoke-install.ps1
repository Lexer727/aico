# @verifies spec-ft-distribution-windows-installer::TASK-DISTRIBUTION-003-1::REQ-001
# @verifies spec-ft-distribution-windows-installer::TASK-DISTRIBUTION-003-1::REQ-002
# @verifies spec-ft-distribution-windows-installer::TASK-DISTRIBUTION-003-1::REQ-003
# @verifies spec-ft-distribution-windows-installer::TASK-DISTRIBUTION-003-1::REQ-009
# @verifies spec-ft-distribution-windows-installer::TASK-DISTRIBUTION-003-2::REQ-005
# @verifies spec-ft-distribution-windows-installer::TASK-DISTRIBUTION-003-2::REQ-006
# @verifies spec-ft-distribution-windows-installer::TASK-DISTRIBUTION-003-2::REQ-007
# @verifies spec-ft-distribution-windows-installer::TASK-DISTRIBUTION-003-2::REQ-008

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$SetupExe,

    [Parameter(Mandatory = $false)]
    [string]$Root
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $SetupExe)) {
    Write-Error "Installer binary not found at: $SetupExe"
    exit 1
}

$cleanupRoot = $false
if (-not $Root) {
    $Root = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "aico_smoke_root_" + [System.Guid]::NewGuid().ToString("N"))
    $cleanupRoot = $true
}

$desktopShortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) "AICO.lnk"
$initialDesktopExists = Test-Path $desktopShortcut
$binDir = Join-Path $Root ".aico\bin"

Write-Host "[*] Executing AICO Installer Smoke Test at root: $Root"

try {
    # 1. Pre-seed workspace markers to verify preservation (REQ-002)
    $preStorage = Join-Path $Root ".aico\storage"
    $preSpecs = Join-Path $Root "specs"
    [System.IO.Directory]::CreateDirectory($preStorage) | Out-Null
    [System.IO.Directory]::CreateDirectory($preSpecs) | Out-Null

    $storageMarker = Join-Path $preStorage "marker.txt"
    $specsMarker = Join-Path $preSpecs "marker.txt"
    Set-Content -Path $storageMarker -Value "PRESERVE_STORAGE_TEST"
    Set-Content -Path $specsMarker -Value "PRESERVE_SPECS_TEST"

    # 2. Execute installer in unattended silent mode with desktopicon and addtopath tasks (REQ-005, REQ-009)
    $proc = Start-Process -FilePath $SetupExe -ArgumentList "/VERYSILENT /SUPPRESSMSGBOXES /DIR=`"$Root`" /TASKS=`"desktopicon,addtopath`"" -PassThru -Wait
    if ($proc.ExitCode -ne 0) {
        Write-Error "Installer exited with non-zero code: $($proc.ExitCode)"
        exit $proc.ExitCode
    }

    # 3. Assert canonical folder layout exists (REQ-001)
    $requiredDirs = @("specs", "codebase", ".agents", ".aico\storage", ".aico\logs", ".aico\bin")
    foreach ($d in $requiredDirs) {
        $p = Join-Path $Root $d
        if (-not (Test-Path $p)) {
            Write-Error "Assertion failed: Directory $p was not created by installer!"
            exit 1
        }
    }

    # 4. Assert payload placed in .aico/bin (REQ-003)
    $serverBin = Join-Path $binDir "aico-server.exe"
    if (-not (Test-Path $serverBin)) {
        Write-Error "Assertion failed: aico-server.exe missing from .aico\bin!"
        exit 1
    }

    # 5. Assert preserved storage and specs markers (REQ-002)
    if ((Get-Content $storageMarker).Trim() -ne "PRESERVE_STORAGE_TEST") {
        Write-Error "Assertion failed: Storage marker modified or overwritten!"
        exit 1
    }
    if ((Get-Content $specsMarker).Trim() -ne "PRESERVE_SPECS_TEST") {
        Write-Error "Assertion failed: Specs marker modified or overwritten!"
        exit 1
    }

    # 6. Assert desktop shortcut created (REQ-005)
    if (-not (Test-Path $desktopShortcut)) {
        Write-Error "Assertion failed: Desktop shortcut $desktopShortcut was not created!"
        exit 1
    }

    # 7. Assert PATH manipulation (REQ-005)
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($userPath -notlike "*$binDir*") {
        Write-Error "Assertion failed: User PATH does not contain $binDir! Current PATH: $userPath"
        exit 1
    }

    # 8. Execute server --version from installed location
    $verOutput = & $serverBin --version
    if ($LASTEXITCODE -ne 0 -or $verOutput -notmatch "aico-server \d+\.\d+") {
        Write-Error "Assertion failed: aico-server --version failed or returned unexpected output: $verOutput"
        exit 1
    }

    # 9. Test upgrade safety with running process (REQ-006 & REQ-007)
    Write-Host "[*] Testing running-process termination and in-place upgrade (REQ-006, REQ-007)..."
    # Create a background sleep process named aico-server.exe in a temp location or run server
    $tempLockDir = Join-Path ([System.IO.Path]::GetTempPath()) ("aico_lock_" + [System.Guid]::NewGuid().ToString("N"))
    [System.IO.Directory]::CreateDirectory($tempLockDir) | Out-Null
    $dummyExe = Join-Path $tempLockDir "aico-server.exe"
    Copy-Item $serverBin $dummyExe

    # Launch dummy aico-server.exe in background
    $dummyProc = Start-Process -FilePath $dummyExe -ArgumentList "--root `"$Root`"" -PassThru
    Start-Sleep -Milliseconds 500

    try {
        # Run installer again over existing $Root (upgrade)
        $upgradeProc = Start-Process -FilePath $SetupExe -ArgumentList "/VERYSILENT /SUPPRESSMSGBOXES /DIR=`"$Root`"" -PassThru -Wait
        if ($upgradeProc.ExitCode -ne 0) {
            Write-Error "In-place upgrade failed with exit code: $($upgradeProc.ExitCode)"
            exit $upgradeProc.ExitCode
        }

        # Verify dummy process was killed by installer PrepareToInstall
        if (-not $dummyProc.HasExited) {
            $dummyProc.Kill()
            Write-Error "Assertion failed: Running aico-server.exe process was not terminated by installer!"
            exit 1
        }
    } finally {
        if (-not $dummyProc.HasExited) {
            $dummyProc.Kill()
        }
        Remove-Item -Recurse -Force $tempLockDir -ErrorAction SilentlyContinue
    }

    Write-Host "[+] Smoke test passed! Layout, preservation, shortcuts, PATH, running process termination, and upgrade verified."
    exit 0
} finally {
    # Clean up desktop shortcut if created during test
    if (-not $initialDesktopExists -and (Test-Path $desktopShortcut)) {
        Remove-Item -Force $desktopShortcut -ErrorAction SilentlyContinue
    }
    # Clean up user PATH
    try {
        $curUserPath = [Environment]::GetEnvironmentVariable("Path", "User")
        if ($curUserPath -like "*$binDir*") {
            $parts = $curUserPath -split ';' | Where-Object { $_ -ne $binDir -and $_ -ne "" }
            [Environment]::SetEnvironmentVariable("Path", ($parts -join ';'), "User")
        }
    } catch {}

    if ($cleanupRoot -and (Test-Path $Root)) {
        Remove-Item -Recurse -Force $Root -ErrorAction SilentlyContinue
    }
}
