# @implements spec-ft-distribution-release-pipeline::TASK-DISTRIBUTION-002-1::REQ-002
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Tag,

    [Parameter(Mandatory = $false)]
    [string]$CargoToml = "Cargo.toml"
)

if (-not (Test-Path $CargoToml)) {
    Write-Error "Cargo.toml not found at path: $CargoToml"
    exit 1
}

$cargoContent = Get-Content -Raw -Path $CargoToml
if ($cargoContent -match '\[workspace\.package\][\s\S]*?version\s*=\s*["'']([^"'']+)["'']') {
    $cargoVersion = $matches[1].Trim()
} elseif ($cargoContent -match 'version\s*=\s*["'']([^"'']+)["'']') {
    $cargoVersion = $matches[1].Trim()
} else {
    Write-Error "Could not locate version attribute in $CargoToml"
    exit 1
}

$cleanTag = $Tag.Trim()
if ($cleanTag.StartsWith("v", [System.StringComparison]::OrdinalIgnoreCase)) {
    $cleanTag = $cleanTag.Substring(1)
}

$baseTagVersion = $cleanTag.Split("-")[0]
$baseCargoVersion = $cargoVersion.Split("-")[0]

if ($baseTagVersion -ne $baseCargoVersion) {
    Write-Error "Release version mismatch! Git tag '$Tag' (version: $cleanTag) does not match Cargo.toml version '$cargoVersion'."
    exit 1
}

Write-Host "[*] Version check passed: Git tag '$Tag' matches Cargo workspace version '$cargoVersion'."
exit 0
