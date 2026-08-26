'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { ArrowRight, PlaneTakeoff } from 'lucide-react';
import { getSavedGuestFlightSnapshot, parseSavedGuestFlight, subscribeToGuestFlight } from '@/lib/guest-flight-storage';
import { getPublicFlightCenterCopy } from '@/lib/public-flight-center-copy';
import type { SupportedPublicLanguage } from '@/lib/public-language';

export function PublicFlightHomeCardContent({
  hotelId,
  language,
  fallbackTitle,
  fallbackDescription,
  iconClassName,
  titleClassName,
  descriptionClassName,
  ctaClassName,
}: {
  hotelId: string;
  language: SupportedPublicLanguage;
  fallbackTitle: string;
  fallbackDescription: string;
  iconClassName: string;
  titleClassName: string;
  descriptionClassName: string;
  ctaClassName: string;
}) {
  const copy = getPublicFlightCenterCopy(language);
  const subscribe = useCallback((onStoreChange: () => void) => subscribeToGuestFlight(hotelId, onStoreChange), [hotelId]);
  const getSnapshot = useCallback(() => getSavedGuestFlightSnapshot(hotelId), [hotelId]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const savedFlight = snapshot ? parseSavedGuestFlight(snapshot, hotelId) : null;
  const airline = savedFlight?.airlineCode || savedFlight?.airlineName;
  const title = savedFlight
    ? `${[airline, savedFlight.flightNumber].filter(Boolean).join(' ')} · ${savedFlight.departureAirport} → ${savedFlight.arrivalAirport}`
    : fallbackTitle;
  const description = savedFlight
    ? `${copy.homeSavedTime}: ${savedFlight.scheduledDepartureTime} · ${copy.statusNotVerified}`
    : fallbackDescription;
  const cta = savedFlight ? copy.homeViewFlight : copy.homeCardCta;

  return (
    <>
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[17px] border sm:h-14 sm:w-14 ${iconClassName}`}>
        <PlaneTakeoff className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block break-words text-base font-semibold leading-5 sm:text-lg ${titleClassName}`}>{title}</span>
        <span className={`mt-1 block break-words text-xs leading-5 sm:text-sm ${descriptionClassName}`}>{description}</span>
        <span className={`mt-2 inline-flex items-center text-xs font-semibold sm:hidden ${ctaClassName}`}>
          {cta}<ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
        </span>
      </span>
      <span className={`hidden shrink-0 items-center text-sm font-semibold sm:inline-flex ${ctaClassName}`}>
        {cta}<ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </>
  );
}
