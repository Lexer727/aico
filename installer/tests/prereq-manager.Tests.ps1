# @verifies spec-ft-distribution-prerequisite-provisioning::TASK-DISTRIBUTION-004-1::REQ-001
# @verifies spec-ft-distribution-prerequisite-provisioning::TASK-DISTRIBUTION-004-1::REQ-002
# @verifies spec-ft-distribution-prerequisite-provisioning::TASK-DISTRIBUTION-004-1::REQ-003
# @verifies spec-ft-distribution-prerequisite-provisioning::TASK-DISTRIBUTION-004-1::REQ-004
# @verifies spec-ft-distribution-prerequisite-provisioning::TASK-DISTRIBUTION-004-1::REQ-005
# @verifies spec-ft-distribution-prerequisite-provisioning::TASK-DISTRIBUTION-004-1::REQ-007

$scriptPath = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\scripts\prereq-manager.ps1"
$catalogPath = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\prerequisites.json"

Describe "Prerequisite Catalog Schema & Contents" {
    It "exists and conforms to REQ-001 and REQ-002" {
        Test-Path $catalogPath | Should Be $true
        $catalog = Get-Content -Raw -Path $catalogPath | ConvertFrom-Json
        $catalog.tools.Count | Should Be 7

        $ids = @($catalog.tools | ForEach-Object { $_.id })
        ($ids -contains "git") | Should Be $true
        ($ids -contains "gh") | Should Be $true
        ($ids -contains "node") | Should Be $true
        ($ids -contains "claude-code") | Should Be $true
        ($ids -contains "antigravity") | Should Be $true
        ($ids -contains "codex") | Should Be $true
        ($ids -contains "copilot") | Should Be $true

        # Check required fields
        foreach ($tool in $catalog.tools) {
            $tool.name.Length | Should BeGreaterThan 0
            $tool.description.Length | Should BeGreaterThan 0
            $tool.homepage_url | Should Match "^https?://"
        }

        # Git must be required
        $gitTool = $catalog.tools | Where-Object { $_.id -eq "git" }
        $gitTool.required | Should Be $true
    }
}

Describe "Prerequisite Detection and Install Command Resolution" {
    It "detects installed tools and returns JSON array with installed flag and version" {
        $detectOutput = & $scriptPath -Action "detect" -CatalogPath $catalogPath
        $LASTEXITCODE | Should Be 0
        $items = $detectOutput | ConvertFrom-Json
        $items.Count | Should Be 7

        # Node and git are running in this environment
        $nodeItem = $items | Where-Object { $_.id -eq "node" }
        $nodeItem.installed | Should Be $true
        $nodeItem.version | Should Match "v?\d+\.\d+"
    }

    It "generates dry-run install commands for winget when winget_id is present" {
        $installOutput = & $scriptPath -Action "install" -CatalogPath $catalogPath -Ids "git,gh" -DryRun
        $LASTEXITCODE | Should Be 0
        $lines = ($installOutput | Out-String)
        $lines | Should Match "winget install --id Git\.Git"
        $lines | Should Match "winget install --id GitHub\.cli"
    }

    It "falls back to npm when winget_id is null and npm_package is defined" {
        $installOutput = & $scriptPath -Action "install" -CatalogPath $catalogPath -Ids "codex" -DryRun
        $LASTEXITCODE | Should Be 0
        $lines = ($installOutput | Out-String)
        $lines | Should Match "npm install -g @openai/codex"
    }
}
