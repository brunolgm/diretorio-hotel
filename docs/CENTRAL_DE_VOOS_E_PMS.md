# Central de Voos — arquitetura final do MVP e evolução PMS

## Checkpoint canônico — Sprint 51.1 e continuidade operacional

A V1 permanece identity-agnostic: consulta de voo informado manualmente não exige
PMS, OPERA, reserva, identidade pessoal nem roomToken. A homologação de produção
G3 1888 GIG–SSA de 10/09/2026 é o checkpoint aprovado informado pelo responsável.
As limitações de status do MVP nas seções históricas abaixo não revogam a evolução
AirLabs da 51.1. Em 29/10, budget_unavailable foi identificado como vigência interna
expirada, sem chamada externa, não como defeito demonstrado do fornecedor.
Renovação operacional conservadora, sem recarga de créditos ou datas de cobrança
presumidas: [contrato e decisão](./airlabs-distributed-coordinator.md#decisão-operacional--renovação-conservadora-29102026).


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

## Refinamento da Sprint 51.1 — apresentação compacta

Referência desta etapa: branch `sprint-51-1-flight-live-status`, checkpoint
`88d6877440d669e13e72c0c6005c3cea0952262e`. As descrições do MVP da Sprint 51
acima e nas seções históricas abaixo não substituem a evolução de status já
presente nesse checkpoint. A infraestrutura AirLabs continua documentada em
[airlabs-distributed-coordinator.md](./airlabs-distributed-coordinator.md).

Esta etapa altera somente apresentação e interação nos componentes compartilhados
da Central, sem criar outra Central ou componentes por hotel:

- Companhia, número e rota aparecem no resumo, sem repetir origem/destino em
  células adicionais. Sem dados externos utilizáveis, data/hora informadas pelo
  hóspede são protagonistas e “Status não verificado” aparece uma única vez.
- Com dados externos utilizáveis, o status normalizado e o horário programado
  externo ficam em destaque, com data, fonte AirLabs e timestamp da atualização.
  O horário manual permanece como referência compacta, inclusive quando diverge.
  A leitura não escreve no storage. `active` continua “Atualização disponível”,
  nunca “Em voo”; ausência de atraso não produz “No horário”.
- Fora da janela: “Consulta automática disponível mais perto da partida”, em
  PT/EN/ES. As mensagens de falha técnica, não encontrado, limitação e contexto
  não verificável continuam distintas. Loading, cooldown de 60 segundos,
  atualização manual, proteção contra simultaneidade e timestamp antigo são
  controlados pelo mesmo código existente.
- Na recomendação válida ficam sempre visíveis título, hora, data, horário local,
  base manual/AirLabs, estimativa sem trânsito em tempo real e
  eventual `departure_notice`. O `<details>` nativo “Como calculamos este horário”
  começa recolhido e contém horário usado, antecedência, deslocamento, margem e
  orientação complementar para seguir as instruções da companhia e do aeroporto.
  O marcador nativo indica o estado, o foco é visível e Enter/Espaço operam o
  controle. Abrir/fechar não chama rede. Avisos operacionais permanecem fora do
  controle para não esconder informação essencial.
- Consulta oficial ocupa a largura principal; calendário e rota ficam lado a
  lado, assim como editar/remover. Textos podem quebrar sem truncamento; os alvos
  mantêm pelo menos 44–48 px. Download, clipboard, feedbacks e callbacks existentes
  permanecem.
- Serviços são uma lista de linhas com ícone, nome, indicação de contato e seta.
  Só as flags habilitadas geram linhas, na ordem Transfer, Despertar, Breakfast
  Box e Recepção. Não há fillers. Continua explícito que nenhuma solicitação é
  criada automaticamente. Não houve edição de flags reais: Breakfast Box no
  Grand Mercure Copacabana permanece desligado.

Fórmula, tratamento de `null`, ocultação da recomendação e fallback genérico
permanecem no código anterior. Estimado/realizado não adiam a recomendação.
Não foram alterados hero, abas, conteúdo de Partidas/Chegadas, Homes, docks,
tokens, entitlement opt-in, baseline, provisioning, Admin, APIs, timezone,
banco, storage v1, analytics ou infraestrutura AirLabs. Novos hotéis utilizam
naturalmente os mesmos componentes e suas próprias flags/tokens. PMS/OPERA e
Sprint 52 continuam fora do escopo; as pendências históricas permanecem.

### Homologação local desta apresentação

Os arquivos `tests/browser/flight-center-fixture.tsx` e
`tests/browser/flight-center-compact.mjs` montam os componentes reais com dados
sintéticos. O harness lê a versão anterior com `git show`, sem checkout/reset,
e gera bundles antes/depois com o mesmo CSS e os mesmos dados. Assets são locais;
`fetch` é simulado, CSP bloqueia conexões e Playwright aborta destinos externos.
Não carrega credenciais nem consulta banco ou AirLabs. Os exemplos não comprovam
existência de voo real naquela data/rota. O harness não é uma rota do produto.

Execução: disponibilizar `esbuild` e `playwright` em ferramentas temporárias,
definir `TOOL_NODE_MODULES` para seu diretório `node_modules` e
`PLAYWRIGHT_BROWSERS_PATH` para o Chromium temporário instalado; executar
`node tests/browser/flight-center-compact.mjs`. Nenhuma dependência foi adicionada
ao projeto. `--serve` mantém a fixture na porta 4173 para inspeção; a matriz usa
a porta 4174. O relógio da matriz é fixo em 09/09/2026 às 18:00 UTC.

Resultado executado: 51 comparações em Chromium, cobrindo Grand Mercure, Novotel,
Mercure e Default em PT/EN/ES, larguras 320/360/390/430 px, mais Grand Mercure
desktop de 1440 px nos três idiomas. Verificações comportamentais: detalhes
inicialmente recolhidos, Enter/Espaço, base/hora visíveis, nenhuma chamada extra
ao expandir, ausência de overflow horizontal da página e último serviço
acessível acima do dock. Também passaram dados externos com referência manual
divergente, erros técnico/não encontrado/limitação, fallback genérico, zero a
quatro serviços, Breakfast Box condicionado, calendário `.ics`, links, editar,
cancelar e remover do storage. Nenhum erro JavaScript capturado.

Altura medida **somente do cartão Meu voo**, cenário manual fora da janela,
Grand Mercure/PT; serviços, hero e dock não entram nestes números:

| Largura | Antes | Depois | Redução |
| --- | ---: | ---: | ---: |
| 320 px | 1487 px | 1001 px | 486 px |
| 360 px | 1323 px | 987 px | 336 px |
| 390 px | 1287 px | 927 px | 360 px |
| 430 px | 1287 px | 887 px | 400 px |
| 1440 px | 1051 px | 829 px | 222 px |

Capturas do topo/final e `measurements.json` são gerados em
`out/flight-center-compact/` (artefatos locais ignorados pelo Git). O Grand Mercure
usa a região de rolagem interna já existente, por isso as capturas registram topo
e final separadamente. Nas abas de 320 px permanece a rolagem horizontal interna
anterior; não houve alteração de seu layout. O cabeçalho Default conserva a
apresentação anterior, inclusive contraste reduzido observado nesta fixture;
qualquer ajuste nele exige uma etapa própria, pois foi excluído deste pedido.

Regressões estruturais adicionais cobrem resumo sem duplicações, conteúdo visível
versus expansível e lista condicionada. `npm run test:security`: 286 testes
aprovados, incluindo controladores, cálculo, storage v1 e entitlement. Esses
contratos de segurança incluem verificações estruturais, não substituem a matriz
de navegador. A homologação usa Chromium desktop em viewports mobile, não aparelhos
físicos, Safari ou leitor de tela. Banco e endpoints reais não foram homologados
nesta etapa visual. As limitações de integração já documentadas permanecem.

`npm run lint` terminou com zero erros e quatro avisos preexistentes de `<img>`
em arquivos fora desta alteração. `npm run build` passou. `git diff --check`
passou; os dois arquivos novos também foram revisados quanto a whitespace,
compilados e incluídos no lint. Nenhum commit, push ou merge foi feito.

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

## Central de Voos V4 premium — 29/10/2026

Checkpoint: main a9118fb; arquitetura compartilhada e opt-in por composição V4.
Referência fornecida: docs/references/bugan/public-v3/proposta_de_evolução_da_central_de_voos.png.
O arquivo é referência de composição, não fotografia oficial nem fonte de status.
O cabeçalho usa gradiente dos tokens da marca e logo oficial já cadastrado;
não houve recorte/publicação da fotografia ilustrativa ou de logos do mockup.

A Central V4 reorganiza identidade, número, programação/status, horários,
terminal/portão, proveniência e ações. Número maior que o status. Abas e retorno
com idioma preservado; navegação desktop própria, dock mobile em faixa reservada.
A correção de visualViewport ignora um frame se o foco já mudou, evitando rolagem
para o input anterior durante abertura do teclado. Nenhuma mudança na Home.

O registro compartilhado airline-identity.ts reconhece exatamente nomes, IATA,
ICAO e aliases revisados, com normalização de espaços/acentos/caixa e sem fuzzy.
Catálogo: Azul AD/AZU; referência comercial LATAM LA/TAM; GOL G3/GLO; TAP TP/TAP;
American AA/AAL; Delta DL/DAL; United UA/UAL; Air France AF/AFR; KLM KL/KLM;
Iberia IB/IBE; Copa CM/CMP; Aerolíneas Argentinas AR/ARG; SKY Chile H2/SKU; JetSMART JA/JAT. Nomes comerciais e aliases
explícitos constam do próprio registro; links novos usam os domínios oficiais
HTTPS, sem prometer preenchimento automático do número no site externo.

TAM não é declarado um sinônimo IATA universal de LA. O catálogo diferencia a
referência operacional/comercial contemporânea da identificação histórica JJ.
A derivação TAM → candidato LA exige origem com country_code BR confirmado no
catálogo canônico, data/rota completas e data a partir do
checkpoint observado de 29/10/2026; esse limite é suporte do catálogo LibGuest,
não data histórica de mudança da companhia. O candidato é consultado uma única
vez e só se torna ocorrência verificada se o contrato existente confirmar
referência, data e aeroportos. JJ permanece JJ, sem tentativa de trocar codeshare
ou descobrir operadora pelo número. Reconhecimento não comprova voo operado.

LAT foi recusado: é ICAO atribuído a outra empresa, não alias inequívoco de LATAM.
SKY/SKY Airline genéricos também não são convertidos entre filiais por suposição.
JetSMART é aceito como referência comercial JA somente com data/rota completas e
data a partir de 05/03/2024, conforme a unificação publicada pela própria empresa.
Isso não identifica a operadora efetiva e não reescreve WJ/JZ/J6 explícitos. IATA explícito pode ser informado no lugar de um nome ambíguo. Conflito
entre companhia e prefixo completo impede salvar até correção, sem escolher um
deles silenciosamente. Nome desconhecido/ambíguo pode ser salvo manualmente sem
consulta verificada. V1 e valores originais continuam preservados; nenhum campo
de status é persistido no objeto local. Não há consulta por candidato alternativo.

Programado, estimado e efetivo são apresentados separadamente e somente quando
fornecidos. Programação verificada difere de live verificado; active de schedules
não significa Em voo/Embarque próximo. FetchedAt é identificado como consulta do
LibGuest; atualização da fonte só aparece quando há timestamp próprio válido.
Refresh mantém cooldown/cache e nunca cria polling. Falha mantém a referência
manual, ações e últimos dados com advertência de consulta não concluída.

Replays: AD4277 é resposta real sanitizada da restauração; LA3565 é projeção real
recuperada por leitura do cache existente (scheduled, 20:50, T1, 07; live não
encontrado). Fixtures e capturas de replay não são novas consultas live. Testes
usam relógio controlado e bloqueiam rede externa. Orçamento, renovação, cache,
leases, backend, entitlements, lifecycle, PMS/roomToken e IA não foram alterados.
Nenhuma migration ou chamada externa AirLabs é necessária nesta entrega.

Fontes de identidade: [IATA](https://www.iata.org/en/about/members/airline-list/),
[FAA — códigos ICAO, incluindo LAT](https://www.faa.gov/air_traffic/publications/atpubs/cnt_html/chap3_section_3.html),
[diretório Aena](https://www.aenabrasil.com.br/en/airports/maceio-zumbi-dos-palmares-international-airport/airline-companies.html).
A lista financeira IATA mantém TAM/JJ; isso não autoriza reescrever JJ para LA.
A referência comercial LA do piloto é sustentada pelo match real já existente,
não pelo mockup nem por uma equivalência genérica entre filiais LATAM.

Validação reproduzível: node tests/browser/flight-center-compact.mjs --premium,
--form e modo legado; TOOL_NODE_MODULES aponta para esbuild temporário e
V3_BROWSER_CHANNEL=msedge. Oito viewports, seis presets, PT/EN/ES, abas,
cooldown, contraste, ações e scroll. Teclado é simulado; aparelho físico permanece
uma validação humana separada. Fixtures ficam apenas em tests/, referência em
docs/, nunca como dados aeronáuticos ou fotos publicados na aplicação.

Fonte adicional de equivalência comercial datada: [guia oficial JetSMART](https://www.jetsmart.com/ar/es/PreguntasFrecuentes).
Identificadores JA/JAT: [IATA JetSMART Chile](https://www.iata.org/en/about/members/airline-list/jetsmart-chile/666/).
SKY H2/SKU: [diretório oficial de aviação coreano](https://www.airportal.go.kr/file/htmlOpen/upload/airline/detail/Sky%20Airline%282024%29.pdf).

O país/timezone é projetado somente para códigos já autorizados pelo RPC público
do hotel, pela leitura server-side existente. Não há inferência de país pelo IATA
ou timezone, nova concessão de tabela, campo no v1 ou parâmetro extra ao provider.
País ausente/estrangeiro impede a conversão TAM; LA explícito continua disponível.

### Hotfix visual — logomarcas locais (29/10/2026)

O card Meu voo apresenta LATAM, Azul e GOL no espaço reservado de 56×56 px,
com object-contain e fundo claro. O nome textual, referência, rota e dados de
programação/live continuam independentes da imagem. O catálogo airline-identity.ts
recebe apenas metadados visuais; getAirlineLogo seleciona um path estático após a
resolução canônica existente. Não há inferência por imagem nem novo catálogo de
operadoras. LAT, conflitos, contexto TAM insuficiente, desconhecidas e conhecidas
sem asset conservam o avião. onError restaura o mesmo fallback sem mudar a geometria.
Partidas/Chegadas representam aeroportos e não recebem logos decorativos.

| Companhia | Asset local | Formato / dimensão nativa | Bytes | Origem oficial | SHA-256 |
| --- | --- | --- | ---: | --- | --- |
| LATAM | public/brand/airlines/latam.png | PNG 180×180 | 1244 | [arquivo oficial](https://s.latamairlines.com/images/seo/apple-touch-icon.png) | 3e7080729499cf060d27394fa6deb34b7778e17f5b9c18308d5d1b2f0a0a68af |
| Azul | public/brand/airlines/azul.svg | SVG 101×28 | 3236 | [arquivo oficial](https://www.voeazul.com.br/_next/static/chunks/pages/_app-5f18d72371d16e51.js) | e9abd4aa8d185201b017e9b2b29809aa597cb1b27b1fc52faa99cc6eb42b1b02 |
| GOL | public/brand/airlines/gol.svg | SVG 50×20 | 2427 | [arquivo oficial](https://www.voegol.com.br/documents/d/guest/logo-voegol-new) | 888ea563ea7b80a2a5dcc47aeb5532bea648d75436ae9ecb80f83f7318405df0 |

Procedência: LATAM é o ícone digital ligado pelo [site oficial LATAM](https://www.latamairlines.com/br/pt); arquivo PNG original, sem recorte/recoloração. Azul é a versão brand_azul_dark do [site oficial Azul](https://www.voeazul.com.br/br/pt/home): somente atributos e 32 paths/rects estáticos foram serializados para SVG, sem executar JavaScript externo, alterar coordenadas, cores ou proporção. GOL é o SVG digital ligado pelo cabeçalho da [página oficial de marcas GOL](https://www.voegol.com.br/pt/marcas-gol), preservado integralmente. Total dos três arquivos: 6.907 bytes; sem CDN em runtime. SVGs passivos, sem scripts, eventos, referências externas ou fontes.

Condições: marcas pertencem às respectivas companhias; uso estritamente
identificativo ao lado do nome, sem sugerir parceria, autorização comercial ou
verificação da ocorrência. Arquivo publicamente disponibilizado não implica
licença aberta. Preservam-se original, cores, proporção e contexto de fundo; não
se extraiu marca do mockup nem se criou símbolo. Não há pacote de marcas
indiscriminado. TAP, American, Delta, United, Air France, KLM, Iberia, Copa, SKY,
JetSMART e Aerolíneas continuam com fallback; ampliar assets exige nova verificação
de procedência e condições. Nenhuma das três marcas prioritárias ficou pendente.

Validação: airline-logo.test.ts + airline-identity.test.ts verificam associação,
contexto, ambiguidades, paths fechados, SVG passivo e preservação da referência.
flight-center-compact.mjs --logos cobre seis temas (Bugan, Grand Mercure, Novotel
Leme, Novotel Salvador, Mercure e Default), PT/EN/ES e oito viewports; inclui
programação LA, live AD, GOL sem ocorrência verificada, ausência de asset, alias
ambíguo, conflito e falha de imagem com geometria, storage e payload inalterados.
flight-premium-production-smoke.mjs --logos valida a interface publicada com
replays interceptados, sem provider real. Evidências ficam em out/ e não no bundle.
Nenhum backend, payload AirLabs, armazenamento v1, quota, rate limit, cache,
normalização, idioma, dock, lifecycle, entitlement, mídia do hotel ou migration
foi alterado. Publicação segue branch técnica, preview READY e smoke antes da
integração em main e confirmação de produção.

Gates do candidato: 13/13 direcionados, 482/482 segurança, 168/168 browser de
logos, 148/148 regressão Premium; TypeScript e build aprovados, lint com zero
erros e quatro warnings históricos, git diff --check limpo. Verificação de
produção usa --logos (replays interceptados), sem consumo AirLabs.
