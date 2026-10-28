import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { tourismAdminError, TOURISM_CONFLICT_MESSAGE } from '../../lib/tourism/admin.ts';

const directory = 'supabase/migrations/';
const foundation = '20260910043520_52_1_tourism_foundation.sql';
const image = '20260911011338_52_2a_tourism_main_image.sql';
const hotfix = '20260914014530_52_2b1_tourism_revision_conflict.sql';
const read = (name: string) => readFileSync(directory + name, 'utf8');
const names = ['save_current_hotel_tourism_item', 'delete_current_hotel_tourism_item', 'update_current_hotel_tourism_image'];

test('applied tourism migrations remain byte-for-byte immutable', () => {
  for (const [name, hash] of [
    [foundation, '52a2eda17b6ae93a16b9e81aa265b52a787ea2c23aab4e92c19d391e16acab64'],
    [image, 'f0777d3d4e6f73bd65e88481486a1cf291e7852abb934656f716726dd88cf902'],
  ]) assert.equal(createHash('sha256').update(readFileSync(directory + name)).digest('hex'), hash);
});

test('incremental hotfix changes only the three revision SQLSTATEs, preserving entire definitions', () => {
  assert.ok(hotfix > image);
  const sql = read(hotfix);
  const definitions = [...sql.matchAll(/create or replace function public\.([a-z_]+)\([\s\S]*?end \$\$;/g)];
  assert.deepEqual(definitions.map((match) => match[1]), names);
  assert.equal(sql.replace(/--[^\n]*|create or replace function public\.[a-z_]+\([\s\S]*?end \$\$;/g, '').trim(), '');
  for (const [index, name] of names.entries()) {
    const original = read(index === 2 ? image : foundation);
    const start = original.indexOf(`create function public.${name}(`);
    const body = original.slice(start, original.indexOf('end $$;', start) + 7);
    assert.equal(definitions[index][0], body.replace('create function', 'create or replace function')
      .replace("errcode='40001',message='tourism_revision_conflict'", "errcode='PT409',message='tourism_revision_conflict'"));
    // Resolve the effective definition across the full ordered migration chain.
    const chain = readdirSync(directory).filter((file) => file.endsWith('.sql')).sort().map(read).join('\n');
    const effective = [...chain.matchAll(new RegExp(`create (?:or replace )?function public\\.${name}\\([\\s\\S]*?end \\$\\$;`, 'g'))].at(-1)?.[0];
    assert.ok(effective);
    assert.match(effective, /errcode='PT409',message='tourism_revision_conflict'/);
    assert.doesNotMatch(effective, /40001/);
  }
  const runner = readFileSync('supabase/tests/52_1_tourism_local_lab.ps1', 'utf8');
  assert.ok(runner.includes(hotfix));
  assert.match(runner, /\$imageMigration \+ \$revisionMigration \+ \$matrix/);
});

test('admin recognizes new code, legacy code and message independently; other errors retain their mapping', () => {
  for (const error of [{ code: 'PT409' }, { code: '40001' }, { message: 'tourism_revision_conflict' }]) {
    assert.equal(tourismAdminError(error), TOURISM_CONFLICT_MESSAGE);
  }
  assert.equal(TOURISM_CONFLICT_MESSAGE, 'Este item foi alterado desde que você abriu a página. Recarregue os dados antes de salvar novamente.');
  assert.equal(tourismAdminError({ code: 'P0002' }), 'Item não encontrado ou indisponível para este hotel.');
  assert.equal(tourismAdminError({ code: '42501' }), 'Seu acesso ou a disponibilidade do módulo mudou. Recarregue a página.');
  assert.equal(tourismAdminError({ code: '22023' }), 'Não foi possível concluir a operação. Revise os dados e tente novamente.');
});
