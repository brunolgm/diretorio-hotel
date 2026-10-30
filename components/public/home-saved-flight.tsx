"use client";
import {
  useCallback,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { BookmarkCheck } from "lucide-react";
import { resolveFlightAirline } from "@/lib/airline-identity";
import {
  GUEST_FLIGHT_CHANGED_EVENT,
  getSavedGuestFlightSnapshot,
  parseSavedGuestFlight,
  subscribeToGuestFlight,
  formatDeviceWallClock,
} from "@/lib/guest-flight-storage";
export function useHomeSavedFlight(hotelId: string, enabled = true) {
  const subscribe = useCallback(
      (notify: () => void) => subscribeToGuestFlight(hotelId, notify),
      [hotelId],
    ),
    getSnapshot = useCallback(
      () => (enabled ? getSavedGuestFlightSnapshot(hotelId) : null),
      [hotelId, enabled],
    );
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => null),
    flight = snapshot ? parseSavedGuestFlight(snapshot, hotelId) : null;
  useEffect(() => {
    const flight = snapshot ? parseSavedGuestFlight(snapshot, hotelId) : null;
    if (!flight) return;
    let timer: ReturnType<typeof setTimeout>;
    const notify = () =>
      window.dispatchEvent(
        new CustomEvent(GUEST_FLIGHT_CHANGED_EVENT, { detail: { hotelId } }),
      );
    const arm = () => {
      const remaining =
        Date.parse(flight.expiresAt + "Z") -
        Date.parse(formatDeviceWallClock(new Date()) + "Z");
      timer = setTimeout(
        () => {
          notify();
          if (remaining > 2147483647) arm();
        },
        Math.min(Math.max(remaining + 1, 1), 2147483647),
      );
    };
    const visible = () => {
      if (document.visibilityState === "visible") notify();
    };
    arm();
    window.addEventListener("pageshow", notify);
    window.addEventListener("focus", notify);
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pageshow", notify);
      window.removeEventListener("focus", notify);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [snapshot, hotelId]);

  return flight;
}
function myFlightHref(href: string) {
  const [path, query] = href.split("?");
  const params = new URLSearchParams(query);
  params.set("tab", "meu-voo");
  return path + "?" + params;
}
export function SavedFlightLink({
  hotelId,
  href,
  enabled = true,
  children,
  className,
  ariaLabel,
}: {
  hotelId: string;
  href: string;
  enabled?: boolean;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  const flight = useHomeSavedFlight(hotelId, enabled);
  return (
    <a
      href={flight ? myFlightHref(href) : href}
      className={className}
      aria-label={ariaLabel}
      data-home-saved-flight={flight ? "true" : undefined}
    >
      {children}
    </a>
  );
}
export function FlightHomeAccess({
  hotelId,
  href,
  language,
  enabled = true,
  label,
  icon,
  arrow,
  access,
  action,
}: {
  hotelId: string;
  href: string;
  language: "pt" | "en" | "es";
  enabled?: boolean;
  label: string;
  icon: ReactNode;
  arrow: ReactNode;
  access?: string;
  action?: string;
}) {
  const flight = useHomeSavedFlight(hotelId, enabled);
  const resolved = flight
    ? resolveFlightAirline(
        flight.airlineCode || flight.airlineName,
        flight.flightNumber,
        flight,
      )
    : null;
  const identifier = resolved?.flightIata
    ? resolved.flightIata.slice(0, 2) + " " + resolved.flightIata.slice(2)
    : flight
      ? [flight.airlineCode || flight.airlineName, flight.flightNumber]
          .filter(Boolean)
          .join(" ")
      : "";
  const saved =
    language === "en"
      ? "Saved in this browser"
      : language === "es"
        ? "Guardado en este navegador"
        : "Salvo neste navegador";
  return (
    <a
      href={flight ? myFlightHref(href) : href}
      data-access={access}
      data-v4-action={action}
      data-home-saved-flight={flight ? "true" : undefined}
    >
      {icon}
      <span className="v4-flight-access-copy">
        <span>{label}</span>
        {flight ? (
          <small className="v4-flight-access-summary">
            <span>
              <b>{identifier}</b> · {flight.departureAirport} → {flight.arrivalAirport}
            </span>
            <span className="v4-flight-saved-indicator" title={saved}><BookmarkCheck aria-hidden/>
              {language === "en"
                ? "Saved"
                : language === "es"
                  ? "Guardado"
                  : "Salvo"}
            </span>
          </small>
        ) : null}
      </span>
      {arrow}
    </a>
  );
}
