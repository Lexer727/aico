# @verifies spec-ft-distribution-release-pipeline::TASK-DISTRIBUTION-002-2::REQ-003
# @verifies spec-ft-distribution-release-pipeline::TASK-DISTRIBUTION-002-2::REQ-004

$scriptPath = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\package-release.ps1"

Describe "Release Bundle Packaging Script" {
    $tempDir = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "aico_pkg_test_" + [System.Guid]::NewGuid().ToString("N"))
    [System.IO.Directory]::CreateDirectory($tempDir) | Out-Null

    $binDir = Join-Path $tempDir "bin"
    [System.IO.Directory]::CreateDirectory($binDir) | Out-Null
    $fakeExe = Join-Path $binDir "aico-server.exe"
    Set-Content -Path $fakeExe -Value "MOCK_EXE_BINARY_DATA"

    $skillsDir = Join-Path $tempDir "skills"
    $skillA = Join-Path $skillsDir "aico-core"
    $gitSubDir = Join-Path $skillsDir ".git"
    [System.IO.Directory]::CreateDirectory($skillA) | Out-Null
    [System.IO.Directory]::CreateDirectory($gitSubDir) | Out-Null
    Set-Content -Path (Join-Path $skillA "SKILL.md") -Value "MOCK_SKILL_A"
    Set-Content -Path (Join-Path $gitSubDir "HEAD") -Value "MOCK_GIT_INTERNAL"

    $catalogPath = Join-Path $tempDir "prerequisites.json"
    Set-Content -Path $catalogPath -Value '{"tools":[]}'

    $outDir = Join-Path $tempDir "out"
    [System.IO.Directory]::CreateDirectory($outDir) | Out-Null

    It "packages zip, checksum, and manifest conforming to REQ-003 and REQ-004" {
        & $scriptPath -Version "0.2.0" -Commit "abcdef123456" -BinaryPath $fakeExe -SkillsPath $skillsDir -CatalogPath $catalogPath -OutDir $outDir
        $LASTEXITCODE | Should Be 0

        $zipPath = Join-Path $outDir "aico-windows-x64.zip"
        $shaPath = Join-Path $outDir "aico-windows-x64.zip.sha256"

        Test-Path $zipPath | Should Be $true
        Test-Path $shaPath | Should Be $true

        # Verify sha256 checksum correctness
        $actualSha = (Get-FileHash -Path $zipPath -Algorithm SHA256).Hash.ToLower()
        $expectedSha = (Get-Content -Path $shaPath).Trim().ToLower()
        $actualSha | Should Be $expectedSha

        # Extract and verify zip contents
        $extractDir = Join-Path $tempDir "extracted"
        [System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $extractDir)

        Test-Path (Join-Path $extractDir "aico-server.exe") | Should Be $true
        Test-Path (Join-Path $extractDir "prerequisites.json") | Should Be $true
        Test-Path (Join-Path $extractDir "manifest.json") | Should Be $true
        Test-Path (Join-Path $extractDir "skills\aico-core\SKILL.md") | Should Be $true
        # .git must be excluded
        Test-Path (Join-Path $extractDir "skills\.git") | Should Be $false

        # Verify manifest.json schema
        $manifestContent = Get-Content -Raw -Path (Join-Path $extractDir "manifest.json") | ConvertFrom-Json
        $manifestContent.version | Should Be "0.2.0"
        $manifestContent.commit | Should Be "abcdef123456"
        $manifestContent.files.Count | Should BeGreaterThan 2

        # Check each file hash in manifest
        foreach ($fileEntry in $manifestContent.files) {
            $extractedFile = Join-Path $extractDir $fileEntry.path
            Test-Path $extractedFile | Should Be $true
            $fileHash = (Get-FileHash -Path $extractedFile -Algorithm SHA256).Hash.ToLower()
            $fileEntry.sha256.ToLower() | Should Be $fileHash
        }
    }

    Remove-Item -Recurse -Force $tempDir
}
