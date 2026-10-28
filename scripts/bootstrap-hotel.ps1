param(
 [Parameter(Mandatory=$true)][string]$Manifest,
 [Parameter(Mandatory=$true)][string]$Email,
 [Parameter(Mandatory=$true)][string]$MediaRoot
)
$ErrorActionPreference='Stop'
$OutputEncoding=[Text.UTF8Encoding]::new($false)
$repoRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $repoRoot
# Plan first: a missing asset must not waste a password interaction.
& node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --conditions=react-server scripts/bootstrap-hotel.mjs --plan --manifest $Manifest --media-root $MediaRoot
if($LASTEXITCODE -ne 0){throw 'Revise o manifesto e os arquivos antes de autenticar.'}
$securePassword=Read-Host 'Senha do administrador do hotel (entrada oculta; nao sera gravada)' -AsSecureString
$passwordPointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
 $credentials=@{email=$Email;password=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)} | ConvertTo-Json -Compress
 # Credentials travel only over private process stdin: no arguments, env, files or transcript output.
 $credentials | & node --conditions=react-server scripts/bootstrap-hotel.mjs --manifest $Manifest --media-root $MediaRoot
 $bootstrapExit=$LASTEXITCODE
} finally {
 [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
 $credentials=$null
 $securePassword.Dispose()
}
if($bootstrapExit -ne 0){throw 'Bootstrap interrompido. Consulte o resumo sem repetir cegamente.'}