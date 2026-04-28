import type { Database } from '@/types/database';

export type ServiceActionType = Database['public']['Tables']['hotel_sections']['Row']['service_action_type'];

export const DEFAULT_SERVICE_ACTION_TYPE: ServiceActionType = 'standard';

export const SERVICE_ACTION_TYPE_OPTIONS: Array<{
  value: ServiceActionType;
  label: string;
  description: string;
}> = [
  {
    value: 'standard',
    label: 'Padrão',
    description: 'Abre a página normal do serviço quando houver conteúdo interno e mantém o comportamento atual do diretório.',
  },
  {
    value: 'external_url',
    label: 'Link externo',
    description: 'Abre uma URL fixa configurada no serviço.',
  },
  {
    value: 'room_restaurant_menu',
    label: 'Cardápio por apartamento',
    description: 'Usa o QR do apartamento para abrir o cardápio correto.',
  },
];

export function normalizeServiceActionType(value: string | null | undefined): ServiceActionType {
  if (
    value === 'standard' ||
    value === 'external_url' ||
    value === 'room_restaurant_menu'
  ) {
    return value;
  }

  return DEFAULT_SERVICE_ACTION_TYPE;
}

export function getServiceActionTypeLabel(value: string | null | undefined) {
  return (
    SERVICE_ACTION_TYPE_OPTIONS.find((option) => option.value === value)?.label || 'Padrão'
  );
}

export function isRoomRestaurantMenuAction(value: string | null | undefined) {
  return normalizeServiceActionType(value) === 'room_restaurant_menu';
}

export function isExternalUrlAction(value: string | null | undefined) {
  return normalizeServiceActionType(value) === 'external_url';
}
