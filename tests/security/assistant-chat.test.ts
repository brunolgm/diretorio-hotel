import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  ASSISTANT_CHAT_LIMITS,
  isSuccessfulGptMakerAcknowledgement,
  parseGptMakerAnswer,
  runAssistantChat,
  validateAssistantChatPayload,
} from '../../lib/assistant-chat.ts';
import { isJsonContentType, readUtf8BodyWithLimit } from '../../lib/security/http.ts';

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');
function readCodeTree(directory: string): string {
  return readdirSync(join(root, directory), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(?:ts|tsx|js|jsx)$/.test(entry.name))
    .map((entry) => readFileSync(join(entry.parentPath, entry.name), 'utf8'))
    .join('\n');
}
const routeSource = read('app', 'api', 'assistant', 'chat', 'route.ts');
const clientSource = read('lib', 'server', 'gptmaker-client.ts');
const contextSource = read('lib', 'public-ai-context.ts');
const VALID_PAYLOAD = {
  hotelSlug: 'hotel-teste',
  language: 'pt',
  contextId: 'b187f57c-c435-4605-99b8-4a5a9c3983f6',
  message: 'Qual o horário do café?',
} as const;

function publicPageData() {
  return {
    hotel: {
      id: '50200000-0000-4000-8000-000000000001',
      name: 'Hotel Teste',
      slug: 'hotel-teste',
      checkin_time: '15h',
      checkout_time: '12h',
      breakfast_hours: '6h30 às 10h30',
      wifi_name: 'HOTEL-GUEST',
      wifi_password: 'SECRET-WIFI-PASSWORD',
      website_url: null,
      instagram_url: null,
      booking_url: null,
      whatsapp_number: null,
      administrative_notes: 'INTERNAL-ADMIN-DATA',
    },
    sections: [{ title: 'Café da manhã', content: 'Buffet no restaurante', category: 'Alimentação', operational_key: null }],
    departments: [],
    policies: [],
    announcements: [],
    banners: [],
    layout: [],
    flightHomeCard: null,
    hasFallbackContent: false,
  };
}

test('accepts only the strict assistant payload contract', () => {
  const result = validateAssistantChatPayload(VALID_PAYLOAD);
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.value, VALID_PAYLOAD);

  for (const [field, value] of Object.entries({
    hotelId: '50200000-0000-4000-8000-000000000001',
    roomToken: 'secret',
    room: '101',
    guestName: 'Guest',
    email: 'guest@example.test',
    phone: '+55 21 99999-9999',
    reservation: 'ABC123',
    url: 'https://external.example',
    unexpected: true,
  })) {
    assert.equal(
      validateAssistantChatPayload({ ...VALID_PAYLOAD, [field]: value }).ok,
      false,
      `unexpected field accepted: ${field}`
    );
  }
});

test('validates slug, language, context id, message and external URLs', () => {
  for (const language of ['pt', 'en', 'es']) {
    assert.equal(validateAssistantChatPayload({ ...VALID_PAYLOAD, language }).ok, true);
  }
  for (const language of ['PT', 'fr', '', null]) {
    assert.equal(validateAssistantChatPayload({ ...VALID_PAYLOAD, language }).ok, false);
  }
  for (const contextId of [
    'short',
    'contains spaces 123',
    '../invalid-context-id',
    'aaaaaaaaaaaaaaaa',
    'b187f57c-c435-1605-99b8-4a5a9c3983f6',
    'a'.repeat(129),
  ]) {
    assert.equal(validateAssistantChatPayload({ ...VALID_PAYLOAD, contextId }).ok, false);
  }
  for (const hotelSlug of ['', 'Hotel Teste', '../hotel', 'hotel_teste', 'a'.repeat(81)]) {
    assert.equal(validateAssistantChatPayload({ ...VALID_PAYLOAD, hotelSlug }).ok, false);
  }
  assert.equal(validateAssistantChatPayload({ ...VALID_PAYLOAD, message: '' }).ok, false);
  assert.equal(validateAssistantChatPayload({ ...VALID_PAYLOAD, message: 'x'.repeat(ASSISTANT_CHAT_LIMITS.message + 1) }).ok, false);
  assert.equal(validateAssistantChatPayload({ ...VALID_PAYLOAD, message: 'Veja https://external.example' }).ok, false);
});

test('rejects missing JSON content type, malformed JSON and oversized bodies before parsing', async () => {
  assert.equal(isJsonContentType(null), false);
  assert.equal(isJsonContentType('text/plain'), false);
  assert.equal(isJsonContentType('application/json; charset=utf-8'), true);
  assert.throws(() => JSON.parse('{'));

  const request = new Request('https://example.test/api/assistant/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: 'x'.repeat(ASSISTANT_CHAT_LIMITS.bodyBytes + 1),
  });
  assert.deepEqual(
    await readUtf8BodyWithLimit(request, ASSISTANT_CHAT_LIMITS.bodyBytes),
    { ok: false, reason: 'too_large' }
  );
  assert.match(routeSource, /isJsonContentType[\s\S]*status: 415/);
  assert.match(routeSource, /body\.reason === 'too_large' \? 413 : 400/);
});

test('resolves current public data by slug and adds context before conversation', async () => {
  const calls: Array<{ operation: string; input: Record<string, string> }> = [];
  let resolved: [string, string] | undefined;
  const result = await runAssistantChat(VALID_PAYLOAD, {
    async getPageDataBySlug(slug, language) {
      resolved = [slug, language];
      return publicPageData() as never;
    },
    client: {
      async addContext(input) {
        calls.push({ operation: 'add-message', input });
      },
      async converse(input) {
        calls.push({ operation: 'conversation', input });
        return '  O café começa às 6h30.  ';
      },
    },
  });

  assert.deepEqual(resolved, ['hotel-teste', 'pt']);
  assert.deepEqual(calls.map(({ operation }) => operation), ['add-message', 'conversation']);
  assert.equal(calls[0].input.role, 'user');
  assert.equal(calls[0].input.contextId, VALID_PAYLOAD.contextId);
  assert.equal(calls[1].input.contextId, VALID_PAYLOAD.contextId);
  assert.equal(calls[1].input.prompt, VALID_PAYLOAD.message);
  assert.match(calls[0].input.prompt, /Hotel Teste|HOTEL-GUEST|6h30/);
  assert.doesNotMatch(calls[0].input.prompt, /50200000|SECRET-WIFI-PASSWORD|INTERNAL-ADMIN-DATA/);
  assert.deepEqual(result, { answer: '  O café começa às 6h30.  ' });
});

test('fails closed for success=false, invalid and empty GPTMaker responses', () => {
  assert.equal(isSuccessfulGptMakerAcknowledgement({ success: true }), true);
  assert.equal(isSuccessfulGptMakerAcknowledgement({ success: false, error: 'raw-secret' }), false);
  assert.equal(parseGptMakerAnswer({ success: false, message: 'raw-secret' }), null);
  assert.equal(parseGptMakerAnswer({ success: true, message: '' }), null);
  assert.equal(parseGptMakerAnswer({ success: true, message: '   ' }), null);
  assert.equal(parseGptMakerAnswer({ success: true, message: 123 }), null);
  assert.equal(parseGptMakerAnswer({ success: true, message: 'Resposta válida', images: [] }), 'Resposta válida');
});

test('keeps credentials and GPTMaker transport server-only with a closed timeout', () => {
  assert.match(clientSource, /^import 'server-only';/);
  assert.match(clientSource, /process\.env\.GPTMAKER_API_KEY/);
  assert.match(clientSource, /process\.env\.GPTMAKER_AGENT_ID/);
  assert.doesNotMatch(clientSource, /NEXT_PUBLIC_/);
  assert.match(clientSource, /new AbortController\(\)/);
  assert.match(clientSource, /controller\.abort\(\)/);
  assert.match(clientSource, /controller\.signal\.aborted[\s\S]*GptMakerError\('timeout'\)/);
  assert.match(routeSource, /error\.kind === 'timeout'[\s\S]*\? 504/);
  assert.doesNotMatch(routeSource, /error\.message|JSON\.stringify\(error\)|console\./);

  const publicCode = `${readCodeTree('components')}\n${readCodeTree('public')}`;
  assert.doesNotMatch(publicCode, /GPTMAKER_API_KEY|Authorization:\s*`?Bearer|api\.gptmaker\.ai\/v2\/agent/i);
});

test('uses only public hotel page data and never persists assistant messages', () => {
  assert.match(routeSource, /getPublicHotelPageDataBySlug/);
  assert.match(read('lib', 'assistant-chat.ts'), /buildPublicAiContext\(\{ pageData/);
  assert.doesNotMatch(routeSource, /hotelId|roomToken|createAdminClient|createClient|\.from\(|\.insert\(|\.upsert\(/);
  assert.doesNotMatch(clientSource, /supabase|hotel\.id|wifi_password|administrative/i);
  assert.doesNotMatch(contextSource, /wifi_password|internal_notes|created_by/);
  assert.match(routeSource, /NextResponse\.json\(\{ answer: result\.answer \}\)/);
  assert.match(routeSource, /\{ error: 'assistant_unavailable' \}/);
});
