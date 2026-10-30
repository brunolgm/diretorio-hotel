import type { SupportedPublicLanguage } from '@/lib/public-language';

export function getFlightPlanningCopy(language: SupportedPublicLanguage) {
  if (language === 'en') return {
    details: 'How we calculate this time', title: 'Recommended hotel departure', scheduled: 'Scheduled flight', lead: 'Airport lead time', transfer: 'Estimated travel time', margin: 'Safety margin',
    local: 'Departure airport local time', airlabs: 'Based on the scheduled flight time · AirLabs.', manual: 'Based on the time you provided; not verified by the airline.',
    estimate: 'Estimate based on hotel guidance. Real-time traffic is not included.', official: 'Follow the airline and airport guidance, including when the flight is delayed.',
  };
  if (language === 'es') return {
    details: 'Cómo calculamos este horario', title: 'Salida recomendada del hotel', scheduled: 'Vuelo programado', lead: 'Anticipación en el aeropuerto', transfer: 'Traslado estimado', margin: 'Margen de seguridad',
    local: 'Hora local del aeropuerto de salida', airlabs: 'Basada en el horario programado del vuelo · AirLabs.', manual: 'Basada en el horario informado por usted; no verificado por la aerolínea.',
    estimate: 'Estimación basada en las orientaciones del hotel. No incluye tráfico en tiempo real.', official: 'Siga las indicaciones de la aerolínea y del aeropuerto, incluso si el vuelo se retrasa.',
  };
  return {
    details: 'Como calculamos este horário', title: 'Saída recomendada do hotel', scheduled: 'Voo programado', lead: 'Antecedência no aeroporto', transfer: 'Deslocamento estimado', margin: 'Margem de segurança',
    local: 'Horário local do aeroporto de partida', airlabs: 'Baseada no horário programado do voo · AirLabs.', manual: 'Baseada no horário informado por você; não verificado pela companhia.',
    estimate: 'Estimativa baseada nas orientações do hotel. Não considera trânsito em tempo real.', official: 'Siga as orientações da companhia e do aeroporto, inclusive em caso de atraso.',
  };
}

function getFlightDataCopy(language: SupportedPublicLanguage) {
  if (language === 'en') return {
    title: 'Flight data', refresh: 'Refresh status', loading: 'Checking flight…', waiting: 'Please wait before refreshing again.',
    scheduled: 'Scheduled', actual: 'Actual departure', estimated: 'Estimated departure', terminal: 'Terminal', gate: 'Gate',
    source: 'Flight data · AirLabs', live: 'Live update', updated: 'Last update', local: 'Departure airport local time',
    unavailable: 'We could not update the flight. Your saved details and travel actions remain available.',
    outside: 'Automatic updates are available closer to departure.',
    unverifiable: 'We cannot safely verify this flight’s time or identifier. Please use the official channel.',
    limited: 'Updates are temporarily limited. Please try again later or use the official channel.',
    notFound: 'No matching flight was found in this update. Confirm the details through the official channel.',
    statuses: { inFlight: 'In flight', landed: 'Landed', cancelled: 'Cancelled', scheduled: 'Scheduled', active: 'Update available', unknown: 'Status unconfirmed' },
  };
  if (language === 'es') return {
    title: 'Datos del vuelo', refresh: 'Actualizar estado', loading: 'Consultando el vuelo…', waiting: 'Espere antes de actualizar de nuevo.',
    scheduled: 'Programado', actual: 'Salida real', estimated: 'Salida estimada', terminal: 'Terminal', gate: 'Puerta',
    source: 'Datos del vuelo · AirLabs', live: 'Actualización en vivo', updated: 'Última actualización', local: 'Hora local del aeropuerto de salida',
    unavailable: 'No pudimos actualizar el vuelo. Sus datos guardados y las acciones del viaje siguen disponibles.',
    outside: 'Consulta automática disponible más cerca de la salida.',
    unverifiable: 'No podemos verificar con seguridad el horario o el identificador del vuelo. Use el canal oficial.',
    limited: 'Las actualizaciones están limitadas temporalmente. Inténtelo más tarde o use el canal oficial.',
    notFound: 'No se encontró un vuelo coincidente en esta consulta. Confirme los datos en el canal oficial.',
    statuses: { inFlight: 'En vuelo', landed: 'Aterrizado', cancelled: 'Cancelado', scheduled: 'Programado', active: 'Actualización disponible', unknown: 'Estado no confirmado' },
  };
  return {
    title: 'Dados do voo', refresh: 'Atualizar status', loading: 'Consultando voo…', waiting: 'Aguarde antes de atualizar novamente.',
    scheduled: 'Programado', actual: 'Partida realizada', estimated: 'Partida estimada', terminal: 'Terminal', gate: 'Portão',
    source: 'Dados do voo · AirLabs', live: 'Atualização ao vivo', updated: 'Última atualização', local: 'Horário local do aeroporto de partida',
    unavailable: 'Não foi possível atualizar o voo. Seus dados salvos e as ações da viagem continuam disponíveis.',
    outside: 'Consulta automática disponível mais perto da partida.',
    unverifiable: 'Não foi possível verificar com segurança o horário ou o identificador do voo. Consulte o canal oficial.',
    limited: 'As atualizações estão temporariamente limitadas. Tente mais tarde ou consulte o canal oficial.',
    notFound: 'Nenhum voo correspondente foi encontrado nesta consulta. Confirme os dados no canal oficial.',
    statuses: { inFlight: 'Em voo', landed: 'Pousado', cancelled: 'Cancelado', scheduled: 'Programado', active: 'Atualização disponível', unknown: 'Status não confirmado' },
  };
}

export const PUBLIC_FLIGHT_CENTER_TABS = ['meu-voo', 'partidas', 'chegadas'] as const;
export type PublicFlightCenterTab = (typeof PUBLIC_FLIGHT_CENTER_TABS)[number];

export function normalizePublicFlightCenterTab(value: string | null | undefined): PublicFlightCenterTab {
  return (PUBLIC_FLIGHT_CENTER_TABS as readonly string[]).includes(value || '')
    ? value as PublicFlightCenterTab
    : 'meu-voo';
}

export function getPublicFlightCenterCopy(language: SupportedPublicLanguage) {
  if (language === 'en') return {
    flightData: getFlightDataCopy('en'),
    back: 'Back to home', title: 'Flight Center', description: 'Official airport links and helpful guidance to plan your departure.',
    tabs: { 'meu-voo': 'My flight', partidas: 'Departures', chegadas: 'Arrivals' },
    myFlightTitle: 'My flight', myFlightDescription: 'Enter your flight to organize your departure from the hotel.', addFlight: 'Add flight',
    airline: 'Airline', optional: 'optional', airlinePlaceholder: 'E.g. LA or LATAM', origin: 'Origin', destination: 'Destination', date: 'Date', plannedTime: 'Scheduled time', saveFlight: 'Save flight', editFlight: 'Edit flight', removeFlight: 'Remove flight', cancelEdit: 'Cancel',
    sourceLabel: 'Source', statusLabel: 'Status', providedByYou: 'Provided by you', statusNotVerified: 'Status not verified', localTimeLabel: 'Time provided by you', officialCheckNotice: 'Check the current status through the official channel before leaving.', pastFlightWarning: 'The scheduled time has passed. Check the current status through the official channel.',
    officialAirlineAction: 'Check flight on official website', officialAirportAction: 'Check the airport official channel', flightNumberCopied: 'Flight number copied. Check it on the airline official website.', clipboardUnavailable: 'The official website was opened. Enter the flight number to check its status.',
    tripActionsTitle: 'Travel actions', addToCalendar: 'Add to calendar', calendarDownloaded: 'Calendar downloaded', calendarUnavailable: 'This browser could not download the calendar.', openAirportRoute: 'Open route to the airport', calendarFlightLabel: 'Flight', calendarInformedTime: 'Time provided by the guest.', checkAvailability: 'Check availability',
    transferRequestMessage: 'Hello! I would like information about an airport transfer.', wakeUpRequestMessage: 'I would like to request a wake-up service.', breakfastBoxRequestMessage: 'I would like to check the availability of breakfast to go.', receptionRequestMessage: 'Hello! I would like to speak with the front desk.',
    homeSavedTime: 'Time provided', homeViewFlight: 'View my flight', storageUnavailable: 'This browser could not save the flight. Check your privacy settings and try again.',
    validation: { airline: 'Enter a valid airline name or a 2–3 character code.', flightNumber: 'Enter a valid flight number using up to 8 letters or numbers.', departureAirport: 'Enter a 3-letter IATA code.', arrivalAirport: 'Enter a different 3-letter IATA code.', departureDate: 'Enter a valid date that has not expired.', scheduledDepartureTime: 'Enter a valid time.' },
    flightNumber: 'Flight number', flightPlaceholder: 'E.g. 3910', preparationNotice: 'The time is stored only on this device and is not verified in real time.',
    departuresTitle: 'Official departures', departuresDescription: 'Open the airport official channel to check current departure information.',
    arrivalsTitle: 'Official arrivals', arrivalsDescription: 'Open the airport official channel to check current arrival information.',
    transferTime: 'Estimated travel time', minutes: (value: number) => `${value} min`, officialDepartures: 'Official departures', officialArrivals: 'Official arrivals', combinedOfficial: 'Official departures and arrivals', officialSource: 'External official channel', noOfficialLink: 'The official channel is not configured in this directory yet. Check with your airline for current information.',
    planningTitle: 'Plan your departure in advance', planningDescription: 'These references are estimates configured by the hotel. Allow for traffic and confirm details with the airline and airport.', domesticLead: 'Recommended domestic lead time', internationalLead: 'Recommended international lead time', safetyMargin: 'Additional margin',
    actionsTitle: 'Hotel services', actionsDescription: 'Contact the hotel through an existing channel. No request is created automatically.', transfer: 'Transfer', wakeUp: 'Wake-up call', breakfastBox: 'Breakfast to go', reception: 'Front desk', contactHotel: 'Contact hotel',
    homeCardTitle: 'Track your flight', homeCardDescription: 'Check your flight and organize your departure from the hotel.', homeCardCta: 'Open Flight Center',
  };
  if (language === 'es') return {
    flightData: getFlightDataCopy('es'),
    back: 'Volver al inicio', title: 'Central de Vuelos', description: 'Enlaces oficiales de aeropuertos y orientaciones para planificar su salida.',
    tabs: { 'meu-voo': 'Mi vuelo', partidas: 'Salidas', chegadas: 'Llegadas' },
    myFlightTitle: 'Mi vuelo', myFlightDescription: 'Informe su vuelo para organizar su salida del hotel.', addFlight: 'Agregar vuelo',
    airline: 'Compañía aérea', optional: 'opcional', airlinePlaceholder: 'Ej.: LA o LATAM', origin: 'Origen', destination: 'Destino', date: 'Fecha', plannedTime: 'Horario previsto', saveFlight: 'Guardar vuelo', editFlight: 'Editar vuelo', removeFlight: 'Eliminar vuelo', cancelEdit: 'Cancelar',
    sourceLabel: 'Fuente', statusLabel: 'Estado', providedByYou: 'Informado por usted', statusNotVerified: 'Estado no verificado', localTimeLabel: 'Horario informado por usted', officialCheckNotice: 'Consulte la situación actual en el canal oficial antes de salir.', pastFlightWarning: 'El horario previsto ya pasó. Consulte la situación actual en el canal oficial.',
    officialAirlineAction: 'Consultar vuelo en el sitio oficial', officialAirportAction: 'Consultar el canal oficial del aeropuerto', flightNumberCopied: 'Número de vuelo copiado. Consúltelo en el sitio oficial de la aerolínea.', clipboardUnavailable: 'Se abrió el sitio oficial. Ingrese el número de vuelo para consultar su estado.',
    tripActionsTitle: 'Acciones del viaje', addToCalendar: 'Añadir al calendario', calendarDownloaded: 'Calendario descargado', calendarUnavailable: 'Este navegador no pudo descargar el calendario.', openAirportRoute: 'Abrir ruta al aeropuerto', calendarFlightLabel: 'Vuelo', calendarInformedTime: 'Horario informado por el huésped.', checkAvailability: 'Consultar disponibilidad',
    transferRequestMessage: '¡Hola! Quisiera información sobre el traslado al aeropuerto.', wakeUpRequestMessage: 'Quisiera solicitar el servicio de despertador.', breakfastBoxRequestMessage: 'Quisiera consultar la disponibilidad de desayuno para llevar.', receptionRequestMessage: '¡Hola! Quisiera hablar con recepción.',
    homeSavedTime: 'Horario informado', homeViewFlight: 'Ver mi vuelo', storageUnavailable: 'Este navegador no pudo guardar el vuelo. Revise la configuración de privacidad e inténtelo de nuevo.',
    validation: { airline: 'Ingrese una compañía válida o un código de 2 a 3 caracteres.', flightNumber: 'Ingrese un número de vuelo válido de hasta 8 letras o números.', departureAirport: 'Ingrese un código IATA de 3 letras.', arrivalAirport: 'Ingrese un código IATA diferente de 3 letras.', departureDate: 'Ingrese una fecha válida que no haya vencido.', scheduledDepartureTime: 'Ingrese un horario válido.' },
    flightNumber: 'Número de vuelo', flightPlaceholder: 'Ej.: 3910', preparationNotice: 'El horario se guarda solo en este dispositivo y no se verifica en tiempo real.',
    departuresTitle: 'Salidas oficiales', departuresDescription: 'Abra el canal oficial del aeropuerto para consultar la información actual de salidas.',
    arrivalsTitle: 'Llegadas oficiales', arrivalsDescription: 'Abra el canal oficial del aeropuerto para consultar la información actual de llegadas.',
    transferTime: 'Tiempo estimado de traslado', minutes: (value: number) => `${value} min`, officialDepartures: 'Salidas oficiales', officialArrivals: 'Llegadas oficiales', combinedOfficial: 'Salidas y llegadas oficiales', officialSource: 'Canal oficial externo', noOfficialLink: 'El canal oficial aún no está configurado en este directorio. Consulte a su aerolínea para obtener información actual.',
    planningTitle: 'Planifique su salida con anticipación', planningDescription: 'Estas referencias son estimaciones configuradas por el hotel. Considere el tráfico y confirme los detalles con la aerolínea y el aeropuerto.', domesticLead: 'Anticipación nacional recomendada', internationalLead: 'Anticipación internacional recomendada', safetyMargin: 'Margen adicional',
    actionsTitle: 'Servicios del hotel', actionsDescription: 'Contacte al hotel mediante un canal existente. No se crea ninguna solicitud automáticamente.', transfer: 'Transfer', wakeUp: 'Despertador', breakfastBox: 'Desayuno para llevar', reception: 'Recepción', contactHotel: 'Contactar al hotel',
    homeCardTitle: 'Siga su vuelo', homeCardDescription: 'Consulte su vuelo y organice su salida del hotel.', homeCardCta: 'Abrir Central de Vuelos',
  };
  return {
    flightData: getFlightDataCopy('pt'),
    back: 'Voltar ao início', title: 'Central de Voos', description: 'Canais oficiais dos aeroportos e orientações úteis para planejar sua saída.',
    tabs: { 'meu-voo': 'Meu voo', partidas: 'Partidas', chegadas: 'Chegadas' },
    myFlightTitle: 'Meu voo', myFlightDescription: 'Informe seu voo para organizar sua saída do hotel.', addFlight: 'Adicionar voo',
    airline: 'Companhia aérea', optional: 'opcional', airlinePlaceholder: 'Ex.: LA ou LATAM', origin: 'Origem', destination: 'Destino', date: 'Data', plannedTime: 'Horário planejado', saveFlight: 'Salvar voo', editFlight: 'Editar voo', removeFlight: 'Remover voo', cancelEdit: 'Cancelar',
    sourceLabel: 'Fonte', statusLabel: 'Status', providedByYou: 'Informado por você', statusNotVerified: 'Status não verificado', localTimeLabel: 'Horário informado por você', officialCheckNotice: 'Consulte a situação atual no canal oficial antes de sair.', pastFlightWarning: 'O horário planejado já passou. Verifique a situação atual no canal oficial.',
    officialAirlineAction: 'Consultar voo no site oficial', officialAirportAction: 'Consultar canal oficial do aeroporto', flightNumberCopied: 'Número do voo copiado. Consulte-o no site oficial da companhia.', clipboardUnavailable: 'O site oficial foi aberto. Informe o número do voo para consultar a situação.',
    tripActionsTitle: 'Ações da viagem', addToCalendar: 'Adicionar ao calendário', calendarDownloaded: 'Calendário baixado', calendarUnavailable: 'Este navegador não conseguiu baixar o calendário.', openAirportRoute: 'Abrir rota para o aeroporto', calendarFlightLabel: 'Voo', calendarInformedTime: 'Horário informado pelo hóspede.', checkAvailability: 'Consultar disponibilidade',
    transferRequestMessage: 'Olá! Gostaria de informações sobre transfer para o aeroporto.', wakeUpRequestMessage: 'Gostaria de solicitar um serviço de despertar.', breakfastBoxRequestMessage: 'Gostaria de consultar a disponibilidade de café da manhã para viagem.', receptionRequestMessage: 'Olá! Gostaria de falar com a recepção.',
    homeSavedTime: 'Horário informado', homeViewFlight: 'Ver meu voo', storageUnavailable: 'Este navegador não conseguiu salvar o voo. Verifique as configurações de privacidade e tente novamente.',
    validation: { airline: 'Informe uma companhia válida ou um código de 2 a 3 caracteres.', flightNumber: 'Informe um número de voo válido com até 8 letras ou números.', departureAirport: 'Informe um código IATA de 3 letras.', arrivalAirport: 'Informe um código IATA diferente de 3 letras.', departureDate: 'Informe uma data válida que ainda não tenha expirado.', scheduledDepartureTime: 'Informe um horário válido.' },
    flightNumber: 'Número do voo', flightPlaceholder: 'Ex.: 3910', preparationNotice: 'O horário fica salvo apenas neste dispositivo e não é verificado em tempo real.',
    departuresTitle: 'Partidas oficiais', departuresDescription: 'Abra o canal oficial do aeroporto para consultar as informações atuais de partidas.',
    arrivalsTitle: 'Chegadas oficiais', arrivalsDescription: 'Abra o canal oficial do aeroporto para consultar as informações atuais de chegadas.',
    transferTime: 'Tempo estimado de deslocamento', minutes: (value: number) => `${value} min`, officialDepartures: 'Partidas oficiais', officialArrivals: 'Chegadas oficiais', combinedOfficial: 'Partidas e chegadas oficiais', officialSource: 'Canal oficial externo', noOfficialLink: 'O canal oficial ainda não está configurado neste diretório. Consulte a companhia aérea para informações atuais.',
    planningTitle: 'Planeje sua saída com antecedência', planningDescription: 'Estas referências são estimativas configuradas pelo hotel. Considere o trânsito e confirme os detalhes com a companhia aérea e o aeroporto.', domesticLead: 'Antecedência nacional recomendada', internationalLead: 'Antecedência internacional recomendada', safetyMargin: 'Margem adicional',
    actionsTitle: 'Serviços do hotel', actionsDescription: 'Fale com o hotel por um canal já existente. Nenhuma solicitação é criada automaticamente.', transfer: 'Transfer', wakeUp: 'Despertar', breakfastBox: 'Café da manhã para viagem', reception: 'Recepção', contactHotel: 'Falar com o hotel',
    homeCardTitle: 'Acompanhe seu voo', homeCardDescription: 'Consulte seu voo e organize sua saída do hotel.', homeCardCta: 'Abrir Central de Voos',
  };
}

// Premium copy. Airline names remain proper names; recognition is not verification.
export function getPremiumFlightCopy(language:SupportedPublicLanguage){
 if(language==='en')return {waiting:'Refresh will be available within 1 minute.',identified:'Airline identified',identityNotice:'This does not verify the flight occurrence.',ambiguous:'This reference is ambiguous. Enter the IATA flight code from your ticket.',conflict:'The airline and flight code do not match. Check both fields.',unresolved:'Airline not identified. You may save your details, but status remains unverified.',context:'This reference needs a current date and complete route. Historical codes are not converted.',locationPending:'Terminal and gate have not been provided. Check the official channel.',scheduleVerified:'Schedule verified',liveVerified:'Live status verified',consulted:'Consulted',sourceUpdated:'Source updated',stale:'Last verified data; the new lookup could not be completed.',official:(name:string)=>'Check with '+name,support:'Travel support',supportTitle:'Count on our team',manual:'Your reference'};
 if(language==='es')return {waiting:'Podrá volver a consultar en hasta 1 minuto.',identified:'Aerolínea identificada',identityNotice:'Esto no verifica la ocurrencia del vuelo.',ambiguous:'Esta referencia es ambigua. Introduzca el código IATA del vuelo de su billete.',conflict:'La aerolínea y el código del vuelo no coinciden. Revise ambos campos.',unresolved:'Aerolínea no identificada. Puede guardar los datos, pero el estado no está verificado.',context:'Esta referencia requiere una fecha actual y una ruta completa. No se convierten códigos históricos.',locationPending:'Terminal y puerta aún no informadas. Consulte el canal oficial.',scheduleVerified:'Programación verificada',liveVerified:'Estado en vivo verificado',consulted:'Consultado',sourceUpdated:'Fuente actualizada',stale:'Últimos datos verificados; no se pudo completar la nueva consulta.',official:(name:string)=>'Consultar en '+name,support:'Apoyo para su viaje',supportTitle:'Cuente con nuestro equipo',manual:'Su referencia'};
 return {waiting:'Nova consulta disponível em até 1 minuto.',identified:'Companhia identificada',identityNotice:'Isso não verifica a ocorrência do voo.',ambiguous:'Esta referência é ambígua. Informe o código IATA do voo que aparece no bilhete.',conflict:'A companhia e o código do voo não correspondem. Confira os dois campos.',unresolved:'Companhia não identificada. Você pode salvar os dados, mas o status fica não verificado.',context:'Esta referência exige data atual e rota completa. Códigos históricos não são convertidos.',locationPending:'Terminal e portão ainda não informados. Consulte o canal oficial.',scheduleVerified:'Programação verificada',liveVerified:'Status live verificado',consulted:'Consultado',sourceUpdated:'Fonte atualizada',stale:'Últimos dados verificados; a nova consulta não foi concluída.',official:(name:string)=>'Consultar na '+name,support:'Serviços de suporte',supportTitle:'Conte com a nossa equipe',manual:'Sua referência'};
}
