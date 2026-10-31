import type { SupabaseClient } from '@supabase/supabase-js';
import { hasMinimumRole, normalizeAppRole } from '../app-roles.ts';
export class CommunicationStatusError extends Error {
    code: string;
    status: number;
    constructor(code: string, status = 400) { super(code); this.code = code; this.status = status; }
}
export type CommunicationKind = 'banner' | 'announcement';
export const communicationTable = (kind: CommunicationKind) => kind === 'banner' ? 'hotel_promotional_banners' : 'hotel_announcements';
export function requireCommunicationVersion(value: unknown): asserts value is string {
    if (typeof value !== 'string' || value.length > 64 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value)))
        throw new CommunicationStatusError('version_required', 409);
}
export function nextCommunicationVersion(expected: string, now = Date.now()) {
    requireCommunicationVersion(expected);
    return new Date(Math.max(now, Date.parse(expected) + 1)).toISOString();
}
export async function authorizeCommunication(client: SupabaseClient, kind: CommunicationKind, administratorOnly = false) {
    if (!['banner', 'announcement'].includes(kind))
        throw new CommunicationStatusError('invalid_input');
    const user = await client.auth.getUser();
    if (user.error || !user.data.user)
        throw new CommunicationStatusError('authentication_required', 401);
    const profile = await client.from('profiles').select('hotel_id,role,is_active').eq('id', user.data.user.id).single();
    const p = profile.data, role = normalizeAppRole(p?.role);
    if (profile.error || !p?.hotel_id || !p.is_active || !role || !hasMinimumRole(role, administratorOnly ? 'administrador' : 'operador'))
        throw new CommunicationStatusError('authorization_required', 403);
    const hotel = await client.from('hotels').select('platform_status').eq('id', p.hotel_id).single();
    if (hotel.error || !hotel.data || hotel.data.platform_status === 'archived')
        throw new CommunicationStatusError('hotel_unavailable', 403);
    const modules = await client.rpc('get_current_hotel_modules'), key = kind === 'banner' ? 'content.banners' : 'content.announcements';
    if (modules.error || !modules.data?.some((m: {
        module_key: string;
        is_enabled: boolean;
    }) => m.module_key === key && m.is_enabled === true))
        throw new CommunicationStatusError('module_required', 403);
    return { userId: user.data.user.id, hotelId: p.hotel_id as string };
}
/** Called only after a conditional mutation misses; this read classifies the error, never authorizes a later write. */
export async function communicationConflict(client: SupabaseClient, kind: CommunicationKind, id: string, hotelId: string): Promise<never> {
    const r = await client.from(communicationTable(kind)).select('id').eq('id', id).eq('hotel_id', hotelId).maybeSingle();
    if (r.error)
        throw new CommunicationStatusError('request_unconfirmed', 503);
    throw new CommunicationStatusError(r.data ? 'PT409' : 'record_unavailable', r.data ? 409 : 404);
}
export function communicationFailureMessage(error: unknown) {
    const code = error instanceof CommunicationStatusError ? error.code : '';
    if (['PT409', 'version_required'].includes(code))
        return 'Este registro foi alterado ou o formulário está desatualizado. Recarregue a página para consultar a versão atual antes de tentar novamente.';
    if (code.includes('audit_unconfirmed'))
        return 'A alteração foi gravada, mas a auditoria não foi confirmada. Recarregue e confira o registro antes de tentar novamente.';
    if (code === 'record_unavailable')
        return 'Registro não encontrado ou indisponível para este hotel. Recarregue a listagem.';
    if (['authorization_required', 'module_required', 'authentication_required', 'hotel_unavailable'].includes(code))
        return 'Não foi possível autorizar esta operação. Confira seu acesso e recarregue a página.';
    return 'Não foi possível confirmar a alteração agora. Recarregue e confira o registro antes de tentar novamente.';
}
export function communicationQueryFailure(error: {
    code?: string;
} | null, code: string): never { throw new CommunicationStatusError(error?.code === '42501' ? 'authorization_required' : code, error?.code === '42501' ? 403 : 503); }
