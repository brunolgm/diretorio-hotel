# Preserve Sprint 52 tests verbatim. Replay their fixtures under every canonical
# theme in independent rollback transactions, including Bugan and the fallback.
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$files = @(
  '20260910043520_52_1_tourism_foundation.sql',
  '20260911011338_52_2a_tourism_main_image.sql',
  '20260914014530_52_2b1_tourism_revision_conflict.sql',
  '20261027215620_bugan_canonical_brand.sql'
)
$migrations = ($files | ForEach-Object {
  [IO.File]::ReadAllText((Join-Path $repoRoot "supabase/migrations/$_")) -replace '(?m)^begin;\r?$','' -replace '(?m)^commit;\r?$',''
}) -join "`n"
$matrix = [IO.File]::ReadAllText((Join-Path $PSScriptRoot '52_1_tourism_behavioral_matrix.sql'))
$marker = '-- Synthetic opt-in solely for testing: never in the migration or a remote database.'
if (-not $matrix.Contains($marker)) { throw 'Tourism fixture boundary changed; review the matrix' }
$OutputEncoding = [Text.UTF8Encoding]::new($false)
foreach ($brand in @('grand-mercure','novotel','mercure','bugan','default')) {
  $value = if ($brand -eq 'default') { 'null' } else { "'$brand'" }
  $fixture = "update public.hotels set brand_code=$value,theme_preset=$value where slug in ('s521-a','s521-b');`n"
  ('begin;' + $migrations + $matrix.Replace($marker,$fixture + $marker)) |
    docker exec -i supabase_db_libguest-45b-lab psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres
  if ($LASTEXITCODE -ne 0) { throw "Tourism regression failed: $brand" }
  Write-Output "Tourism domain/RLS/Admin RPC/images/translations rollback: PASS ($brand)"
}
@'
do $$ begin
  assert to_regclass('public.hotel_tourism_items') is null, 'tourism schema residue';
  assert not exists(select 1 from public.hotels where slug like 's521-%'), 'fixture residue';
end $$;
'@ | docker exec -i supabase_db_libguest-45b-lab psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres
if ($LASTEXITCODE -ne 0) { throw 'Tourism rollback residue check failed' }
