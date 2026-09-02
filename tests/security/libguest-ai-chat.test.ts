import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';
import {
  ASSISTANT_SESSION_TTL_MS,
  buildAssistantChatRequest,
  createAssistantSession,
  getAssistantSessionStorageKey,
  loadOrCreateAssistantSession,
  parseAssistantStoredSession,
  saveAssistantSession,
  type AssistantStorage,
} from '../../lib/assistant-chat-session.ts';
import {
  AI_CHAT_PILOT_SLUG,
  AI_CHAT_POC_MODE,
  isAiChatPilotHotel,
} from '../../lib/assistant-chat-poc.ts';

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');
const component = read('components', 'public', 'libguest-ai-chat.tsx');
const grandMercureHome = read('components', 'public', 'grand-mercure', 'grand-mercure-public-home.tsx');
const grandMercureDock = read('components', 'public', 'grand-mercure', 'grand-mercure-mobile-navigation.tsx');
const widget = read('components', 'public', 'gptmaker-webchat.tsx');
const pocGuard = read('lib', 'assistant-chat-poc.ts');
const UUID_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const UUID_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const UUID_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const NOW = new Date('2026-08-27T12:00:00.000Z');

class MemoryStorage implements AssistantStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

test('guards the native chat with the single canonical pilot slug', () => {
  assert.equal(AI_CHAT_PILOT_SLUG, 'grandmercureriocopacabana');
  assert.equal(isAiChatPilotHotel(AI_CHAT_PILOT_SLUG), true);
  assert.equal(isAiChatPilotHotel('another-grand-mercure'), false);
  assert.equal(isAiChatPilotHotel('novotel-rio'), false);
  assert.match(grandMercureHome, /isChatPilot && aiChatPocMode === 'native' \? <LibGuestAiChat/);

  const consumers = [...sourceFiles(join(root, 'app')), ...sourceFiles(join(root, 'components'))]
    .filter((path) => /<LibGuestAiChat\b/.test(readFileSync(path, 'utf8')))
    .map((path) => relative(root, path).replaceAll('\\', '/'));
  assert.deepEqual(consumers, ['components/public/grand-mercure/grand-mercure-public-home.tsx']);

  for (const directory of ['app/admin', 'app/platform', 'app/login']) {
    const source = sourceFiles(join(root, directory)).map((path) => readFileSync(path, 'utf8')).join('\n');
    assert.doesNotMatch(source, /LibGuestAiChat|libguest-ai-chat/);
  }
});

test('scopes sessionStorage by hotel and never crosses conversation messages', () => {
  const storage = new MemoryStorage();
  const hotelA = loadOrCreateAssistantSession({ storage, hotelSlug: 'hotel-a', language: 'pt', now: NOW, createId: () => UUID_A });
  hotelA.messages.push({ id: UUID_C, role: 'user', text: 'Mensagem A', createdAt: NOW.toISOString() });
  saveAssistantSession(storage, 'hotel-a', hotelA);
  const hotelB = loadOrCreateAssistantSession({ storage, hotelSlug: 'hotel-b', language: 'pt', now: NOW, createId: () => UUID_B });

  assert.equal(getAssistantSessionStorageKey('hotel-a'), 'libguest:assistant:hotel-a:v1');
  assert.equal(getAssistantSessionStorageKey('hotel-b'), 'libguest:assistant:hotel-b:v1');
  assert.equal(hotelA.contextId, UUID_A);
  assert.equal(hotelB.contextId, UUID_B);
  assert.deepEqual(hotelB.messages, []);
  assert.doesNotMatch(storage.getItem(getAssistantSessionStorageKey('hotel-b')) || '', /Mensagem A/);
});

test('expires after eight hours and a new conversation receives a new context id', () => {
  const storage = new MemoryStorage();
  const initial = createAssistantSession('en', NOW, () => UUID_A);
  initial.messages.push({ id: UUID_C, role: 'assistant', text: 'Old answer', createdAt: NOW.toISOString() });
  saveAssistantSession(storage, 'hotel-a', initial);

  const beforeExpiry = parseAssistantStoredSession(
    storage.getItem(getAssistantSessionStorageKey('hotel-a')),
    'en',
    new Date(NOW.getTime() + ASSISTANT_SESSION_TTL_MS - 1)
  );
  assert.equal(beforeExpiry?.contextId, UUID_A);

  const expired = loadOrCreateAssistantSession({
    storage,
    hotelSlug: 'hotel-a',
    language: 'en',
    now: new Date(NOW.getTime() + ASSISTANT_SESSION_TTL_MS),
    createId: () => UUID_B,
  });
  assert.equal(expired.contextId, UUID_B);
  assert.deepEqual(expired.messages, []);

  const manualReset = createAssistantSession('en', new Date(), () => UUID_C);
  assert.notEqual(manualReset.contextId, expired.contextId);
  assert.deepEqual(manualReset.messages, []);
  assert.match(component, /function startNewConversation\(\)[\s\S]*createAssistantSession\(language, new Date\(\), newId\)/);
});

test('persists only the allowlisted shape and redacts recognizable PII', () => {
  const storage = new MemoryStorage();
  const session = createAssistantSession('es', NOW, () => UUID_A);
  session.messages = [{
    id: UUID_B,
    role: 'user',
    text: 'guestName: Bruno, email: guest@example.com, phone: +55 21 99999-9999, quarto 1204, reservation: ABC123',
    createdAt: NOW.toISOString(),
  }];
  saveAssistantSession(storage, 'hotel-a', session);
  const raw = storage.getItem(getAssistantSessionStorageKey('hotel-a')) || '';
  const stored = JSON.parse(raw) as Record<string, unknown>;

  assert.deepEqual(Object.keys(stored).sort(), ['contextId', 'language', 'messages', 'timestamp']);
  assert.doesNotMatch(raw, /Bruno|guest@example|99999|1204|ABC123/);
  assert.doesNotMatch(raw, /hotelId|roomToken|api[_-]?key/i);
  assert.match(component, /window\.sessionStorage/);
  assert.doesNotMatch(component, /localStorage|document\.cookie/);
});

test('persists only allowlisted, revalidated assistant actions', () => {
  const storage = new MemoryStorage();
  const session = createAssistantSession('pt', NOW, () => UUID_A);
  session.messages = [{
    id: UUID_B,
    role: 'assistant',
    text: 'Você pode falar com a recepção por este canal.',
    createdAt: NOW.toISOString(),
    action: { type: 'open_url', label: 'Falar com a recepção', url: 'https://wa.me/5521999999999' },
  }];
  saveAssistantSession(storage, 'hotel-a', session);
  const parsed = parseAssistantStoredSession(
    storage.getItem(getAssistantSessionStorageKey('hotel-a')),
    'pt',
    NOW
  );
  assert.deepEqual(parsed?.messages[0].action, {
    type: 'open_url', label: 'Falar com a recepção', url: 'https://wa.me/5521999999999',
  });

  session.messages[0].action = {
    type: 'open_url', label: 'Executar', url: 'javascript:alert(1)',
  };
  saveAssistantSession(storage, 'hotel-a', session);
  const raw = storage.getItem(getAssistantSessionStorageKey('hotel-a')) || '';
  assert.doesNotMatch(raw, /javascript|Executar/);
  assert.equal(parseAssistantStoredSession(raw, 'pt', NOW)?.messages[0].action, undefined);
});

test('builds the browser request from only the current public fields', () => {
  const payload = buildAssistantChatRequest({
    hotelSlug: 'hotel-a',
    language: 'pt',
    contextId: UUID_A,
    message: 'Mensagem atual',
  });
  assert.deepEqual(Object.keys(payload).sort(), ['contextId', 'hotelSlug', 'language', 'message']);
  assert.deepEqual(payload, {
    hotelSlug: 'hotel-a', language: 'pt', contextId: UUID_A, message: 'Mensagem atual',
  });
  const privatePayload = buildAssistantChatRequest({
    hotelSlug: 'hotel-a', language: 'pt', contextId: UUID_A,
    message: 'guestName: Bruno, email: guest@example.com, quarto 1204',
  });
  assert.equal(privatePayload.message, 'guestName: Bruno, email: guest@example.com, quarto 1204');
  assert.doesNotMatch(component, /hotelId|roomToken|guestName|reservation|pathname|querystring|navigator\./i);
  assert.match(component, /fetch\('\/api\/assistant\/chat'/);
  assert.doesNotMatch(component, /gptmaker\.ai|gptmaker-client|GPTMAKER_API_KEY|Authorization|additionalContext|pageData/);
});

test('renders model output as text and fails safely with manual retry', () => {
  assert.doesNotMatch(component, /dangerouslySetInnerHTML|innerHTML|DOMParser/);
  assert.match(component, /\{message\.text\}/);
  assert.match(component, /whitespace-pre-wrap/);
  assert.match(component, /catch \{[\s\S]*setFailedMessage\(message\)/);
  assert.match(component, /role="alert"/);
  assert.match(component, /sendMessage\(failedMessage, false\)/);
  assert.doesNotMatch(component, /setInterval|location\.reload/);
});

test('is mobile-safe, keyboard accessible and separate from every dock', () => {
  assert.match(grandMercureDock, /h-\[94px\][\s\S]*pb-\[env\(safe-area-inset-bottom\)\]/);
  assert.match(component, /bottom-\[calc\(112px\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(component, /top-\[max\(1rem,env\(safe-area-inset-top\)\)\]/);
  assert.match(component, /bottom-\[calc\(110px\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(component, /inset-x-2/);
  assert.match(component, /min-h-10 flex-1[\s\S]*h-10 w-10 shrink-0/);
  assert.match(component, /event\.key === 'Enter' && !event\.shiftKey/);
  assert.match(component, /event\.key === 'Escape'/);
  assert.match(component, /maxLength=\{MESSAGE_MAX_LENGTH\}/);
  assert.doesNotMatch(component, /MobileNavigation|BottomDock|<nav\b|navigationItems/);
  assert.match(component, /'grand-mercure'[\s\S]*mercure:[\s\S]*novotel:[\s\S]*default:/);
});

test('keeps a compact stable desktop panel with bounded internal scrolling', () => {
  assert.match(component, /min-\[1025px\]:h-\[560px\]/);
  assert.match(component, /min-\[1025px\]:max-h-\[calc\(100dvh-7rem\)\]/);
  assert.match(component, /min-h-0 flex-1 overflow-y-auto overscroll-contain/);
  assert.match(component, /flex min-h-0 flex-col overflow-hidden/);
  assert.doesNotMatch(component, /min-\[1025px\]:h-\[min\(660px/);
});

test('shows one responsive unlinked AI brand signature for every visual variant', () => {
  assert.equal((component.match(/Powered by<\/span>/g) || []).length, 1);
  assert.equal((component.match(/LibGuest AI<\/span>/g) || []).length, 1);
  assert.equal((component.match(/Conecta AI<\/span>/g) || []).length, 1);
  assert.match(component, /flex flex-wrap items-baseline justify-center[\s\S]*text-center text-\[10px\]/);
  assert.match(component, /aria-label="Powered by LibGuest AI • Conecta AI"/);
  assert.match(component, /font-semibold \$\{styles\.brandingPrimary\}[\s\S]*LibGuest AI/);
  assert.match(component, /font-medium \$\{styles\.brandingSecondary\}[\s\S]*Conecta AI/);
  assert.match(component, /h-px w-8 \$\{styles\.brandingRule\}/);
  assert.match(component, /'grand-mercure':[\s\S]*brandingPrimary: 'text-\[#8a6429\]'[\s\S]*brandingSecondary: 'text-\[#8a6429\]'/);
  assert.match(component, /mercure:[\s\S]*brandingPrimary: 'text-\[#6f2f68\]'/);
  assert.match(component, /novotel:[\s\S]*brandingPrimary: 'text-\[#0052b4\]'/);
  assert.match(component, /default:[\s\S]*brandingPrimary: 'text-\[color:var\(--hotel-accent\)\]'/);
  const brandingMarkup = component.slice(
    component.indexOf('aria-label="Powered by LibGuest AI • Conecta AI"') - 160,
    component.indexOf('aria-label="Powered by LibGuest AI • Conecta AI"') + 700
  );
  assert.doesNotMatch(brandingMarkup, /<a\b|href=/);
  assert.ok(component.indexOf('Powered by</span>') > component.indexOf("const styles = VARIANT_CLASSES[variant]"));
});

test('contains complete PT, EN and ES copy', () => {
  for (const language of ['pt', 'en', 'es']) {
    for (const key of ['launcher', 'subtitle', 'greeting', 'placeholder', 'send', 'newConversation', 'close', 'typing', 'error', 'retry', 'sessionNotice']) {
      assert.match(component, new RegExp(`${key}:\\s*['’¡A-Za-zÀ-ÿ]`), `${language}.${key} missing`);
    }
  }
  assert.match(component, /Olá! Sou a Maya, assistente virtual do hotel\. Como posso ajudar\?/);
  assert.match(component, /Hello! I’m Maya, the hotel’s virtual assistant\. How can I help\?/);
  assert.match(component, /¡Hola! Soy Maya, la asistente virtual del hotel\. ¿Cómo puedo ayudar\?/);
});

test('switches native versus legacy widget without removing float.js', () => {
  assert.equal(AI_CHAT_POC_MODE, 'native');
  assert.match(pocGuard, /AI_CHAT_POC_MODE: 'native' \| 'widget' = 'native'/);
  assert.match(grandMercureHome, /aiChatPocMode === 'native'/);
  assert.match(grandMercureHome, /aiChatPocMode === 'widget'/);
  assert.match(widget, /float\.js/);
  assert.match(grandMercureHome, /webChatContext \? <GptMakerWebChat/);
  assert.match(grandMercureHome, /isChatPilot && aiChatPocMode === 'widget'[\s\S]*\? buildPublicAiContext\(\{ pageData, language \}\)/);
  assert.match(pocGuard, /TODO\(ai-chat-production\): add server-side rate limiting/);
});
