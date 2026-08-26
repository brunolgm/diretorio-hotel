'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { recordAdminAuditEvent } from '@/lib/audit';
import { requireHotelModule } from '@/lib/admin-entitlements';
import { requireAdminAccess } from '@/lib/auth';
import { readCheckboxBoolean, readNullableString, readTrimmedString } from '@/lib/form-utils';
import { isUuid } from '@/lib/security/identifiers';
import {
  buildFeedbackRedirect,
  buildOperationalErrorMessage,
  logOperationalError,
} from '@/lib/services/translation-admin';
import { createClient } from '@/lib/supabase/server';

const ADMIN_FLIGHTS_PATH = '/admin/voos';

type NumberRule = { label: string; min: number; max: number; nullable?: boolean };

function fail(message: string): never {
  redirect(buildFeedbackRedirect(ADMIN_FLIGHTS_PATH, { error: message }));
}

function readBoundedInteger(formData: FormData, key: string, rule: NumberRule) {
  const raw = readTrimmedString(formData, key);
  if (!raw && rule.nullable) return null;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < rule.min || value > rule.max) {
    fail(`${rule.label} deve ser um número inteiro entre ${rule.min} e ${rule.max}.`);
  }
  return value;
}

function validateOptionalText(value: string | null, label: string, max: number) {
  if (value && value.length > max) fail(`${label} deve ter no máximo ${max} caracteres.`);
  return value;
}

async function requireFlightEditor() {
  const context = await requireAdminAccess('editor');
  await requireHotelModule('travel.flights');
  return context;
}

function finish(success: string): never {
  revalidatePath(ADMIN_FLIGHTS_PATH);
  redirect(buildFeedbackRedirect(ADMIN_FLIGHTS_PATH, { success }));
}

export async function updateFlightSettingsAction(formData: FormData) {
  const { user, profile } = await requireFlightEditor();
  const supabase = await createClient();
  const payload = {
    home_card_enabled: readCheckboxBoolean(formData, 'home_card_enabled'),
    transfer_enabled: readCheckboxBoolean(formData, 'transfer_enabled'),
    wake_up_enabled: readCheckboxBoolean(formData, 'wake_up_enabled'),
    breakfast_box_enabled: readCheckboxBoolean(formData, 'breakfast_box_enabled'),
    reception_enabled: readCheckboxBoolean(formData, 'reception_enabled'),
    official_links_enabled: readCheckboxBoolean(formData, 'official_links_enabled'),
    departure_planning_enabled: readCheckboxBoolean(formData, 'departure_planning_enabled'),
    home_card_title: validateOptionalText(readNullableString(formData, 'home_card_title'), 'O título do card', 120),
    home_card_description: validateOptionalText(readNullableString(formData, 'home_card_description'), 'A descrição do card', 280),
    departure_notice: validateOptionalText(readNullableString(formData, 'departure_notice'), 'A orientação de saída', 500),
  };

  const { data: existing, error: readError } = await supabase
    .from('hotel_flight_settings')
    .select('hotel_id')
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle();
  if (readError) fail('Não foi possível conferir as configurações atuais.');

  const { error } = existing
    ? await supabase
        .from('hotel_flight_settings')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('hotel_id', profile.hotel_id)
    : await supabase
        .from('hotel_flight_settings')
        .insert({ hotel_id: profile.hotel_id, ...payload });

  if (error) {
    logOperationalError({ module: 'flights', action: 'updateFlightSettingsAction', operation: 'save settings', hotelId: profile.hotel_id, error });
    fail(buildOperationalErrorMessage('as configurações da Central de Voos', 'salvar'));
  }

  await recordAdminAuditEvent({
    actorUserId: user.id,
    hotelId: profile.hotel_id,
    action: 'flight.settings_updated',
    entityType: 'hotel_flight_settings',
    entityId: profile.hotel_id,
    metadata: {
      home_card_enabled: payload.home_card_enabled,
      official_links_enabled: payload.official_links_enabled,
      departure_planning_enabled: payload.departure_planning_enabled,
    },
  });

  finish('Configurações da Central de Voos salvas com sucesso.');
}

export async function addHotelAirportAction(formData: FormData) {
  const { user, profile } = await requireFlightEditor();
  const supabase = await createClient();
  const airportId = readTrimmedString(formData, 'airport_id');
  if (!isUuid(airportId)) fail('Selecione um aeroporto válido.');

  const [{ data: airport, error: airportError }, { data: configured, error: configuredError }] = await Promise.all([
    supabase.from('airports').select('id, iata_code, name, is_active').eq('id', airportId).eq('is_active', true).maybeSingle(),
    supabase.from('hotel_airports').select('airport_id, sort_order').eq('hotel_id', profile.hotel_id).order('sort_order'),
  ]);

  if (airportError || !airport || !airport.is_active) fail('Esse aeroporto não está disponível no catálogo ativo.');
  if (configuredError) fail('Não foi possível conferir os aeroportos configurados.');
  if ((configured || []).some((item) => item.airport_id === airportId)) fail('Esse aeroporto já está configurado para o hotel.');
  if ((configured || []).length >= 20) fail('O limite de 20 aeroportos configurados foi atingido.');

  const usedOrders = new Set((configured || []).map((item) => item.sort_order));
  const maximumOrder = (configured || []).reduce((max, item) => Math.max(max, item.sort_order), 0);
  const sortOrder = maximumOrder < 20
    ? maximumOrder + 1
    : Array.from({ length: 20 }, (_, index) => index + 1).find((position) => !usedOrders.has(position));
  if (!sortOrder) fail('Não há uma posição disponível para adicionar este aeroporto.');
  const { error } = await supabase.from('hotel_airports').insert({
    hotel_id: profile.hotel_id,
    airport_id: airportId,
    sort_order: sortOrder,
    is_active: true,
  });

  if (error) {
    logOperationalError({ module: 'flights', action: 'addHotelAirportAction', operation: 'add airport', hotelId: profile.hotel_id, targetId: airportId, error });
    fail(buildOperationalErrorMessage('o aeroporto', 'adicionar', 'Verifique se ele já está configurado e tente novamente.'));
  }

  await recordAdminAuditEvent({
    actorUserId: user.id,
    hotelId: profile.hotel_id,
    action: 'flight.airport_added',
    entityType: 'hotel_airport',
    entityId: airportId,
    metadata: { iata_code: airport.iata_code, sort_order: sortOrder },
  });

  finish(`${airport.iata_code} adicionado à Central de Voos.`);
}

export async function updateHotelAirportAction(formData: FormData) {
  const { user, profile } = await requireFlightEditor();
  const supabase = await createClient();
  const airportId = readTrimmedString(formData, 'airport_id');
  if (!isUuid(airportId)) fail('Aeroporto inválido para atualização.');

  const { data: airport } = await supabase
    .from('airports')
    .select('id, iata_code, is_active')
    .eq('id', airportId)
    .eq('is_active', true)
    .maybeSingle();
  if (!airport) fail('Esse aeroporto não está disponível no catálogo ativo.');

  const payload = {
    is_active: readCheckboxBoolean(formData, 'is_active'),
    estimated_transfer_minutes: readBoundedInteger(formData, 'estimated_transfer_minutes', { label: 'O tempo estimado', min: 0, max: 1440, nullable: true }),
    domestic_lead_minutes: readBoundedInteger(formData, 'domestic_lead_minutes', { label: 'A antecedência para voos nacionais', min: 0, max: 2880, nullable: true }),
    international_lead_minutes: readBoundedInteger(formData, 'international_lead_minutes', { label: 'A antecedência para voos internacionais', min: 0, max: 2880, nullable: true }),
    safety_margin_minutes: readBoundedInteger(formData, 'safety_margin_minutes', { label: 'A margem de segurança', min: 0, max: 720, nullable: true }),
    updated_at: new Date().toISOString(),
  };

  const { data: updated, error } = await supabase
    .from('hotel_airports')
    .update(payload)
    .eq('hotel_id', profile.hotel_id)
    .eq('airport_id', airportId)
    .select('airport_id')
    .maybeSingle();

  if (error || !updated) {
    logOperationalError({ module: 'flights', action: 'updateHotelAirportAction', operation: 'update airport', hotelId: profile.hotel_id, targetId: airportId, error: error || 'Association not found' });
    fail(buildOperationalErrorMessage('as informações do aeroporto', 'salvar'));
  }

  await recordAdminAuditEvent({
    actorUserId: user.id,
    hotelId: profile.hotel_id,
    action: 'flight.airport_updated',
    entityType: 'hotel_airport',
    entityId: airportId,
    metadata: { iata_code: airport.iata_code, is_active: payload.is_active },
  });

  finish(`${airport.iata_code} atualizado com sucesso.`);
}

export async function removeHotelAirportAction(formData: FormData) {
  const { user, profile } = await requireFlightEditor();
  const supabase = await createClient();
  const airportId = readTrimmedString(formData, 'airport_id');
  if (!isUuid(airportId)) fail('Aeroporto inválido para remoção.');

  const { data: removed, error } = await supabase
    .from('hotel_airports')
    .delete()
    .eq('hotel_id', profile.hotel_id)
    .eq('airport_id', airportId)
    .select('airport_id, sort_order')
    .maybeSingle();

  if (error || !removed) {
    logOperationalError({ module: 'flights', action: 'removeHotelAirportAction', operation: 'remove airport', hotelId: profile.hotel_id, targetId: airportId, error: error || 'Association not found' });
    fail(buildOperationalErrorMessage('o aeroporto', 'remover'));
  }

  await recordAdminAuditEvent({
    actorUserId: user.id,
    hotelId: profile.hotel_id,
    action: 'flight.airport_removed',
    entityType: 'hotel_airport',
    entityId: airportId,
    metadata: { previous_sort_order: removed.sort_order },
  });

  finish('Aeroporto removido da Central de Voos.');
}

export async function moveHotelAirportAction(formData: FormData) {
  const { profile } = await requireFlightEditor();
  const supabase = await createClient();
  const airportId = readTrimmedString(formData, 'airport_id');
  const direction = readTrimmedString(formData, 'direction');
  if (!isUuid(airportId) || !['up', 'down'].includes(direction)) fail('Movimentação de aeroporto inválida.');

  const { data: configured, error: readError } = await supabase
    .from('hotel_airports')
    .select('airport_id, sort_order')
    .eq('hotel_id', profile.hotel_id)
    .order('sort_order');
  if (readError) fail('Não foi possível carregar a ordem dos aeroportos.');

  const orderedIds = (configured || []).map((item) => item.airport_id);
  const currentIndex = orderedIds.indexOf(airportId);
  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= orderedIds.length) {
    redirect(ADMIN_FLIGHTS_PATH);
  }
  [orderedIds[currentIndex], orderedIds[targetIndex]] = [orderedIds[targetIndex], orderedIds[currentIndex]];

  const { error } = await supabase.rpc('reorder_current_hotel_airports', { p_airport_ids: orderedIds });
  if (error) {
    logOperationalError({ module: 'flights', action: 'moveHotelAirportAction', operation: 'reorder airports', hotelId: profile.hotel_id, targetId: airportId, error });
    fail(buildOperationalErrorMessage('a ordem dos aeroportos', 'atualizar'));
  }

  finish('Ordem dos aeroportos atualizada.');
}
