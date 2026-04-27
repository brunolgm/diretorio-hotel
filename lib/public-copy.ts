import type { SupportedPublicLanguage } from '@/lib/public-language';

type PublicCopy = {
  announcements: string;
  hotelAnnouncements: string;
  activeAnnouncementsCount: (count: number) => string;
  announcementDefaultDescription: string;
  announcementCategoryLabel: (category: string) => string;
  activeDuringPeriod: string;
  activeUntil: (date: string) => string;
  languageMenuLabel: string;
  destinationExternal: string;
  destinationInternal: string;
  serviceInfoUnavailable: string;
  openSite: string;
  viewService: string;
  departmentDefaultDescription: string;
  talkToDepartment: (name: string) => string;
  contactDepartment: (name: string) => string;
  policyDefaultDescription: string;
  essentialsSinglePlace: string;
  heroDescription: string;
  bookNow: string;
  bookingUnavailable: string;
  officialWebsite: string;
  websiteUnavailable: string;
  whatsappSupport: string;
  breakfast: string;
  serviceHours: string;
  wifi: string;
  notInformed: string;
  passwordLabel: (value: string) => string;
  askFrontDesk: string;
  checkIn: string;
  standardEntry: string;
  checkOut: string;
  standardExit: string;
  explore: string;
  servicesAndInfo: string;
  itemsAvailable: (count: number) => string;
  noServicesTitle: string;
  noServicesDescription: string;
  support: string;
  talkToHotel: string;
  noChannelsTitle: string;
  noChannelsDescription: string;
  importantInfo: string;
  hotelPolicies: string;
  noPoliciesTitle: string;
  noPoliciesDescription: string;
  usefulLinks: string;
  quickAccess: string;
  usefulLinksDescription: string;
  reservations: string;
  fallbackNotice: string;
  backToServices: string;
  internalDetailedContent: string;
  serviceDetails: string;
  fullInformation: string;
  back: string;
  internalPageRule: (minLength: number) => string;
};

const COPY: Record<SupportedPublicLanguage, PublicCopy> = {
  pt: {
    announcements: 'Comunicados',
    hotelAnnouncements: 'Avisos do hotel',
    activeAnnouncementsCount: (count) => `${count} aviso(s) ativo(s)`,
    announcementDefaultDescription: 'Comunicado geral do hotel.',
    announcementCategoryLabel: (category) => {
      if (category === 'alerta') return 'Alerta';
      if (category === 'manutencao') return 'Manutenção';
      if (category === 'promocao') return 'Promoção';
      return 'Informativo';
    },
    activeDuringPeriod: 'Aviso ativo no período informado',
    activeUntil: (date) => `Válido até ${date}`,
    languageMenuLabel: 'Idioma',
    destinationExternal: 'Destino externo',
    destinationInternal: 'Detalhe interno',
    serviceInfoUnavailable: 'Informação não disponível.',
    openSite: 'Abrir site',
    viewService: 'Ver serviço',
    departmentDefaultDescription: 'Canal de atendimento do hotel.',
    talkToDepartment: (name) => `Falar com ${name}`,
    contactDepartment: (name) => `Contato com ${name}`,
    policyDefaultDescription: 'Política do hotel.',
    essentialsSinglePlace: 'Informações essenciais em um só lugar',
    heroDescription:
      'Acesse serviços, contatos, orientações e links importantes do hotel em uma experiência digital mais elegante, prática e organizada.',
    bookNow: 'Reservar agora',
    bookingUnavailable: 'Reservas indisponíveis',
    officialWebsite: 'Site oficial',
    websiteUnavailable: 'Site indisponível',
    whatsappSupport: 'Atendimento via WhatsApp',
    breakfast: 'Café da manhã',
    serviceHours: 'Horário de serviço',
    wifi: 'Wi-Fi',
    notInformed: 'Não informado',
    passwordLabel: (value) => `Senha: ${value}`,
    askFrontDesk: 'Consulte a recepção',
    checkIn: 'Check-in',
    standardEntry: 'Entrada padrão',
    checkOut: 'Check-out',
    standardExit: 'Saída padrão',
    explore: 'Explorar',
    servicesAndInfo: 'Serviços e informações',
    itemsAvailable: (count) => `${count} itens disponíveis`,
    noServicesTitle: 'Nenhum serviço disponível no momento',
    noServicesDescription: 'As informações do diretório serão atualizadas em breve.',
    support: 'Atendimento',
    talkToHotel: 'Fale com o hotel',
    noChannelsTitle: 'Nenhum canal disponível no momento',
    noChannelsDescription: 'Os contatos do hotel serão disponibilizados em breve.',
    importantInfo: 'Informações importantes',
    hotelPolicies: 'Políticas do hotel',
    noPoliciesTitle: 'Nenhuma política publicada',
    noPoliciesDescription: 'As orientações do hotel aparecerão aqui quando estiverem disponíveis.',
    usefulLinks: 'Links úteis',
    quickAccess: 'Acesso rápido',
    usefulLinksDescription:
      'Utilize os canais oficiais do hotel para reservas, atendimento e informações institucionais.',
    reservations: 'Reservas',
    fallbackNotice:
      'Algumas informações ainda estão em português enquanto as traduções desta página são concluídas.',
    backToServices: 'Voltar aos serviços',
    internalDetailedContent: 'Conteúdo interno detalhado',
    serviceDetails: 'Detalhes do serviço',
    fullInformation: 'Informações completas',
    back: 'Voltar',
    internalPageRule: (minLength) =>
      `Esta página interna aparece apenas quando o serviço não tem link externo e possui pelo menos ${minLength} caracteres de conteúdo útil para leitura.`,
  },
  en: {
    announcements: 'Announcements',
    hotelAnnouncements: 'Hotel announcements',
    activeAnnouncementsCount: (count) => `${count} active announcement(s)`,
    announcementDefaultDescription: 'General hotel announcement.',
    announcementCategoryLabel: (category) => {
      if (category === 'alerta') return 'Alert';
      if (category === 'manutencao') return 'Maintenance';
      if (category === 'promocao') return 'Promotion';
      return 'Information';
    },
    activeDuringPeriod: 'Announcement active during the selected period',
    activeUntil: (date) => `Active until ${date}`,
    languageMenuLabel: 'Language',
    destinationExternal: 'External destination',
    destinationInternal: 'Internal detail',
    serviceInfoUnavailable: 'Information not available.',
    openSite: 'Open website',
    viewService: 'View service',
    departmentDefaultDescription: 'Hotel support channel.',
    talkToDepartment: (name) => `Talk to ${name}`,
    contactDepartment: (name) => `Contact ${name}`,
    policyDefaultDescription: 'Hotel policy.',
    essentialsSinglePlace: 'Essential information in one place',
    heroDescription:
      'Access services, contacts, guidelines, and important links from the hotel in a more elegant, practical, and organized digital experience.',
    bookNow: 'Book now',
    bookingUnavailable: 'Bookings unavailable',
    officialWebsite: 'Official website',
    websiteUnavailable: 'Website unavailable',
    whatsappSupport: 'WhatsApp support',
    breakfast: 'Breakfast',
    serviceHours: 'Service hours',
    wifi: 'Wi-Fi',
    notInformed: 'Not provided',
    passwordLabel: (value) => `Password: ${value}`,
    askFrontDesk: 'Check with the front desk',
    checkIn: 'Check-in',
    standardEntry: 'Standard arrival',
    checkOut: 'Check-out',
    standardExit: 'Standard departure',
    explore: 'Explore',
    servicesAndInfo: 'Services and information',
    itemsAvailable: (count) => `${count} items available`,
    noServicesTitle: 'No services available right now',
    noServicesDescription: 'The directory information will be updated soon.',
    support: 'Support',
    talkToHotel: 'Talk to the hotel',
    noChannelsTitle: 'No channels available right now',
    noChannelsDescription: 'Hotel contacts will be available soon.',
    importantInfo: 'Important information',
    hotelPolicies: 'Hotel policies',
    noPoliciesTitle: 'No policies published',
    noPoliciesDescription: 'Hotel guidelines will appear here when available.',
    usefulLinks: 'Useful links',
    quickAccess: 'Quick access',
    usefulLinksDescription:
      'Use the hotel’s official channels for bookings, support, and institutional information.',
    reservations: 'Reservations',
    fallbackNotice:
      'Some information is still shown in Portuguese while translations for this page are being completed.',
    backToServices: 'Back to services',
    internalDetailedContent: 'Detailed internal content',
    serviceDetails: 'Service details',
    fullInformation: 'Full information',
    back: 'Back',
    internalPageRule: (minLength) =>
      `This internal page appears only when the service has no external link and includes at least ${minLength} characters of useful reading content.`,
  },
  es: {
    announcements: 'Comunicados',
    hotelAnnouncements: 'Avisos del hotel',
    activeAnnouncementsCount: (count) => `${count} aviso(s) activo(s)`,
    announcementDefaultDescription: 'Comunicado general del hotel.',
    announcementCategoryLabel: (category) => {
      if (category === 'alerta') return 'Alerta';
      if (category === 'manutencao') return 'Mantenimiento';
      if (category === 'promocao') return 'Promoción';
      return 'Informativo';
    },
    activeDuringPeriod: 'Aviso activo en el período informado',
    activeUntil: (date) => `Vigente hasta ${date}`,
    languageMenuLabel: 'Idioma',
    destinationExternal: 'Destino externo',
    destinationInternal: 'Detalle interno',
    serviceInfoUnavailable: 'Información no disponible.',
    openSite: 'Abrir sitio',
    viewService: 'Ver servicio',
    departmentDefaultDescription: 'Canal de atención del hotel.',
    talkToDepartment: (name) => `Hablar con ${name}`,
    contactDepartment: (name) => `Contacto con ${name}`,
    policyDefaultDescription: 'Política del hotel.',
    essentialsSinglePlace: 'Información esencial en un solo lugar',
    heroDescription:
      'Acceda a servicios, contactos, orientaciones y enlaces importantes del hotel en una experiencia digital más elegante, práctica y organizada.',
    bookNow: 'Reservar ahora',
    bookingUnavailable: 'Reservas no disponibles',
    officialWebsite: 'Sitio oficial',
    websiteUnavailable: 'Sitio no disponible',
    whatsappSupport: 'Atención por WhatsApp',
    breakfast: 'Desayuno',
    serviceHours: 'Horario de servicio',
    wifi: 'Wi-Fi',
    notInformed: 'No informado',
    passwordLabel: (value) => `Clave: ${value}`,
    askFrontDesk: 'Consulte con recepción',
    checkIn: 'Check-in',
    standardEntry: 'Entrada estándar',
    checkOut: 'Check-out',
    standardExit: 'Salida estándar',
    explore: 'Explorar',
    servicesAndInfo: 'Servicios e información',
    itemsAvailable: (count) => `${count} elementos disponibles`,
    noServicesTitle: 'No hay servicios disponibles por ahora',
    noServicesDescription: 'La información del directorio se actualizará pronto.',
    support: 'Atención',
    talkToHotel: 'Hable con el hotel',
    noChannelsTitle: 'No hay canales disponibles por ahora',
    noChannelsDescription: 'Los contactos del hotel estarán disponibles pronto.',
    importantInfo: 'Información importante',
    hotelPolicies: 'Políticas del hotel',
    noPoliciesTitle: 'No hay políticas publicadas',
    noPoliciesDescription: 'Las orientaciones del hotel aparecerán aquí cuando estén disponibles.',
    usefulLinks: 'Enlaces útiles',
    quickAccess: 'Acceso rápido',
    usefulLinksDescription:
      'Utilice los canales oficiales del hotel para reservas, atención e información institucional.',
    reservations: 'Reservas',
    fallbackNotice:
      'Parte de la información sigue mostrándose en portugués mientras se completan las traducciones de esta página.',
    backToServices: 'Volver a servicios',
    internalDetailedContent: 'Contenido interno detallado',
    serviceDetails: 'Detalles del servicio',
    fullInformation: 'Información completa',
    back: 'Volver',
    internalPageRule: (minLength) =>
      `Esta página interna aparece solo cuando el servicio no tiene enlace externo y contiene al menos ${minLength} caracteres de contenido útil para lectura.`,
  },
};

export function getPublicCopy(language: SupportedPublicLanguage): PublicCopy {
  return COPY[language];
}
