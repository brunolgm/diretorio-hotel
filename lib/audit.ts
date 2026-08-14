import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { logOperationalError } from '@/lib/services/translation-admin';
import type { Json } from '@/types/database';

export async function recordAdminAuditEvent({
  actorUserId,
  hotelId,
  action,
  entityType,
  entityId = null,
  metadata = {},
  requestId = null,
}: {
  actorUserId: string;
  hotelId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Json;
  requestId?: string | null;
}) {
  const adminClient = createAdminClient();
  const { error } = await adminClient.rpc('record_admin_audit_event', {
    p_actor_user_id: actorUserId,
    p_hotel_id: hotelId,
    p_action: action,
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_metadata: metadata,
    p_request_id: requestId,
  });

  if (error) {
    logOperationalError({
      module: 'audit',
      action: 'recordAdminAuditEvent',
      operation: action,
      hotelId,
      targetId: entityId || undefined,
      error: 'Persistent audit write failed',
    });
    return false;
  }

  return true;
}
