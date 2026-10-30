# @implements spec-ft-distribution-windows-installer::TASK-DISTRIBUTION-003-3::REQ-004
# @implements spec-ft-distribution-windows-installer::TASK-DISTRIBUTION-003-3::REQ-010
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$BundledVersion,

    [Parameter(Mandatory = $false)]
    [string]$ApiUrl = "https://api.github.com/repos/Lexer727/aico/releases/latest",

    [Parameter(Mandatory = $false)]
    [string]$OutDir,

    [Parameter(Mandatory = $false)]
    [switch]$SkipCheck
)

$ErrorActionPreference = "Stop"

function Parse-SemVer([string]$v) {
    $clean = $v -replace '^[vV]', ''
    $clean = ($clean -split '[-+]')[0]
    $parts = $clean -split '\.'
    $major = if ($parts.Length -gt 0) { [int]$parts[0] } else { 0 }
    $minor = if ($parts.Length -gt 1) { [int]$parts[1] } else { 0 }
    $patch = if ($parts.Length -gt 2) { [int]$parts[2] } else { 0 }
    return [System.Version]::new($major, $minor, $patch)
}

if ($SkipCheck) {
    [PSCustomObject]@{
        action  = "bundled"
        version = $BundledVersion
        reason  = "Update check explicitly skipped"
    } | ConvertTo-Json -Compress
    exit 0
}

if (-not $OutDir) {
    $OutDir = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "aico_update_" + [System.Guid]::NewGuid().ToString("N"))
}

if (-not (Test-Path $OutDir)) {
    [System.IO.Directory]::CreateDirectory($OutDir) | Out-Null
}

try {
    $headers = @{
        "User-Agent" = "AICO-Installer"
        "Accept"     = "application/vnd.github.v3+json"
    }

    $response = Invoke-RestMethod -Uri $ApiUrl -Headers $headers -TimeoutSec 10
    $remoteTag = $response.tag_name
    if (-not $remoteTag) {
        throw "Release payload missing tag_name"
    }

    $bundledSemver = Parse-SemVer $BundledVersion
    $remoteSemver = Parse-SemVer $remoteTag

    if ($remoteSemver -le $bundledSemver) {
        [PSCustomObject]@{
            action  = "bundled"
            version = $BundledVersion
            reason  = "Bundled version ($BundledVersion) is current or newer than remote ($remoteTag)"
        } | ConvertTo-Json -Compress
        exit 0
    }

    # Find zip and checksum assets
    $zipAsset = $response.assets | Where-Object { $_.name -eq "aico-windows-x64.zip" } | Select-Object -First 1
    $shaAsset = $response.assets | Where-Object { $_.name -like "*.sha256" } | Select-Object -First 1

    if (-not $zipAsset -or -not $shaAsset) {
        throw "Release assets incomplete (expected aico-windows-x64.zip and checksum asset)"
    }

    $zipPath = Join-Path $OutDir "aico-windows-x64.zip"
    $shaPath = Join-Path $OutDir ($shaAsset.name)

    Invoke-WebRequest -Uri $zipAsset.browser_download_url -OutFile $zipPath -Headers $headers -TimeoutSec 60
    Invoke-WebRequest -Uri $shaAsset.browser_download_url -OutFile $shaPath -Headers $headers -TimeoutSec 15

    $expectedRaw = Get-Content -Path $shaPath -Raw
    $expectedHash = ($expectedRaw -split '\s+')[0].Trim().ToLower()

    $actualHash = (Get-FileHash -Path $zipPath -Algorithm SHA256).Hash.ToLower()

    if ($actualHash -ne $expectedHash) {
        [PSCustomObject]@{
            action  = "bundled"
            version = $BundledVersion
            reason  = "Checksum mismatch: expected $expectedHash, got $actualHash"
        } | ConvertTo-Json -Compress
        exit 0
    }

    # Extract archive
    $extractDir = Join-Path $OutDir "extracted"
    [System.IO.Directory]::CreateDirectory($extractDir) | Out-Null
    Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force

    [PSCustomObject]@{
        action     = "downloaded"
        version    = ($remoteTag -replace '^[vV]', '')
        zipPath    = $zipPath
        extractDir = $extractDir
        reason     = "Newer version $remoteTag verified and ready for installation"
    } | ConvertTo-Json -Compress
    exit 0

} catch {
    [PSCustomObject]@{
        action  = "bundled"
        version = $BundledVersion
        reason  = "Update check failed: $($_.Exception.Message)"
    } | ConvertTo-Json -Compress
    exit 0
}
