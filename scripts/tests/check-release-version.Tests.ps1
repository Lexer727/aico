# @verifies spec-ft-distribution-release-pipeline::TASK-DISTRIBUTION-002-1::REQ-002

$scriptPath = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\check-release-version.ps1"

Describe "Release Version Gate Script" {
    $tempDir = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "aico_ver_test_" + [System.Guid]::NewGuid().ToString("N"))
    [System.IO.Directory]::CreateDirectory($tempDir) | Out-Null
    $cargoPath = Join-Path $tempDir "Cargo.toml"

    Set-Content -Path $cargoPath -Value @"
[workspace]
members = ["crates/*"]

[workspace.package]
version = "0.2.0"
edition = "2021"
"@

    It "passes when tag exactly matches Cargo workspace version" {
        & $scriptPath -Tag "v0.2.0" -CargoToml $cargoPath
        $LASTEXITCODE | Should Be 0
    }

    It "passes when tag has no leading v but matches Cargo workspace version" {
        & $scriptPath -Tag "0.2.0" -CargoToml $cargoPath
        $LASTEXITCODE | Should Be 0
    }

    It "passes when tag matches with prerelease suffix" {
        & $scriptPath -Tag "v0.2.0-rc.1" -CargoToml $cargoPath
        $LASTEXITCODE | Should Be 0
    }

    It "fails when tag version does not match Cargo workspace version" {
        $output = & $scriptPath -Tag "v0.3.0" -CargoToml $cargoPath 2>&1
        $LASTEXITCODE | Should Not Be 0
        $outputString = $output | Out-String
        $outputString | Should Match "0.3.0"
        $outputString | Should Match "0.2.0"
    }

    Remove-Item -Recurse -Force $tempDir
}
