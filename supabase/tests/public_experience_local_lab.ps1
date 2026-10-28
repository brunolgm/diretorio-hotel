# Requires a disposable Sprint 51 baseline. Every schema/data change rolls back.
param([ValidatePattern('^supabase_db_[a-zA-Z0-9_-]+$')][string]$Container='supabase_db_libguest-45b-lab')
$ErrorActionPreference='Stop'
$OutputEncoding=[Text.UTF8Encoding]::new($false)
$repoRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
function Read-Sql([string]$file) {
  ([IO.File]::ReadAllText((Join-Path $repoRoot $file))).TrimStart([char]0xFEFF) -replace '(?m)^begin;\r?$','' -replace '(?m)^commit;\r?$',''
}
function Invoke-LocalSql([string]$sql) {
  $sql | docker exec -i $Container psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres
  if($LASTEXITCODE -ne 0){throw 'Local rollback SQL failed'}
}
Invoke-LocalSql @'
DO $$ BEGIN
  assert to_regclass('public.hotel_tourism_items') is null, 'requires pre-Tourism baseline';
  assert to_regclass('public.hotel_public_experience_media') is null, 'requires pre-V3 baseline';
END $$;
'@
$files=@('20260910043520_52_1_tourism_foundation.sql','20260911011338_52_2a_tourism_main_image.sql','20260914014530_52_2b1_tourism_revision_conflict.sql','20261027215620_bugan_canonical_brand.sql','20261028012744_52_2_tourism_governance_available.sql','20261028034907_public_experience_media_v3.sql')
$migrations=($files | ForEach-Object { Read-Sql "supabase/migrations/$_" }) -join "`n"
$foundation=Read-Sql 'supabase/tests/52_1_tourism_behavioral_matrix.sql'
$fixtures=$foundation.Split(@('-- Constraints are exercised independently'),[StringSplitOptions]::None)[0]
$media=Read-Sql 'supabase/tests/public_experience_media_behavioral_matrix.sql'
Invoke-LocalSql ('begin;'+$migrations+$fixtures+$media)
Write-Output 'PASS media behavioral matrix'
$currentMatrices=@(
  '46_8_module_entitlements_rls_verification.sql','46_8_module_entitlements_behavioral_matrix.sql',
  '47_multi_hotel_onboarding_rls_verification.sql','47_multi_hotel_onboarding_behavioral_matrix.sql',
  '51_travel_flights_entitlement_behavioral_matrix.sql','51_public_flight_home_card_behavioral_matrix.sql',
  '51_public_flight_center_behavioral_matrix.sql','51_flight_center_configuration_behavioral_matrix.sql',
  '52_2_tourism_governance_behavioral_matrix.sql'
)
foreach($name in $currentMatrices) {
  Invoke-LocalSql ('begin;'+$migrations+(Read-Sql "supabase/tests/$name"))
  Write-Output "PASS current SQL gate: $name"
}
foreach($brand in @('grand-mercure','novotel','mercure','bugan','default')) {
  $value=if($brand -eq 'default'){'null'}else{"'$brand'"}
  $matrix=$foundation.Replace('-- Synthetic opt-in solely for testing:',"update public.hotels set brand_code=$value,theme_preset=$value where slug in ('s521-a','s521-b');`n-- Synthetic opt-in solely for testing:")
  Invoke-LocalSql ('begin;'+$migrations+$matrix)
  Write-Output "PASS Tourism five-brand matrix: $brand"
}
Invoke-LocalSql @'
DO $$ BEGIN
  assert to_regclass('public.hotel_tourism_items') is null, 'Tourism rollback residue';
  assert to_regclass('public.hotel_public_experience_media') is null, 'Media rollback residue';
  assert not exists(select 1 from public.hotels where slug like 's521-%'), 'fixture residue';
END $$;
'@
