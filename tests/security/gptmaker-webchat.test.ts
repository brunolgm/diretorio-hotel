import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');
const webChat = read('components', 'public', 'gptmaker-webchat.tsx');
const grandMercureHome = read('components', 'public', 'grand-mercure', 'grand-mercure-public-home.tsx');
const grandMercureProperty = read('lib', 'grand-mercure-property.ts');
const otherPublicHomes = [
  read('components', 'public', 'hotel-public-page-content.tsx'),
  read('components', 'public', 'mercure', 'mercure-public-home.tsx'),
  read('components', 'public', 'novotel', 'novotel-public-home.tsx'),
];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

test('loads the official GPTMaker script once, after interactivity and without inline code', () => {
  assert.match(webChat, /^'use client';/);
  assert.match(webChat, /from 'next\/script'/);
  assert.equal((webChat.match(/https:\/\/app\.gptmaker\.ai\/widget\/3F83AECD2037037309F0CE90CE228FB1\/float\.js/g) || []).length, 1);
  assert.match(webChat, /id="gptmaker-grand-mercure-rio-copacabana"/);
  assert.match(webChat, /strategy="afterInteractive"/);
  assert.match(webChat, /onError=\{\(\) => undefined\}/);
  assert.doesNotMatch(webChat, /dangerouslySetInnerHTML/);
  assert.ok(webChat.indexOf('window.GPTMakerWidget = configuration') < webChat.indexOf('return <Script'));
});

test('mounts the webchat only behind the canonical Grand Mercure Copacabana property guard', () => {
  assert.match(grandMercureProperty, /GRAND_MERCURE_RIO_COPACABANA_SLUG = 'grandmercureriocopacabana'/);
  assert.match(grandMercureHome, /showRioCopacabanaEditorial = isGrandMercureRioCopacabanaProperty\(hotel\)/);
  assert.match(grandMercureHome, /isChatPilot = isAiChatPilotHotel\(hotel\.slug\)/);
  assert.match(grandMercureHome, /aiChatPocMode === 'widget'/);
  assert.match(grandMercureHome, /webChatContext \? <GptMakerWebChat language=\{language\} additionalContext=\{webChatContext\} \/> : null/);

  for (const home of otherPublicHomes) assert.doesNotMatch(home, /GptMakerWebChat|GPTMakerWidget|gptmaker\.ai/i);

  const consumers = [...sourceFiles(join(root, 'app')), ...sourceFiles(join(root, 'components'))]
    .filter((path) => /<GptMakerWebChat\b/.test(readFileSync(path, 'utf8')))
    .map((path) => relative(root, path).replaceAll('\\', '/'));
  assert.deepEqual(consumers, ['components/public/grand-mercure/grand-mercure-public-home.tsx']);
});

test('sends only non-sensitive hotel, language and source context to the widget', () => {
  assert.match(webChat, /getUserMetadata: \(\) => \(\{[\s\S]*?hotel: GRAND_MERCURE_RIO_COPACABANA,[\s\S]*?language,[\s\S]*?source: 'LibGuest'/);
  assert.match(webChat, /getAdditionalContext: \(\) => additionalContext/);
  assert.doesNotMatch(webChat, /\bany\b/);
  assert.doesNotMatch(webChat, /api[_-]?key|roomToken|\bguest(?:Name|Id|Identity)?|h[oó]spede|quarto|roomNumber|telefone|phone|e-?mail/i);
  assert.doesNotMatch(webChat, /localStorage|sessionStorage|document\.cookie/);
});
