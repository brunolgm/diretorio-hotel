import type { SupportedPublicLanguage } from '@/lib/public-language';

export const PUBLIC_FLIGHT_CENTER_TABS = ['meu-voo', 'partidas', 'chegadas'] as const;
export type PublicFlightCenterTab = (typeof PUBLIC_FLIGHT_CENTER_TABS)[number];

export function normalizePublicFlightCenterTab(value: string | null | undefined): PublicFlightCenterTab {
  return (PUBLIC_FLIGHT_CENTER_TABS as readonly string[]).includes(value || '')
    ? value as PublicFlightCenterTab
    : 'meu-voo';
}

export function getPublicFlightCenterCopy(language: SupportedPublicLanguage) {
  if (language === 'en') return {
    back: 'Back to home', title: 'Flight Center', description: 'Official airport links and helpful guidance to plan your departure.',
    tabs: { 'meu-voo': 'My flight', partidas: 'Departures', chegadas: 'Arrivals' },
    myFlightTitle: 'My flight', myFlightDescription: 'Enter your flight to organize your departure from the hotel.', addFlight: 'Add flight',
    flightNumber: 'Flight number', flightPlaceholder: 'E.g. LA 3910', preparationNotice: 'Flight saving and live status will be available in a future stage. No information is stored yet.',
    departuresTitle: 'Official departures', departuresDescription: 'Open the airport official channel to check current departure information.',
    arrivalsTitle: 'Official arrivals', arrivalsDescription: 'Open the airport official channel to check current arrival information.',
    transferTime: 'Estimated travel time', minutes: (value: number) => `${value} min`, officialDepartures: 'Official departures', officialArrivals: 'Official arrivals', combinedOfficial: 'Official departures and arrivals', officialSource: 'External official channel', noOfficialLink: 'No official link is available for this airport.',
    planningTitle: 'Plan your departure in advance', planningDescription: 'These references are estimates configured by the hotel. Allow for traffic and confirm details with the airline and airport.', domesticLead: 'Recommended domestic lead time', internationalLead: 'Recommended international lead time', safetyMargin: 'Additional margin',
    actionsTitle: 'Hotel services', actionsDescription: 'Contact the hotel through an existing channel. No request is created automatically.', transfer: 'Transfer', wakeUp: 'Wake-up call', breakfastBox: 'Breakfast to go', reception: 'Front desk', contactHotel: 'Contact hotel',
  };
  if (language === 'es') return {
    back: 'Volver al inicio', title: 'Central de Vuelos', description: 'Enlaces oficiales de aeropuertos y orientaciones para planificar su salida.',
    tabs: { 'meu-voo': 'Mi vuelo', partidas: 'Salidas', chegadas: 'Llegadas' },
    myFlightTitle: 'Mi vuelo', myFlightDescription: 'Informe su vuelo para organizar su salida del hotel.', addFlight: 'Agregar vuelo',
    flightNumber: 'Número de vuelo', flightPlaceholder: 'Ej.: LA 3910', preparationNotice: 'El guardado del vuelo y el estado en vivo estarán disponibles en una etapa futura. Aún no se almacena información.',
    departuresTitle: 'Salidas oficiales', departuresDescription: 'Abra el canal oficial del aeropuerto para consultar la información actual de salidas.',
    arrivalsTitle: 'Llegadas oficiales', arrivalsDescription: 'Abra el canal oficial del aeropuerto para consultar la información actual de llegadas.',
    transferTime: 'Tiempo estimado de traslado', minutes: (value: number) => `${value} min`, officialDepartures: 'Salidas oficiales', officialArrivals: 'Llegadas oficiales', combinedOfficial: 'Salidas y llegadas oficiales', officialSource: 'Canal oficial externo', noOfficialLink: 'No hay un enlace oficial disponible para este aeropuerto.',
    planningTitle: 'Planifique su salida con anticipación', planningDescription: 'Estas referencias son estimaciones configuradas por el hotel. Considere el tráfico y confirme los detalles con la aerolínea y el aeropuerto.', domesticLead: 'Anticipación nacional recomendada', internationalLead: 'Anticipación internacional recomendada', safetyMargin: 'Margen adicional',
    actionsTitle: 'Servicios del hotel', actionsDescription: 'Contacte al hotel mediante un canal existente. No se crea ninguna solicitud automáticamente.', transfer: 'Transfer', wakeUp: 'Despertador', breakfastBox: 'Desayuno para llevar', reception: 'Recepción', contactHotel: 'Contactar al hotel',
  };
  return {
    back: 'Voltar ao início', title: 'Central de Voos', description: 'Canais oficiais dos aeroportos e orientações úteis para planejar sua saída.',
    tabs: { 'meu-voo': 'Meu voo', partidas: 'Partidas', chegadas: 'Chegadas' },
    myFlightTitle: 'Meu voo', myFlightDescription: 'Informe seu voo para organizar sua saída do hotel.', addFlight: 'Adicionar voo',
    flightNumber: 'Número do voo', flightPlaceholder: 'Ex.: LA 3910', preparationNotice: 'O salvamento do voo e o status ao vivo estarão disponíveis em uma próxima etapa. Nenhuma informação é armazenada agora.',
    departuresTitle: 'Partidas oficiais', departuresDescription: 'Abra o canal oficial do aeroporto para consultar as informações atuais de partidas.',
    arrivalsTitle: 'Chegadas oficiais', arrivalsDescription: 'Abra o canal oficial do aeroporto para consultar as informações atuais de chegadas.',
    transferTime: 'Tempo estimado de deslocamento', minutes: (value: number) => `${value} min`, officialDepartures: 'Partidas oficiais', officialArrivals: 'Chegadas oficiais', combinedOfficial: 'Partidas e chegadas oficiais', officialSource: 'Canal oficial externo', noOfficialLink: 'Não há link oficial disponível para este aeroporto.',
    planningTitle: 'Planeje sua saída com antecedência', planningDescription: 'Estas referências são estimativas configuradas pelo hotel. Considere o trânsito e confirme os detalhes com a companhia aérea e o aeroporto.', domesticLead: 'Antecedência nacional recomendada', internationalLead: 'Antecedência internacional recomendada', safetyMargin: 'Margem adicional',
    actionsTitle: 'Serviços do hotel', actionsDescription: 'Fale com o hotel por um canal já existente. Nenhuma solicitação é criada automaticamente.', transfer: 'Transfer', wakeUp: 'Despertar', breakfastBox: 'Café da manhã para viagem', reception: 'Recepção', contactHotel: 'Falar com o hotel',
  };
}
