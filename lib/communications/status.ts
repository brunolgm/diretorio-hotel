import type { SupabaseClient } from '@supabase/supabase-js';
import { isUuid } from '../security/identifiers.ts';
import { authorizeCommunication, communicationConflict, communicationQueryFailure, communicationTable, CommunicationStatusError, nextCommunicationVersion, requireCommunicationVersion, type CommunicationKind } from './access.ts';
export { CommunicationStatusError } from './access.ts';
export type { CommunicationKind } from './access.ts';
export type StatusAudit = (event: {
    actorUserId: string;
    hotelId: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata: {
        is_active: boolean;
    };
}) => Promise<boolean>;
/** Normal-session/RLS status operation. Version is mandatory for UI and authenticated automation. */
export async function setCommunicationStatus(client: SupabaseClient, input: {
    kind: CommunicationKind;
    id: string;
    isActive: boolean;
    expectedUpdatedAt: string;
    administratorOnly?: boolean;
}, audit: StatusAudit) {
    if (!['banner', 'announcement'].includes(input.kind) || !isUuid(input.id) || typeof input.isActive !== 'boolean')
        throw new CommunicationStatusError('invalid_input');
    requireCommunicationVersion(input.expectedUpdatedAt);
    const access = await authorizeCommunication(client, input.kind, input.administratorOnly), version = nextCommunicationVersion(input.expectedUpdatedAt);
    const r = await client.from(communicationTable(input.kind)).update({ is_active: input.isActive, updated_at: version }).eq('id', input.id).eq('hotel_id', access.hotelId).eq('updated_at', input.expectedUpdatedAt).select('id,is_active,updated_at').maybeSingle();
    if (r.error)
        communicationQueryFailure(r.error, 'status_update_unconfirmed');
    if (!r.data)
        return communicationConflict(client, input.kind, input.id, access.hotelId);
    let audited = false;
    try {
        audited = await audit({ actorUserId: access.userId, hotelId: access.hotelId, action: (input.kind === 'banner' ? 'banner' : 'announcement') + (input.isActive ? '.activated' : '.deactivated'), entityType: input.kind === 'banner' ? 'hotel_promotional_banner' : 'hotel_announcement', entityId: input.id, metadata: { is_active: input.isActive } });
    }
    catch { }
    if (!audited)
        throw new CommunicationStatusError('status_changed_audit_unconfirmed', 503);
    return { status: 'communication_status_confirmed', id: r.data.id, is_active: r.data.is_active, updated_at: r.data.updated_at };
}
