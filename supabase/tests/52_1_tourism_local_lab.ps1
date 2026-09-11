# Fixed disposable target. Migration, fixtures and behavior tests ALL roll back.
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$migration = [IO.File]::ReadAllText((Join-Path $repoRoot 'supabase/migrations/20260910043520_52_1_tourism_foundation.sql'))
$matrix = [IO.File]::ReadAllText((Join-Path $PSScriptRoot '52_1_tourism_behavioral_matrix.sql'))
$imageMigration = [IO.File]::ReadAllText((Join-Path $repoRoot 'supabase/migrations/20260911011338_52_2a_tourism_main_image.sql'))
$OutputEncoding = [Text.UTF8Encoding]::new($false)
('begin;' + $migration + $imageMigration + $matrix) | docker exec -i supabase_db_libguest-45b-lab psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres
if ($LASTEXITCODE -ne 0) { throw 'Tourism local rollback matrix failed' }
@'
do $$ begin
  assert to_regclass('public.hotel_tourism_items') is null, 'migration was not rolled back';
  assert to_regprocedure('public.update_current_hotel_tourism_image(uuid,text,timestamptz)') is null, 'image RPC was not rolled back';
  assert to_regclass('public.hotel_tourism_item_translations') is null, 'translations were not rolled back';
  assert not exists(select 1 from pg_catalog.pg_namespace where nspname='tourism_private'), 'private schema was not rolled back';
  assert not exists(select 1 from public.hotels where slug like 's521-%'), 'fixtures were not rolled back';
end $$;
'@ | docker exec -i supabase_db_libguest-45b-lab psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres
if ($LASTEXITCODE -ne 0) { throw 'Tourism local rollback residue check failed' }
Write-Output 'Tourism domain/RLS/RPC/audit rollback matrix: PASS'
