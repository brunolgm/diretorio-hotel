import type { AnalyticsEventPayload } from '@/lib/analytics';

export type PublicAnalyticsTransport = {
  sendBeacon?: (url: string, data: Blob) => boolean;
  fetch?: (url: string, init: RequestInit) => Promise<unknown>;
};

function getBrowserTransport(): PublicAnalyticsTransport {
  return {
    sendBeacon: typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function'
      ? navigator.sendBeacon.bind(navigator)
      : undefined,
    fetch: typeof fetch === 'function' ? fetch : undefined,
  };
}

export function sendPublicAnalyticsEvent(
  payload: AnalyticsEventPayload,
  transport: PublicAnalyticsTransport = getBrowserTransport(),
) {
  const body = JSON.stringify(payload);

  try {
    if (transport.sendBeacon) {
      const accepted = transport.sendBeacon('/api/analytics', new Blob([body], { type: 'application/json' }));
      if (accepted) return;
    }
  } catch {
    // Analytics is best-effort and must never interrupt the guest action.
  }

  try {
    if (transport.fetch) {
      void transport.fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => undefined);
    }
  } catch {
    // Synchronous transport failures are intentionally ignored as well.
  }
}
