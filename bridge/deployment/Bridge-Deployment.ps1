Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
function Get-BridgePaths {
    $base=[Environment]::GetFolderPath('CommonApplicationData')
    $program=[Environment]::GetFolderPath('ProgramFiles')
    @{ DataRoot=(Assert-BridgeChild (Join-Path $base 'LibGuest\PrintingBridge') $base); BinaryRoot=(Assert-BridgeChild (Join-Path $program 'LibGuest\PrintingBridge') $program); Service='LibGuestPrintingBridge' }
}
function Assert-BridgeAdministrator {
    $identity=[Security.Principal.WindowsIdentity]::GetCurrent()
    if(-not ([Security.Principal.WindowsPrincipal]$identity).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Abra PowerShell como administrador local.'}
}
function Assert-BridgeChild([string]$Path,[string]$Root) {
    $resolved=[IO.Path]::GetFullPath($Path);$allowed=[IO.Path]::GetFullPath($Root).TrimEnd('\')+'\'
    if(-not $resolved.StartsWith($allowed,[StringComparison]::OrdinalIgnoreCase)){throw 'Caminho fora da raiz autorizada.'}
    $ancestor=$resolved
    while($ancestor){
        if(Test-Path -LiteralPath $ancestor){if((Get-Item -LiteralPath $ancestor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Link de filesystem não permitido no caminho da instalação.'}}
        $parent=[IO.Directory]::GetParent($ancestor);$ancestor=if($parent){$parent.FullName}else{$null}
    }
    $resolved
}
function Invoke-BridgeSc([string[]]$Arguments) {
    $result=& "$env:SystemRoot\System32\sc.exe" @Arguments 2>&1
    if($LASTEXITCODE -ne 0){throw ('Operação SCM falhou: '+($result -join ' '))}
}
function Set-BridgeAcl([string]$Path,[Security.Principal.SecurityIdentifier]$ServiceSid,[bool]$Mutable) {
    $acl=New-Object Security.AccessControl.DirectorySecurity
    $acl.SetAccessRuleProtection($true,$false)
    foreach($sid in @([Security.Principal.SecurityIdentifier]'S-1-5-18',[Security.Principal.SecurityIdentifier]'S-1-5-32-544')){
        $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow')))
    }
    $right=if($Mutable){'FullControl'}else{'ReadAndExecute'}
    $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($ServiceSid,$right,'ContainerInherit,ObjectInherit','None','Allow')))
    Set-Acl -LiteralPath $Path -AclObject $acl
}
function Set-BridgeServicePath([string]$Command,[string]$Mode,[bool]$Create) {
    if($Create){
        $result=Invoke-CimMethod -ClassName Win32_Service -MethodName Create -Arguments @{Name='LibGuestPrintingBridge';DisplayName='LibGuest Printing Bridge';PathName=$Command;ServiceType=[byte]16;ErrorControl=[byte]1;StartMode=$Mode;DesktopInteract=$false;StartName='NT SERVICE\LibGuestPrintingBridge';StartPassword=$null}
    }else{
        $service=Get-CimInstance Win32_Service -Filter "Name='LibGuestPrintingBridge'"
        $result=Invoke-CimMethod -InputObject $service -MethodName Change -Arguments @{PathName=$Command;StartMode=$Mode}
    }
    if($result.ReturnValue -ne 0){throw ('Configuração do serviço falhou: '+$result.ReturnValue)}
}
function Get-OwnedBridge {
    $paths=Get-BridgePaths;$manifestPath=Join-Path $paths.DataRoot 'installation.json'
    if(-not (Test-Path -LiteralPath $manifestPath)){throw 'Instalação oficial não encontrada; não alterar serviço preexistente.'}
    $installation=Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if($installation.schema -ne 'libguest-printing-installation/v1' -or $installation.service -ne $paths.Service){throw 'Identificação de instalação inválida.'}
    $null=Assert-BridgeChild $installation.executable $paths.BinaryRoot
    $null=Assert-BridgeChild $installation.config $paths.DataRoot
    @{ Paths=$paths; Manifest=$installation; ManifestPath=$manifestPath }
}
function Stop-OwnedBridge($Owned) {
    $service=Get-Service -Name $Owned.Paths.Service -ErrorAction SilentlyContinue
    if($service){
        $cim=Get-CimInstance Win32_Service -Filter "Name='LibGuestPrintingBridge'"
        if(-not $cim.PathName.Contains($Owned.Manifest.executable)){throw 'O serviço não corresponde ao manifesto; não foi alterado.'}
        if($service.Status -eq 'StartPending'){$service.WaitForStatus('Running',[TimeSpan]::FromSeconds(30));$service.Refresh()}
        if($service.Status -eq 'StopPending'){$service.WaitForStatus('Stopped',[TimeSpan]::FromSeconds(30));return}
        if($service.Status -ne 'Stopped'){
            try{Stop-Service -Name $service.Name -ErrorAction Stop}catch{$service.Refresh();if($service.Status -ne 'Stopped'){throw}}
            $service.WaitForStatus('Stopped',[TimeSpan]::FromSeconds(30))
        }
    }
}
function Save-BridgeManifest($Owned) {
    $Owned.Manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $Owned.ManifestPath -Encoding UTF8
}
