[CmdletBinding()]param(
    [Parameter(Mandatory=$true)][string]$Queue,
    [Parameter(Mandatory=$true)][string]$PackagePath,
    [Parameter(Mandatory=$true)][string]$ExpectedPort,
    [switch]$Worker
)
$ErrorActionPreference='Stop'
$repository=Split-Path -Parent $PSScriptRoot
if($Queue -notmatch '^[\p{L}\p{N} ._()-]{1,120}$' -or $ExpectedPort -notmatch '^[\p{L}\p{N} ._()-]{1,128}$'){throw 'Invalid explicit LAB input.'}
$package=(Resolve-Path -LiteralPath $PackagePath).Path
$allowedRoot=[IO.Path]::GetFullPath((Join-Path $repository 'out'))+'\'
if(-not $package.StartsWith($allowedRoot,[StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath (Join-Path $package 'manifest.json'))){throw 'Select a verified package inside repository out.'}
if(-not $Worker){
    $arguments='-NoProfile -File "'+$PSCommandPath+'" -Queue "'+$Queue+'" -PackagePath "'+$package+'" -ExpectedPort "'+$ExpectedPort+'" -Worker'
    $process=Start-Process -FilePath powershell.exe -ArgumentList $arguments -Verb RunAs -WindowStyle Hidden -Wait -PassThru
    exit $process.ExitCode
}
Set-Location -LiteralPath $repository
$identity=[Security.Principal.WindowsIdentity]::GetCurrent()
if(-not (New-Object Security.Principal.WindowsPrincipal($identity)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Real Windows elevation is required for the authorized official service.'}
$directory=Join-Path $repository 'out\fb-ticket-layout-lab'
$null=New-Item -ItemType Directory -Path $directory -Force
$env:FB_LAB_PRINTER=$Queue
$env:FB_BRIDGE_PACKAGE=$package
$env:FB_DEPLOYMENT_CONTROL=Join-Path $directory 'control.json'
if(Test-Path -LiteralPath $env:FB_DEPLOYMENT_CONTROL){throw 'Previous control exists. Preserve the closed round; do not rerun physical work.'}
$reportPath=Join-Path $directory 'report.json'
if(Test-Path -LiteralPath $reportPath){
    $prior=Get-Content -LiteralPath $reportPath -Raw | ConvertFrom-Json
    if(@($prior.physical).Count -gt 0){throw 'A prior physical intent exists. No automatic resubmission.'}
}
$printer=Get-Printer -Name $Queue
if($printer.PortName -ne $ExpectedPort){throw 'Discovered port differs from the explicitly authorized LAB port.'}
$printer | Select-Object Name,DriverName,PortName | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $directory 'queue-metadata.json') -Encoding UTF8
[IO.File]::WriteAllText((Join-Path $directory 'elevated.pid'),[string]$PID)
$ErrorActionPreference='Continue' # Keep native diagnostics in the log; enforce its exit code.
& node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tests/integration/fb-ticket-layout-lab.mjs --interactive > (Join-Path $directory 'elevated.log') 2>&1
exit $LASTEXITCODE
