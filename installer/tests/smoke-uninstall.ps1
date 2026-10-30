# @verifies spec-ft-distribution-uninstaller::TASK-DISTRIBUTION-005-1::REQ-001
# @verifies spec-ft-distribution-uninstaller::TASK-DISTRIBUTION-005-1::REQ-002
# @verifies spec-ft-distribution-uninstaller::TASK-DISTRIBUTION-005-1::REQ-003
# @verifies spec-ft-distribution-uninstaller::TASK-DISTRIBUTION-005-1::REQ-004

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Root,

    [Parameter(Mandatory = $false)]
    [switch]$PurgeData
)

$ErrorActionPreference = "Stop"

$uninstallerExe = Join-Path $Root ".aico\bin\unins000.exe"
if (-not (Test-Path $uninstallerExe)) {
    Write-Error "Uninstaller executable not found at: $uninstallerExe"
    exit 1
}

# Pre-populate verification markers
$specsMarker = Join-Path $Root "specs\user_spec.md"
$codebaseMarker = Join-Path $Root "codebase\user_code.rs"
$storageMarker = Join-Path $Root ".aico\storage\graph.db"
$aicoSkillMarker = Join-Path $Root ".agents\skills\aico-core\SKILL.md"
$customSkillMarker = Join-Path $Root ".agents\skills\my-custom-skill\SKILL.md"

[System.IO.Directory]::CreateDirectory((Split-Path -Parent $specsMarker)) | Out-Null
[System.IO.Directory]::CreateDirectory((Split-Path -Parent $codebaseMarker)) | Out-Null
[System.IO.Directory]::CreateDirectory((Split-Path -Parent $storageMarker)) | Out-Null
[System.IO.Directory]::CreateDirectory((Split-Path -Parent $aicoSkillMarker)) | Out-Null
[System.IO.Directory]::CreateDirectory((Split-Path -Parent $customSkillMarker)) | Out-Null

Set-Content -Path $specsMarker -Value "USER_SPEC"
Set-Content -Path $codebaseMarker -Value "USER_CODE"
Set-Content -Path $storageMarker -Value "STORAGE_DATA"
Set-Content -Path $aicoSkillMarker -Value "AICO_SKILL"
Set-Content -Path $customSkillMarker -Value "CUSTOM_USER_SKILL"

$args = "/VERYSILENT /SUPPRESSMSGBOXES"
if ($PurgeData) {
    $args += " /PURGEDATA"
}

Write-Host "[*] Executing uninstaller with args: $args"
$proc = Start-Process -FilePath $uninstallerExe -ArgumentList $args -PassThru -Wait
Start-Sleep -Seconds 1

# Assert .aico\bin is deleted (REQ-002)
if (Test-Path (Join-Path $Root ".aico\bin")) {
    Write-Error "Assertion failed: .aico\bin was not removed by uninstaller!"
    exit 1
}

# Assert user specs and codebase are ALWAYS preserved (REQ-004)
if (-not (Test-Path $specsMarker)) {
    Write-Error "CRITICAL: User specs were deleted by uninstaller!"
    exit 1
}
if (-not (Test-Path $codebaseMarker)) {
    Write-Error "CRITICAL: User codebase was deleted by uninstaller!"
    exit 1
}

if ($PurgeData) {
    # Purge mode: storage, logs, and aico-skills removed (REQ-003)
    if (Test-Path $storageMarker) {
        Write-Error "Assertion failed: Storage marker was not purged with /PURGEDATA!"
        exit 1
    }
    if (Test-Path $aicoSkillMarker) {
        Write-Error "Assertion failed: AICO skill was not purged with /PURGEDATA!"
        exit 1
    }
    # Custom skills MUST survive
    if (-not (Test-Path $customSkillMarker)) {
        Write-Error "Assertion failed: Custom non-AICO skill was deleted!"
        exit 1
    }
    Write-Host "[+] PurgeData uninstall smoke test passed!"
} else {
    # Default mode: storage preserved (REQ-004)
    if (-not (Test-Path $storageMarker)) {
        Write-Error "Assertion failed: Storage was deleted during default uninstall!"
        exit 1
    }
    Write-Host "[+] Default uninstall smoke test passed!"
}

exit 0
