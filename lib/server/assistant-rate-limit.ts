import 'server-only';

import {
  AssistantRateLimiter,
  InMemoryAssistantRateLimitStore,
  resolveAssistantClientIp,
} from './assistant-rate-limit-core.ts';

// IN-MEMORY RATE LIMIT IS NOT PRODUCTION-SAFE IN MULTI-INSTANCE ENVIRONMENTS.
// Replace this store with a shared Redis/Upstash/Vercel KV adapter before production rollout.
const processLocalStore = new InMemoryAssistantRateLimitStore();
const processLocalLimiter = new AssistantRateLimiter(processLocalStore);

export { resolveAssistantClientIp };

export async function consumeAssistantRateLimit(input: {
  hotelSlug: string;
  ip: string;
  contextId: string;
}) {
  return processLocalLimiter.consume(input);
}
