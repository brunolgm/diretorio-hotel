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
    airline: 'Airline', optional: 'optional', airlinePlaceholder: 'E.g. LA or LATAM', origin: 'Origin', destination: 'Destination', date: 'Date', plannedTime: 'Scheduled time', saveFlight: 'Save flight', editFlight: 'Edit flight', removeFlight: 'Remove flight', cancelEdit: 'Cancel',
    sourceLabel: 'Source', statusLabel: 'Status', providedByYou: 'Provided by you', statusNotVerified: 'Status not verified', localTimeLabel: 'Time provided by you', officialCheckNotice: 'Check the current status through the official channel before leaving.', pastFlightWarning: 'The scheduled time has passed. Check the current status through the official channel.',
    homeSavedTime: 'Time provided', homeViewFlight: 'View my flight', storageUnavailable: 'This browser could not save the flight. Check your privacy settings and try again.',
    validation: { airline: 'Enter a valid airline name or a 2–3 character code.', flightNumber: 'Enter a valid flight number using up to 8 letters or numbers.', departureAirport: 'Enter a 3-letter IATA code.', arrivalAirport: 'Enter a different 3-letter IATA code.', departureDate: 'Enter a valid date that has not expired.', scheduledDepartureTime: 'Enter a valid time.' },
    flightNumber: 'Flight number', flightPlaceholder: 'E.g. 3910', preparationNotice: 'The time is stored only on this device and is not verified in real time.',
    departuresTitle: 'Official departures', departuresDescription: 'Open the airport official channel to check current departure information.',
    arrivalsTitle: 'Official arrivals', arrivalsDescription: 'Open the airport official channel to check current arrival information.',
    transferTime: 'Estimated travel time', minutes: (value: number) => `${value} min`, officialDepartures: 'Official departures', officialArrivals: 'Official arrivals', combinedOfficial: 'Official departures and arrivals', officialSource: 'External official channel', noOfficialLink: 'No official link is available for this airport.',
    planningTitle: 'Plan your departure in advance', planningDescription: 'These references are estimates configured by the hotel. Allow for traffic and confirm details with the airline and airport.', domesticLead: 'Recommended domestic lead time', internationalLead: 'Recommended international lead time', safetyMargin: 'Additional margin',
    actionsTitle: 'Hotel services', actionsDescription: 'Contact the hotel through an existing channel. No request is created automatically.', transfer: 'Transfer', wakeUp: 'Wake-up call', breakfastBox: 'Breakfast to go', reception: 'Front desk', contactHotel: 'Contact hotel',
    homeCardTitle: 'Track your flight', homeCardDescription: 'Check your flight and organize your departure from the hotel.', homeCardCta: 'Open Flight Center',
  };
  if (language === 'es') return {
    back: 'Volver al inicio', title: 'Central de Vuelos', description: 'Enlaces oficiales de aeropuertos y orientaciones para planificar su salida.',
    tabs: { 'meu-voo': 'Mi vuelo', partidas: 'Salidas', chegadas: 'Llegadas' },
    myFlightTitle: 'Mi vuelo', myFlightDescription: 'Informe su vuelo para organizar su salida del hotel.', addFlight: 'Agregar vuelo',
    airline: 'Compañía aérea', optional: 'opcional', airlinePlaceholder: 'Ej.: LA o LATAM', origin: 'Origen', destination: 'Destino', date: 'Fecha', plannedTime: 'Horario previsto', saveFlight: 'Guardar vuelo', editFlight: 'Editar vuelo', removeFlight: 'Eliminar vuelo', cancelEdit: 'Cancelar',
    sourceLabel: 'Fuente', statusLabel: 'Estado', providedByYou: 'Informado por usted', statusNotVerified: 'Estado no verificado', localTimeLabel: 'Horario informado por usted', officialCheckNotice: 'Consulte la situación actual en el canal oficial antes de salir.', pastFlightWarning: 'El horario previsto ya pasó. Consulte la situación actual en el canal oficial.',
    homeSavedTime: 'Horario informado', homeViewFlight: 'Ver mi vuelo', storageUnavailable: 'Este navegador no pudo guardar el vuelo. Revise la configuración de privacidad e inténtelo de nuevo.',
    validation: { airline: 'Ingrese una compañía válida o un código de 2 a 3 caracteres.', flightNumber: 'Ingrese un número de vuelo válido de hasta 8 letras o números.', departureAirport: 'Ingrese un código IATA de 3 letras.', arrivalAirport: 'Ingrese un código IATA diferente de 3 letras.', departureDate: 'Ingrese una fecha válida que no haya vencido.', scheduledDepartureTime: 'Ingrese un horario válido.' },
    flightNumber: 'Número de vuelo', flightPlaceholder: 'Ej.: 3910', preparationNotice: 'El horario se guarda solo en este dispositivo y no se verifica en tiempo real.',
    departuresTitle: 'Salidas oficiales', departuresDescription: 'Abra el canal oficial del aeropuerto para consultar la información actual de salidas.',
    arrivalsTitle: 'Llegadas oficiales', arrivalsDescription: 'Abra el canal oficial del aeropuerto para consultar la información actual de llegadas.',
    transferTime: 'Tiempo estimado de traslado', minutes: (value: number) => `${value} min`, officialDepartures: 'Salidas oficiales', officialArrivals: 'Llegadas oficiales', combinedOfficial: 'Salidas y llegadas oficiales', officialSource: 'Canal oficial externo', noOfficialLink: 'No hay un enlace oficial disponible para este aeropuerto.',
    planningTitle: 'Planifique su salida con anticipación', planningDescription: 'Estas referencias son estimaciones configuradas por el hotel. Considere el tráfico y confirme los detalles con la aerolínea y el aeropuerto.', domesticLead: 'Anticipación nacional recomendada', internationalLead: 'Anticipación internacional recomendada', safetyMargin: 'Margen adicional',
    actionsTitle: 'Servicios del hotel', actionsDescription: 'Contacte al hotel mediante un canal existente. No se crea ninguna solicitud automáticamente.', transfer: 'Transfer', wakeUp: 'Despertador', breakfastBox: 'Desayuno para llevar', reception: 'Recepción', contactHotel: 'Contactar al hotel',
    homeCardTitle: 'Siga su vuelo', homeCardDescription: 'Consulte su vuelo y organice su salida del hotel.', homeCardCta: 'Abrir Central de Vuelos',
  };
  return {
    back: 'Voltar ao início', title: 'Central de Voos', description: 'Canais oficiais dos aeroportos e orientações úteis para planejar sua saída.',
    tabs: { 'meu-voo': 'Meu voo', partidas: 'Partidas', chegadas: 'Chegadas' },
    myFlightTitle: 'Meu voo', myFlightDescription: 'Informe seu voo para organizar sua saída do hotel.', addFlight: 'Adicionar voo',
    airline: 'Companhia aérea', optional: 'opcional', airlinePlaceholder: 'Ex.: LA ou LATAM', origin: 'Origem', destination: 'Destino', date: 'Data', plannedTime: 'Horário planejado', saveFlight: 'Salvar voo', editFlight: 'Editar voo', removeFlight: 'Remover voo', cancelEdit: 'Cancelar',
    sourceLabel: 'Fonte', statusLabel: 'Status', providedByYou: 'Informado por você', statusNotVerified: 'Status não verificado', localTimeLabel: 'Horário informado por você', officialCheckNotice: 'Consulte a situação atual no canal oficial antes de sair.', pastFlightWarning: 'O horário planejado já passou. Verifique a situação atual no canal oficial.',
    homeSavedTime: 'Horário informado', homeViewFlight: 'Ver meu voo', storageUnavailable: 'Este navegador não conseguiu salvar o voo. Verifique as configurações de privacidade e tente novamente.',
    validation: { airline: 'Informe uma companhia válida ou um código de 2 a 3 caracteres.', flightNumber: 'Informe um número de voo válido com até 8 letras ou números.', departureAirport: 'Informe um código IATA de 3 letras.', arrivalAirport: 'Informe um código IATA diferente de 3 letras.', departureDate: 'Informe uma data válida que ainda não tenha expirado.', scheduledDepartureTime: 'Informe um horário válido.' },
    flightNumber: 'Número do voo', flightPlaceholder: 'Ex.: 3910', preparationNotice: 'O horário fica salvo apenas neste dispositivo e não é verificado em tempo real.',
    departuresTitle: 'Partidas oficiais', departuresDescription: 'Abra o canal oficial do aeroporto para consultar as informações atuais de partidas.',
    arrivalsTitle: 'Chegadas oficiais', arrivalsDescription: 'Abra o canal oficial do aeroporto para consultar as informações atuais de chegadas.',
    transferTime: 'Tempo estimado de deslocamento', minutes: (value: number) => `${value} min`, officialDepartures: 'Partidas oficiais', officialArrivals: 'Chegadas oficiais', combinedOfficial: 'Partidas e chegadas oficiais', officialSource: 'Canal oficial externo', noOfficialLink: 'Não há link oficial disponível para este aeroporto.',
    planningTitle: 'Planeje sua saída com antecedência', planningDescription: 'Estas referências são estimativas configuradas pelo hotel. Considere o trânsito e confirme os detalhes com a companhia aérea e o aeroporto.', domesticLead: 'Antecedência nacional recomendada', internationalLead: 'Antecedência internacional recomendada', safetyMargin: 'Margem adicional',
    actionsTitle: 'Serviços do hotel', actionsDescription: 'Fale com o hotel por um canal já existente. Nenhuma solicitação é criada automaticamente.', transfer: 'Transfer', wakeUp: 'Despertar', breakfastBox: 'Café da manhã para viagem', reception: 'Recepção', contactHotel: 'Falar com o hotel',
    homeCardTitle: 'Acompanhe seu voo', homeCardDescription: 'Consulte seu voo e organize sua saída do hotel.', homeCardCta: 'Abrir Central de Voos',
  };
}
