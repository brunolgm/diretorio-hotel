# Central de Voos — arquitetura final do MVP e evolução PMS

## Estado da Sprint 51

A Sprint 51 foi concluída em nove etapas. O MVP entrega uma Central de Voos pública, opt-in por hotel, configurável pelo Admin e governada pela Platform, sem consulta de status em tempo real e sem integração PMS.

O produto final inclui:

- entitlement `travel.flights`, fora do baseline de novos hotéis;
- configuração hotel-scoped de aeroportos, planejamento e ações;
- rotas públicas equivalentes por slug e subdomínio;
- card temático nas Homes, sem alterar o compositor da Sprint 50 ou os docks;
- voo manual armazenado somente no dispositivo em `localStorage` v1;
- links oficiais de aeroportos e companhias conhecidas;
- calendário `.ics` gerado no navegador;
- rota textual para o aeroporto via Google Maps URL, sem API key;
- transfer, despertar, café da manhã para viagem e recepção via canal existente do hotel;
- analytics agregado e sem itinerário, identidade ou contexto de apartamento.

## Etapas 1–9

1. Inclusão de `travel.flights` no catálogo e no fluxo de entitlement da Platform.
2. Modelo operacional e Admin para configurações e aeroportos.
3. Reordenação atômica dos aeroportos e auditoria administrativa.
4. Central pública, loader mínimo e navegação canônica.
5. Identidade visual de Grand Mercure, Mercure, Novotel e tema genérico.
6. Card público da Central nas Homes, condicionado à disponibilidade real.
7. Voo manual em storage v1 e links oficiais de companhia.
8. Calendário, rota para aeroporto e ações reais do hotel.
9. Analytics sem PII, hardening, regressões multi-hotel e documentação final.

## Migrations da Sprint 51

- `202608250001_51_travel_flights_entitlement.sql`: catálogo SQL e contratos de entitlement.
- `202608250002_51_flight_center_configuration.sql`: aeroportos, vínculos, configurações, RLS e RPCs administrativas.
- `202608250003_51_flight_center_airport_reorder.sql`: reordenação atômica e auditada.
- `202608250004_51_public_flight_center.sql`: projeção pública mínima da Central.
- `202608250005_51_public_flight_home_card.sql`: projeção pública do card da Home.
- `202608260001_51_flight_center_analytics.sql`: catálogo fechado de eventos da Central e enum fechado da ação de hotel.

As migrations antigas não são reescritas. A Etapa 9 amplia somente o `CHECK` de analytics e restringe o único metadata permitido a `{ "action": ... }` em `flight_service_action`.

## Arquitetura final

### Governança e disponibilidade

`travel.flights` é opt-in. O entitlement governa Admin, Central e card público. Uma Central só fica disponível quando o hotel está público, possui settings e ao menos um aeroporto ativo vinculado. `home_card_enabled=false` remove somente o card; não religa nem substitui o entitlement.

A Platform administra a disponibilidade do módulo. O Admin do hotel administra a operação. O compositor da experiência não ganha um bloco novo e nenhum dock recebe item de voos.

### Dados operacionais

- `airports`: catálogo global, com código IATA, nome, cidade e links oficiais HTTPS.
- `hotel_airports`: vínculo e ordem específicos do hotel.
- `hotel_flight_settings`: apresentação, planejamento e flags das ações.
- RPCs públicas: retornam apenas a projeção necessária e filtram hotel, entitlement, settings e aeroportos ativos.

Tabelas administrativas permanecem sem `SELECT` para `anon`. Os loaders não aceitam o tenant fornecido pelo navegador como autoridade.

### Voo manual e localStorage v1

O voo informado pelo hóspede não é enviado ao backend. O contrato `SavedGuestFlight` permanece na versão 1 e usa a chave:

```text
libguest:flight:<hotel-id>:v1
```

O payload contém somente companhia/código opcional, número, origem, destino, data/hora informadas, base temporal não verificada e timestamps de retenção. Não contém nome, reserva, apartamento, contato, `roomToken`, URL externa ou HTML.

Toda leitura valida versão, hotel, allowlist de chaves, limites de string, IATA, datas e expiração. JSON inválido, payload de outro hotel, campos extras e voo expirado são descartados. Falhas de storage não derrubam a página. O contrato v1 continua backward-compatible.

### Links oficiais e rota

Companhias suportadas usam catálogo local de origens HTTPS conhecidas. Companhia desconhecida não produz URL inventada e pode usar o link oficial do aeroporto quando disponível. Links de aeroporto são normalizados para HTTPS no loader público.

A rota usa:

```text
https://www.google.com/maps/dir/?api=1&destination=<nome + IATA + cidade>
```

Não há API key, iframe, geocoding, fetch ou exposição das coordenadas administrativas. Aeroporto não configurado não produz rota. Links externos usam `target="_blank"` e `rel="noreferrer"` ou `noopener noreferrer`.

### Calendário `.ics`

O arquivo é criado client-side com `Blob`, `VCALENDAR` 2.0 e um `VEVENT`. `SUMMARY`, `DESCRIPTION` e `LOCATION` escapam barra invertida, vírgula e ponto e vírgula; CR/LF de entradas são neutralizados e as linhas do documento usam CRLF.

`DTSTART` preserva a data e hora fornecidas como horário local floating. Não há `Z` ou `TZID`, porque o contrato público não possui timezone confiável para qualquer IATA informado. Essa limitação é intencional e evita inventar UTC. O nome do arquivo é sanitizado e nenhum URL, token ou dado adicional entra no evento.

### Ações do hotel

- Transfer: abre o WhatsApp do hotel com pedido de informação.
- Despertar: abre o canal real para solicitar o serviço; não afirma agendamento.
- Café da manhã para viagem: consulta disponibilidade; não cria pedido.
- Recepção: abre o contato existente do hotel.

Sem WhatsApp válido, as quatro ações reutilizam a página pública de contato. As mensagens nunca recebem automaticamente voo, hóspede, apartamento ou `roomToken`.

## Analytics e privacidade

O pipeline continua sendo `/api/analytics`; não existe API paralela. A API resolve o hotel pelo slug público, confirma `analytics.basic` e persiste com o cliente server-side existente.

Eventos da Central:

- `flight_center_view`
- `flight_saved`
- `flight_removed`
- `flight_official_link_click`
- `flight_calendar_download`
- `flight_route_open`
- `flight_service_action`

`flight_service_action` exige exatamente uma ação do enum:

- `transfer`
- `wake_up`
- `breakfast_box`
- `reception`

O payload público permite `hotelSlug`, `eventType`, `language`, os IDs já existentes de departamento/serviço quando exigidos pelos eventos legados e `action` somente para `flight_service_action`. O banco grava metadata vazio nos demais eventos da Central.

É proibido registrar número do voo, companhia, aeroportos, rota, data/hora, conteúdo do storage, URL completa, nome, reserva, apartamento, `roomToken`, cookie ou confirmação. O evento de visualização segue o cooldown em `sessionStorage`, evitando duplicação por hydration. Analytics é fire-and-forget: falha, bloqueio ou indisponibilidade do endpoint não impede salvar, remover, abrir links, baixar o calendário ou contatar o hotel.

## Acessibilidade e responsividade

As abas são navegação por URL, com `nav`, nome acessível, `aria-current` e foco visível. Formulários possuem labels, erros associados por `aria-describedby`, `aria-invalid`, foco no primeiro campo inválido e mensagens por `role="alert"`/`aria-live`. Ícones decorativos são ocultos da árvore acessível e CTAs têm touch targets de pelo menos 44–48 px.

Os layouts usam grids adaptativos, `min-width: 0`, quebra de texto e clearance dos docks já aprovados. Os contratos estruturais cobrem 320, 360, 390 e 430 px, tablet e desktop sem inserir fillers ou alterar os temas homologados.

## Estados seguros e limitações conhecidas

- Não existe status ao vivo, portão, terminal, atraso ou cancelamento verificado.
- Companhia desconhecida não recebe link inventado.
- Aeroporto sem URL continua visível com estado editorial, sem link falso.
- Aeroporto não configurado não gera rota.
- Falhas de clipboard, storage, Blob/download e analytics são locais e não derrubam a Central.
- Horário passado recebe aviso e permanece somente dentro da retenção de 12 horas.
- A vigência do voo é calculada como wall clock informado, sem inferência de timezone.
- O pipeline público de analytics continua sujeito a ruído/bots; rate limiting distribuído permanece tema de infraestrutura.
- Nenhum fluxo cria reserva, transfer, despertar ou pedido de alimentação.

## Contratos preservados

1. Baseline de 12 módulos; `travel.flights` permanece opt-in.
2. Isolamento multi-hotel em Admin, RPCs, storage e analytics.
3. Homes, grids, Destaques, seção carioca, compositor Sprint 50 e docks preservados.
4. Paridade slug/subdomínio e PT/EN/ES.
5. `roomToken` continua apenas como capacidade limitada de contexto do apartamento.
6. Nenhum voo manual é persistido no banco.
7. Nenhum status operacional é inventado.

## Evolução futura — Guest Context / OPERA/PMS

Esta seção permanece deliberadamente fora do MVP. Nenhum código da Sprint 51 antecipa integração OPERA, OHIP, FlightAware ou outro provedor de voo.

Possibilidades futuras exigem discovery específica com hotel, jurídico/privacidade, segurança, Oracle/licenciador e operação:

- OPERA Cloud via OHIP, condicionado a contrato, escopos, licenciamento e limites;
- exportação segura/SFTP quando operacionalmente adequada;
- domínio separado de `guest_stays`, com origem, sincronização, reconciliação e retenção;
- sessão de hóspede verificada, curta e revogável, distinta da autenticação administrativa e do `roomToken`;
- personalização consentida e opcional, mantendo a Central funcional de forma anônima.

Fronteiras obrigatórias da evolução:

- nunca inferir identidade pelo apartamento ou QR;
- nunca fundir credenciais PMS, identidade ou estadia com `roomToken`;
- aplicar finalidade, base legal, minimização, transparência, retenção e direitos do titular desde o desenho;
- manter segredos OPERA/OHIP exclusivamente server-side em cofre apropriado;
- exigir isolamento por hotel, menor privilégio e trilha de auditoria;
- definir comportamento seguro para indisponibilidade, reconciliação e expiração do PMS;
- não reutilizar tabelas do MVP como atalho para armazenar identidade futura.

FlightAware/status ao vivo continua fora do produto até existir contrato/licença, fonte confiável, política de indisponibilidade e revisão de privacidade. Até lá, a Central informa explicitamente que os horários são fornecidos pelo hóspede e que a situação deve ser confirmada no canal oficial.
