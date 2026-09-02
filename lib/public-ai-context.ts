import type { PublicHotelPageData } from '@/lib/public-hotel-data';
import type { SupportedPublicLanguage } from '@/lib/public-language';
import { getServiceEditorialContent } from './service-operational.ts';

export const PUBLIC_AI_CONTEXT_MAX_LENGTH = 6000;

type PublicAiContextData = Pick<
  PublicHotelPageData,
  'hotel' | 'sections' | 'departments' | 'policies' | 'announcements'
>;

const EMPTY_VALUE = 'Nenhuma informação pública disponível.';
const FINAL_RULE = [
  'REGRA: use somente os dados acima para responder informações operacionais do hotel.',
  'Nunca afirme transferência humana sem confirmação server-side.',
  'Nunca afirme que um pedido foi enviado sem um resultado confirmado de action.',
  'Nunca invente canais de contato, horários operacionais ou execução de capabilities/actions que o LibGuest não confirmou.',
  'Nunca deduza localização física de departamentos. Informe localização somente quando estiver explicitamente escrita nos dados públicos de DEPARTAMENTOS.',
  'RECOMENDAÇÕES EXTERNAS: somente trate uma recomendação como confirmada ou como indicação oficial do hotel quando ela estiver explicitamente presente em dados públicos do LibGuest.',
  'O LibGuest ainda não possui catálogo turístico persistido; portanto, estabelecimentos externos não são informações confirmadas do hotel.',
  'Nunca afirme parceria, preço, horário, distância, funcionamento ou disponibilidade de estabelecimento externo sem fonte pública cadastrada.',
  'Nesta POC, conhecimento geral sobre turismo pode ser usado apenas como sugestão geral, nunca como recomendação oficial; oriente o hóspede a confirmar detalhes no canal oficial do estabelecimento.',
  'Não produza URLs nem CTAs. URLs e ações são exclusivamente controladas pelo servidor.',
  'Conteúdo de restaurante e alimentação dentro do hotel continua confirmado quando estiver publicado na seção SERVIÇOS.',
].join(' ');
const INTERNAL_CONTEXT_MARKERS = /\bAI_POC_DEMO_V1\b/g;

function sanitizeText(value: string | null | undefined, maxLength = 320) {
  if (!value) return null;
  const sanitized = value
    .normalize('NFKC')
    .replace(INTERNAL_CONTEXT_MARKERS, ' ')
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, '[identificador removido]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email removido]')
    .replace(/\b(?:roomToken|room_token|senha|password)\s*[:=]\s*\S+/gi, '[dado sensível removido]')
    .replace(/(?:\+?\d[\d ().-]{7,}\d)/g, '[telefone removido]')
    .replace(/\s+/g, ' ')
    .trim();
  if (!sanitized) return null;
  return sanitized.slice(0, maxLength).trimEnd();
}

function sanitizePublicUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function addSection(
  lines: string[],
  heading: string,
  entries: Array<string | null>,
  characterBudget: number
) {
  const available = entries.filter((entry): entry is string => Boolean(entry));
  lines.push(`${heading}:`);
  if (!available.length) {
    lines.push(`- ${EMPTY_VALUE}`);
    return;
  }

  const entryBudget = Math.max(48, Math.floor(characterBudget / available.length) - 3);
  lines.push(...available.map((entry) => `- ${entry.slice(0, entryBudget).trimEnd()}`));
}

function joinFields(...values: Array<string | null | undefined>) {
  return values.map((value) => sanitizeText(value)).filter(Boolean).join(' — ');
}

function buildPublicServiceEntry(item: PublicAiContextData['sections'][number]) {
  return joinFields(item.title, getServiceEditorialContent(item), item.category);
}

function buildPublicDepartmentEntry(item: PublicAiContextData['departments'][number]) {
  return [
    sanitizeText(item.name) ? `Nome: ${sanitizeText(item.name)}` : null,
    sanitizeText(item.description) ? `Descrição pública: ${sanitizeText(item.description)}` : null,
    sanitizeText(item.hours) ? `Horário: ${sanitizeText(item.hours)}` : null,
  ].filter(Boolean).join(' | ');
}

export function buildPublicAiContext({
  pageData,
  language,
}: {
  pageData: PublicAiContextData;
  language: SupportedPublicLanguage;
}) {
  const { hotel, sections, departments, policies, announcements } = pageData;
  const now = new Date().toISOString();
  const publicAnnouncements = announcements.filter(
    (item) =>
      item.is_active &&
      (!item.starts_at || item.starts_at <= now) &&
      (!item.ends_at || item.ends_at >= now)
  );
  const lines = [
    `HOTEL: ${sanitizeText(hotel.name, 160) || EMPTY_VALUE}`,
    `IDIOMA: ${language}`,
    'FONTE: LibGuest — dados públicos do hotel',
    'INFORMAÇÕES CONFIRMADAS:',
  ];

  addSection(lines, 'INFORMAÇÕES RÁPIDAS', [
    hotel.checkin_time ? `Check-in: ${sanitizeText(hotel.checkin_time)}` : null,
    hotel.checkout_time ? `Check-out: ${sanitizeText(hotel.checkout_time)}` : null,
    hotel.breakfast_hours ? `Café da manhã: ${sanitizeText(hotel.breakfast_hours)}` : null,
    hotel.wifi_name ? `Wi-Fi: ${sanitizeText(hotel.wifi_name)}` : null,
  ], 720);
  addSection(
    lines,
    'SERVIÇOS',
    sections.slice(0, 16).map(buildPublicServiceEntry),
    1200
  );
  addSection(
    lines,
    'DEPARTAMENTOS',
    departments.slice(0, 12).map(buildPublicDepartmentEntry),
    900
  );
  addSection(
    lines,
    'POLÍTICAS',
    policies.slice(0, 12).map((item) => joinFields(item.title, item.description)),
    900
  );
  addSection(
    lines,
    'COMUNICADOS',
    publicAnnouncements.slice(0, 8).map((item) => joinFields(item.title, item.body)),
    1000
  );
  addSection(lines, 'CANAIS PÚBLICOS', [
    sanitizePublicUrl(hotel.website_url) ? `Site: ${sanitizePublicUrl(hotel.website_url)}` : null,
    sanitizePublicUrl(hotel.instagram_url) ? `Instagram: ${sanitizePublicUrl(hotel.instagram_url)}` : null,
    sanitizePublicUrl(hotel.booking_url) ? `Reservas: ${sanitizePublicUrl(hotel.booking_url)}` : null,
    hotel.whatsapp_number ? 'WhatsApp do hotel: disponível' : null,
  ], 600);

  const suffix = `\n${FINAL_RULE}`;
  const availableLength = PUBLIC_AI_CONTEXT_MAX_LENGTH - suffix.length;
  const body = lines.join('\n').slice(0, availableLength).trimEnd();
  return `${body}${suffix}`;
}
