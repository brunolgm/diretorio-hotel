[CmdletBinding()]param()
. (Join-Path $PSScriptRoot 'Bridge-Deployment.ps1')
Assert-BridgeAdministrator
$owned=Get-OwnedBridge;Stop-OwnedBridge $owned
Invoke-BridgeSc -Arguments @('delete',$owned.Paths.Service)
$owned.Manifest.status='uninstalled_data_preserved';Save-BridgeManifest $owned
@{status='uninstalled';journal_preserved=$true;configuration_preserved=$true;binary_versions_preserved=$true} | ConvertTo-Json
