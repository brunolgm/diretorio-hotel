[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$EvidenceDirectory)
. (Join-Path $PSScriptRoot 'Bridge-Deployment.ps1')
Assert-BridgeAdministrator
$owned=Get-OwnedBridge
$evidence=(Resolve-Path -LiteralPath $EvidenceDirectory).Path
$before=Get-Content -LiteralPath (Join-Path $evidence 'maintenance-service-before.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$candidate=Assert-BridgeChild $before.candidate $owned.Paths.BinaryRoot
$normal='"'+$owned.Manifest.executable+'" service --config "'+$owned.Manifest.config+'"'
$maintenance='"'+$candidate+'" maintenance-service --config "'+$owned.Manifest.config+'"'
$current=Get-CimInstance Win32_Service -Filter "Name='LibGuestPrintingBridge'"
if($current.State -ne 'Running' -or $current.PathName -ne $maintenance -or $current.StartName -ne $owned.Manifest.identity -or $before.path -ne $normal){throw 'Maintenance/official manifest mismatch.'}
$diagnostic=& $candidate diagnose-service --config $owned.Manifest.config
if($LASTEXITCODE -ne 0){throw 'Maintenance diagnostic failed.'}
$state=$diagnostic | ConvertFrom-Json
if($state.status -ne 'maintenance' -or $state.operator_required -or $state.pending -ne 0 -or -not $state.credential_readable -or $state.device_id -ne $owned.Manifest.device_id){throw 'Resolve pending/operator/credential state before returning to worker.'}
$diagnostic | Set-Content -LiteralPath (Join-Path $evidence 'before-normal.json') -Encoding UTF8
try{Stop-Service $owned.Paths.Service -ErrorAction Stop}catch{if((Get-Service $owned.Paths.Service).Status -ne 'Stopped'){throw}}
(Get-Service $owned.Paths.Service).WaitForStatus('Stopped',[TimeSpan]::FromSeconds(30))
Set-BridgeServicePath $normal 'Automatic' $false
Start-Service $owned.Paths.Service
(Get-Service $owned.Paths.Service).WaitForStatus('Running',[TimeSpan]::FromSeconds(30))
$result=& $owned.Manifest.executable diagnose-service --config $owned.Manifest.config
if($LASTEXITCODE -ne 0){throw 'Official worker diagnostic failed; inspect preserved service state.'}
$result | Set-Content -LiteralPath (Join-Path $evidence 'normal-worker-initial.json') -Encoding UTF8
$state=$result | ConvertFrom-Json
if($state.status -ne 'running' -or $state.operator_required -or $state.pending -ne 0 -or -not $state.credential_readable -or $state.device_id -ne $owned.Manifest.device_id){throw 'Worker health gate failed; do not create a test.'}
@{status='running';automatic_start=$true;device_id=$state.device_id;version=$state.version;path=$normal} | ConvertTo-Json
