'use client';

import { useCallback, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { AlertTriangle, Info, Pencil, Plane, Trash2 } from 'lucide-react';
import {
  createSavedGuestFlight,
  getSavedGuestFlightSnapshot,
  hasSavedGuestFlightDeparted,
  parseSavedGuestFlight,
  removeGuestFlight,
  saveGuestFlight,
  subscribeToGuestFlight,
  type GuestFlightDraft,
  type GuestFlightField,
  type GuestFlightValidationErrors,
  type SavedGuestFlight,
} from '@/lib/guest-flight-storage';
import { getPublicFlightCenterCopy } from '@/lib/public-flight-center-copy';
import type { SupportedPublicLanguage } from '@/lib/public-language';

const EMPTY_DRAFT: GuestFlightDraft = {
  airline: '',
  flightNumber: '',
  departureAirport: '',
  arrivalAirport: '',
  departureDate: '',
  scheduledDepartureTime: '',
};

const INPUT_CLASS = 'mt-2 h-12 w-full min-w-0 rounded-[13px] border border-[color:var(--hotel-border)] bg-[var(--hotel-surface)] px-4 text-base text-[color:var(--hotel-text)] outline-none transition focus:ring-2 focus:ring-[var(--hotel-accent)]';

function draftFromFlight(flight: SavedGuestFlight): GuestFlightDraft {
  return {
    airline: flight.airlineCode || flight.airlineName || '',
    flightNumber: flight.flightNumber,
    departureAirport: flight.departureAirport,
    arrivalAirport: flight.arrivalAirport,
    departureDate: flight.departureDate,
    scheduledDepartureTime: flight.scheduledDepartureTime,
  };
}

function formatFlightDate(date: string, language: SupportedPublicLanguage) {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(language === 'pt' ? 'pt-BR' : language === 'es' ? 'es-ES' : 'en-US', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export function GuestFlightManager({ hotelId, language }: {
  hotelId: string;
  language: SupportedPublicLanguage;
}) {
  const copy = getPublicFlightCenterCopy(language);
  const subscribe = useCallback((onStoreChange: () => void) => subscribeToGuestFlight(hotelId, onStoreChange), [hotelId]);
  const getSnapshot = useCallback(() => getSavedGuestFlightSnapshot(hotelId), [hotelId]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const flight = snapshot ? parseSavedGuestFlight(snapshot, hotelId) : null;
  const [editingOverride, setEditingOverride] = useState<boolean | null>(null);
  const editing = editingOverride ?? !flight;
  const [draft, setDraft] = useState<GuestFlightDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<GuestFlightValidationErrors>({});
  const [storageError, setStorageError] = useState(false);
  const fieldRefs = useRef<Partial<Record<GuestFlightField, HTMLInputElement | null>>>({});

  function updateField(field: GuestFlightField, value: string) {
    const normalized = field === 'departureAirport' || field === 'arrivalAirport'
      ? value.replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase()
      : field === 'flightNumber'
        ? value.replace(/\s+/g, '').slice(0, 8).toUpperCase()
        : value;
    setDraft((current) => ({ ...current, [field]: normalized }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setStorageError(false);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = createSavedGuestFlight(hotelId, draft);
    if (!result.ok) {
      setErrors(result.errors);
      const firstInvalidField = (Object.keys(result.errors) as GuestFlightField[])[0];
      if (firstInvalidField) fieldRefs.current[firstInvalidField]?.focus();
      return;
    }
    if (!saveGuestFlight(hotelId, result.flight)) {
      setStorageError(true);
      return;
    }
    setDraft(draftFromFlight(result.flight));
    setErrors({});
    setEditingOverride(false);
  }

  function remove() {
    removeGuestFlight(hotelId);
    setDraft(EMPTY_DRAFT);
    setErrors({});
    setStorageError(false);
    setEditingOverride(true);
  }

  if (flight && !editing) {
    const airline = flight.airlineCode || flight.airlineName;
    const identifier = [airline, flight.flightNumber].filter(Boolean).join(' ');
    const departed = hasSavedGuestFlightDeparted(flight);
    return (
      <article className="hotel-public-content-card relative overflow-hidden rounded-[26px] border border-[color:var(--hotel-border)] bg-[var(--hotel-surface)] p-5 shadow-[var(--hotel-card-shadow)] sm:p-6 md:p-8" data-saved-guest-flight>
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[19px] bg-[var(--hotel-accent-soft)] text-[color:var(--hotel-accent)]"><Plane className="h-7 w-7" aria-hidden="true" /></div>
          <div className="min-w-0 flex-1">
            <p className="break-words text-xl font-semibold text-[color:var(--hotel-primary)] sm:text-2xl">{identifier}</p>
            <p className="mt-1 text-base font-semibold text-[color:var(--hotel-text)]">{flight.departureAirport} → {flight.arrivalAirport}</p>
          </div>
        </div>
        <div className="mt-5 rounded-[18px] border border-[color:var(--hotel-border)] bg-[var(--hotel-surface-muted)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[.12em] text-[color:var(--hotel-text-muted)]">{copy.localTimeLabel}</p>
          <p className="mt-1 text-lg font-semibold text-[color:var(--hotel-primary)]">{formatFlightDate(flight.departureDate, language)} · {flight.scheduledDepartureTime}</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><dt className="text-[color:var(--hotel-text-muted)]">{copy.origin}</dt><dd className="mt-1 font-semibold text-[color:var(--hotel-primary)]">{flight.departureAirport}</dd></div>
            <div><dt className="text-[color:var(--hotel-text-muted)]">{copy.destination}</dt><dd className="mt-1 font-semibold text-[color:var(--hotel-primary)]">{flight.arrivalAirport}</dd></div>
            <div><dt className="text-[color:var(--hotel-text-muted)]">{copy.sourceLabel}</dt><dd className="mt-1 font-semibold text-[color:var(--hotel-primary)]">{copy.providedByYou}</dd></div>
            <div><dt className="text-[color:var(--hotel-text-muted)]">{copy.statusLabel}</dt><dd className="mt-1 font-semibold text-[color:var(--hotel-primary)]">{copy.statusNotVerified}</dd></div>
          </dl>
        </div>
        <p className={`mt-4 flex gap-2 text-sm leading-6 ${departed ? 'font-medium text-amber-800' : 'text-[color:var(--hotel-text-muted)]'}`}>
          {departed ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /> : <Info className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--hotel-accent)]" aria-hidden="true" />}
          {departed ? copy.pastFlightWarning : copy.officialCheckNotice}
        </p>
        <div className="mt-6 flex flex-col gap-2 min-[360px]:flex-row">
          <button type="button" onClick={() => { setDraft(draftFromFlight(flight)); setEditingOverride(true); }} className="inline-flex min-h-11 items-center justify-center rounded-[14px] bg-[var(--hotel-accent)] px-5 text-sm font-semibold text-[color:var(--hotel-accent-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hotel-accent)] focus-visible:ring-offset-2"><Pencil className="mr-2 h-4 w-4" aria-hidden="true" />{copy.editFlight}</button>
          <button type="button" onClick={remove} className="inline-flex min-h-11 items-center justify-center rounded-[14px] border border-[color:var(--hotel-border)] bg-[var(--hotel-surface)] px-5 text-sm font-semibold text-[color:var(--hotel-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hotel-accent)] focus-visible:ring-offset-2"><Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />{copy.removeFlight}</button>
        </div>
      </article>
    );
  }

  const fields: Array<{ field: GuestFlightField; label: string; type: string; placeholder?: string; inputMode?: 'text' | 'numeric'; maxLength?: number }> = [
    { field: 'airline', label: copy.airline, type: 'text', placeholder: copy.airlinePlaceholder, inputMode: 'text', maxLength: 60 },
    { field: 'flightNumber', label: copy.flightNumber, type: 'text', placeholder: copy.flightPlaceholder, inputMode: 'text', maxLength: 8 },
    { field: 'departureAirport', label: copy.origin, type: 'text', placeholder: 'GIG', inputMode: 'text', maxLength: 3 },
    { field: 'arrivalAirport', label: copy.destination, type: 'text', placeholder: 'REC', inputMode: 'text', maxLength: 3 },
    { field: 'departureDate', label: copy.date, type: 'date' },
    { field: 'scheduledDepartureTime', label: copy.plannedTime, type: 'time' },
  ];

  return (
    <article className="hotel-public-content-card relative overflow-hidden rounded-[26px] border border-[color:var(--hotel-border)] bg-[var(--hotel-surface)] p-5 shadow-[var(--hotel-card-shadow)] sm:p-6 md:p-8" data-guest-flight-form>
      <div className="flex h-14 w-14 items-center justify-center rounded-[19px] bg-[var(--hotel-accent-soft)] text-[color:var(--hotel-accent)]"><Plane className="h-7 w-7" aria-hidden="true" /></div>
      <h2 className="mt-5 text-2xl font-semibold text-[color:var(--hotel-primary)]">{copy.myFlightTitle}</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-[color:var(--hotel-text-muted)]">{copy.myFlightDescription}</p>
      <form className="mt-6 max-w-2xl" onSubmit={submit} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map(({ field, label, ...input }) => {
            const error = errors[field];
            const errorId = `${field}-error`;
            return (
              <div key={field}>
                <label htmlFor={`guest-flight-${field}`} className="text-sm font-medium text-[color:var(--hotel-primary)]">{label}{field === 'airline' ? <span className="ml-1 font-normal text-[color:var(--hotel-text-muted)]">({copy.optional})</span> : null}</label>
                <input
                  {...input}
                  ref={(element) => { fieldRefs.current[field] = element; }}
                  id={`guest-flight-${field}`}
                  name={field}
                  value={draft[field]}
                  onChange={(event) => updateField(field, event.target.value)}
                  autoComplete="off"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? errorId : undefined}
                  className={`${INPUT_CLASS} ${error ? 'border-red-500' : ''}`}
                />
                {error ? <p id={errorId} className="mt-1.5 text-xs leading-5 text-red-700">{copy.validation[field]}</p> : null}
              </div>
            );
          })}
        </div>
        <p className="mt-4 flex gap-2 text-xs leading-5 text-[color:var(--hotel-text-muted)]"><Info className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--hotel-accent)]" aria-hidden="true" />{copy.preparationNotice}</p>
        {storageError ? <p className="mt-3 text-sm text-red-700" role="alert">{copy.storageUnavailable}</p> : null}
        <div className="mt-5 flex flex-col gap-2 min-[360px]:flex-row">
          <button type="submit" className="inline-flex min-h-11 items-center justify-center rounded-[14px] bg-[var(--hotel-accent)] px-5 text-sm font-semibold text-[color:var(--hotel-accent-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hotel-accent)] focus-visible:ring-offset-2">{copy.saveFlight}</button>
          {flight ? <button type="button" onClick={() => { setDraft(draftFromFlight(flight)); setErrors({}); setEditingOverride(false); }} className="inline-flex min-h-11 items-center justify-center rounded-[14px] border border-[color:var(--hotel-border)] px-5 text-sm font-semibold text-[color:var(--hotel-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hotel-accent)] focus-visible:ring-offset-2">{copy.cancelEdit}</button> : null}
        </div>
      </form>
    </article>
  );
}
