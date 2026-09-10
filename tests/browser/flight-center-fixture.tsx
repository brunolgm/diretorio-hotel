// Synthetic local scenarios, never evidence of a real flight or hotel configuration.
import { createRoot } from 'react-dom/client';
import { HotelPublicFlightCenter } from '../../components/public/hotel-public-flight-center';
import { createSavedGuestFlight } from '../../lib/guest-flight-storage';
import type { PublicFlightCenterData } from '../../lib/public-hotel-data';
import type { DomainContext } from '../../lib/domain-context';
import type { SupportedPublicLanguage } from '../../lib/public-language';

const params = new URLSearchParams(location.search);
const theme = params.get('theme') || 'grand-mercure';
const language = (params.get('lang') || 'pt') as SupportedPublicLanguage;
const scenario = params.get('scenario') || 'outside';
const hotelId = `50200000-0000-4000-8000-00000000000${['grand-mercure', 'novotel', 'mercure', 'default'].indexOf(theme) + 1}`;
const date = scenario === 'outside' ? '2026-09-20' : '2026-09-09';
const result = createSavedGuestFlight(hotelId, { airline: 'LA', flightNumber: '3530', departureAirport: 'GIG', arrivalAirport: 'VIX', departureDate: date, scheduledDepartureTime: '23:15' });
if (!result.ok) throw new Error(`Invalid synthetic flight: ${JSON.stringify(result.errors)}`);
localStorage.setItem(`libguest:flight:${hotelId}:v1`, JSON.stringify(result.flight));

// Fail closed: every browser fetch is handled locally or rejected. No real API.
const calls: string[] = [];
Object.assign(window, { fixtureCalls: calls });
window.fetch = async (input) => {
  const url = String(input);
  calls.push(url);
  if (url === '/api/analytics') return Response.json({ ok: true });
  if (url === '/api/flights/route-context') return Response.json({ travelType: scenario === 'generic' ? 'unknown' : 'domestic' });
  if (url === '/api/flights/status') {
    if (['not_found', 'service_unavailable', 'rate_limited'].includes(scenario)) return Response.json({ ok: false, error: scenario }, { status: 503 });
    return Response.json({ ok: true, data: {
      airlineCode: 'LA', flightNumber: '3530', departureAirport: 'GIG', arrivalAirport: 'VIX',
      scheduledDeparture: { local: `${date}T23:45:00`, utc: `${date === '2026-09-09' ? '2026-09-10' : '2026-09-21'}T02:45:00Z` },
      scheduleStatus: 'active', departureTerminal: '2', departureGate: 'B12',
      provenance: { provider: 'airlabs', schedule: 'matched', fetchedAt: '2026-09-09T12:00:00Z' },
    } });
  }
  throw new Error(`Unexpected fixture request: ${url}`);
};
navigator.sendBeacon = () => false;

const data = {
  hotel: { id: hotelId, slug: hotelId, name: theme === 'grand-mercure' ? 'Grand Mercure Copacabana' : `${theme} Fixture`, theme_preset: theme, theme_primary_color: null, logo_url: null, hero_image_url: null, whatsapp_number: '5521999999999' },
  airports: [{ iataCode: 'GIG', name: 'Aeroporto Internacional do Rio de Janeiro', city: 'Rio de Janeiro', timezone: 'America/Sao_Paulo', officialDeparturesUrl: 'https://www.riogaleao.com/', officialArrivalsUrl: 'https://www.riogaleao.com/', estimatedTransferMinutes: 40, domesticLeadMinutes: 120, internationalLeadMinutes: 180, safetyMarginMinutes: 30 }],
  navigationAvailability: { services: true, menu: false, information: true, contact: true },
  settings: { departurePlanningEnabled: true, officialLinksEnabled: true, departureNotice: null, transferEnabled: true, wakeUpEnabled: true, breakfastBoxEnabled: params.get('breakfast') === '1', receptionEnabled: true },
} as PublicFlightCenterData;
if (params.has('services')) {
  const count = Number(params.get('services'));
  data.settings.transferEnabled = count > 0;
  data.settings.wakeUpEnabled = count > 1;
  data.settings.breakfastBoxEnabled = count > 2;
  data.settings.receptionEnabled = count > 3;
}
createRoot(document.getElementById('root')!).render(<HotelPublicFlightCenter data={data} language={language} tab="meu-voo"
  domainContext={{ kind: 'localhost', shouldUseSlugFallback: true } as DomainContext} preferSubdomainRoot={false} />);
