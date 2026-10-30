'use client';

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { createGuestStatusController, guestStatusQuery, showManualFlightNotice } from '@/lib/guest-flight-status';
import type { SavedGuestFlight } from '@/lib/guest-flight-storage';
import { getPremiumFlightCopy, getPublicFlightCenterCopy } from '@/lib/public-flight-center-copy';
import type { SupportedPublicLanguage } from '@/lib/public-language';
import { GuestFlightPlanning } from '@/components/public/guest-flight-planning';
import { FlightVerifiedSummary } from '@/components/public/flight-verified-summary';
import type { FlightPlanning, FlightPlanningAirport } from '@/lib/guest-flight-planning';

export function GuestFlightStatus({ flight, hotelSlug, timezone, language, manual, compactManual, notice, planning, airport, planningFallback, premium=false }: {
  premium?:boolean;
  flight: SavedGuestFlight; hotelSlug: string; timezone: string | null; language: SupportedPublicLanguage;
  manual: ReactNode; compactManual: ReactNode; notice: ReactNode;
  planning: FlightPlanning; airport: FlightPlanningAirport | null; planningFallback: ReactNode;
}) {
  const copy = getPublicFlightCenterCopy(language).flightData;
  const premiumCopy=getPremiumFlightCopy(language);
  const [controller] = useState(() => createGuestStatusController(guestStatusQuery(flight, hotelSlug, timezone,airport?.countryCode)));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    let mounted = true;
    // StrictMode's discarded effect never sends a request. No render-driven retry.
    queueMicrotask(() => { if (mounted) void controller.refresh(); });
    return () => { mounted = false; controller.cancel(); };
  }, [controller]);
  const data = state.data;
  const message = state.error === 'outside_provider_window' ? copy.outside
    : state.error === 'unverifiable' || state.error === 'provider_window_unverified' ? copy.unverifiable
    : state.error === 'not_found' ? copy.notFound
    : ['quota_exhausted','quota_exceeded','rate_limited','in_progress'].includes(state.error ?? '') ? copy.limited : copy.unavailable;
  const updated = data ? new Intl.DateTimeFormat(language === 'pt' ? 'pt-BR' : language === 'es' ? 'es-ES' : 'en-US', {
    timeZone: timezone ?? 'UTC', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(data.updatedAt)) : null;
  return (
    <>
    {!data ? manual : null}
    <section className="mt-3 min-w-0" aria-label={copy.title} aria-busy={state.loading} data-guest-flight-status data-verified={Boolean(data)}>
      <h3 className="sr-only">{copy.title}</h3>
      {data ? premium ? <FlightVerifiedSummary data={data} language={language} timezone={timezone} stale={Boolean(state.error)}/> : <>
        <p className="mt-2 w-fit max-w-full break-words rounded-[14px] bg-[var(--hotel-accent-soft)] px-4 py-2 text-2xl font-semibold text-[color:var(--hotel-primary)] sm:text-3xl" data-flight-operational-status>{copy.statuses[data.status]}</p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-[repeat(auto-fit,minmax(120px,1fr))]">
          <div className="min-w-0"><dt className="text-sm text-[color:var(--hotel-text-muted)]">{copy.scheduled}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums text-[color:var(--hotel-primary)]">{data.scheduled.slice(11, 16)}<span className="block text-sm font-normal">{new Intl.DateTimeFormat(language, { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(new Date(`${data.scheduled.slice(0, 10)}T12:00:00Z`))}</span></dd></div>
          {data.updated && data.updatedKind ? <div className="min-w-0"><dt className="text-sm text-[color:var(--hotel-text-muted)]">{copy[data.updatedKind]}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums text-[color:var(--hotel-primary)]">{data.updated.slice(11, 16)}</dd></div> : null}
          {data.terminal ? <div className="min-w-0"><dt className="text-sm text-[color:var(--hotel-text-muted)]">{copy.terminal}</dt><dd className="mt-1 break-words font-semibold text-[color:var(--hotel-primary)]">{data.terminal}</dd></div> : null}
          {data.gate ? <div className="min-w-0"><dt className="text-sm text-[color:var(--hotel-text-muted)]">{copy.gate}</dt><dd className="mt-1 break-words font-semibold text-[color:var(--hotel-primary)]">{data.gate}</dd></div> : null}
        </dl>
        <div className="mt-3 text-sm leading-5 text-[color:var(--hotel-text-muted)]">
          {data.live ? <p className="font-semibold text-[color:var(--hotel-accent)]">{copy.live}</p> : null}
          <p>{copy.updated}: {updated} · {copy.source}</p><p>{copy.local}</p>
        </div>
      </> : <p className="mt-2 text-lg font-semibold text-[color:var(--hotel-primary)]">{getPublicFlightCenterCopy(language).statusNotVerified}</p>}
      <p className="mt-2 text-sm leading-5 text-[color:var(--hotel-text-muted)]" role="status" aria-live="polite">{state.loading ? copy.loading : state.error ? message : state.waiting ? (premium?premiumCopy.waiting:copy.waiting) : null}</p>
      <button type="button" disabled={state.loading || state.waiting || state.error === 'unverifiable'} onClick={() => void controller.refresh()}
        className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[14px] border border-[color:var(--hotel-border)] px-3 text-sm font-semibold text-[color:var(--hotel-primary)] disabled:cursor-wait disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hotel-accent)] sm:w-auto">
        <RefreshCw aria-hidden="true" className={`h-4 w-4 shrink-0 ${state.loading ? 'animate-spin motion-reduce:animate-none' : ''}`} />{copy.refresh}
      </button>
    </section>
    {data ? compactManual : null}
    {showManualFlightNotice(data) ? notice : null}
    <GuestFlightPlanning hotelSlug={hotelSlug} flight={flight} airport={airport} planning={planning} data={data} language={language} fallback={planningFallback} />
    </>
  );
}
