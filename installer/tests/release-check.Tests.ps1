# @verifies spec-ft-distribution-windows-installer::TASK-DISTRIBUTION-003-3::REQ-004
# @verifies spec-ft-distribution-windows-installer::TASK-DISTRIBUTION-003-3::REQ-010
$scriptPath = Join-Path $PSScriptRoot "..\scripts\release-check.ps1"
$mockScript = Join-Path $PSScriptRoot "mock-release-server.cjs"

function Start-MockServer($mode, $port) {
    $proc = Start-Process node -ArgumentList "`"$mockScript`" $mode $port" -PassThru
    Start-Sleep -Milliseconds 600
    return $proc
}

function Stop-MockServer($port, $proc) {
    try { Invoke-RestMethod -Uri "http://127.0.0.1:$port/shutdown" -TimeoutSec 2 | Out-Null } catch {}
    if ($proc -and -not $proc.HasExited) {
        $proc.Kill()
    }
}

Describe "Release Check and Latest Version Download Logic" {
    It "returns bundled when SkipCheck is specified" {
        $resultJson = & $scriptPath -BundledVersion "0.2.0" -SkipCheck
        $result = $resultJson | ConvertFrom-Json
        $result.action | Should Be "bundled"
        $result.version | Should Be "0.2.0"
        $result.reason | Should Match "skipped"
    }

    It "returns bundled when remote version is equal or older" {
        $port = 48991
        $proc = Start-MockServer "equal" $port
        $tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("aico_rc_test_" + [System.Guid]::NewGuid().ToString("N"))

        try {
            $resultJson = & $scriptPath -BundledVersion "0.2.0" -ApiUrl "http://127.0.0.1:$port/release" -OutDir $tempDir
            $result = $resultJson | ConvertFrom-Json
            $result.action | Should Be "bundled"
            $result.reason | Should Match "current or newer"
        } finally {
            Stop-MockServer $port $proc
            Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
        }
    }

    It "downloads and verifies newer release when available" {
        $port = 48992
        $proc = Start-MockServer "newer" $port
        $tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("aico_rc_test_" + [System.Guid]::NewGuid().ToString("N"))

        try {
            $resultJson = & $scriptPath -BundledVersion "0.2.0" -ApiUrl "http://127.0.0.1:$port/release" -OutDir $tempDir
            $result = $resultJson | ConvertFrom-Json
            $result.action | Should Be "downloaded"
            $result.version | Should Be "0.3.0"
            $extractedExe = Join-Path $result.extractDir "aico-server.exe"
            (Test-Path $extractedExe) | Should Be $true
            (Get-Content $extractedExe).Trim() | Should Be "MOCK_V0_3_0_SERVER_BINARY"
        } finally {
            Stop-MockServer $port $proc
            Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
        }
    }

    It "falls back to bundled when checksum fails" {
        $port = 48993
        $proc = Start-MockServer "bad_hash" $port
        $tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("aico_rc_test_" + [System.Guid]::NewGuid().ToString("N"))

        try {
            $resultJson = & $scriptPath -BundledVersion "0.2.0" -ApiUrl "http://127.0.0.1:$port/release" -OutDir $tempDir
            $result = $resultJson | ConvertFrom-Json
            $result.action | Should Be "bundled"
            $result.reason | Should Match "Checksum mismatch"
        } finally {
            Stop-MockServer $port $proc
            Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
        }
    }

    It "falls back to bundled when API fails" {
        $resultJson = & $scriptPath -BundledVersion "0.2.0" -ApiUrl "http://127.0.0.1:49999/nonexistent"
        $result = $resultJson | ConvertFrom-Json
        $result.action | Should Be "bundled"
        $result.reason | Should Match "failed"
    }
}
