$setup = "d:\aico\codebase\aico\dist\release\aico-setup-0.2.0.exe"

# 1. Default uninstall test
$testRoot1 = Join-Path ([System.IO.Path]::GetTempPath()) ("aico_uninst_test1_" + [System.Guid]::NewGuid().ToString("N"))
Write-Host "[*] Installing to $testRoot1"
$proc1 = Start-Process $setup -ArgumentList "/VERYSILENT /SUPPRESSMSGBOXES /DIR=`"$testRoot1`"" -PassThru -Wait
if ($proc1.ExitCode -ne 0) { throw "Install 1 failed: $($proc1.ExitCode)" }

Write-Host "[*] Running default uninstall smoke test..."
& "d:\aico\codebase\aico\installer\tests\smoke-uninstall.ps1" -Root $testRoot1
Remove-Item -Recurse -Force $testRoot1 -ErrorAction SilentlyContinue

# 2. Purge uninstall test
$testRoot2 = Join-Path ([System.IO.Path]::GetTempPath()) ("aico_uninst_test2_" + [System.Guid]::NewGuid().ToString("N"))
Write-Host "[*] Installing to $testRoot2"
$proc2 = Start-Process $setup -ArgumentList "/VERYSILENT /SUPPRESSMSGBOXES /DIR=`"$testRoot2`"" -PassThru -Wait
if ($proc2.ExitCode -ne 0) { throw "Install 2 failed: $($proc2.ExitCode)" }

Write-Host "[*] Running PurgeData uninstall smoke test..."
& "d:\aico\codebase\aico\installer\tests\smoke-uninstall.ps1" -Root $testRoot2 -PurgeData
Remove-Item -Recurse -Force $testRoot2 -ErrorAction SilentlyContinue

Write-Host "[+] Both uninstall smoke tests succeeded!"
