[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$Executable)
. (Join-Path $PSScriptRoot 'Bridge-Deployment.ps1')
Assert-BridgeAdministrator
$owned=Get-OwnedBridge
$exe=Assert-BridgeChild $Executable $owned.Paths.BinaryRoot
$service=Get-CimInstance Win32_Service -Filter "Name='LibGuestPrintingBridge'"
if($service.State -ne 'Running' -or $service.StartName -ne $owned.Manifest.identity -or -not $service.PathName.StartsWith('"'+$exe+'" maintenance-service --config "')){throw 'Matching service maintenance identity required.'}
$before=& $exe diagnose-service --config $owned.Manifest.config
if($LASTEXITCODE -ne 0){throw 'Read maintenance status before resuming.'}
$state=$before | ConvertFrom-Json
if($state.status -ne 'maintenance' -or $state.device_id -ne $owned.Manifest.device_id -or -not $state.credential_readable){throw 'Maintenance vault/identity validation failed.'}
$reply=& $exe resume-service --config $owned.Manifest.config
if($LASTEXITCODE -ne 0){throw 'Recovery failed; leave maintenance service unchanged.'}
$reply
if(($reply | ConvertFrom-Json).status -ne 'resumed'){throw 'Recovery remains blocked; do not start printing worker.'}
