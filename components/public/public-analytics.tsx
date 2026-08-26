'use client';

import { useEffect } from 'react';
import { isFlightServiceAnalyticsAction, type AnalyticsEventType } from '@/lib/analytics';
import { sendPublicAnalyticsEvent } from '@/lib/public-analytics-client';
import type { SupportedPublicLanguage } from '@/lib/public-language';

const EVENT_TIMESTAMP_PREFIX = 'guestdesk_public_event_ts:';
const PAGE_VIEW_COOLDOWN_MS = 15 * 1000;
const CLICK_COOLDOWN_MS = 2500;
const LANGUAGE_SELECTION_COOLDOWN_MS = 5000;

interface PublicAnalyticsProps {
  hotelSlug: string;
  language: SupportedPublicLanguage;
  serviceId?: string;
  pageEventType?: 'page_view' | 'flight_center_view';
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

export function PublicAnalytics({
  hotelSlug,
  language,
  serviceId,
  pageEventType = 'page_view',
}: PublicAnalyticsProps) {
  useEffect(() => {
    const pageViewKey = `${pageEventType}:${hotelSlug}:${language}`;

    if (shouldTrackEvent(pageViewKey, PAGE_VIEW_COOLDOWN_MS)) {
      sendPublicAnalyticsEvent({
        hotelSlug,
        eventType: pageEventType,
        language,
      });
    }

    if (serviceId && shouldTrackEvent(`service_view:${hotelSlug}:${serviceId}`, PAGE_VIEW_COOLDOWN_MS)) {
      sendPublicAnalyticsEvent({ hotelSlug, eventType: 'service_view', language, serviceId });
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
      const analyticsAction = trackedElement.dataset.analyticsAction;
      const action = analyticsAction && isFlightServiceAnalyticsAction(analyticsAction)
        ? analyticsAction
        : null;

      if (eventType === 'language_selected' && nextLanguage === language) {
        return;
      }

      const dedupeKey = [
        eventType,
        hotelSlug,
        nextLanguage,
        trackedElement.dataset.analyticsDepartmentId || '',
        action || '',
      ].join(':');

      if (!shouldTrackEvent(dedupeKey, getCooldownForEvent(eventType))) {
        return;
      }

      sendPublicAnalyticsEvent({
        hotelSlug,
        eventType,
        language: nextLanguage,
        departmentId: trackedElement.dataset.analyticsDepartmentId || null,
        ...(action ? { action } : {}),
      });
    }

    document.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, [hotelSlug, language, pageEventType, serviceId]);

  return null;
}
