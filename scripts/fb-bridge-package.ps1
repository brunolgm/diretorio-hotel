[CmdletBinding()]param([string]$PublishPath,[string]$OutputPath)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if(-not $PublishPath){$PublishPath=Join-Path $repo 'out\fb-c2-publish'}
if(-not $OutputPath){$OutputPath=Join-Path $repo ('out\fb-install-package-'+[Guid]::NewGuid().ToString('N'))}
$source=(Resolve-Path -LiteralPath $PublishPath).Path
$output=[IO.Path]::GetFullPath($OutputPath)
if(-not $output.StartsWith(([IO.Path]::GetFullPath((Join-Path $repo 'out'))+'\'),[StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $output)){throw 'Destino deve ser novo e estar dentro de out.'}
$null=New-Item -ItemType Directory -Path (Join-Path $output 'bin')
# Enumerate only the explicitly selected publish; never invoke another shell for paths.
Get-ChildItem -LiteralPath $source | ForEach-Object {if($_.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Link em publish não permitido.'};Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $output 'bin') -Recurse -Force}
Get-ChildItem -LiteralPath (Join-Path $repo 'bridge\deployment') -Filter '*.ps1' | ForEach-Object {[IO.File]::WriteAllText((Join-Path $output $_.Name),[IO.File]::ReadAllText($_.FullName,[Text.Encoding]::UTF8),(New-Object Text.UTF8Encoding($true)))}
$files=@(Get-ChildItem -LiteralPath $output -Recurse -File | ForEach-Object {@{path=$_.FullName.Substring($output.Length+1).Replace('\','/');sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}} | Sort-Object path)
$version=[Diagnostics.FileVersionInfo]::GetVersionInfo((Join-Path $source 'LibGuest.PrintingBridge.exe')).ProductVersion
@{schema='libguest-printing-package/v1';version=$version;protocol=1;payload=1;renderer=1;runtime='win-x64 self-contained';checksum_is_signature=$false;files=$files} | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $output 'manifest.json') -Encoding UTF8
$zip=$output+'.zip';Compress-Archive -LiteralPath $output -DestinationPath $zip
$sha=(Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant();Set-Content -LiteralPath ($zip+'.sha256') -Value $sha -Encoding ASCII
@{status='packaged';directory=$output;zip=$zip;sha256=$sha;version=$version;signature=$false} | ConvertTo-Json
