[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$PackagePath,[Parameter(Mandatory=$true)][string]$EvidenceDirectory)
. (Join-Path $PSScriptRoot 'Bridge-Deployment.ps1')
Assert-BridgeAdministrator
$owned=Get-OwnedBridge
$packageRoot=(Resolve-Path -LiteralPath $PackagePath).Path
$evidence=(Resolve-Path -LiteralPath $EvidenceDirectory).Path
$package=Get-Content -LiteralPath (Join-Path $packageRoot 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if($package.schema -ne 'libguest-printing-package/v1' -or $package.protocol -ne 1 -or $package.payload -ne 1 -or $package.renderer -ne 1){throw 'Incompatible maintenance package.'}
foreach($file in $package.files){
 $source=Assert-BridgeChild (Join-Path $packageRoot $file.path) $packageRoot
 if((Get-Item -LiteralPath $source).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Package link refused.'}
 if((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant() -ne $file.sha256){throw 'Package checksum mismatch.'}
}
$service=Get-CimInstance Win32_Service -Filter "Name='LibGuestPrintingBridge'"
if(-not $service.PathName.Contains($owned.Manifest.executable) -or $service.StartName -ne $owned.Manifest.identity){throw 'Service identity/path mismatch.'}
if($service.State -ne 'Stopped'){throw 'Stop and inventory the original service before entering maintenance.'}
$stamp=(Get-FileHash -LiteralPath (Join-Path $packageRoot 'manifest.json') -Algorithm SHA256).Hash.ToLowerInvariant()
$folder=($package.version -replace '[^a-zA-Z0-9._-]','_')+'-'+$stamp.Substring(0,12)
$binary=Assert-BridgeChild (Join-Path $owned.Paths.BinaryRoot $folder) $owned.Paths.BinaryRoot
if(Test-Path -LiteralPath $binary){throw 'Candidate path exists; never replace a package silently.'}
$null=New-Item -ItemType Directory -Path $binary
foreach($file in $package.files | Where-Object {$_.path.StartsWith('bin/')}){
 $target=Assert-BridgeChild (Join-Path $binary $file.path.Substring(4)) $binary
 $null=New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($target)) -Force
 Copy-Item -LiteralPath (Join-Path $packageRoot $file.path) -Destination $target
}
$exe=Join-Path $binary 'LibGuest.PrintingBridge.exe'
$mode=if($service.StartMode -eq 'Auto'){'Automatic'}else{'Manual'}
$backup=Join-Path $evidence 'maintenance-service-before.json'
if(Test-Path -LiteralPath $backup){throw 'Maintenance backup already exists.'}
@{path=$service.PathName;start_mode=$mode;identity=$service.StartName;candidate=$exe;version=$package.version;package_manifest_sha256=$stamp} | ConvertTo-Json | Set-Content -LiteralPath $backup -Encoding UTF8
try{
 $command='"'+$exe+'" maintenance-service --config "'+$owned.Manifest.config+'"'
 Set-BridgeServicePath $command $mode $false
 Start-Service -Name $owned.Paths.Service
 (Get-Service $owned.Paths.Service).WaitForStatus('Running',[TimeSpan]::FromSeconds(30))
 $diagnostic=& $exe diagnose-service --config $owned.Manifest.config
 if($LASTEXITCODE -ne 0){throw 'Maintenance diagnostic failed.'}
 $diagnostic | Set-Content -LiteralPath (Join-Path $evidence 'maintenance-status.json') -Encoding UTF8
 $state=$diagnostic | ConvertFrom-Json
 if($state.status -ne 'maintenance' -or $state.device_id -ne $owned.Manifest.device_id){throw 'Maintenance identity mismatch.'}
 @{status='maintenance';version=$package.version;printing_worker_started=$false;dpapi='CurrentUser'} | ConvertTo-Json
}catch{
 Stop-Service -Name $owned.Paths.Service -ErrorAction SilentlyContinue
 Set-BridgeServicePath $service.PathName $mode $false
 throw
}
