import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  ASSISTANT_RATE_LIMIT_POLICY,
  AssistantRateLimiter,
  InMemoryAssistantRateLimitStore,
  buildAssistantRateLimitKeys,
  resolveAssistantClientIp,
} from '../../lib/server/assistant-rate-limit-core.ts';

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');
const routeSource = read('app', 'api', 'assistant', 'chat', 'route.ts');
const wrapperSource = read('lib', 'server', 'assistant-rate-limit.ts');
const coreSource = read('lib', 'server', 'assistant-rate-limit-core.ts');
const componentSource = read('components', 'public', 'libguest-ai-chat.tsx');
const CONTEXT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CONTEXT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function input(overrides: Partial<{ hotelSlug: string; ip: string; contextId: string; now: number }> = {}) {
  return {
    hotelSlug: 'hotel-a',
    ip: '203.0.113.10',
    contextId: CONTEXT_A,
    now: 0,
    ...overrides,
  };
}

function createLimiter() {
  const store = new InMemoryAssistantRateLimitStore();
  return { store, limiter: new AssistantRateLimiter(store) };
}

test('allows the first message, blocks an immediate second and allows after cooldown', () => {
  const { limiter } = createLimiter();
  assert.deepEqual(limiter.consume(input({ now: 0 })), { allowed: true });
  const blocked = limiter.consume(input({ now: 999 }));
  assert.deepEqual(blocked, { allowed: false, reason: 'cooldown', retryAfterSeconds: 1 });
  assert.deepEqual(limiter.consume(input({ now: ASSISTANT_RATE_LIMIT_POLICY.cooldownMs })), { allowed: true });
});

test('enforces the three-message burst window with a valid Retry-After', () => {
  const { limiter } = createLimiter();
  for (const now of [0, 1_000, 2_000]) assert.equal(limiter.consume(input({ now })).allowed, true);
  const blocked = limiter.consume(input({ now: 3_000 }));
  assert.equal(blocked.allowed, false);
  if (!blocked.allowed) {
    assert.equal(blocked.reason, 'burst');
    assert.equal(blocked.retryAfterSeconds, 7);
    assert.ok(Number.isInteger(blocked.retryAfterSeconds) && blocked.retryAfterSeconds > 0);
  }
  assert.equal(limiter.consume(input({ now: 10_000 })).allowed, true);
});

test('enforces eight allowed messages in a rolling minute', () => {
  const { limiter } = createLimiter();
  for (const now of [0, 1_000, 2_000, 10_000, 11_000, 12_000, 20_000, 21_000]) {
    assert.equal(limiter.consume(input({ now })).allowed, true, `unexpected block at ${now}`);
  }
  const blocked = limiter.consume(input({ now: 22_000 }));
  assert.equal(blocked.allowed, false);
  if (!blocked.allowed) {
    assert.equal(blocked.reason, 'minute');
    assert.equal(blocked.retryAfterSeconds, 38);
  }
});

test('enforces thirty allowed messages in a rolling ten-minute window', () => {
  const { limiter } = createLimiter();
  const timestamps = Array.from({ length: 10 }, (_, minute) => [
    minute * 60_000,
    minute * 60_000 + 1_000,
    minute * 60_000 + 2_000,
  ]).flat();
  for (const now of timestamps) assert.equal(limiter.consume(input({ now })).allowed, true);
  const blocked = limiter.consume(input({ now: 550_000 }));
  assert.equal(blocked.allowed, false);
  if (!blocked.allowed) {
    assert.equal(blocked.reason, 'ten_minute');
    assert.equal(blocked.retryAfterSeconds, 50);
  }
});

test('isolates hotels and IPs while a new context cannot bypass hotel plus IP', () => {
  const { limiter } = createLimiter();
  assert.equal(limiter.consume(input({ now: 0 })).allowed, true);
  assert.equal(limiter.consume(input({ hotelSlug: 'hotel-b', now: 100 })).allowed, true);
  assert.equal(limiter.consume(input({ ip: '203.0.113.11', now: 100 })).allowed, true);

  const newContext = limiter.consume(input({ contextId: CONTEXT_B, now: 200 }));
  assert.equal(newContext.allowed, false);
  if (!newContext.allowed) assert.equal(newContext.reason, 'cooldown');

  const sameContext = limiter.consume(input({ now: 300 }));
  assert.equal(sameContext.allowed, false);
  if (!sameContext.allowed) assert.equal(sameContext.reason, 'cooldown');
});

test('uses hashed two-level keys without room, PII, raw IP or full context id', () => {
  const keys = buildAssistantRateLimitKeys(input());
  assert.notEqual(keys.hotelIp, keys.hotelIpContext);
  assert.match(keys.hotelIp, /^assistant:hotel-a:ip:[a-f0-9]{32}$/);
  assert.match(keys.hotelIpContext, /^assistant:hotel-a:ip:[a-f0-9]{32}:context:[a-f0-9]{32}$/);
  const serialized = JSON.stringify(keys);
  assert.doesNotMatch(serialized, /203\.0\.113\.10|aaaaaaaa-aaaa|roomToken|guestName|email|phone|reservation/i);
});

test('lazy cleanup removes every expired process-local entry', () => {
  const { store, limiter } = createLimiter();
  limiter.consume(input({ now: 0 }));
  assert.equal(store.size, 2);
  assert.equal(store.cleanup(0), 2);
  assert.equal(store.size, 0);
});

test('resolves proxy IP headers deterministically with conservative fallbacks', () => {
  assert.equal(resolveAssistantClientIp(new Headers({
    'cf-connecting-ip': '2001:0DB8:0:0:0:0:0:1',
    'x-real-ip': '203.0.113.20',
    'x-forwarded-for': '203.0.113.30',
  })), '2001:db8::1');
  assert.equal(resolveAssistantClientIp(new Headers({
    'cf-connecting-ip': 'invalid',
    'x-real-ip': '203.0.113.20:443',
  })), '203.0.113.20');
  assert.equal(resolveAssistantClientIp(new Headers({
    'x-forwarded-for': 'invalid, 203.0.113.30, 203.0.113.31',
  })), '203.0.113.30');
  assert.equal(resolveAssistantClientIp(new Headers({
    'cf-connecting-ip': 'invalid',
    'x-real-ip': 'also-invalid',
    'x-forwarded-for': 'bad, worse',
  })), 'unknown');
});

test('blocks before hotel resolution and every paid GPTMaker operation', () => {
  const validationPosition = routeSource.indexOf('const validation = validateAssistantChatPayload');
  const rateLimitPosition = routeSource.indexOf('const rateLimit = await consumeAssistantRateLimit');
  const pageDataPosition = routeSource.indexOf('runAssistantChat(validation.value');
  assert.ok(rateLimitPosition > validationPosition);
  assert.ok(rateLimitPosition < pageDataPosition);
  assert.match(routeSource, /if \(!rateLimit\.allowed\)[\s\S]*error: 'rate_limited'[\s\S]*status: 429[\s\S]*Retry-After/);
  assert.equal((routeSource.match(/status: 429/g) || []).length, 1);
  assert.ok(routeSource.indexOf("return NextResponse.json(\n      { error: 'rate_limited' }") < pageDataPosition);
  assert.doesNotMatch(routeSource.slice(rateLimitPosition, pageDataPosition), /addContext|converse|add-message|conversation/);
});

test('keeps limiter and logs free of message, context, answer, tokens and raw identifiers', () => {
  assert.match(wrapperSource, /^import 'server-only';/);
  assert.match(wrapperSource, /IN-MEMORY RATE LIMIT IS NOT PRODUCTION-SAFE IN MULTI-INSTANCE ENVIRONMENTS\./);
  assert.match(wrapperSource, /Redis\/Upstash\/Vercel KV/);
  assert.doesNotMatch(`${wrapperSource}\n${coreSource}`, /console\.|API_KEY|Authorization|\.message\b|\banswer\b|roomToken|guestName/);
  assert.doesNotMatch(routeSource, /console\.|logger\.|logRateLimit/);
});

test('preserves request hardening and the minimal success response', () => {
  assert.match(routeSource, /isJsonContentType/);
  assert.match(routeSource, /ASSISTANT_CHAT_LIMITS\.bodyBytes/);
  assert.match(routeSource, /validateAssistantChatPayload/);
  assert.match(routeSource, /NextResponse\.json\(\{[\s\S]*answer: result\.answer,[\s\S]*action: result\.action,[\s\S]*pendingRequest: result\.pendingRequest,[\s\S]*responseLanguage: result\.responseLanguage/);
  assert.doesNotMatch(routeSource, /error\.message|JSON\.stringify\(error\)/);
});

test('frontend handles 429 in PT, EN and ES without resetting session or automatic retry', () => {
  assert.match(componentSource, /Você enviou muitas mensagens em pouco tempo\. Aguarde alguns instantes e tente novamente\./);
  assert.match(componentSource, /You sent too many messages in a short period\. Please wait a moment and try again\./);
  assert.match(componentSource, /Enviaste demasiados mensajes en poco tiempo\. Espera unos instantes e inténtalo de nuevo\./);
  assert.match(componentSource, /response\.status === 429[\s\S]*result\.error === 'rate_limited'/);
  assert.match(componentSource, /setFailureKind\('rate_limited'\)/);
  assert.match(componentSource, /failureKind === 'rate_limited'[\s\S]*\? copy\.rateLimited[\s\S]*: resolveAssistantErrorMessage/);
  assert.doesNotMatch(componentSource, /setTimeout\([^)]*sendMessage|setInterval|429[\s\S]{0,200}createAssistantSession/);
});
