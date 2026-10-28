# Disposable local Sprint 51 baseline only; schema, fixtures and audit changes all roll back.
param([ValidateSet('supabase_db_libguest-45b-lab')][string]$Container='supabase_db_libguest-45b-lab')
$ErrorActionPreference='Stop'
$OutputEncoding=[Text.UTF8Encoding]::new($false)
$repoRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
function Read-Sql([string]$file) {
 ([IO.File]::ReadAllText((Join-Path $repoRoot $file))).TrimStart([char]0xFEFF) -replace '(?m)^begin;\r?$','' -replace '(?m)^commit;\r?$',''
}
$sql='begin;'+(Read-Sql 'supabase/migrations/20261028100544_platform_existing_hotel_admin.sql')+(Read-Sql 'supabase/tests/platform_hotel_admin_behavioral_matrix.sql')
$sql | docker exec -i $Container psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres
if($LASTEXITCODE -ne 0){throw 'Local administrator matrix failed'}
Write-Output 'PASS local administrator matrix: authorization, lifecycle, identity provenance, duplicates, audit rollback, preservation'