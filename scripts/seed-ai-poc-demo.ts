import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.ts';

export const AI_POC_MARKER = 'AI_POC_DEMO_V1';
export const AI_POC_PREFIX = '[DEMO]';
export const AI_POC_HOTEL_SLUG = 'grandmercureriocopacabana';

const FIXTURE_PATH = resolve('poc/ai-demo/04_DADOS_DEMO_LIBGUEST_POC.json');
const SECTION_IDS = Array.from({ length: 6 }, (_, index) => `a1000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`);
const DEPARTMENT_IDS = Array.from({ length: 4 }, (_, index) => `a2000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`);
const POLICY_IDS = Array.from({ length: 4 }, (_, index) => `a3000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`);
const ANNOUNCEMENT_IDS = ['a4000000-0000-4000-8000-000000000001'];

type LocalEnvironment = Record<string, string | undefined>;
type LocalClient = SupabaseClient<Database>;
type HotelQuickInfo = Pick<
  Database['public']['Tables']['hotels']['Row'],
  'checkin_time' | 'checkout_time' | 'breakfast_hours' | 'wifi_name'
>;
type SeedHotel = Pick<Database['public']['Tables']['hotels']['Row'], 'id' | 'slug'> & HotelQuickInfo;

type DemoFixture = {
  metadata: { scope: string; marker: string };
  hotel: { slug: string; displayName: string };
  quickInfo: Array<{ key: string; label: string; value: string }>;
  services: Array<{ title: string; description: string; hours: string }>;
  departments: Array<{ name: string; description: string; hours: string }>;
  policies: Array<{ title: string; description: string }>;
  announcements: Array<{ title: string; message: string }>;
};

const SERVICE_TRANSLATIONS = {
  en: [
    ['[DEMO] Gym', 'Exercise area available to hotel guests.', '6am–11pm'],
    ['[DEMO] Pool', 'Leisure area subject to the hotel safety rules.', '8am–8pm'],
    ['[DEMO] Breakfast', 'Demonstration buffet served in the restaurant.', 'Mon–Fri, 6:30am–10:30am; Sat–Sun, 7am–11am'],
    ['[DEMO] Restaurant', 'Contemporary cuisine in a casual setting.', '12pm–10:30pm'],
    ['[DEMO] Bar', 'Drinks and snacks.', '4pm–11pm'],
    ['[DEMO] Luggage storage', 'Luggage storage subject to confirmation by reception.', '24 hours'],
  ],
  es: [
    ['[DEMO] Gimnasio', 'Espacio de ejercicios disponible para los huéspedes.', '6h–23h'],
    ['[DEMO] Piscina', 'Área de ocio sujeta a las normas de seguridad del hotel.', '8h–20h'],
    ['[DEMO] Desayuno', 'Buffet demostrativo servido en el restaurante.', 'Lun–vie, 6h30–10h30; sáb–dom, 7h–11h'],
    ['[DEMO] Restaurante', 'Cocina contemporánea en un ambiente informal.', '12h–22h30'],
    ['[DEMO] Bar', 'Bebidas y aperitivos.', '16h–23h'],
    ['[DEMO] Equipaje', 'Guardaequipaje sujeto a confirmación de recepción.', '24 horas'],
  ],
} as const;

const DEPARTMENT_TRANSLATIONS = {
  en: [
    ['[DEMO] Reception', 'General assistance, information and guest support.', '24 hours'],
    ['[DEMO] Housekeeping', 'Room items, cleaning and linen.', '8am–10pm'],
    ['[DEMO] Maintenance', 'Support for technical issues in the room.', '8am–10pm'],
    ['[DEMO] Reservations', 'Guidance about reservations and future stays.', '8am–6pm'],
  ],
  es: [
    ['[DEMO] Recepción', 'Atención general, información y soporte al huésped.', '24 horas'],
    ['[DEMO] Gobernanza', 'Artículos de la habitación, limpieza y ropa de cama.', '8h–22h'],
    ['[DEMO] Mantenimiento', 'Soporte para incidencias técnicas en la habitación.', '8h–22h'],
    ['[DEMO] Reservas', 'Orientación sobre reservas y futuras estancias.', '8h–18h'],
  ],
} as const;

const POLICY_TRANSLATIONS = {
  en: [
    ['[DEMO] Smoke-free environment', 'Smoking is not allowed in rooms or indoor areas.'],
    ['[DEMO] Visitors', 'Visitors must contact reception and follow the hotel rules.'],
    ['[DEMO] Valuables', 'Use the safe and confirm guidance with reception.'],
    ['[DEMO] Quiet hours', 'Avoid excessive noise between 10pm and 8am.'],
  ],
  es: [
    ['[DEMO] Ambiente sin humo', 'No está permitido fumar en las habitaciones ni en áreas interiores.'],
    ['[DEMO] Visitantes', 'Los visitantes deben acudir a recepción y seguir las normas del hotel.'],
    ['[DEMO] Objetos de valor', 'Utilice la caja fuerte y confirme las indicaciones con recepción.'],
    ['[DEMO] Silencio', 'Evite ruidos excesivos entre las 22h y las 8h.'],
  ],
} as const;

const ANNOUNCEMENT_TRANSLATIONS = {
  en: ['[DEMO] Virtual Assistant test content', 'This information is fictional and exists only to validate the GPTMaker + LibGuest integration.'],
  es: ['[DEMO] Contenido de prueba del Asistente Virtual', 'Esta información es ficticia y existe únicamente para validar la integración GPTMaker + LibGuest.'],
} as const;

export function assertLocalAiPocEnvironment(environment: LocalEnvironment) {
  if (environment.NODE_ENV === 'production' || environment.VERCEL || environment.VERCEL_ENV) {
    throw new Error('AI POC seed refused: production and Vercel environments are forbidden.');
  }

  const configuredUrls = [environment.NEXT_PUBLIC_SUPABASE_URL, environment.SUPABASE_URL].filter(
    (value): value is string => Boolean(value)
  );
  if (!configuredUrls.length) throw new Error('AI POC seed refused: local Supabase URL is required.');

  for (const configuredUrl of configuredUrls) {
    let hostname: string;
    try {
      hostname = new URL(configuredUrl).hostname;
    } catch {
      throw new Error('AI POC seed refused: invalid Supabase URL.');
    }
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(hostname)) {
      throw new Error(`AI POC seed refused: non-local Supabase host ${hostname}.`);
    }
  }
}

export function isDemoValue(value: string | null | undefined) {
  return Boolean(value?.trim().startsWith(AI_POC_PREFIX));
}

export function buildSafeQuickInfoUpdate(current: HotelQuickInfo, fixture: DemoFixture) {
  const quickInfo = new Map(fixture.quickInfo.map((item) => [item.key, item.value]));
  const candidates: HotelQuickInfo = {
    checkin_time: quickInfo.get('check_in') || null,
    checkout_time: quickInfo.get('check_out') || null,
    breakfast_hours: quickInfo.get('breakfast') || null,
    wifi_name: quickInfo.get('wifi') || null,
  };
  return Object.fromEntries(
    Object.entries(candidates).filter(([key]) => {
      const existing = current[key as keyof HotelQuickInfo];
      return !existing || isDemoValue(existing);
    })
  ) as Partial<HotelQuickInfo>;
}

export function buildDemoQuickInfoCleanup(current: HotelQuickInfo) {
  return Object.fromEntries(
    Object.entries(current).filter(([, value]) => isDemoValue(value)).map(([key]) => [key, null])
  ) as Partial<HotelQuickInfo>;
}

export function assertDemoOwnership(rows: Array<{ id: string; hotelId: string; marker: string }>, expectedHotelId: string) {
  const collision = rows.find((row) => row.hotelId !== expectedHotelId || !isDemoValue(row.marker));
  if (collision) throw new Error(`AI POC seed refused: fixture id collision at ${collision.id}.`);
}

export function buildDemoRecords(fixture: DemoFixture, hotelId: string) {
  if (fixture.metadata.scope !== 'LOCAL_POC_ONLY' || fixture.metadata.marker !== AI_POC_MARKER) {
    throw new Error('AI POC seed refused: fixture scope or marker is invalid.');
  }
  if (fixture.hotel.slug !== AI_POC_HOTEL_SLUG) {
    throw new Error('AI POC seed refused: fixture targets an unexpected hotel.');
  }
  if (
    fixture.services.length !== SECTION_IDS.length ||
    fixture.departments.length !== DEPARTMENT_IDS.length ||
    fixture.policies.length !== POLICY_IDS.length ||
    fixture.announcements.length !== ANNOUNCEMENT_IDS.length
  ) throw new Error('AI POC seed refused: fixture cardinality changed; review it explicitly.');

  const sections: Database['public']['Tables']['hotel_sections']['Insert'][] = fixture.services.map((item, index) => ({
    id: SECTION_IDS[index], hotel_id: hotelId, title: item.title, content: `${item.description} Horário: ${item.hours}`,
    category: AI_POC_MARKER, service_action_type: 'standard', enabled: true, sort_order: 900 + index,
  }));
  const departments: Database['public']['Tables']['hotel_departments']['Insert'][] = fixture.departments.map((item, index) => ({
    id: DEPARTMENT_IDS[index], hotel_id: hotelId, name: item.name, description: item.description,
    hours: item.hours, enabled: true,
  }));
  const policies: Database['public']['Tables']['hotel_policies']['Insert'][] = fixture.policies.map((item, index) => ({
    id: POLICY_IDS[index], hotel_id: hotelId, title: item.title, description: item.description, enabled: true,
  }));
  const announcements: Database['public']['Tables']['hotel_announcements']['Insert'][] = fixture.announcements.map((item, index) => ({
    id: ANNOUNCEMENT_IDS[index], hotel_id: hotelId, title: item.title, body: item.message,
    category: 'informativo', is_active: true, starts_at: null, ends_at: null,
  }));

  const sectionTranslations: Database['public']['Tables']['hotel_section_translations']['Insert'][] = (['en', 'es'] as const).flatMap((language) =>
    SECTION_IDS.map((sectionId, index) => ({ section_id: sectionId, language, title: SERVICE_TRANSLATIONS[language][index][0], content: `${SERVICE_TRANSLATIONS[language][index][1]} Hours: ${SERVICE_TRANSLATIONS[language][index][2]}`, cta: null, category: AI_POC_MARKER }))
  );
  const departmentTranslations: Database['public']['Tables']['hotel_department_translations']['Insert'][] = (['en', 'es'] as const).flatMap((language) =>
    DEPARTMENT_IDS.map((departmentId, index) => ({ department_id: departmentId, language, name: DEPARTMENT_TRANSLATIONS[language][index][0], description: `${DEPARTMENT_TRANSLATIONS[language][index][1]} ${DEPARTMENT_TRANSLATIONS[language][index][2]}`, action: null }))
  );
  const policyTranslations: Database['public']['Tables']['hotel_policy_translations']['Insert'][] = (['en', 'es'] as const).flatMap((language) =>
    POLICY_IDS.map((policyId, index) => ({ policy_id: policyId, language, title: POLICY_TRANSLATIONS[language][index][0], description: POLICY_TRANSLATIONS[language][index][1] }))
  );
  const announcementTranslations: Database['public']['Tables']['hotel_announcement_translations']['Insert'][] = (['en', 'es'] as const).map((language) => ({
    announcement_id: ANNOUNCEMENT_IDS[0], language, title: ANNOUNCEMENT_TRANSLATIONS[language][0], body: ANNOUNCEMENT_TRANSLATIONS[language][1],
  }));

  return { sections, departments, policies, announcements, sectionTranslations, departmentTranslations, policyTranslations, announcementTranslations };
}

async function loadFixture() {
  return JSON.parse(await readFile(FIXTURE_PATH, 'utf8')) as DemoFixture;
}

function throwOnError(error: { message: string } | null, operation: string) {
  if (error) throw new Error(`AI POC ${operation} failed: ${error.message}`);
}

async function verifyNoFixtureIdCollisions(client: LocalClient, hotelId: string) {
  const [sections, departments, policies, announcements] = await Promise.all([
    client.from('hotel_sections').select('id,hotel_id,title').in('id', SECTION_IDS),
    client.from('hotel_departments').select('id,hotel_id,name').in('id', DEPARTMENT_IDS),
    client.from('hotel_policies').select('id,hotel_id,title').in('id', POLICY_IDS),
    client.from('hotel_announcements').select('id,hotel_id,title').in('id', ANNOUNCEMENT_IDS),
  ]);
  for (const result of [sections, departments, policies, announcements]) throwOnError(result.error, 'ownership check');
  assertDemoOwnership([
    ...(sections.data || []).map((row) => ({ id: row.id, hotelId: row.hotel_id, marker: row.title })),
    ...(departments.data || []).map((row) => ({ id: row.id, hotelId: row.hotel_id, marker: row.name })),
    ...(policies.data || []).map((row) => ({ id: row.id, hotelId: row.hotel_id, marker: row.title })),
    ...(announcements.data || []).map((row) => ({ id: row.id, hotelId: row.hotel_id, marker: row.title })),
  ], hotelId);
}

async function seedDemo(client: LocalClient, fixture: DemoFixture, hotel: SeedHotel) {
  await verifyNoFixtureIdCollisions(client, hotel.id);
  const records = buildDemoRecords(fixture, hotel.id);
  const quickInfoUpdate = buildSafeQuickInfoUpdate(hotel, fixture);
  if (Object.keys(quickInfoUpdate).length) {
    const result = await client.from('hotels').update(quickInfoUpdate).eq('id', hotel.id).eq('slug', AI_POC_HOTEL_SLUG);
    throwOnError(result.error, 'quick-info update');
  }

  const results = await Promise.all([
    client.from('hotel_sections').upsert(records.sections, { onConflict: 'id' }),
    client.from('hotel_departments').upsert(records.departments, { onConflict: 'id' }),
    client.from('hotel_policies').upsert(records.policies, { onConflict: 'id' }),
    client.from('hotel_announcements').upsert(records.announcements, { onConflict: 'id' }),
  ]);
  for (const result of results) throwOnError(result.error, 'content upsert');

  const translationResults = await Promise.all([
    client.from('hotel_section_translations').upsert(records.sectionTranslations, { onConflict: 'section_id,language' }),
    client.from('hotel_department_translations').upsert(records.departmentTranslations, { onConflict: 'department_id,language' }),
    client.from('hotel_policy_translations').upsert(records.policyTranslations, { onConflict: 'policy_id,language' }),
    client.from('hotel_announcement_translations').upsert(records.announcementTranslations, { onConflict: 'announcement_id,language' }),
  ]);
  for (const result of translationResults) throwOnError(result.error, 'translation upsert');
}

async function cleanupDemo(client: LocalClient, hotel: SeedHotel) {
  const quickInfoCleanup = buildDemoQuickInfoCleanup(hotel);
  if (Object.keys(quickInfoCleanup).length) {
    const result = await client.from('hotels').update(quickInfoCleanup).eq('id', hotel.id).eq('slug', AI_POC_HOTEL_SLUG);
    throwOnError(result.error, 'quick-info cleanup');
  }
  const results = await Promise.all([
    client.from('hotel_sections').delete().eq('hotel_id', hotel.id).in('id', SECTION_IDS).like('title', `${AI_POC_PREFIX}%`),
    client.from('hotel_departments').delete().eq('hotel_id', hotel.id).in('id', DEPARTMENT_IDS).like('name', `${AI_POC_PREFIX}%`),
    client.from('hotel_policies').delete().eq('hotel_id', hotel.id).in('id', POLICY_IDS).like('title', `${AI_POC_PREFIX}%`),
    client.from('hotel_announcements').delete().eq('hotel_id', hotel.id).in('id', ANNOUNCEMENT_IDS).like('title', `${AI_POC_PREFIX}%`),
  ]);
  for (const result of results) throwOnError(result.error, 'cleanup');
}

async function main() {
  assertLocalAiPocEnvironment(process.env);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error('AI POC seed refused: local service-role environment is incomplete.');

  const client = createClient<Database>(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const hotelResult = await client
    .from('hotels')
    .select('id,slug,checkin_time,checkout_time,breakfast_hours,wifi_name')
    .eq('slug', AI_POC_HOTEL_SLUG)
    .maybeSingle();
  throwOnError(hotelResult.error, 'hotel lookup');
  if (!hotelResult.data) throw new Error(`AI POC seed refused: local hotel ${AI_POC_HOTEL_SLUG} was not found.`);

  const command = process.argv[2];
  if (command === 'seed') {
    await seedDemo(client, await loadFixture(), hotelResult.data);
    console.log(`AI POC demo populated locally for ${AI_POC_HOTEL_SLUG}.`);
  } else if (command === 'cleanup') {
    await cleanupDemo(client, hotelResult.data);
    console.log(`AI POC demo removed locally for ${AI_POC_HOTEL_SLUG}.`);
  } else {
    throw new Error('Usage: seed-ai-poc-demo.ts seed|cleanup');
  }
}

const executedDirectly = process.argv[1] && resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (executedDirectly) void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'AI POC seed failed.');
  process.exitCode = 1;
});
