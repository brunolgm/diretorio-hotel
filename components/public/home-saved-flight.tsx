"use client";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { ChevronRight } from "lucide-react";
import { AirlineLogo } from "./airline-logo";
import { resolveFlightAirline } from "@/lib/airline-identity";
import {
  GUEST_FLIGHT_CHANGED_EVENT,
  getSavedGuestFlightSnapshot,
  parseSavedGuestFlight,
  subscribeToGuestFlight,
  formatDeviceWallClock,
} from "@/lib/guest-flight-storage";
export function HomeSavedFlight({
  hotelId,
  href,
  language,
}: {
  hotelId: string;
  href: string;
  language: "pt" | "en" | "es";
}) {
  const subscribe = useCallback(
      (notify: () => void) => subscribeToGuestFlight(hotelId, notify),
      [hotelId],
    ),
    getSnapshot = useCallback(
      () => getSavedGuestFlightSnapshot(hotelId),
      [hotelId],
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
  if (!flight) return null;
  const resolved = resolveFlightAirline(
      flight.airlineCode || flight.airlineName,
      flight.flightNumber,
      flight,
    ),
    identifier = resolved.flightIata
      ? resolved.flightIata.slice(0, 2) + " " + resolved.flightIata.slice(2)
      : [flight.airlineCode || flight.airlineName, flight.flightNumber]
          .filter(Boolean)
          .join(" ");
  const copy =
    language === "en"
      ? {
          title: "Your saved flight",
          open: "View my flight",
          manual: "Time provided by you · saved in this browser",
        }
      : language === "es"
        ? {
            title: "Tu vuelo guardado",
            open: "Ver mi vuelo",
            manual: "Horario indicado por ti · guardado en este navegador",
          }
        : {
            title: "Seu voo salvo",
            open: "Ver meu voo",
            manual: "Horário informado por você · salvo neste navegador",
          };
  return (
    <aside
      className="v4-saved-flight"
      data-home-saved-flight
      aria-label={copy.title}
    >
      <AirlineLogo airline={resolved.airline} />
      <div>
        <p>{copy.title}</p>
        <h2>{identifier}</h2>
        <p>
          {flight.departureAirport} → {flight.arrivalAirport} ·{" "}
          {new Intl.DateTimeFormat(language, {
            day: "2-digit",
            month: "short",
            timeZone: "UTC",
          }).format(new Date(flight.departureDate + "T00:00:00Z"))}{" "}
          · {flight.scheduledDepartureTime}
        </p>
        <small>{copy.manual}</small>
      </div>
      <a href={href}>
        {copy.open}
        <ChevronRight aria-hidden />
      </a>
    </aside>
  );
}
