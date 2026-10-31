import type { SupabaseClient } from '@supabase/supabase-js';
import { isUuid } from '../security/identifiers.ts';
import { authorizeCommunication, communicationConflict, communicationQueryFailure, communicationTable, CommunicationStatusError, nextCommunicationVersion, requireCommunicationVersion, type CommunicationKind } from './access.ts';
export { communicationFailureMessage } from './access.ts';
export type CommunicationAudit = (event: {
    actorUserId: string;
    hotelId: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata: Record<string, string | boolean | number | null>;
    requestId?: string;
}) => Promise<boolean>;
export const EDITORIAL_FIELDS = { announcement: ['title', 'body', 'category', 'starts_at', 'ends_at'], banner: ['title', 'subtitle', 'cta_label', 'cta_url', 'starts_at', 'ends_at', 'display_order'] } as const;
export function communicationEditorialPatch(kind: CommunicationKind, operation: 'content' | 'image' | 'translations', changes: Record<string, unknown>) {
    const allowed: readonly string[] = operation === 'content' ? EDITORIAL_FIELDS[kind] : operation === 'image' && kind === 'banner' ? ['image_url'] : operation === 'translations' ? [] : [];
    if ((operation === 'image' && kind !== 'banner') || Object.keys(changes).some(key => !allowed.includes(key)))
        throw new CommunicationStatusError('invalid_editorial_fields');
    return { ...changes };
}
export async function confirmCommunicationAudit(audit: CommunicationAudit, event: Parameters<CommunicationAudit>[0]) {
    let ok = false;
    try {
        ok = await audit({ ...event, requestId: event.requestId ?? crypto.randomUUID() });
    }
    catch { }
    if (!ok)
        throw new CommunicationStatusError('write_audit_unconfirmed', 503);
}
export async function updateCommunicationEditorial(client: SupabaseClient, input: {
    kind: CommunicationKind;
    id: string;
    hotelId: string;
    expectedUpdatedAt: string;
    changes: Record<string, unknown>;
    operation?: 'content' | 'image' | 'translations';
    auditAction?: string;
}, audit: CommunicationAudit) {
    if (!['banner', 'announcement'].includes(input.kind) || !isUuid(input.id) || !isUuid(input.hotelId))
        throw new CommunicationStatusError('invalid_input');
    requireCommunicationVersion(input.expectedUpdatedAt);
    const operation = input.operation ?? 'content', patch = communicationEditorialPatch(input.kind, operation, input.changes), access = await authorizeCommunication(client, input.kind);
    if (access.hotelId !== input.hotelId)
        throw new CommunicationStatusError('authorization_required', 403);
    const version = nextCommunicationVersion(input.expectedUpdatedAt);
    // The version predicate is part of the mutation itself, including tenant and resource scopes.
    const r = await client.from(communicationTable(input.kind)).update({ ...patch, updated_at: version }).eq('id', input.id).eq('hotel_id', access.hotelId).eq('updated_at', input.expectedUpdatedAt).select('*').maybeSingle();
    if (r.error)
        communicationQueryFailure(r.error, 'content_update_unconfirmed');
    if (!r.data)
        return communicationConflict(client, input.kind, input.id, access.hotelId);
    await confirmCommunicationAudit(audit, { actorUserId: access.userId, hotelId: access.hotelId, action: input.auditAction ?? (input.kind === 'banner' ? 'banner' : 'announcement') + (operation === 'translations' ? '.translation_requested' : '.updated'), entityType: input.kind === 'banner' ? 'hotel_promotional_banner' : 'hotel_announcement', entityId: input.id, metadata: { operation, submitted_fields: Object.keys(patch).join(','), previous_version: input.expectedUpdatedAt, updated_at: version } });
    return r.data;
}
export async function readCommunicationVersion(client: SupabaseClient, input: {
    kind: CommunicationKind;
    id: string;
    hotelId: string;
    expectedUpdatedAt: string;
}) {
    requireCommunicationVersion(input.expectedUpdatedAt);
    if (!isUuid(input.id))
        throw new CommunicationStatusError('invalid_input');
    const access = await authorizeCommunication(client, input.kind);
    if (access.hotelId !== input.hotelId)
        throw new CommunicationStatusError('authorization_required', 403);
    const r = await client.from(communicationTable(input.kind)).select('*').eq('id', input.id).eq('hotel_id', access.hotelId).maybeSingle();
    if (r.error)
        throw new CommunicationStatusError('request_unconfirmed', 503);
    if (!r.data)
        throw new CommunicationStatusError('record_unavailable', 404);
    if (r.data.updated_at !== input.expectedUpdatedAt)
        throw new CommunicationStatusError('PT409', 409);
    return r.data;
}
export async function deleteCommunication(client: SupabaseClient, input: {
    kind: CommunicationKind;
    id: string;
    hotelId: string;
    expectedUpdatedAt: string;
}, audit: CommunicationAudit) {
    requireCommunicationVersion(input.expectedUpdatedAt);
    if (!isUuid(input.id))
        throw new CommunicationStatusError('invalid_input');
    const access = await authorizeCommunication(client, input.kind);
    if (access.hotelId !== input.hotelId)
        throw new CommunicationStatusError('authorization_required', 403);
    const r = await client.from(communicationTable(input.kind)).delete().eq('id', input.id).eq('hotel_id', access.hotelId).eq('updated_at', input.expectedUpdatedAt).select('*').maybeSingle();
    if (r.error)
        communicationQueryFailure(r.error, 'content_delete_unconfirmed');
    if (!r.data)
        return communicationConflict(client, input.kind, input.id, access.hotelId);
    await confirmCommunicationAudit(audit, { actorUserId: access.userId, hotelId: access.hotelId, action: (input.kind === 'banner' ? 'banner' : 'announcement') + '.deleted', entityType: input.kind === 'banner' ? 'hotel_promotional_banner' : 'hotel_announcement', entityId: input.id, metadata: { previous_version: input.expectedUpdatedAt } });
    return r.data;
}
