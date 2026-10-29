# Fixed disposable local target from 45b_last_admin_concurrency.md. No remote URL.
# Concurrent sessions require committed synthetic setup, unlike the rollback matrix.
# Cleanup always removes this migration and the exact synthetic fixture namespace.
param([switch]$BudgetRollover)
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
function Invoke-LabSql([string]$Sql) {
  $output = $Sql | docker exec -i supabase_db_libguest-45b-lab psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d postgres
  if ($LASTEXITCODE -ne 0) { throw "Local SQL failed: $output" }
  return $output
}
$migration = [IO.File]::ReadAllText((Join-Path $repoRoot 'supabase/migrations/20260907034531_51_airlabs_distributed_coordinator.sql'))
if ($BudgetRollover) {
  $migration += [IO.File]::ReadAllText((Join-Path $repoRoot 'supabase/migrations/20261029231150_airlabs_operational_budget_rollover.sql'))
}
$fixtures = [IO.File]::ReadAllText((Join-Path $PSScriptRoot '51_airlabs_fixtures.sql'))
$matrix = [IO.File]::ReadAllText((Join-Path $PSScriptRoot '51_airlabs_behavioral_matrix.sql'))
Invoke-LabSql ('begin;' + $migration + $fixtures + $matrix)
Write-Output 'Rollback matrix: passed'
if ($BudgetRollover) {
  $renewalMatrix = [IO.File]::ReadAllText((Join-Path $PSScriptRoot '51_airlabs_budget_rollover_behavioral_matrix.sql'))
  Invoke-LabSql ('begin;' + $migration + $fixtures + $renewalMatrix)
  Write-Output 'Budget rollover matrix: passed'
}

$installed = $false
try {
  # Preflight collision checks in both migration and fixtures run before COMMIT.
  Invoke-LabSql ('begin;' + $migration + $fixtures + @'
insert into flight_private.rate_policies values('test-only',3600,10000,10000,10000);
insert into flight_private.budgets(provider,account_scope,period_start,period_end,limit_total,used_total)
values('airlabs','test-only',now()-interval '1 hour',now()+interval '1 day',900,899);
commit;
'@)
  $installed = $true
  if ($BudgetRollover) {
    Invoke-LabSql "update flight_private.budgets set period_start='2001-01-01',period_end='2001-02-01',rollover_enabled=true where account_scope='test-only';"
  }
  foreach ($mode in @('same','different')) {
    if ($mode -eq 'different') {
      if ($BudgetRollover) {
        Invoke-LabSql "begin; delete from flight_private.query_cache; delete from flight_private.rate_buckets; delete from flight_private.budgets where account_scope='test-only'; insert into flight_private.budgets(provider,account_scope,period_start,period_end,limit_total,used_total,rollover_enabled) values('airlabs','test-only','2001-01-01','2001-02-01',900,895,true); commit;"
      } else {
        Invoke-LabSql "begin; delete from flight_private.query_cache; delete from flight_private.rate_buckets; update flight_private.budgets set used_total=895; commit;"
      }
    }
    $count = if ($mode -eq 'same') { 5 } else { 12 }
    $jobs = @()
    try {
      for ($i=0; $i -lt $count; $i++) {
        $number = if ($mode -eq 'same') { 123 } else { 200+$i }
        $sql = @"
begin;
select pg_sleep(1);
select public.admit_airlabs_query('test-only','51900000-0000-4000-8000-000000000001','{"provider":"airlabs","contract_version":1,"query_type":"schedule","flight_iata":"G3$number","departure_date":"2026-09-07","departure_airport":"QXA","arrival_airport":"AEP"}'::jsonb);
select pg_sleep(0.2);
commit;
"@
        $jobs += Start-Job -ArgumentList $sql -ScriptBlock {
          param($query)
          $result = $query | docker exec -i supabase_db_libguest-45b-lab psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d postgres
          if ($LASTEXITCODE -ne 0) { throw 'Concurrent SQL failed' }
          $result
        }
      }
      $results = @($jobs | Wait-Job | Receive-Job -ErrorAction Stop | Where-Object { $_ -match '^\{' } | ForEach-Object { $_ | ConvertFrom-Json })
      if ($results.Count -ne $count) { throw 'Missing concurrent response' }
      $winners = @($results | Where-Object status -eq 'fetch_allowed').Count
      $others = @($results | Where-Object status -eq $(if ($mode -eq 'same') { 'in_progress' } else { 'quota_exhausted' })).Count
      if (($mode -eq 'same' -and ($winners -ne 1 -or $others -ne 4)) -or ($mode -eq 'different' -and ($winners -ne 5 -or $others -ne 7))) {
        throw "Unexpected concurrency distribution: winners=$winners others=$others"
      }
      Invoke-LabSql 'do $$ begin assert (select sum(used_total)=900 and bool_and(used_total<=limit_total) from flight_private.budgets where account_scope=''test-only''),''concurrent budget''; end; $$;'
      if ($BudgetRollover) {
        Invoke-LabSql 'do $$ begin assert (select count(*)=2 from flight_private.budgets where account_scope=''test-only''),''one successor''; assert (select used_total in (899,895) from flight_private.budgets where account_scope=''test-only'' and rolled_from is null),''parent counter preserved''; end; $$;'
      }
      Write-Output "$mode concurrency: $winners fetch_allowed, $others blocked; budget=900/900"
    } finally {
      $jobs | Stop-Job -ErrorAction SilentlyContinue
      $jobs | Remove-Job -Force -ErrorAction SilentlyContinue
    }
  }
} finally {
  if ($installed) {
    $rollback = [IO.File]::ReadAllText((Join-Path $PSScriptRoot '51_airlabs_rollback.sql'))
    Invoke-LabSql ($rollback + @'
begin;
delete from public.hotel_airports where hotel_id in ('51900000-0000-4000-8000-000000000001','51900000-0000-4000-8000-000000000002','51900000-0000-4000-8000-000000000003','51900000-0000-4000-8000-000000000004');
delete from public.hotel_flight_settings where hotel_id in ('51900000-0000-4000-8000-000000000001','51900000-0000-4000-8000-000000000002','51900000-0000-4000-8000-000000000003','51900000-0000-4000-8000-000000000004');
delete from public.hotel_module_entitlements where hotel_id in ('51900000-0000-4000-8000-000000000001','51900000-0000-4000-8000-000000000002','51900000-0000-4000-8000-000000000003','51900000-0000-4000-8000-000000000004');
delete from public.hotels where id in ('51900000-0000-4000-8000-000000000001','51900000-0000-4000-8000-000000000002','51900000-0000-4000-8000-000000000003','51900000-0000-4000-8000-000000000004');
delete from public.airports where id in ('51930000-0000-4000-8000-000000000001','51930000-0000-4000-8000-000000000002','51930000-0000-4000-8000-000000000003','51930000-0000-4000-8000-000000000004');
commit;
'@)
    Write-Output 'Local migration and committed concurrency fixtures removed'
  }
}
