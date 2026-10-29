param([ValidateSet('supabase_db_libguest-45b-lab')][string]$Container='supabase_db_libguest-45b-lab')
$ErrorActionPreference='Stop'
$OutputEncoding=[Text.UTF8Encoding]::new($false)
$repoRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
function Read-Sql([string]$file){
  ([IO.File]::ReadAllText((Join-Path $repoRoot $file))).TrimStart([char]0xFEFF) -replace '(?m)^begin;\r?$','' -replace '(?m)^commit;\r?$',''
}
$files=@('20260910043520_52_1_tourism_foundation.sql','20260911011338_52_2a_tourism_main_image.sql','20260914014530_52_2b1_tourism_revision_conflict.sql','20261027215620_bugan_canonical_brand.sql','20261028012744_52_2_tourism_governance_available.sql','20261028034907_public_experience_media_v3.sql','20261028165619_readiness_published_experience_hero.sql','20261028230359_public_editorial_presentation.sql','20261029024616_public_experience_v4_selection.sql','20261029105535_tourism_editorial_destinations.sql')
$migrations=($files | ForEach-Object {Read-Sql "supabase/migrations/$_"}) -join "`n"
$foundation=Read-Sql 'supabase/tests/52_1_tourism_behavioral_matrix.sql'
$fixtures=$foundation.Split(@('-- Constraints are exercised independently'),[StringSplitOptions]::None)[0]
('begin;'+$migrations+$fixtures+(Read-Sql 'supabase/tests/tourism_editorial_behavioral_matrix.sql')) |
  docker exec -i $Container psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres
if($LASTEXITCODE -ne 0){throw 'Public experience V4 matrix failed'}
Write-Output 'PASS V4 selection: opt-in, roles, RLS, revision, rollback and operational preservation'
