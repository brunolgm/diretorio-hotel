[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$PackagePath,[Parameter(Mandatory=$true)][string]$EvidenceDirectory)
. (Join-Path $PSScriptRoot 'Bridge-Deployment.ps1')
Assert-BridgeAdministrator
$owned=Get-OwnedBridge
$root=(Resolve-Path -LiteralPath $PackagePath).Path
$evidence=(Resolve-Path -LiteralPath $EvidenceDirectory).Path
$package=Get-Content -LiteralPath (Join-Path $root 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if($package.schema -ne 'libguest-printing-package/v1' -or $package.protocol -ne 1 -or $package.payload -ne 1 -or $package.renderer -ne 1){throw 'Incompatible package.'}
foreach($file in $package.files){
 $source=Assert-BridgeChild (Join-Path $root $file.path) $root
 if((Get-Item -LiteralPath $source).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Package link refused.'}
 if((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant() -ne $file.sha256){throw 'Package checksum mismatch.'}
}
$service=Get-CimInstance Win32_Service -Filter "Name='LibGuestPrintingBridge'"
$normal='"'+$owned.Manifest.executable+'" service --config "'+$owned.Manifest.config+'"'
if($service.PathName -ne $normal -or $service.StartName -ne $owned.Manifest.identity -or $service.State -ne 'Running'){throw 'Matching running official worker required.'}
$diagnostic=& $owned.Manifest.executable diagnose-service --config $owned.Manifest.config
if($LASTEXITCODE -ne 0){throw 'Pre-update diagnostic failed.'}
$state=$diagnostic | ConvertFrom-Json
if($state.operator_required -or -not $state.credential_readable -or $state.device_id -ne $owned.Manifest.device_id -or @($state.jobs | Where-Object {$_.local_state -notin @('terminal','expired','blocked')}).Count -gt 0){throw 'Worker has active/uncertain work; do not update.'}
$previous=$owned.Manifest | ConvertTo-Json -Depth 8 | ConvertFrom-Json
$previous | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $evidence 'installation-before-update.json') -Encoding UTF8
$diagnostic | Set-Content (Join-Path $evidence 'bridge-before-update.json') -Encoding UTF8
$stamp=(Get-FileHash -LiteralPath (Join-Path $root 'manifest.json') -Algorithm SHA256).Hash.ToLowerInvariant()
$folder=($package.version -replace '[^a-zA-Z0-9._-]','_')+'-'+$stamp.Substring(0,12)
$binary=Assert-BridgeChild (Join-Path $owned.Paths.BinaryRoot $folder) $owned.Paths.BinaryRoot
if(Test-Path -LiteralPath $binary){throw 'Version path already exists; never overwrite an installed package.'}
$null=New-Item -ItemType Directory -Path $binary
foreach($file in $package.files | Where-Object {$_.path.StartsWith('bin/')}){
 $target=Assert-BridgeChild (Join-Path $binary $file.path.Substring(4)) $binary
 $null=New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($target)) -Force
 Copy-Item -LiteralPath (Join-Path $root $file.path) -Destination $target
}
try{
 Stop-OwnedBridge $owned
 $owned.Manifest.executable=Join-Path $binary 'LibGuest.PrintingBridge.exe'
 $owned.Manifest.version=$package.version
 $owned.Manifest.package_manifest_sha256=$stamp
 $command='"'+$owned.Manifest.executable+'" service --config "'+$owned.Manifest.config+'"'
 Set-BridgeServicePath $command 'Automatic' $false
 Save-BridgeManifest $owned
 Start-Service $owned.Paths.Service
 (Get-Service $owned.Paths.Service).WaitForStatus('Running',[TimeSpan]::FromSeconds(30))
 $result=& $owned.Manifest.executable diagnose-service --config $owned.Manifest.config
 if($LASTEXITCODE -ne 0){throw 'Updated worker diagnostic failed.'}
 $result | Set-Content (Join-Path $evidence 'bridge-after-update.json') -Encoding UTF8
 $status=$result | ConvertFrom-Json
 if($status.status -ne 'running' -or $status.operator_required -or -not $status.credential_readable -or $status.device_id -ne $previous.device_id){throw 'Updated worker health gate failed.'}
 @{status='updated';version=$package.version;device_id=$status.device_id;automatic_start=$true;identity_preserved=$true;config_preserved=$true} | ConvertTo-Json
}catch{
 try{Stop-Service $owned.Paths.Service -ErrorAction Stop}catch{if((Get-Service $owned.Paths.Service).Status -ne 'Stopped'){throw}}
 (Get-Service $owned.Paths.Service).WaitForStatus('Stopped',[TimeSpan]::FromSeconds(30))
 $owned.Manifest=$previous
 Set-BridgeServicePath $normal 'Automatic' $false
 Save-BridgeManifest $owned
 Start-Service $owned.Paths.Service
 throw
}
