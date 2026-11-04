param([switch]$SkipRestore)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskBridge = Join-Path $taskRoot 'bridge'
$taskOut = Join-Path $taskRoot 'out'
if (-not [Environment]::Is64BitOperatingSystem -or $env:OS -ne 'Windows_NT') { throw 'C2 requires Windows x64.' }
Get-Command dotnet -ErrorAction Stop | Out-Null
$taskEnvironment = @{
    DOTNET_CLI_HOME = (Join-Path $taskOut 'fb-c2-dotnet')
    DOTNET_CLI_TELEMETRY_OPTOUT = '1'
    DOTNET_ADD_GLOBAL_TOOLS_TO_PATH = '0'
    DOTNET_GENERATE_ASPNET_CERTIFICATE = 'false'
    DOTNET_NOLOGO = '1'
    NUGET_PACKAGES = (Join-Path $taskOut 'fb-c2-dotnet\packages')
    NUGET_HTTP_CACHE_PATH = (Join-Path $taskOut 'fb-c2-dotnet\http-cache')
}
$taskPrevious = @{}
foreach ($taskName in $taskEnvironment.Keys) { $taskPrevious[$taskName] = [Environment]::GetEnvironmentVariable($taskName, 'Process'); [Environment]::SetEnvironmentVariable($taskName, $taskEnvironment[$taskName], 'Process') }
function Invoke-C2Dotnet([string[]]$Arguments) { & dotnet @Arguments; if ($LASTEXITCODE -ne 0) { throw 'C2 dotnet gate failed.' } }
Push-Location $taskBridge
try {
    Invoke-C2Dotnet @('--version')
    $taskTests = Join-Path $taskBridge 'LibGuest.PrintingBridge.Tests\LibGuest.PrintingBridge.Tests.csproj'
    $taskMain = Join-Path $taskBridge 'LibGuest.PrintingBridge\LibGuest.PrintingBridge.csproj'
    $taskNuget = Join-Path $taskBridge 'NuGet.Config'
    if (-not $SkipRestore) { Invoke-C2Dotnet @('restore', $taskTests, '--configfile', $taskNuget, '--verbosity', 'minimal', '--locked-mode') }
    Invoke-C2Dotnet @('build', $taskTests, '--no-restore', '-c', 'Release', '--disable-build-servers')
    $taskTestExe = Join-Path $taskBridge 'LibGuest.PrintingBridge.Tests\bin\Release\net10.0-windows\LibGuest.PrintingBridge.Tests.exe'
    & $taskTestExe test (Join-Path $taskOut ('fb-c2-unit-' + [Guid]::NewGuid().ToString('N')))
    if ($LASTEXITCODE -ne 0) { throw 'C2 native Windows tests failed.' }
    if (-not $SkipRestore) { Invoke-C2Dotnet @('restore', $taskMain, '--runtime', 'win-x64', '-p:SelfContained=true', '--configfile', $taskNuget, '--verbosity', 'minimal', '--locked-mode') }
    Invoke-C2Dotnet @('publish', $taskMain, '--no-restore', '-c', 'Release', '-r', 'win-x64', '--self-contained', 'true', '--output', (Join-Path $taskOut 'fb-c2-publish'), '--disable-build-servers')
    $taskCertificate = & $taskTestExe certificate (Join-Path $taskOut 'fb-c2-certificate')
    if ($LASTEXITCODE -ne 0) { throw 'C2 isolated laboratory certificate failed.' }
    [IO.File]::WriteAllText((Join-Path $taskOut 'fb-c2-certificate.log'), ($taskCertificate -join "`n"), (New-Object Text.UTF8Encoding($false)))
}
finally { Pop-Location; foreach ($taskName in $taskPrevious.Keys) { [Environment]::SetEnvironmentVariable($taskName, $taskPrevious[$taskName], 'Process') } }
