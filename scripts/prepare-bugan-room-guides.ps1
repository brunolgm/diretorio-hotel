$ErrorActionPreference='Stop'
$OutputEncoding=[Text.UTF8Encoding]::new($false)
Set-Location -LiteralPath ([IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')))
$securePassword=Read-Host 'Senha do administrador Bugan Recife (oculta)' -AsSecureString
$pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
 $credentials=@{email='libguestbugan@yahoo.com';password=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)} | ConvertTo-Json -Compress
 $credentials | & node scripts/prepare-bugan-room-guides.mjs
 $result=$LASTEXITCODE
} finally {
 [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
 $credentials=$null
 $securePassword.Dispose()
}
if($result -ne 0){throw 'Preparacao interrompida; confira o estado por leitura antes de repetir.'}
