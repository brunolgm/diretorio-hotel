export const HOTEL_READINESS_CATEGORIES = [
  'identity',
  'access',
  'operations',
  'content',
  'experience',
  'publication',
] as const;

export type HotelReadinessCategory = (typeof HOTEL_READINESS_CATEGORIES)[number];
export type HotelReadinessSeverity = 'blocking' | 'warning';

export const HOTEL_READINESS_CHECK_CATALOG = [
  { key: 'identity.name', category: 'identity', severity: 'blocking', label: 'Nome do hotel', description: 'Informe o nome público da propriedade.', href: '/admin/hotel' },
  { key: 'identity.city', category: 'identity', severity: 'blocking', label: 'Cidade', description: 'Informe a cidade da propriedade.', href: '/admin/hotel' },
  { key: 'identity.slug', category: 'publication', severity: 'blocking', label: 'Slug público', description: 'Mantenha um slug canônico e válido.', href: undefined },
  { key: 'identity.subdomain', category: 'publication', severity: 'blocking', label: 'Subdomínio', description: 'Mantenha um subdomínio canônico e válido.', href: undefined },
  { key: 'admin.active', category: 'access', severity: 'blocking', label: 'Administrador ativo', description: 'O hotel precisa de pelo menos um administrador ativo.', href: '/admin/usuarios' },
  { key: 'module.core_directory', category: 'publication', severity: 'blocking', label: 'Diretório principal', description: 'O módulo principal precisa estar habilitado pela plataforma.', href: undefined },
  { key: 'operation.checkin', category: 'operations', severity: 'warning', label: 'Horário de check-in', description: 'Informe o horário de entrada dos hóspedes.', href: '/admin/hotel' },
  { key: 'operation.checkout', category: 'operations', severity: 'warning', label: 'Horário de check-out', description: 'Informe o horário de saída dos hóspedes.', href: '/admin/hotel' },
  { key: 'operation.breakfast', category: 'operations', severity: 'warning', label: 'Café da manhã', description: 'Informe os horários do café da manhã.', href: '/admin/hotel' },
  { key: 'contact.primary', category: 'operations', severity: 'warning', label: 'Canal principal', description: 'Configure WhatsApp, site oficial ou reservas.', href: '/admin/hotel' },
  { key: 'visual.logo', category: 'experience', severity: 'warning', label: 'Logo', description: 'Adicione a assinatura visual da propriedade.', href: '/admin/hotel' },
  { key: 'visual.hero', category: 'experience', severity: 'warning', label: 'Imagem de capa', description: 'Adicione uma imagem principal para a experiência.', href: '/admin/hotel' },
  { key: 'content.services', category: 'content', severity: 'warning', label: 'Serviço publicado', description: 'Publique ao menos um serviço ativo.', href: '/admin/servicos' },
  { key: 'content.departments', category: 'content', severity: 'warning', label: 'Departamento publicado', description: 'Publique ao menos um departamento ativo.', href: '/admin/departamentos' },
  { key: 'content.policies', category: 'content', severity: 'warning', label: 'Política publicada', description: 'Publique ao menos uma política ativa.', href: '/admin/politicas' },
  { key: 'content.banners', category: 'content', severity: 'warning', label: 'Banner elegível', description: 'Configure ao menos um banner vigente.', href: '/admin/banners' },
  { key: 'rooms.qr', category: 'publication', severity: 'warning', label: 'Apartamento e QR', description: 'Configure ao menos um acesso ativo por apartamento.', href: '/admin/apartamentos' },
  { key: 'languages.translations', category: 'content', severity: 'warning', label: 'Traduções', description: 'Disponibilize conteúdo em inglês ou espanhol.', href: '/admin/idiomas' },
  { key: 'experience.preview', category: 'experience', severity: 'warning', label: 'Pré-visualização configurada', description: 'Mantenha a estrutura necessária para revisar a experiência.', href: '/admin/experiencia?tab=preview' },
] as const satisfies ReadonlyArray<{
  key: string;
  category: HotelReadinessCategory;
  severity: HotelReadinessSeverity;
  label: string;
  description: string;
  href: string | undefined;
}>;

export type HotelReadinessCheckKey = (typeof HOTEL_READINESS_CHECK_CATALOG)[number]['key'];
export type HotelReadinessPlatformStatus = 'draft' | 'active' | 'suspended' | 'archived';

export type HotelReadinessCheck = {
  key: HotelReadinessCheckKey;
  category: HotelReadinessCategory;
  severity: HotelReadinessSeverity;
  passed: boolean;
  label: string;
  description: string;
  href?: string;
};

export type HotelReadiness = {
  hotelId: string;
  platformStatus: HotelReadinessPlatformStatus;
  readyToActivate: boolean;
  blockingCount: number;
  warningCount: number;
  checks: HotelReadinessCheck[];
};

export type HotelReadinessRpcRow = {
  hotel_id: string;
  platform_status: string;
  ready_to_activate: boolean;
  blocking_count: number;
  warning_count: number;
  check_key: string;
  severity: string;
  passed: boolean;
};

export const HOTEL_READINESS_CATEGORY_LABELS: Record<HotelReadinessCategory, string> = {
  identity: 'Identidade',
  access: 'Acesso',
  operations: 'Operação',
  content: 'Conteúdo',
  experience: 'Experiência',
  publication: 'Publicação',
};

const CATALOG_BY_KEY = new Map(HOTEL_READINESS_CHECK_CATALOG.map((check) => [check.key, check]));
const REQUIRED_BLOCKING_KEYS = HOTEL_READINESS_CHECK_CATALOG
  .filter((check) => check.severity === 'blocking')
  .map((check) => check.key);

export function normalizeHotelReadiness(rows: HotelReadinessRpcRow[]): HotelReadiness | null {
  const first = rows[0];
  if (!first || !['draft', 'active', 'suspended', 'archived'].includes(first.platform_status)) return null;

  const seen = new Set<string>();
  const checks: HotelReadinessCheck[] = [];
  for (const row of rows) {
    const definition = CATALOG_BY_KEY.get(row.check_key as HotelReadinessCheckKey);
    if (
      !definition ||
      definition.severity !== row.severity ||
      seen.has(row.check_key) ||
      row.hotel_id !== first.hotel_id ||
      row.platform_status !== first.platform_status
    ) return null;
    seen.add(row.check_key);
    checks.push({ ...definition, passed: row.passed });
  }
  if (REQUIRED_BLOCKING_KEYS.some((key) => !seen.has(key))) return null;

  const blockingCount = checks.filter((check) => check.severity === 'blocking' && !check.passed).length;
  const warningCount = checks.filter((check) => check.severity === 'warning' && !check.passed).length;

  return {
    hotelId: first.hotel_id,
    platformStatus: first.platform_status as HotelReadinessPlatformStatus,
    readyToActivate: blockingCount === 0,
    blockingCount,
    warningCount,
    checks,
  };
}

export function getHotelReadinessNextSteps(readiness: HotelReadiness) {
  const seen = new Set<string>();
  return readiness.checks.filter((check) => {
    if (check.passed || !check.href || seen.has(check.href)) return false;
    seen.add(check.href);
    return true;
  });
}

export function hasPassedReadinessChecks(
  readiness: HotelReadiness,
  keys: readonly HotelReadinessCheckKey[]
) {
  return keys.every((key) => readiness.checks.find((check) => check.key === key)?.passed === true);
}
