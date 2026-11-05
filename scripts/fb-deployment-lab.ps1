[CmdletBinding()]param([Parameter(Mandatory=$true)][string]$Queue,[switch]$Worker)
$ErrorActionPreference='Stop'
$repository=Split-Path -Parent $PSScriptRoot
if($Queue -match '["\r\n]' -or $Queue.Length -gt 128){throw 'Invalid LAB queue argument.'}
if(-not $Worker){
    $arguments='-NoProfile -File "'+$PSCommandPath+'" -Queue "'+$Queue+'" -Worker'
    $process=Start-Process -FilePath powershell.exe -ArgumentList $arguments -Verb RunAs -WindowStyle Hidden -Wait -PassThru
    exit $process.ExitCode
}
Set-Location -LiteralPath $repository
$env:FB_LAB_PRINTER=$Queue
$env:FB_DEPLOYMENT_CONTROL=Join-Path $repository 'out\fb-deployment\control.json'
$directory=Join-Path $repository 'out\fb-deployment';$null=New-Item -ItemType Directory -Path $directory -Force
if(Test-Path -LiteralPath $env:FB_DEPLOYMENT_CONTROL){throw 'Old LAB control exists; preserve and explicitly choose a fresh run before elevating.'}
[IO.File]::WriteAllText((Join-Path $directory 'elevated.pid'),[string]$PID)
$ErrorActionPreference='Continue' # Native stderr is logged; the native exit code remains authoritative.
$attempt=0
while($true){
    $attempt++
    & node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tests/integration/fb-deployment.mjs --interactive > (Join-Path $directory 'elevated.log') 2>&1
    $result=$LASTEXITCODE
    if($result -eq 0){exit 0}
    $report=Join-Path $directory 'report.json'
    if(Test-Path -LiteralPath $report){
        Copy-Item -LiteralPath $report -Destination (Join-Path $directory ('attempt-'+$PID+'-'+$attempt+'.json'))
        $evidence=Get-Content -LiteralPath $report -Raw | ConvertFrom-Json
        if(@($evidence.physical).Count -gt 0){exit $result}
    }
    $restart=Join-Path $directory 'restart.json'
    while(-not (Test-Path -LiteralPath $restart)){Start-Sleep -Milliseconds 500}
    $request=Get-Content -LiteralPath $restart -Raw | ConvertFrom-Json
    Move-Item -LiteralPath $restart -Destination (Join-Path $directory ('restart-'+$PID+'-'+$attempt+'.json'))
    if($request.command -ne 'restart'){exit $result}
    & node scripts/fb-local-lab.mjs down > (Join-Path $directory 'restart-down.log') 2>&1
    if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
    & node scripts/fb-local-lab.mjs up > (Join-Path $directory 'restart-up.log') 2>&1
    if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
}
