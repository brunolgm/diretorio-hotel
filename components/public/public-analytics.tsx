'use client';

import { useEffect } from 'react';
import type { AnalyticsEventType } from '@/lib/analytics';
import type { SupportedPublicLanguage } from '@/lib/public-language';

const EVENT_TIMESTAMP_PREFIX = 'guestdesk_public_event_ts:';
const PAGE_VIEW_COOLDOWN_MS = 15 * 1000;
const CLICK_COOLDOWN_MS = 2500;
const LANGUAGE_SELECTION_COOLDOWN_MS = 5000;

interface PublicAnalyticsProps {
  hotelSlug: string;
  language: SupportedPublicLanguage;
  serviceId?: string;
}

function getCooldownForEvent(eventType: AnalyticsEventType) {
  if (eventType === 'page_view') {
    return PAGE_VIEW_COOLDOWN_MS;
  }

  if (eventType === 'language_selected') {
    return LANGUAGE_SELECTION_COOLDOWN_MS;
  }

  return CLICK_COOLDOWN_MS;
}

function shouldTrackEvent(dedupeKey: string, cooldownMs: number) {
  if (typeof window === 'undefined') {
    return true;
  }

  const storageKey = `${EVENT_TIMESTAMP_PREFIX}${dedupeKey}`;
  const now = Date.now();
  const previousTimestamp = Number(window.sessionStorage.getItem(storageKey) || '0');

  if (previousTimestamp && now - previousTimestamp < cooldownMs) {
    return false;
  }

  window.sessionStorage.setItem(storageKey, String(now));
  return true;
}

function sendAnalyticsEvent(payload: {
  hotelSlug: string;
  eventType: AnalyticsEventType;
  language: SupportedPublicLanguage;
  departmentId?: string | null;
  serviceId?: string | null;
}) {
  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' });
    navigator.sendBeacon('/api/analytics', blob);
    return;
  }

  void fetch('/api/analytics', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body,
    keepalive: true,
  });
}

export function PublicAnalytics({
  hotelSlug,
  language,
  serviceId,
}: PublicAnalyticsProps) {
  useEffect(() => {
    const pageViewKey = `page_view:${hotelSlug}:${language}`;

    if (shouldTrackEvent(pageViewKey, PAGE_VIEW_COOLDOWN_MS)) {
      sendAnalyticsEvent({
        hotelSlug,
        eventType: 'page_view',
        language,
      });
    }

    if (serviceId && shouldTrackEvent(`service_view:${hotelSlug}:${serviceId}`, PAGE_VIEW_COOLDOWN_MS)) {
      sendAnalyticsEvent({ hotelSlug, eventType: 'service_view', language, serviceId });
    }

    function handleClick(event: MouseEvent) {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const trackedElement = target.closest<HTMLElement>('[data-analytics-event]');

      if (!trackedElement) {
        return;
      }

      const eventType = trackedElement.dataset.analyticsEvent as AnalyticsEventType | undefined;

      if (!eventType) {
        return;
      }

      const nextLanguage =
        (trackedElement.dataset.analyticsLanguage as SupportedPublicLanguage | undefined) ||
        language;

      if (eventType === 'language_selected' && nextLanguage === language) {
        return;
      }

      const dedupeKey = [
        eventType,
        hotelSlug,
        nextLanguage,
        trackedElement.dataset.analyticsDepartmentId || '',
      ].join(':');

      if (!shouldTrackEvent(dedupeKey, getCooldownForEvent(eventType))) {
        return;
      }

      sendAnalyticsEvent({
        hotelSlug,
        eventType,
        language: nextLanguage,
        departmentId: trackedElement.dataset.analyticsDepartmentId || null,
      });
    }

    document.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, [hotelSlug, language, serviceId]);

  return null;
}
