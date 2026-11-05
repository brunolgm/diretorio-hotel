[CmdletBinding()]param()
. (Join-Path $PSScriptRoot 'Bridge-Deployment.ps1')
Assert-BridgeAdministrator
$owned=Get-OwnedBridge
Stop-OwnedBridge $owned
$command='"'+$owned.Manifest.executable+'" service --config "'+$owned.Manifest.config+'"'
Set-BridgeServicePath $command 'Automatic' $false
Invoke-BridgeSc -Arguments @('failure',$owned.Paths.Service,'reset=','86400','actions=','restart/5000/restart/15000/restart/60000')
Invoke-BridgeSc -Arguments @('failureflag',$owned.Paths.Service,'1')
Start-Service -Name $owned.Paths.Service
$diagnostic=& $owned.Manifest.executable diagnose-service --config $owned.Manifest.config
if($LASTEXITCODE -ne 0){throw 'Não foi possível validar a identidade do serviço; instalação preservada.'}
$status=$diagnostic | ConvertFrom-Json
if(-not $status.credential_readable -or $status.device_id -ne $owned.Manifest.device_id){throw 'Vault não legível pela identidade do serviço; não declarar provisionado.'}
$owned.Manifest.paired=$true;$owned.Manifest.status='installed';Save-BridgeManifest $owned
@{status='service_started';identity=$owned.Manifest.identity;dpapi='CurrentUser';automatic_start=$true} | ConvertTo-Json
