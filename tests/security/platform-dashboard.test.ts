import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  PLATFORM_DIRECTORY_DEFAULT_PAGE_SIZE,
  PLATFORM_DIRECTORY_MAX_PAGE,
  PLATFORM_DIRECTORY_MAX_PAGE_SIZE,
  PLATFORM_DIRECTORY_MAX_SEARCH_LENGTH,
  normalizePlatformDirectoryParams,
} from '../../lib/platform-directory.ts';

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');
const migration = read(
  'supabase',
  'migrations',
  '202608140001_46b_platform_dashboard_directory.sql'
);

test('normalizes and bounds platform directory parameters server-side', () => {
  assert.deepEqual(normalizePlatformDirectoryParams({}), {
    search: null,
    page: 1,
    pageSize: PLATFORM_DIRECTORY_DEFAULT_PAGE_SIZE,
  });
  assert.deepEqual(
    normalizePlatformDirectoryParams({
      busca: `  ${'a'.repeat(PLATFORM_DIRECTORY_MAX_SEARCH_LENGTH + 20)}  `,
      pagina: String(PLATFORM_DIRECTORY_MAX_PAGE + 50),
      limite: '999',
    }),
    {
      search: 'a'.repeat(PLATFORM_DIRECTORY_MAX_SEARCH_LENGTH),
      page: PLATFORM_DIRECTORY_MAX_PAGE,
      pageSize: PLATFORM_DIRECTORY_MAX_PAGE_SIZE,
    }
  );
  assert.deepEqual(
    normalizePlatformDirectoryParams({ busca: ["%' OR true --"], pagina: '-1', limite: '0' }),
    { search: null, page: 1, pageSize: 1 }
  );
  assert.equal(
    normalizePlatformDirectoryParams({ busca: "%' OR true --" }).search,
    "%' OR true --"
  );
});

test('creates narrow self-authorizing platform read contracts with preflight', () => {
  assert.ok(
    migration.indexOf('do $$') < migration.indexOf('create function public.get_platform_hotel_metrics()')
  );
  assert.match(migration, /to_regprocedure\('public\.get_platform_hotel_metrics\(\)'\)/i);
  assert.match(
    migration,
    /to_regprocedure\('public\.list_platform_hotels\(text,integer,integer\)'\)/i
  );
  assert.doesNotMatch(migration, /create or replace/i);
  assert.equal((migration.match(/security definer/gi) || []).length >= 2, true);
  assert.equal((migration.match(/set search_path = ''/gi) || []).length >= 2, true);
  assert.match(migration, /pu\.user_id = auth\.uid\(\)/i);
  assert.match(migration, /pu\.is_active = true/i);
  assert.match(migration, /pu\.role = 'platform_admin'/i);
});

test('directory SQL exposes only the approved projection and bounded search', () => {
  const directoryFunction = migration.match(
    /create function public\.list_platform_hotels[\s\S]+?\n\$\$;/i
  )?.[0] || '';

  for (const field of [
    'id',
    'name',
    'slug',
    'subdomain',
    'city',
    'brand_code',
    'theme_preset',
    'logo_url',
  ]) {
    assert.match(directoryFunction, new RegExp(`\\b${field}\\b`));
  }

  assert.doesNotMatch(
    directoryFunction,
    /wifi_password|wifi_name|room_token|notes|profiles|analytics|hotel_sections/i
  );
  assert.match(directoryFunction, /p_page_size > 50/);
  assert.match(directoryFunction, /length\(normalized_search\) > 100/);
  assert.match(directoryFunction, /order by lower\(fh\.name\), fh\.id/i);
  assert.match(directoryFunction, /limit p_page_size[\s\S]*offset/i);
  assert.match(directoryFunction, /escape E'\\\\'/i);
  assert.doesNotMatch(directoryFunction, /\bexecute\b|format\s*\(/i);
});

test('46B does not add hotel policies or direct hotel grants', () => {
  assert.doesNotMatch(migration, /create policy[\s\S]*on public\.hotels/i);
  assert.doesNotMatch(
    migration,
    /grant\s+select\s+on\s+(?:table\s+)?public\.hotels/i
  );
  assert.doesNotMatch(
    migration,
    /grant\s+(?:insert|update|delete|all)[^;]*public\.hotels/i
  );
  assert.match(
    migration,
    /grant execute on function public\.get_platform_hotel_metrics\(\)[\s\S]*to authenticated/i
  );
  assert.match(
    migration,
    /grant execute on function public\.list_platform_hotels\(text, integer, integer\)[\s\S]*to authenticated/i
  );
});

test('platform query layer uses only approved RPCs after the platform guard', () => {
  const queries = read('lib', 'platform-queries.ts');

  assert.match(queries, /requirePlatformAccess\(\)/);
  assert.match(queries, /rpc\('get_platform_hotel_metrics'\)/);
  assert.match(queries, /rpc\('list_platform_hotels'/);
  assert.doesNotMatch(queries, /\.from\(['"]hotels['"]\)|createAdminClient|service_role/i);
});

test('platform dashboard and directory remain read-only and status-free', () => {
  const dashboard = read('app', 'platform', 'page.tsx');
  const directory = read('app', 'platform', 'hoteis', 'page.tsx');

  assert.match(dashboard, /getPlatformHotelMetrics\(\)/);
  assert.match(dashboard, /\/platform\/hoteis/);
  assert.match(directory, /listPlatformHotels\(params\)/);
  assert.match(directory, /name="busca"/);
  assert.doesNotMatch(`${dashboard}\n${directory}`, /brand_code.*(?:update|mutation)|lifecycle|status\/lifecycle/i);
  assert.doesNotMatch(directory, /requireAdminAccess|getAdminHotel/);
});
