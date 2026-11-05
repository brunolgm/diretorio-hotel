[CmdletBinding()]param()
. (Join-Path $PSScriptRoot 'Bridge-Deployment.ps1')
Assert-BridgeAdministrator
$owned=Get-OwnedBridge
& $owned.Manifest.executable diagnose-service --config $owned.Manifest.config
if($LASTEXITCODE -ne 0){throw 'Diagnóstico não disponível; confira o serviço e o manifesto.'}
