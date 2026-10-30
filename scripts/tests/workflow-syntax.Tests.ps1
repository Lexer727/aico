# @verifies spec-ft-distribution-release-pipeline::TASK-DISTRIBUTION-002-3::REQ-001
# @verifies spec-ft-distribution-release-pipeline::TASK-DISTRIBUTION-002-3::REQ-005
# @verifies spec-ft-distribution-release-pipeline::TASK-DISTRIBUTION-002-3::REQ-006
# @verifies spec-ft-distribution-release-pipeline::TASK-DISTRIBUTION-002-3::REQ-007

$workflowPath = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\..\.github\workflows\release.yml"

Describe "GitHub Actions Release Workflow Contract" {
    It "exists at .github/workflows/release.yml" {
        Test-Path $workflowPath | Should Be $true
    }

    $content = Get-Content -Raw -Path $workflowPath

    It "triggers on push tags matching v* and workflow_dispatch" {
        $content | Should Match "tags:\s*-\s*['""]v\*"
        $content | Should Match "workflow_dispatch:"
    }

    It "checks out with submodules recursive" {
        $content | Should Match "actions/checkout@v4"
        $content | Should Match "submodules:\s*recursive"
    }

    It "executes check-release-version and package-release scripts" {
        $content | Should Match "check-release-version\.ps1"
        $content | Should Match "package-release\.ps1"
    }

    It "configures action-gh-release with zip, checksum, installer, and prerelease detection" {
        $content | Should Match "softprops/action-gh-release@v2"
        $content | Should Match "aico-windows-x64\.zip"
        $content | Should Match "aico-windows-x64\.zip\.sha256"
        $content | Should Match "prerelease:\s*\$\{\{\s*contains\(github\.ref_name,\s*'-'\)\s*\}\}"
    }
}
