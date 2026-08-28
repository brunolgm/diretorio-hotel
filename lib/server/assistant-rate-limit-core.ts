import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

export const ASSISTANT_RATE_LIMIT_POLICY = {
  cooldownMs: 1_000,
  burst: { max: 3, windowMs: 10_000 },
  minute: { max: 8, windowMs: 60_000 },
  tenMinute: { max: 30, windowMs: 10 * 60_000 },
} as const;

export type AssistantRateLimitReason = 'cooldown' | 'burst' | 'minute' | 'ten_minute';

export type AssistantRateLimitResult =
  | { allowed: true }
  | { allowed: false; reason: AssistantRateLimitReason; retryAfterSeconds: number };

interface AssistantRateLimitEntry {
  timestamps: number[];
}

export interface AssistantRateLimitStore {
  get(key: string): AssistantRateLimitEntry | undefined;
  set(key: string, value: AssistantRateLimitEntry): void;
  delete(key: string): void;
  cleanup(expiredBefore: number): number;
}

export class InMemoryAssistantRateLimitStore implements AssistantRateLimitStore {
  private readonly entries = new Map<string, AssistantRateLimitEntry>();

  get(key: string) {
    const entry = this.entries.get(key);
    return entry ? { timestamps: [...entry.timestamps] } : undefined;
  }

  set(key: string, value: AssistantRateLimitEntry) {
    this.entries.set(key, { timestamps: [...value.timestamps] });
  }

  delete(key: string) {
    this.entries.delete(key);
  }

  cleanup(expiredBefore: number) {
    let removed = 0;
    for (const [key, entry] of this.entries) {
      if (!entry.timestamps.length || entry.timestamps[entry.timestamps.length - 1] <= expiredBefore) {
        this.entries.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  get size() {
    return this.entries.size;
  }
}

type HeaderReader = Pick<Headers, 'get'>;

function normalizeIpCandidate(value: string | null | undefined) {
  if (!value) return null;
  let candidate = value.trim();
  if (!candidate || candidate.length > 96 || /[\u0000-\u001f\u007f]/.test(candidate)) return null;

  const bracketed = candidate.match(/^\[([^\]]+)](?::\d{1,5})?$/);
  if (bracketed) candidate = bracketed[1];

  if (isIP(candidate) === 0) {
    const ipv4WithPort = candidate.match(/^([^:]+):(\d{1,5})$/);
    if (!ipv4WithPort || isIP(ipv4WithPort[1]) !== 4) return null;
    candidate = ipv4WithPort[1];
  }

  const version = isIP(candidate);
  if (version === 4) return candidate.split('.').map((part) => String(Number(part))).join('.');
  if (version === 6) {
    try {
      return new URL(`http://[${candidate}]/`).hostname.slice(1, -1).toLowerCase();
    } catch {
      return null;
    }
  }
  return null;
}

export function resolveAssistantClientIp(headers: HeaderReader) {
  const cloudflareIp = normalizeIpCandidate(headers.get('cf-connecting-ip'));
  if (cloudflareIp) return cloudflareIp;

  const realIp = normalizeIpCandidate(headers.get('x-real-ip'));
  if (realIp) return realIp;

  const forwarded = headers.get('x-forwarded-for');
  if (forwarded && forwarded.length <= 512) {
    for (const part of forwarded.split(',').slice(0, 5)) {
      const forwardedIp = normalizeIpCandidate(part);
      if (forwardedIp) return forwardedIp;
    }
  }

  return 'unknown';
}

function digestKeyPart(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}

export function buildAssistantRateLimitKeys(input: {
  hotelSlug: string;
  ip: string;
  contextId: string;
}) {
  const hotel = input.hotelSlug;
  const ipHash = digestKeyPart(input.ip);
  const contextHash = digestKeyPart(input.contextId);
  const hotelIp = `assistant:${hotel}:ip:${ipHash}`;
  return {
    hotelIp,
    hotelIpContext: `${hotelIp}:context:${contextHash}`,
  };
}

function retryAfter(windowMs: number, oldestTimestamp: number, now: number) {
  return Math.max(1, Math.ceil((oldestTimestamp + windowMs - now) / 1_000));
}

function evaluateTimestamps(timestamps: number[], now: number): AssistantRateLimitResult {
  const policy = ASSISTANT_RATE_LIMIT_POLICY;
  const lastTimestamp = timestamps[timestamps.length - 1];
  if (lastTimestamp !== undefined && now - lastTimestamp < policy.cooldownMs) {
    return {
      allowed: false,
      reason: 'cooldown',
      retryAfterSeconds: retryAfter(policy.cooldownMs, lastTimestamp, now),
    };
  }

  const windows = [
    { ...policy.burst, reason: 'burst' as const },
    { ...policy.minute, reason: 'minute' as const },
    { ...policy.tenMinute, reason: 'ten_minute' as const },
  ];
  for (const window of windows) {
    const active = timestamps.filter((timestamp) => timestamp > now - window.windowMs);
    if (active.length >= window.max) {
      return {
        allowed: false,
        reason: window.reason,
        retryAfterSeconds: retryAfter(window.windowMs, active[0], now),
      };
    }
  }
  return { allowed: true };
}

export class AssistantRateLimiter {
  private readonly store: AssistantRateLimitStore;

  constructor(store: AssistantRateLimitStore) {
    this.store = store;
  }

  consume(input: { hotelSlug: string; ip: string; contextId: string; now?: number }) {
    const now = input.now ?? Date.now();
    const policy = ASSISTANT_RATE_LIMIT_POLICY;
    this.store.cleanup(now - policy.tenMinute.windowMs);

    const keys = buildAssistantRateLimitKeys(input);
    const activeByKey = new Map<string, number[]>();
    for (const key of [keys.hotelIp, keys.hotelIpContext]) {
      const timestamps = (this.store.get(key)?.timestamps ?? [])
        .filter((timestamp) => timestamp > now - policy.tenMinute.windowMs);
      activeByKey.set(key, timestamps);
      const result = evaluateTimestamps(timestamps, now);
      if (!result.allowed) return result;
    }

    for (const [key, timestamps] of activeByKey) {
      this.store.set(key, { timestamps: [...timestamps, now] });
    }
    return { allowed: true } as const;
  }
}
