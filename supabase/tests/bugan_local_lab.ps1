# Fixed local disposable database only; schema, fixtures and assertions all roll back.
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$migration = [IO.File]::ReadAllText((Join-Path $repoRoot 'supabase/migrations/20261027215620_bugan_canonical_brand.sql'))
$migration = $migration -replace '(?m)^begin;\r?$','' -replace '(?m)^commit;\r?$',''
$matrix = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'bugan_behavioral_matrix.sql'))
$matrix = $matrix -replace '(?m)^begin;\r?$',''
$snapshot = @'
begin;
create temp table bugan_before_hotels as select * from public.hotels;
create temp table bugan_before_layout as select * from public.hotel_experience_layout;
create temp table bugan_before_entitlements as select * from public.hotel_module_entitlements;
create temp table bugan_before_acl as
  select oid,proacl,prosecdef,proconfig from pg_proc where oid in (
    'public.create_platform_hotel_onboarding(text,text,text,text,text,text,uuid,text,text)'::regprocedure,
    'public.update_platform_hotel_brand(uuid,text)'::regprocedure,
    'public.initialize_hotel_experience_layout()'::regprocedure);
'@
$OutputEncoding = [Text.UTF8Encoding]::new($false)
# Apply twice inside the same outer rollback transaction to verify idempotence.
($snapshot + $migration + $migration + $matrix) | docker exec -i supabase_db_libguest-45b-lab psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres
if ($LASTEXITCODE -ne 0) { throw 'Bugan local rollback matrix failed' }
@'
do $$ begin
  assert not exists(select 1 from public.hotels where slug like 'bugan-test-%'), 'fixture residue';
  assert pg_get_constraintdef((select oid from pg_constraint where conrelid='public.hotels'::regclass and conname='hotels_brand_code_check')) not like '%bugan%', 'migration residue';
end $$;
'@ | docker exec -i supabase_db_libguest-45b-lab psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres
if ($LASTEXITCODE -ne 0) { throw 'Bugan rollback residue check failed' }
Write-Output 'Bugan brand/onboarding/governance/ACL/isolation/rollback: PASS'
