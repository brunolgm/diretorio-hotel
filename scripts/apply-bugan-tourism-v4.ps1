$ErrorActionPreference='Stop'
$OutputEncoding=[Text.UTF8Encoding]::new($false)
Set-Location -LiteralPath ([IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')))
$securePassword=Read-Host 'Senha do administrador Bugan Recife (oculta; nao sera gravada)' -AsSecureString
$passwordPointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
 $credentials=@{email='libguestbugan@yahoo.com';password=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)} | ConvertTo-Json -Compress
 $credentials | & node scripts/apply-tourism-editorial.mjs --manifest docs/bootstrap/bugan-tourism-v4-20261029.json
 $editorialExit=$LASTEXITCODE
} finally {
 [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
 $credentials=$null
 $securePassword.Dispose()
}
if($editorialExit -ne 0){throw 'Apresentacao interrompida; confira o estado por leitura.'}
