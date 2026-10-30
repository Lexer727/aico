# @implements spec-ft-distribution-release-pipeline::TASK-DISTRIBUTION-002-2::REQ-003
# @implements spec-ft-distribution-release-pipeline::TASK-DISTRIBUTION-002-2::REQ-004
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Version,

    [Parameter(Mandatory = $false)]
    [string]$Commit,

    [Parameter(Mandatory = $false)]
    [string]$BinaryPath = "target/release/aico-server.exe",

    [Parameter(Mandatory = $false)]
    [string]$SkillsPath = "skills",

    [Parameter(Mandatory = $false)]
    [string]$CatalogPath = "installer/prerequisites.json",

    [Parameter(Mandatory = $false)]
    [string]$OutDir = "dist/release"
)

$ErrorActionPreference = "Stop"

function Resolve-FullPath([string]$p) {
    if ([System.IO.Path]::IsPathRooted($p)) {
        return $p
    }
    return [System.IO.Path]::Combine((Get-Location).Path, $p)
}

$BinaryPath = Resolve-FullPath $BinaryPath
if (-not (Test-Path $BinaryPath)) {
    Write-Error "Server binary not found at path: $BinaryPath"
    exit 1
}

$OutDir = Resolve-FullPath $OutDir
if (-not (Test-Path $OutDir)) {
    [System.IO.Directory]::CreateDirectory($OutDir) | Out-Null
}

if (-not $Commit) {
    try {
        $Commit = (git rev-parse HEAD).Trim()
    } catch {
        $Commit = "unknown"
    }
}

$stagingParent = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "aico_stage_" + [System.Guid]::NewGuid().ToString("N"))
[System.IO.Directory]::CreateDirectory($stagingParent) | Out-Null
$stagingDir = Join-Path $stagingParent "payload"
[System.IO.Directory]::CreateDirectory($stagingDir) | Out-Null

try {
    # 1. Copy aico-server.exe
    Copy-Item -Path $BinaryPath -Destination (Join-Path $stagingDir "aico-server.exe") -Force

    # 2. Copy skills directory excluding .git
    $SkillsPath = Resolve-FullPath $SkillsPath
    if (Test-Path $SkillsPath) {
        $destSkills = Join-Path $stagingDir "skills"
        [System.IO.Directory]::CreateDirectory($destSkills) | Out-Null

        $sourceFiles = Get-ChildItem -Path $SkillsPath -Recurse -File | Where-Object {
            $_.FullName -notmatch '[\\/]\.git([\\/]|$)'
        }
        foreach ($f in $sourceFiles) {
            $rel = $f.FullName.Substring($SkillsPath.Length).TrimStart('\', '/')
            $destFile = Join-Path $destSkills $rel
            $destSubdir = Split-Path -Parent $destFile
            if (-not (Test-Path $destSubdir)) {
                [System.IO.Directory]::CreateDirectory($destSubdir) | Out-Null
            }
            Copy-Item -Path $f.FullName -Destination $destFile -Force
        }
    }

    # 3. Copy prerequisites catalog if present
    $CatalogPath = Resolve-FullPath $CatalogPath
    if (Test-Path $CatalogPath) {
        Copy-Item -Path $CatalogPath -Destination (Join-Path $stagingDir "prerequisites.json") -Force
    }

    # 4. Generate manifest.json (files array contains every file in staging except manifest.json)
    $stagedFiles = Get-ChildItem -Path $stagingDir -Recurse -File
    $filesList = @()
    foreach ($sf in $stagedFiles) {
        $rel = $sf.FullName.Substring($stagingDir.Length).TrimStart('\', '/').Replace('\', '/')
        $hash = (Get-FileHash -Path $sf.FullName -Algorithm SHA256).Hash.ToLower()
        $filesList += [PSCustomObject]@{
            path   = $rel
            sha256 = $hash
        }
    }

    $manifest = [PSCustomObject]@{
        version  = $Version
        commit   = $Commit
        built_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
        files    = $filesList
    }

    $manifestJson = $manifest | ConvertTo-Json -Depth 5
    Set-Content -Path (Join-Path $stagingDir "manifest.json") -Value $manifestJson -Encoding UTF8

    # 5. Export payload directory to OutDir for installer compilation
    $outPayload = Join-Path $OutDir "payload"
    if (Test-Path $outPayload) {
        Remove-Item -Recurse -Force $outPayload
    }
    Copy-Item -Path $stagingDir -Destination $outPayload -Recurse -Force

    # 6. Compress staging directory into aico-windows-x64.zip
    $zipPath = Join-Path $OutDir "aico-windows-x64.zip"
    if (Test-Path $zipPath) {
        Remove-Item -Force $zipPath
    }

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::CreateFromDirectory($stagingDir, $zipPath, [System.IO.Compression.CompressionLevel]::Optimal, $false)

    # 7. Generate checksum
    $zipHash = (Get-FileHash -Path $zipPath -Algorithm SHA256).Hash.ToLower()
    $shaPath = Join-Path $OutDir "aico-windows-x64.zip.sha256"
    Set-Content -Path $shaPath -Value $zipHash -Encoding ASCII

    Write-Host "[*] Release package successfully created:"
    Write-Host "    Zip:      $zipPath"
    Write-Host "    SHA-256:  $zipHash"
    Write-Host "    Payload:  $outPayload"
    Write-Host "    Files:    $($filesList.Count + 1)"
} finally {
    if (Test-Path $stagingParent) {
        Remove-Item -Recurse -Force $stagingParent -ErrorAction SilentlyContinue
    }
}

exit 0
