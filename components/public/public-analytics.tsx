'use client';

import { useEffect } from 'react';
import type { AnalyticsEventType } from '@/lib/analytics';
import type { SupportedPublicLanguage } from '@/lib/public-language';

const sentPageViews = new Set<string>();

interface PublicAnalyticsProps {
  hotelId: string;
  hotelSlug: string;
  language: SupportedPublicLanguage;
}

function sendAnalyticsEvent(payload: {
  hotelId: string;
  hotelSlug: string;
  eventType: AnalyticsEventType;
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
    const pageViewKey = `${hotelSlug}:${language}:${window.location.pathname}`;

    if (!sentPageViews.has(pageViewKey)) {
      sentPageViews.add(pageViewKey);
      sendAnalyticsEvent({
        hotelId,
        hotelSlug,
        eventType: 'page_view',
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

      sendAnalyticsEvent({
        hotelId,
        hotelSlug,
        eventType,
        language:
          (trackedElement.dataset.analyticsLanguage as SupportedPublicLanguage | undefined) ||
          language,
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
