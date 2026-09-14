import { isTourismCategoryPair } from './catalog.ts';
import { normalizeTourismPatch } from './validation.ts';

export const TOURISM_FORM_FIELDS = [
  'name', 'type', 'category_key', 'short_description', 'full_description',
  'address', 'map_url', 'official_website_url', 'phone', 'whatsapp_number',
  'opening_hours', 'price_info', 'duration_info',
  'featured', 'recommended_by_hotel', 'is_published',
] as const;
export const TOURISM_CONFLICT_MESSAGE = 'Este item foi alterado desde que você abriu a página. Recarregue os dados antes de salvar novamente.';

export function tourismFormPatch(form: FormData) {
  if (!TOURISM_FORM_FIELDS.some((key) => form.has(key))) throw new Error('tourism_patch_empty');
  const values: Record<string, string | boolean> = {};
  for (const key of TOURISM_FORM_FIELDS) {
    const value = form.get(key);
    if (['featured', 'recommended_by_hotel', 'is_published'].includes(key)) values[key] = value === 'on';
    else {
      if (value !== null && typeof value !== 'string') throw new Error('tourism_text_required');
      values[key] = value || '';
    }
  }
  const patch = normalizeTourismPatch(values);
  if (!isTourismCategoryPair(patch.type, patch.category_key)) throw new Error('tourism_category_invalid');
  return patch;
}

export function tourismAdminError(error: { code?: string; message?: string }): string {
  if (error.code === 'PT409' || error.code === '40001' || error.message === 'tourism_revision_conflict') return TOURISM_CONFLICT_MESSAGE;
  if (error.message === 'tourism_patch_empty') return 'Informe os campos antes de salvar.';
  if (error.message === 'tourism_category_invalid') return 'Escolha um tipo e uma categoria compatíveis.';
  if (error.message === 'tourism_phone_invalid') return 'Informe telefone e WhatsApp com +, código do país e número, sem espaços.';
  if (error.message === 'tourism_url_invalid') return 'Informe uma URL HTTP/HTTPS válida, sem credenciais ou caracteres de controle.';
  if (error.message === 'tourism_text_too_long') return 'Um dos campos excede o limite permitido. Revise os textos.';
  if (error.message === 'tourism_plain_text_required') return 'Use texto simples, sem HTML ou caracteres de controle.';
  if (error.message === 'tourism_required_field') return 'Preencha nome, tipo, categoria e descrição curta.';
  if (error.code === 'P0002') return 'Item não encontrado ou indisponível para este hotel.';
  if (error.code === '42501') return 'Seu acesso ou a disponibilidade do módulo mudou. Recarregue a página.';
  if (error.message === 'tourism_order_invalid') return 'O catálogo mudou. Recarregue a lista antes de reordenar.';
  return 'Não foi possível concluir a operação. Revise os dados e tente novamente.';
}

export function moveTourismOrder(ids: string[], id: string, direction: string): string[] | null {
  if (!['up', 'down'].includes(direction)) throw new Error('tourism_order_invalid');
  const index = ids.indexOf(id);
  if (index < 0) throw new Error('tourism_order_invalid');
  const next = index + (direction === 'up' ? -1 : 1);
  if (next < 0 || next >= ids.length) return null;
  const result = [...ids];
  [result[index], result[next]] = [result[next], result[index]];
  return result;
}

export type TourismFormState = { error?: string };

export const TOURISM_FIELD_LABELS = {
  name: 'Nome', short_description: 'Descrição curta', full_description: 'Descrição completa',
  address: 'Endereço', map_url: 'Link do mapa', official_website_url: 'Site oficial',
  phone: 'Telefone', whatsapp_number: 'WhatsApp', opening_hours: 'Horário de funcionamento',
  price_info: 'Preço ou faixa de preço', duration_info: 'Duração',
} as const;
