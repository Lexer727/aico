# @implements spec-ft-distribution-prerequisite-provisioning::TASK-DISTRIBUTION-004-1::REQ-001
# @implements spec-ft-distribution-prerequisite-provisioning::TASK-DISTRIBUTION-004-1::REQ-002
# @implements spec-ft-distribution-prerequisite-provisioning::TASK-DISTRIBUTION-004-1::REQ-003
# @implements spec-ft-distribution-prerequisite-provisioning::TASK-DISTRIBUTION-004-1::REQ-004
# @implements spec-ft-distribution-prerequisite-provisioning::TASK-DISTRIBUTION-004-1::REQ-005
# @implements spec-ft-distribution-prerequisite-provisioning::TASK-DISTRIBUTION-004-1::REQ-007
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("detect", "install")]
    [string]$Action,

    [Parameter(Mandatory = $false)]
    [string]$CatalogPath = "installer/prerequisites.json",

    [Parameter(Mandatory = $false)]
    [string]$Ids = "",

    [Parameter(Mandatory = $false)]
    [switch]$DryRun
)

if (-not (Test-Path $CatalogPath)) {
    Write-Error "Prerequisite catalog not found at: $CatalogPath"
    exit 1
}

$catalog = Get-Content -Raw -Path $CatalogPath | ConvertFrom-Json

if ($Action -eq "detect") {
    $results = @()
    foreach ($tool in $catalog.tools) {
        $installed = $false
        $version = $null

        try {
            $cmdOutput = Invoke-Expression "$($tool.detect_cmd) 2>`$null"
            if ($cmdOutput) {
                $outputStr = ($cmdOutput | Out-String).Trim()
                if ($outputStr -match '(\bv?\d+(\.\d+)+[a-zA-Z0-9_\-\.]*\b)') {
                    $version = $matches[1]
                    $installed = $true
                } elseif ($LASTEXITCODE -eq 0 -or $outputStr.Length -gt 0) {
                    $version = "installed"
                    $installed = $true
                }
            }
        } catch {
            $installed = $false
            $version = $null
        }

        $results += [PSCustomObject]@{
            id              = $tool.id
            name            = $tool.name
            description     = $tool.description
            required        = [bool]$tool.required
            default_checked = [bool]$tool.default_checked
            installed       = $installed
            version         = $version
            homepage_url    = $tool.homepage_url
        }
    }

    $results | ConvertTo-Json -Depth 5
    exit 0
}

if ($Action -eq "install") {
    $targetIds = $Ids.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_.Length -gt 0 }
    $wingetAvailable = [bool](Get-Command "winget" -ErrorAction SilentlyContinue)
    $npmAvailable = [bool](Get-Command "npm" -ErrorAction SilentlyContinue)

    $installSummary = @()

    foreach ($tool in $catalog.tools) {
        if ($targetIds -contains $tool.id) {
            $cmd = $null
            $method = "none"

            if ($tool.winget_id -and $wingetAvailable) {
                $cmd = "winget install --id $($tool.winget_id) --exact --silent --accept-package-agreements --accept-source-agreements"
                $method = "winget"
            } elseif ($tool.npm_package -and $npmAvailable) {
                $cmd = "npm install -g $($tool.npm_package)"
                $method = "npm"
            } elseif ($tool.winget_id) {
                $cmd = "winget install --id $($tool.winget_id) --exact --silent --accept-package-agreements --accept-source-agreements"
                $method = "winget"
            }

            if ($DryRun) {
                Write-Output "[DryRun] Would execute: $cmd (Method: $method for $($tool.name))"
                $installSummary += [PSCustomObject]@{
                    id     = $tool.id
                    status = "dry-run"
                    method = $method
                    cmd    = $cmd
                }
            } else {
                if ($cmd) {
                    Write-Output "[*] Provisioning $($tool.name) via $method..."
                    try {
                        Invoke-Expression $cmd
                        $installSummary += [PSCustomObject]@{
                            id     = $tool.id
                            status = "success"
                            method = $method
                        }
                    } catch {
                        Write-Warning "Failed to install $($tool.name): $_"
                        $installSummary += [PSCustomObject]@{
                            id           = $tool.id
                            status       = "failed"
                            homepage_url = $tool.homepage_url
                            error        = $_.ToString()
                        }
                    }
                } else {
                    Write-Warning "No installer found for $($tool.name). Please visit $($tool.homepage_url)"
                    $installSummary += [PSCustomObject]@{
                        id           = $tool.id
                        status       = "manual"
                        homepage_url = $tool.homepage_url
                    }
                }
            }
        }
    }

    exit 0
}
