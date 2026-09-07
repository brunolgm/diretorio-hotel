'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { recommendHotelDeparture, type FlightPlanning, type FlightPlanningAirport } from '@/lib/guest-flight-planning';
import type { FlightDisplay } from '@/lib/guest-flight-status';
import type { SavedGuestFlight } from '@/lib/guest-flight-storage';
import type { TravelType } from '@/lib/flights/route-context';
import { getFlightPlanningCopy } from '@/lib/public-flight-center-copy';
import type { SupportedPublicLanguage } from '@/lib/public-language';

export function GuestFlightPlanning({ hotelSlug, flight, airport, planning, data, language, fallback }: {
  hotelSlug: string; flight: SavedGuestFlight; airport: FlightPlanningAirport | null; planning: FlightPlanning;
  data: FlightDisplay | null; language: SupportedPublicLanguage; fallback: ReactNode;
}) {
  const [context, setContext] = useState<{ key: string; travelType: TravelType } | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const departureAirport = flight.departureAirport, arrivalAirport = flight.arrivalAirport;
  const key = `${hotelSlug}:${departureAirport}:${arrivalAirport}`;
  const eligible = planning.enabled && airport?.iataCode === departureAirport;
  useEffect(() => {
    if (!eligible) return;
    let mounted = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    queueMicrotask(async () => {
      if (!mounted) return;
      try {
        const response = await fetch('/api/flights/route-context', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hotelSlug, departureAirport, arrivalAirport }), cache: 'no-store', signal: controller.signal });
        const result: unknown = await response.json();
        const type = result && typeof result === 'object' && 'travelType' in result ? result.travelType : null;
        if (mounted) setContext({ key, travelType: response.ok && (type === 'domestic' || type === 'international') ? type : 'unknown' });
      } catch { if (mounted) setContext({ key, travelType: 'unknown' }); }
      finally { clearTimeout(timeout); }
    });
    return () => { mounted = false; clearTimeout(timeout); controller.abort(); };
  }, [eligible, key, hotelSlug, departureAirport, arrivalAirport]);

  const recommendation = recommendHotelDeparture({ enabled: eligible, airport, flight, data,
    travelType: context?.key === key ? context.travelType : 'unknown', now: now ?? NaN });
  const expires = recommendation.available ? Date.parse(recommendation.recommendedDepartureAt) : null;
  useEffect(() => {
    const update = () => setNow(Date.now());
    queueMicrotask(update);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const expire = () => {
      if (expires === null) return;
      const remaining = expires - Date.now() + 1;
      if (remaining <= 0) update();
      else timer = setTimeout(expire, Math.min(2147483647, remaining));
    };
    expire();
    return () => { clearTimeout(timer); window.removeEventListener('focus', update); document.removeEventListener('visibilitychange', update); };
  }, [expires]);
  if (!recommendation.available) return <div className="mt-5">{fallback}</div>;
  const copy = getFlightPlanningCopy(language);
  const locale = language === 'pt' ? 'pt-BR' : language === 'es' ? 'es-ES' : 'en-US';
  const format = (instant: string, date = false) => new Intl.DateTimeFormat(locale, { timeZone: recommendation.timezone,
    ...(date ? { day: '2-digit', month: 'short' } as const : { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } as const),
  }).format(new Date(instant));
  return <aside className="mt-5 min-w-0 rounded-[20px] border border-[color:var(--hotel-accent-border)] bg-[var(--hotel-accent-soft)] p-4 sm:p-5" data-flight-recommendation>
    <h3 className="text-xs font-semibold uppercase tracking-[.1em] text-[color:var(--hotel-primary)]">{copy.title}</h3>
    <p className="mt-2 text-4xl font-semibold tabular-nums text-[color:var(--hotel-primary)]"><time dateTime={recommendation.recommendedDepartureAt}>{format(recommendation.recommendedDepartureAt)}</time></p>
    <p className="mt-1 text-xs text-[color:var(--hotel-text-muted)]">{format(recommendation.recommendedDepartureAt, true)} · {copy.local}</p>
    <dl className="mt-4 max-w-xl space-y-2 text-sm text-[color:var(--hotel-text)]">
      {[[copy.scheduled, `${format(recommendation.scheduledDepartureAt, true)} · ${format(recommendation.scheduledDepartureAt)}`], [copy.lead, `${recommendation.lead} min`], [copy.transfer, `${recommendation.transfer} min`], [copy.margin, `${recommendation.margin} min`]].map(([label, value]) =>
        <div key={label} className="flex items-baseline justify-between gap-3"><dt className="min-w-0">{label}</dt><dd className="shrink-0 font-semibold tabular-nums">{value}</dd></div>)}
    </dl>
    <div className="mt-4 space-y-1 border-t border-[color:var(--hotel-accent-border)] pt-3 text-xs leading-5 text-[color:var(--hotel-text-muted)]">
      <p>{copy[recommendation.basis]}</p><p>{copy.estimate}</p><p>{copy.official}</p>
      {planning.notice ? <p>{planning.notice}</p> : null}
    </div>
  </aside>;
}
