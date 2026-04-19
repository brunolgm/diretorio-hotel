'use client';

import { useEffect } from 'react';
import type { AnalyticsEventType } from '@/lib/analytics';
import type { SupportedPublicLanguage } from '@/lib/public-language';

const SESSION_ID_STORAGE_KEY = 'guestdesk_public_session_id';
const EVENT_TIMESTAMP_PREFIX = 'guestdesk_public_event_ts:';
const PAGE_VIEW_COOLDOWN_MS = 15 * 1000;
const CLICK_COOLDOWN_MS = 2500;
const LANGUAGE_SELECTION_COOLDOWN_MS = 5000;

interface PublicAnalyticsProps {
  hotelId: string;
  hotelSlug: string;
  language: SupportedPublicLanguage;
}

function getSessionId() {
  if (typeof window === 'undefined') {
    return null;
  }

  const existingSessionId = window.sessionStorage.getItem(SESSION_ID_STORAGE_KEY);

  if (existingSessionId) {
    return existingSessionId;
  }

  const generatedSessionId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  window.sessionStorage.setItem(SESSION_ID_STORAGE_KEY, generatedSessionId);
  return generatedSessionId;
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
  hotelId: string;
  hotelSlug: string;
  eventType: AnalyticsEventType;
  sessionId?: string | null;
  language: SupportedPublicLanguage;
  targetUrl?: string | null;
  departmentId?: string | null;
  metadata?: Record<string, string | null>;
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
  hotelId,
  hotelSlug,
  language,
}: PublicAnalyticsProps) {
  useEffect(() => {
    const sessionId = getSessionId();
    const pageViewKey = `page_view:${hotelSlug}:${language}`;

    if (shouldTrackEvent(pageViewKey, PAGE_VIEW_COOLDOWN_MS)) {
      sendAnalyticsEvent({
        hotelId,
        hotelSlug,
        eventType: 'page_view',
        sessionId,
        language,
      });
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
        trackedElement.dataset.analyticsTargetUrl || '',
        trackedElement.dataset.analyticsDepartmentId || '',
        trackedElement.dataset.analyticsLabel || '',
      ].join(':');

      if (!shouldTrackEvent(dedupeKey, getCooldownForEvent(eventType))) {
        return;
      }

      sendAnalyticsEvent({
        hotelId,
        hotelSlug,
        eventType,
        sessionId,
        language: nextLanguage,
        targetUrl: trackedElement.dataset.analyticsTargetUrl || null,
        departmentId: trackedElement.dataset.analyticsDepartmentId || null,
        metadata: trackedElement.dataset.analyticsLabel
          ? { label: trackedElement.dataset.analyticsLabel }
          : undefined,
      });
    }

    document.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, [hotelId, hotelSlug, language]);

  return null;
}
