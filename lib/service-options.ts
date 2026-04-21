export const SERVICE_ICON_OPTIONS = [
  { value: 'Globe', label: 'Geral', description: 'Informações gerais e links institucionais.' },
  {
    value: 'ConciergeBell',
    label: 'Atendimento',
    description: 'Recepção, suporte e serviços gerais.',
  },
  { value: 'Coffee', label: 'Café da manhã', description: 'Café, brunch e horários matinais.' },
  {
    value: 'UtensilsCrossed',
    label: 'Restaurante',
    description: 'Alimentação e refeições principais.',
  },
  {
    value: 'BellRing',
    label: 'Room service',
    description: 'Pedidos no quarto e atendimento interno.',
  },
  {
    value: 'ShoppingBag',
    label: 'Conveniência',
    description: 'Loja, itens rápidos e conveniência.',
  },
  { value: 'Sparkles', label: 'Bem-estar', description: 'Experiências premium e relaxamento.' },
  { value: 'Heart', label: 'Lazer', description: 'Experiências leves, descanso e entretenimento.' },
  { value: 'BedDouble', label: 'Hospedagem', description: 'Quartos e estadia do hóspede.' },
  { value: 'Package', label: 'Utilidades', description: 'Amenidades, kits e itens de apoio.' },
  { value: 'Shirt', label: 'Lavanderia', description: 'Serviços de roupa e limpeza têxtil.' },
  { value: 'Dumbbell', label: 'Academia', description: 'Fitness, treino e atividade física.' },
  { value: 'Droplets', label: 'Piscina / spa', description: 'Piscina, água e relaxamento.' },
  { value: 'Wifi', label: 'Wi-Fi', description: 'Conectividade e acesso à internet.' },
  { value: 'Building2', label: 'Estrutura', description: 'Áreas físicas, espaços e instalações.' },
  { value: 'Phone', label: 'Contato', description: 'Canais de contato e comunicação.' },
  { value: 'ShieldCheck', label: 'Política', description: 'Regras, orientações e segurança.' },
  { value: 'Hotel', label: 'Hotel', description: 'Hospedagem e serviços centrais do hotel.' },
  { value: 'Info', label: 'Informações', description: 'Avisos, dicas e orientações úteis.' },
] as const;

export type ServiceIconName = (typeof SERVICE_ICON_OPTIONS)[number]['value'];

export interface ServiceIconOption {
  value: ServiceIconName;
  label: string;
  description: string;
}

export const DEFAULT_SERVICE_CATEGORIES = [
  'Alimentação',
  'Café da manhã',
  'Restaurante',
  'Conveniência',
  'Lazer',
  'Bem-estar',
  'Atendimento',
  'Hospedagem',
  'Mobilidade',
  'Utilidades',
  'Lavanderia',
  'Academia',
  'Piscina',
  'Estacionamento',
  'Wi-Fi',
  'Recepção',
  'Spa',
  'Transfer',
  'Room service',
] as const;

export function isServiceIconName(value: string | null | undefined): value is ServiceIconName {
  return SERVICE_ICON_OPTIONS.some((option) => option.value === value);
}

export function resolveServiceIconName(value: string | null | undefined): ServiceIconName {
  return isServiceIconName(value) ? value : 'Globe';
}

export function normalizeServiceCategory(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function buildServiceCategoryOptions(
  categories: Array<string | null | undefined>
) {
  const uniqueCategories = new Set<string>();

  DEFAULT_SERVICE_CATEGORIES.forEach((category) => {
    uniqueCategories.add(category);
  });

  categories.forEach((category) => {
    const normalized = normalizeServiceCategory(category);
    if (normalized) {
      uniqueCategories.add(normalized);
    }
  });

  return Array.from(uniqueCategories);
}
