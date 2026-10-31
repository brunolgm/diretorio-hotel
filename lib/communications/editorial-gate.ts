import { communicationEligible, publicCommunications } from '../public-communications.ts';
import type { PublicHotelAnnouncement, PublicHotelPromotionalBanner } from '../public-hotel-data.ts';
export const BUGAN_DEMO_HOTEL_ID = '5eb7d695-ccf7-4594-b9df-fc46aaa25695';
/** Reviewed identity registry from the canonical P0 evidence, not a text filter or persisted attribute. */
export const KNOWN_DEMO_COMMUNICATIONS = [
    { kind: 'announcement', id: '69e72156-1e45-43dc-87e1-33c690291b54' },
    { kind: 'announcement', id: '5babf6c1-dbc1-4821-aa98-8c87a26add8d' },
    { kind: 'announcement', id: '574684ff-e441-4712-9cf0-c40079ec5a8b' },
    { kind: 'announcement', id: '0b08ba8d-0e4e-4bb6-ab12-7fdd064a73f3' },
    { kind: 'banner', id: 'e1f4222d-bb17-4990-9cbf-12c1b9c5a04b' },
    { kind: 'banner', id: '0b012d35-0b6b-49d8-a357-fa53b657be4f' },
    { kind: 'banner', id: '2aa0e949-b306-4862-891b-e54c46e6d0da' },
] as const;
export function evaluateCommunicationEditorialGate(input: {
    hotelId: string;
    announcements: PublicHotelAnnouncement[];
    banners: PublicHotelPromotionalBanner[];
    now?: number;
    functionalPassed?: boolean;
}) {
    const now = input.now ?? Date.now(), model = publicCommunications(input.hotelId, input.announcements, input.banners, now);
    const publicAnnouncements = new Set([...model.alerts, ...model.updates, ...model.promotions].map(r => r.id));
    const projectedBanners = new Set(model.banners.map(r => r.id));
    const violations = input.hotelId === BUGAN_DEMO_HOTEL_ID ? KNOWN_DEMO_COMMUNICATIONS.flatMap(known => {
        const row = (known.kind === 'banner' ? input.banners : input.announcements).find(r => r.id === known.id && r.hotel_id === input.hotelId);
        if (!row || !communicationEligible(row, input.hotelId, now) || (known.kind === 'announcement' && !publicAnnouncements.has(row.id)))
            return [];
        return [{ ...known, projected: known.kind === 'banner' ? projectedBanners.has(row.id) : true, reason: 'known_demo_eligible' as const }];
    }) : [];
    return { checkedAt: new Date(now).toISOString(), hotelId: input.hotelId, functional: input.functionalPassed === undefined ? 'not_assessed' : input.functionalPassed ? 'green' : 'red', editorial: violations.length ? 'red' : 'green', violations, scope: 'seven_known_identities; canonical tenant/status/validity/content eligibility; banners beyond carousel cap remain eligible; layout/module visibility not asserted; unknown demo identities require review' };
}
