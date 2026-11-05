[CmdletBinding()]param([Parameter(Mandatory=$true)][ValidateSet('Simulated','Physical')][string]$Transport)
. (Join-Path $PSScriptRoot 'Bridge-Deployment.ps1')
Assert-BridgeAdministrator
$owned=Get-OwnedBridge
$configuration=Get-Content -LiteralPath $owned.Manifest.config -Raw -Encoding UTF8 | ConvertFrom-Json
if($configuration.environment -ne 'laboratory'){throw 'Este comando é exclusivo LAB.'}
Stop-OwnedBridge $owned
$configuration.laboratory_spooler=($Transport -eq 'Simulated')
$configuration | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $owned.Manifest.config -Encoding UTF8
Start-Service -Name $owned.Paths.Service
@{status='lab_transport_changed';transport=$Transport;configuration_preserved=$true} | ConvertTo-Json
