[CmdletBinding()]
param([string]$PackagePath,[string]$CloudUrl,[Guid]$DeviceId=[Guid]::Empty,[switch]$Laboratory,[string]$LaboratoryCertificateSha256,[switch]$SimulatedSpooler,[switch]$NoPair)
. (Join-Path $PSScriptRoot 'Bridge-Deployment.ps1')
if(-not $PackagePath){$PackagePath=$PSScriptRoot}
Assert-BridgeAdministrator
if(-not $CloudUrl){$CloudUrl=Read-Host 'URL HTTPS do Cloud (ex.: https://hotel.libguest.digital/)'}
if($DeviceId -eq [Guid]::Empty){$DeviceId=[Guid](Read-Host 'Identificador da Bridge exibido no Admin')}
$uri=[Uri]$CloudUrl
if(-not $uri.IsAbsoluteUri -or $uri.Scheme -ne 'https' -or $uri.AbsolutePath -ne '/' -or $uri.UserInfo -or $uri.Query -or $uri.Fragment){throw 'URL Cloud inválida.'}
if($SimulatedSpooler -and -not $Laboratory){throw 'Transporte simulado é exclusivo LAB.'}
if($LaboratoryCertificateSha256 -and (-not $Laboratory -or -not $uri.IsLoopback -or $LaboratoryCertificateSha256 -notmatch '^[a-fA-F0-9]{64}$')){throw 'Certificado LAB inválido.'}
$packageRoot=(Resolve-Path -LiteralPath $PackagePath).Path
$package=Get-Content -LiteralPath (Join-Path $packageRoot 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if($package.schema -ne 'libguest-printing-package/v1' -or $package.protocol -ne 1 -or $package.payload -ne 1){throw 'Pacote incompatível.'}
foreach($file in $package.files){
    $source=Assert-BridgeChild (Join-Path $packageRoot $file.path) $packageRoot
    if((Get-Item -LiteralPath $source).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Pacote contém link não permitido.'}
    if((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant() -ne $file.sha256){throw 'Checksum divergente; não instalar.'}
}
$paths=Get-BridgePaths;$existing=Get-Service -Name $paths.Service -ErrorAction SilentlyContinue
$manifestPath=Join-Path $paths.DataRoot 'installation.json';$owned=$null
if($existing){$owned=Get-OwnedBridge;if($owned.Manifest.device_id -ne $DeviceId.ToString('D')){throw 'Device divergente; use desinstalação/provisionamento oficial.'};if($owned.Manifest.paired -and (Test-Path -LiteralPath $owned.Manifest.config)){$priorConfiguration=Get-Content -LiteralPath $owned.Manifest.config -Raw -Encoding UTF8 | ConvertFrom-Json;if($priorConfiguration.cloud_base_url -ne $uri.AbsoluteUri){throw 'Cloud divergente; não transferir credencial pareada entre endpoints.'}};Stop-OwnedBridge $owned}
$stamp=(Get-FileHash -LiteralPath (Join-Path $packageRoot 'manifest.json') -Algorithm SHA256).Hash.ToLowerInvariant()
$versionFolder=($package.version -replace '[^a-zA-Z0-9._-]','_')+'-'+$stamp.Substring(0,12)
$binary=Assert-BridgeChild (Join-Path $paths.BinaryRoot $versionFolder) $paths.BinaryRoot
$null=New-Item -ItemType Directory -Path $binary -Force
$null=New-Item -ItemType Directory -Path $paths.DataRoot -Force
foreach($file in $package.files | Where-Object {$_.path.StartsWith('bin/')}){
    $relative=$file.path.Substring(4);$target=Assert-BridgeChild (Join-Path $binary $relative) $binary
    $null=New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($target)) -Force
    Copy-Item -LiteralPath (Join-Path $packageRoot $file.path) -Destination $target -Force
}
$exe=Join-Path $binary 'LibGuest.PrintingBridge.exe'
$configurationRoot=Assert-BridgeChild (Join-Path $paths.DataRoot 'configuration') $paths.DataRoot;$null=New-Item -ItemType Directory -Path $configurationRoot -Force
$configPath=Join-Path $configurationRoot ($DeviceId.ToString('D')+'.json')
$data=Assert-BridgeChild (Join-Path $paths.DataRoot $DeviceId.ToString('D')) $paths.DataRoot
$paired=if($owned){[bool]$owned.Manifest.paired}else{$false}
$mode=if($paired){'service'}else{'provision-service'}
$command='"'+$exe+'" '+$mode+' --config "'+$configPath+'"'
Set-BridgeServicePath $command 'Manual' (-not [bool]$existing)
$installation=[ordered]@{schema='libguest-printing-installation/v1';service=$paths.Service;device_id=$DeviceId.ToString('D');executable=$exe;config=$configPath;data_directory=$data;version=$package.version;package_manifest_sha256=$stamp;identity=('NT SERVICE\'+$paths.Service);dpapi='CurrentUser';paired=$paired;status='installing'}
if(Test-Path -LiteralPath $manifestPath){$previous=Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json;Copy-Item -LiteralPath $manifestPath -Destination (Join-Path $paths.DataRoot ('installation-'+$previous.device_id+'-'+$previous.package_manifest_sha256+'.json')) -Force}
$installation | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
Invoke-BridgeSc -Arguments @('sidtype',$paths.Service,'unrestricted')
$account=New-Object Security.Principal.NTAccount('NT SERVICE',$paths.Service)
$serviceSid=$account.Translate([Security.Principal.SecurityIdentifier])
Set-BridgeAcl $paths.BinaryRoot $serviceSid $false
Set-BridgeAcl $binary $serviceSid $false
Set-BridgeAcl $paths.DataRoot $serviceSid $false
Set-BridgeAcl $configurationRoot $serviceSid $false
if(-not (Test-Path -LiteralPath $data)){$null=New-Item -ItemType Directory -Path $data;Set-BridgeAcl $data $serviceSid $true}
$configuration=[ordered]@{cloud_base_url=$uri.AbsoluteUri;device_id=$DeviceId.ToString('D');environment=$(if($Laboratory){'laboratory'}else{'production'});data_directory=$data;windows_spooler_enabled=$true;queue_discovery_enabled=$true;simulator_enabled=$false;laboratory_spooler=[bool]$SimulatedSpooler}
if($LaboratoryCertificateSha256){$configuration.laboratory_certificate_sha256=$LaboratoryCertificateSha256.ToLowerInvariant()}
if(Test-Path -LiteralPath $configPath){$priorStamp=if($owned){$owned.Manifest.package_manifest_sha256}else{'preserved'};Copy-Item -LiteralPath $configPath -Destination ($configPath+'.before-'+$priorStamp+'.json') -Force}
$configuration | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $configPath -Encoding UTF8
$installation.status=if($paired){'installed'}else{'awaiting_pairing'}
$installation | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
Start-Service -Name $paths.Service
(Get-Service -Name $paths.Service).WaitForStatus('Running',[TimeSpan]::FromSeconds(30))
if(-not $paired -and -not $NoPair){& $exe provision --config $configPath;if($LASTEXITCODE -ne 0){throw 'Pareamento não concluído; serviço preservado para diagnóstico.'};& (Join-Path $PSScriptRoot 'Complete-LibGuestBridgePairing.ps1')}
elseif($paired){& (Join-Path $PSScriptRoot 'Complete-LibGuestBridgePairing.ps1')}
[pscustomobject]@{status='installed';version=$package.version;device_id=$DeviceId;service=$paths.Service;config=$configPath;dpapi='CurrentUser';checksum_is_signature=$false} | ConvertTo-Json
