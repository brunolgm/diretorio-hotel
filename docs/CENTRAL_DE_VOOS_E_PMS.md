# Central de Voos e evolução futura de PMS

## Status deste documento

Este documento é o resultado da Fase 0 de auditoria da Sprint 51. Ele registra decisões e uma proposta de implementação, sem implementar funcionalidade, alterar banco, criar migration ou modificar componentes visuais.

- Branch auditada: `sprint-51-central-de-voos-mvp`
- HEAD auditado: `7eba8d97d107d56a2fdac02b13abbf1987228ce4` (`merge: preserve highlights empty state`)
- Data da auditoria: 25 de agosto de 2026
- Escopo aprovado do módulo: `travel.flights`
- Estado do módulo no repositório nesta fase: apenas proposto; ainda não existe no catálogo

## Resumo executivo

A Central de Voos pode ser entregue como módulo opcional por hotel, sem PMS, sem identificação do hóspede e sem modificar o contrato de `roomToken`. O MVP recebe um voo informado manualmente, mantém esse dado somente no dispositivo, deixa explícito que o status não é verificado e direciona o hóspede a fontes oficiais.

A arquitetura atual já oferece as fundações necessárias: catálogo e entitlement por hotel, rotas públicas equivalentes para slug e subdomínio, temas oficiais, navegação administrativa filtrada por módulo, RLS multi-hotel, analytics com payload fechado e serviços/departamentos reutilizáveis. A implementação exigirá ampliar os catálogos fechados de módulos e criar, em migration futura, apenas dados operacionais de aeroportos, configurações do hotel e links oficiais. Nenhum dado de voo manual ou dado pessoal deve ser persistido no banco.

O card público deve ocupar um slot explícito entre a grade temática e Destaques nas três homes de marca. Ele não será um novo bloco do compositor da Sprint 50 e não criará item no bottom dock. Na home genérica, deve existir um slot independente equivalente, sem alterar `EXPERIENCE_BLOCK_CATALOG` nem reinterpretar as posições do compositor.

## Estado Git auditado

| Item | Estado |
| --- | --- |
| Branch | `sprint-51-central-de-voos-mvp` |
| HEAD | `7eba8d97d107d56a2fdac02b13abbf1987228ce4` |
| Commit | `merge: preserve highlights empty state` |
| Working tree no início da auditoria | limpo |
| `stash@{0}` | `On hotfix/sprint-50-grand-mercure-mobile-composition: WIP Sprint 50 antes da auditoria de recuperação visual` |
| `stash@{1}` | `On sprint-38-grand-mercure-carioca-final: WIP Grand Mercure carioca completo antes do refino da main` |

Os stashes são preexistentes e não foram aplicados, removidos ou alterados.

## A. Versão atual — Central de Voos MVP

### Decisões de produto preservadas

- Sem OPERA Cloud, PMS, importação de hóspedes, nome do hóspede ou sessão verificada.
- Sem FlightAware em produção, API paga ou afirmação de status em tempo real.
- Sem associação direta entre voo e `roomToken`.
- `roomToken` permanece uma capacidade temporária de contexto do apartamento, não uma autenticação de identidade.
- Voo manual permanece somente no dispositivo, escopado ao hotel, com expiração e remoção explícita.
- Nenhum dado pessoal é necessário ou persistido.
- O módulo é `travel.flights`, opcional e habilitado por hotel.
- `travel.flights` não entra no baseline automático atual.
- A referência visual aprovada orienta hierarquia e organização, mas a implementação deve usar componentes, tokens, tipografia e responsividade reais do repositório.
- O card da home aparece apenas quando o entitlement está habilitado.
- Não haverá quinto item no bottom dock.

### Experiência pública aprovada

A ordem conceitual é:

```text
Hero
  → grade temática atual
  → card horizontal “Acompanhe seu voo”
  → Destaques
  → restante da experiência
```

A Central terá três abas:

1. Meu voo
2. Partidas
3. Chegadas

No MVP, “Meu voo” aceita aeroporto de origem, destino, companhia, número do voo e data/hora planejada. O produto deve usar textos inequívocos, como “Informado por você”, “Status não verificado” e “Consulte a situação atual no canal oficial antes de sair”. Sem fonte licenciada, são proibidas afirmações como “no horário”, “atrasado”, “cancelado”, “embarcando”, terminal confirmado, portão confirmado ou tempo real.

“Partidas” e “Chegadas” devem apresentar aeroportos configurados pelo hotel e caminhos para fontes oficiais; não devem fabricar painel operacional. Se uma fonte oficial não fornecer uma integração pública validada, a aba funciona como diretório editorial de consulta.

### Sistema de módulos e entitlements

#### Estado atual

- `ModuleKey`, `MODULE_KEYS`, `MODULE_CATALOG` e `BASELINE_MODULE_KEYS` ficam em `lib/modules/catalog.ts`.
- O catálogo possui 19 chaves: `core.directory`, `content.services`, `content.departments`, `content.policies`, `content.announcements`, `content.banners`, `rooms.qr`, `content.languages`, `experience.appearance`, `experience.navigation`, `experience.preview`, `experience.seo`, `fb.menu`, `content.tourism`, `analytics.basic`, `analytics.advanced`, `integrations.thex`, `integrations.opera` e `audit.access_logs`.
- O baseline possui 12 chaves: `core.directory`, os módulos de conteúdo atualmente disponíveis, `rooms.qr`, aparência, composição, preview e analytics básico.
- A Platform agrupa o catálogo e chama `updatePlatformHotelModuleAction`, que valida a chave e delega ao RPC auditado `update_platform_hotel_module`.
- O Admin chama `getCurrentHotelEntitlements()`/`get_current_hotel_modules`; o layout filtra a sidebar e `requireHotelModule()` bloqueia acesso direto a módulos indisponíveis.
- O banco contém listas fechadas equivalentes nos RPCs e na constraint de `hotel_module_entitlements`. Uma migration futura precisa atualizar todas essas listas em conjunto.

#### Inclusão proposta de `travel.flights`

- Adicionar ao catálogo como `available`, grupo `operations`, com nome “Central de Voos”.
- Não adicionar a `BASELINE_MODULE_KEYS` nem ao conjunto de módulos provisionado automaticamente no onboarding.
- Atualizar, na mesma migration futura, a constraint e os RPCs `is_hotel_module_enabled`, `get_platform_hotel_modules` e `update_platform_hotel_module`, além dos testes/preflights que conferem o catálogo fechado.
- Manter a Platform responsável apenas por habilitar/desabilitar o módulo. Aeroportos, links, textos e ações continuam no `/admin` do hotel.
- O público deve receber uma capacidade calculada no servidor. A presença de configuração não substitui o entitlement.

### Home pública e ponto de inserção

O despacho por tema ocorre em `components/public/hotel-public-page-content.tsx`.

| Tema | Home | Slot proposto |
| --- | --- | --- |
| Grand Mercure | `components/public/grand-mercure/grand-mercure-public-home.tsx` | imediatamente depois de `{cardGridSection}` e antes de `{highlights}` |
| Mercure | `components/public/mercure/mercure-public-home.tsx` | imediatamente depois de `{cardGridSection}` e antes de `{highlights}` |
| Novotel | `components/public/novotel/novotel-public-home.tsx` | imediatamente depois de `{cardGridSection}` e antes de `{highlights}` |
| Genérica | `components/public/hotel-public-page-content.tsx` | slot explícito independente depois da área de cards/quick info e antes de Destaques, sem integrar o card ao catálogo do compositor |

No Grand Mercure, a seção carioca permanece depois de Destaques. Em nenhum tema o novo card deve alterar Hero, grade, Destaques, suporte, footer ou dock.

O card não deve ser adicionado a `lib/experience-layout.ts`: entitlement de produto e composição editorial são contratos diferentes. Transformá-lo em um nono bloco faria o Sprint 51 alterar o compositor aprovado na Sprint 50.

### Rotas públicas

#### Padrão real

- Slug: `app/hotel/[slug]/explorar/[area]/page.tsx`.
- Subdomínio: `app/explorar/[area]/page.tsx`, condicionado a `isHotelSubdomainContext`.
- Ambas as entradas validam a área, carregam o hotel por seu contexto e hoje renderizam `HotelPublicAreaContent`.
- `lib/public-routes.ts` mantém a lista fechada `PUBLIC_HOTEL_AREA_KEYS` e gera `/hotel/{slug}/explorar/{area}` ou `/explorar/{area}`, preservando `?lang=en|es`.

#### Proposta

- Acrescentar `voos` a `PUBLIC_HOTEL_AREA_KEYS` numa etapa futura.
- Reutilizar as duas rotas dinâmicas existentes e fazer dispatch de `voos` para um componente especializado da Central antes do conteúdo genérico de áreas.
- Proteger os dois caminhos com o mesmo entitlement `travel.flights`; módulo desabilitado deve resultar em indisponibilidade consistente, preferencialmente `notFound()` para o público.
- Continuar usando `buildPublicHotelAreaHref()` para gerar os dois formatos e preservar idioma/contexto.
- Não adicionar `voos` aos itens dos docks. O card da home é a entrada principal; a Central mantém a navegação já existente e um retorno para a home.

### Proposta da tela pública

Uma camada compartilhada deve concentrar estado, validação, armazenamento local, geração de calendário e URLs externas. Cada marca fornece apenas a moldura visual adequada. Isso evita duplicar regras sem homogeneizar as experiências.

- Cabeçalho/hero interno: reaproveitar `GrandMercureAreaHero`, `MercureAreaHero` e `NovotelAreaHero`; a experiência genérica usa os tokens `--hotel-*`.
- Idiomas: reaproveitar `LanguageSwitcher` e o contrato PT/EN/ES.
- Navegação: reaproveitar `GrandMercureMobileNavigation`, `MercureBottomDock` e `NovotelMobileNavigation` sem nova chave de dock.
- Analytics: reaproveitar `PublicAnalytics`, apenas após ampliar o contrato fechado de eventos.
- Serviços: reaproveitar `getServiceDestination()` e os serviços/departamentos publicados quando uma ação apontar para conteúdo já existente.

### Card da home por tema

O card compartilha semântica, acessibilidade e destino, mas cada home controla seu wrapper e sua composição visual.

| Tema | Fonte visual do repositório | Direção do card |
| --- | --- | --- |
| Grand Mercure | tokens marfim/dourado de `lib/hotel-theme.ts`: superfície `#FFFDF9`, texto `#2B2926`, accent `#B08D57`, borda quente e tipografia Avenir/Montserrat | peça editorial clara, filete/acento dourado, contraste escuro e raios/sombra já usados pela marca |
| Mercure | tema oficial e variáveis locais da home, especialmente plum `#52204f`/`#71386e`, warm white e rose | card branco/quente com hierarquia plum e ornamentação mínima coerente com a home |
| Novotel | tokens `--hotel-*`: primary `#003B7A`, accent `#0072CE`, superfície branca e fundo azul-claro | card branco/azul, geometria e contraste equivalentes aos cards atuais |
| Temas futuros/genérico | `--hotel-surface`, `--hotel-primary`, `--hotel-text-muted`, `--hotel-border`, `--hotel-accent`, raios e sombras do preset | apresentação totalmente baseada em tokens, sem hardcode de marca |

O CTA deve ser um link real para a Central, com foco visível e área de toque adequada. O card não deve exibir voo armazenado nem qualquer detalhe sensível na home.

### Admin proposto

#### Entrada e permissão

- Rota: `/admin/voos`.
- Grupo da sidebar: “Experiência do hóspede”.
- Módulo: `travel.flights`; a entrada desaparece quando desabilitada.
- Leitura: papel `visualizador`.
- Mutação de configuração: papel `editor` ou superior. Esta escolha é mais conservadora que `operador` porque a tela define integrações, links e comportamento público do hotel; deve ser confirmada antes da implementação.
- `app/admin/voos/layout.tsx` deve chamar `requireHotelModule('travel.flights')`.

#### Estrutura

1. Geral
2. Aeroportos
3. Links oficiais
4. Ações e Serviços
5. Textos
6. Widget/Card da Home

Usar `AdminPageHero`, `AdminSurface`, `AdminSectionTitle`, `AdminField`, inputs/selects/checkboxes e `AdminEmptyState` de `components/admin/ui.tsx`. Server actions devem seguir o padrão atual: `'use server'`, `requireAdminAccess`, validação normalizada, escopo obtido do perfil autenticado, gravação protegida por RLS/RPC, auditoria, `revalidatePath` e feedback por redirect.

As configurações não devem receber `hotel_id` confiado do browser. O tenant vem da sessão/perfil. Escritas que alterem ordem ou várias entidades em conjunto devem preferir RPC transacional e auditado.

### Platform proposta

A página atual `app/platform/hoteis/[id]/page.tsx` já apresenta módulos por grupo. Ao ampliar o catálogo e os RPCs, `travel.flights` aparecerá no grupo Operação e poderá ser habilitado/desabilitado pelo fluxo auditado existente.

A Platform não deve editar aeroportos, companhias, textos, ações ou widget. Esse conteúdo pertence ao hotel e permanece em `/admin/voos`.

### Banco — proposta conceitual, sem migration nesta fase

A auditoria não encontrou tabelas de aeroportos, companhias aéreas ou voos. `hotel_sections` e `hotel_departments` podem ser referenciados por ações, mas não substituem o catálogo canônico necessário. O MVP não precisa de tabela para o voo informado pelo hóspede.

#### `airports`

Catálogo global e não sensível.

- `id uuid` PK
- `iata_code text` único, normalizado e obrigatório
- `name text`, `city text`, `country_code text`
- `timezone text`
- `latitude numeric`, `longitude numeric`
- `official_url text` opcional
- `is_active boolean`
- `created_at`, `updated_at`

#### `hotel_airports`

Vínculo configurável entre hotel e aeroportos; substitui qualquer hardcode de GIG, SDU ou SSA no frontend.

- `hotel_id uuid` FK
- `airport_id uuid` FK
- `display_order integer`
- `is_enabled boolean`
- campos editoriais não sensíveis, caso necessários, como instrução curta de deslocamento
- PK/unique em `(hotel_id, airport_id)`

#### `hotel_flight_settings`

Configuração operacional por hotel, sem duplicar o entitlement.

- `hotel_id uuid` PK/FK
- aba inicial e preferências editoriais permitidas
- referências opcionais para ações/serviços publicados
- configuração do widget/card e textos, caso o contrato de tradução adotado não use tabela própria
- `created_at`, `updated_at`

O entitlement continua sendo a única autoridade para disponibilizar o módulo. Um campo de widget pode controlar apresentação interna somente se o produto aprovar essa segunda chave; não deve religar um módulo desabilitado.

#### `airline_official_links`

Catálogo global de links oficiais, sem status de voo.

- `id uuid` PK
- `iata_code` e/ou `icao_code`, com unicidade adequada
- `airline_name text`
- `status_url text`, `manage_booking_url text`, `check_in_url text` opcionais
- `is_active boolean`
- `created_at`, `updated_at`

Se textos multilíngues crescerem, preferir tabelas de tradução coerentes com banners, seções e departamentos, em vez de colunas soltas por idioma.

#### Segurança futura de banco

- RLS habilitada em toda tabela hotel-scoped.
- Leitura admin exige `has_active_hotel_role(hotel_id, 'visualizador')` e entitlement.
- Escrita exige papel definido e entitlement.
- Leitura pública deve expor somente view/RPC com hotéis ativos, módulo habilitado e registros ativos; nunca expor configuração privada.
- Catálogos globais devem ter mutação restrita à Platform/service role.
- Toda mudança operacional relevante deve gerar auditoria sem copiar URLs com tokens, voo manual ou informação do hóspede.

### Armazenamento local do voo manual

O único padrão de storage encontrado é `sessionStorage` em `components/public/public-analytics.tsx`, usado em efeito client-side para deduplicação. Não há contrato atual de `localStorage` ou IndexedDB.

Contrato recomendado:

```ts
type StoredManualFlightV1 = {
  version: 1;
  hotelId: string;
  flight: {
    originIata: string;
    destinationIata: string;
    airlineCode: string | null;
    airlineName: string;
    flightNumber: string;
    scheduledAt: string; // ISO 8601 com offset ou UTC
    source: 'guest_manual';
  };
  savedAt: string;
  expiresAt: string;
};
```

- Chave: `libguest:flights:v1:{hotelId}`. O UUID é preferível ao slug por não mudar com renomeação.
- Não armazenar nome, contato, reserva, apartamento, `roomToken`, cookie ou identificador de sessão.
- Validar tipo, versão, códigos, limites de tamanho e datas em toda leitura; remover payload corrompido.
- Expirar após o horário planejado mais 24 horas, com limite absoluto recomendado de 7 dias desde a gravação.
- Oferecer “Remover voo” e remover automaticamente quando expirado.
- Tratar `SecurityError`, quota e storage indisponível sem impedir o uso da página.
- Ler apenas depois do mount, em `useEffect`, iniciando com estado neutro para evitar divergência de SSR/hydration.
- Opcionalmente ouvir o evento `storage` para sincronizar abas do mesmo navegador.
- Exibir o fuso explicitamente; não reinterpretar silenciosamente uma data sem offset.

### Calendário

Não existe helper `.ics`, `text/calendar` ou `VCALENDAR` no repositório. O MVP pode usar um helper pequeno e sem dependência externa:

- gerar `VCALENDAR` 2.0 e um `VEVENT`;
- escapar barra invertida, vírgula, ponto e vírgula e quebras de linha segundo iCalendar;
- usar linhas CRLF;
- normalizar `DTSTART`/`DTEND` para UTC;
- usar UID determinístico baseado somente em campos não sensíveis do voo e hotel, sem identidade/roomToken;
- criar `Blob` com `text/calendar;charset=utf-8`, baixar por object URL e revogá-la;
- identificar no título/descrição que o horário foi informado pelo usuário e não é verificado.

Não é necessária uma biblioteca para esse escopo. Testes unitários devem cobrir escaping, UTC, CRLF e ausência de dados sensíveis.

### Rotas e mapas

Não foram encontrados helpers atuais para Google Maps ou Apple Maps. Não é necessária API paga nem geolocalização:

- Google Maps: `https://www.google.com/maps/dir/?api=1&destination={destino codificado}`
- Apple Maps: `https://maps.apple.com/?daddr={destino codificado}`

O destino deve vir das coordenadas/endereço do aeroporto configurado. Omitir origem permite que o aplicativo de mapas solicite/use a localização atual. Links externos usam `target="_blank"`, `rel="noreferrer"`, encoding rigoroso e rótulo acessível. Podem ser exibidas as duas opções, evitando detecção frágil de plataforma.

### Ações relacionadas à saída

| Ação | Reuso disponível | Limite do MVP |
| --- | --- | --- |
| Transfer | `hotel_sections`, categoria “Transfer”/“Mobilidade”, `getTourismSections()` e `getServiceDestination()` | abrir serviço interno ou link externo configurado; não afirmar reserva concluída |
| Recepção | `hotel_departments`, área de contato e `hotel.whatsapp_number` | abrir canal oficial existente e manter analytics não sensível |
| Despertar | não há fluxo transacional dedicado | linkar para recepção/departamento ou serviço configurado; texto deve dizer “solicitar/entrar em contato”, nunca “agendado” |
| Breakfast box | há horário de café em `hotels.breakfast_hours` e serviços/categorias, mas não há pedido transacional | mostrar orientação e linkar para serviço/recepção configurado; nunca confirmar pedido |

`ServiceActionType` atualmente aceita `standard`, `external_url` e `room_restaurant_menu`. Não se deve ampliar esse enum apenas para rotular ações da Central sem uma necessidade transacional real. Referências a serviços/departamentos existentes são suficientes para o primeiro MVP.

### Analytics e privacidade

O contrato atual está em `lib/analytics.ts` e aceita somente sete eventos: `page_view`, `language_selected`, `whatsapp_click`, `website_click`, `booking_click`, `department_click` e `service_view`. O payload possui allowlist estrita (`hotelSlug`, evento, idioma e IDs opcionais de departamento/serviço). `app/api/analytics/route.ts` valida o hotel, entitlement de analytics e vínculos tenant antes da inserção server-side. `PublicAnalytics` usa atributos `data-analytics-*` e deduplicação em `sessionStorage`.

Eventos futuros possíveis, todos sem payload de voo:

- `flights_card_open`
- `flights_manual_saved`
- `flights_calendar_download`
- `flights_official_link_open`
- `flights_map_open`
- `flights_action_open`

É proibido registrar número do voo, companhia, aeroportos, rota, data/hora, conteúdo do storage, `roomToken`, apartamento, nome, URL completa ou qualquer texto digitado. Hotel, idioma e tipo agregado do evento são suficientes. A implementação futura exige ampliar conjuntamente o enum TypeScript, validações, constraint SQL e testes; não deve reutilizar `website_click` para esconder semântica nova.

### `roomToken`: fluxo e invariantes

Fluxo atual:

1. `app/r/[roomToken]/route.ts` valida o formato e resolve um link ativo de apartamento.
2. O hotel ativo é confirmado e ocorre redirect para a entrada pública.
3. `lib/room-context.ts` grava `lg_room_ctx`, cookie HTTP-only, `SameSite=Lax`, seguro em produção e com duração de 24 horas.
4. `app/hotel/[slug]/page.tsx` revalida token/hotel antes de expor contexto do apartamento.
5. `app/servicos/[id]/page.tsx` usa o contexto apenas para resolver o cardápio correto quando aplicável.
6. `app/room-context/clear/route.ts` limpa o cookie com redirect seguro.

Invariantes:

- O token é uma capacidade de contexto do apartamento, não prova identidade.
- Não contém nome do hóspede e não deve ganhar voo, reserva, companhia ou itinerário.
- Central de Voos funciona com ou sem contexto de apartamento.
- Storage do voo é independente do cookie e escopado somente ao hotel.
- Nenhum evento de analytics/audit recebe token ou cookie.

Arquivos que a implementação do MVP não deve alterar para integrar identidade/voo: `app/r/[roomToken]/route.ts`, `lib/room-context.ts`, `lib/room-links.ts`, `app/room-context/clear/route.ts`, o fluxo de cardápio em `app/servicos/[id]/page.tsx` e as tabelas/policies de room links. Uma alteração puramente necessária de composição em `app/hotel/[slug]/page.tsx` não autoriza mudar seu contrato de room context.

### Fases concretas do MVP

#### Fase 1 — fundação do módulo

- Adicionar `travel.flights` ao catálogo TypeScript, fora do baseline.
- Criar migration única para constraint/RPCs de entitlement, sem tabelas operacionais ainda.
- Incluir navegação Admin protegida e placeholder funcional mínimo, sem exposição pública.
- Ampliar testes de catálogo, Platform, onboarding/baseline, Admin e RLS.

#### Fase 2 — modelo operacional e Admin mínimo

- Criar `airports`, `hotel_airports`, `hotel_flight_settings` e `airline_official_links` com RLS/RPCs.
- Implementar `/admin/voos` com Geral, Aeroportos e Links oficiais.
- Configurar GIG/SDU/SSA por hotel via dados administrativos, nunca frontend hardcoded.
- Testar isolamento entre hotéis, papéis e módulo desabilitado.

#### Fase 3 — rota pública e voo manual

- Adicionar área `voos` aos helpers e dispatch especializado nos dois contextos.
- Implementar abas, formulário manual, linguagem de status não verificado e storage v1.
- Implementar remoção/expiração e `.ics`.
- Adicionar links oficiais e mapas sem API paga.

#### Fase 4 — card temático e ações

- Inserir card no slot definido de cada home, condicionado ao entitlement.
- Preservar compositor, grids, Destaques, seções exclusivas e docks.
- Conectar transfer/recepção e apresentar despertar/breakfast box sem falsa confirmação.
- Validar Grand Mercure, Mercure, Novotel e tema genérico em desktop/mobile.

#### Fase 5 — analytics, conteúdo e homologação

- Adicionar somente eventos agregados aprovados.
- Completar Textos e Widget/Card no Admin, com PT/EN/ES.
- Executar testes de segurança, RLS, TypeScript, build, lint, acessibilidade e fluxos slug/subdomínio.
- Homologar desabilitação do módulo sem resíduo de rota, card ou navegação Admin.

### Primeira etapa recomendada de implementação

Começar exclusivamente pela Fase 1: introduzir `travel.flights` como módulo `available` fora do baseline e fechar todo o circuito de entitlement — catálogo, RPCs, Platform, Admin, onboarding e testes. Essa etapa cria a fronteira de segurança e rollout antes de qualquer dado ou UI pública. O critério de conclusão é provar que um hotel novo não recebe o módulo automaticamente, que a Platform pode habilitá-lo de forma auditada e que o Admin não o expõe quando desabilitado.

## B. Versão futura — Guest Context / OPERA

Esta seção preserva uma direção arquitetural futura; ela não faz parte do MVP e não autoriza código antecipado.

### Possibilidades a avaliar

- OPERA Cloud por OHIP, condicionado a contrato, escopos, ambiente, limites e licenciamento.
- Exportação segura ou SFTP quando adequado à operação, após análise de formato, frequência, reconciliação e responsabilidade.
- Modelo separado de `guest_stays`, com vínculo verificável à reserva/estadia.
- Sessão verificada, curta e revogável, distinta de autenticação administrativa e de `roomToken`.
- Personalização consentida de serviços e informações da estadia.

### Fronteiras obrigatórias

- Nunca fundir identidade, estadia ou credenciais PMS com `roomToken`.
- Nunca inferir identidade a partir do número do apartamento ou do acesso ao QR.
- Aplicar LGPD desde o desenho: finalidade, base legal, transparência, consentimento quando aplicável, minimização, retenção curta, direitos do titular e descarte verificável.
- Segredos OPERA/OHIP ficam server-side em cofre apropriado, nunca no browser, banco público, analytics ou logs.
- Acesso a guest stays exige trilha de auditoria, menor privilégio e segregação por hotel.
- Dados importados precisam de origem, horário de sincronização, reconciliação, expiração e política para indisponibilidade do PMS.
- A Central deve continuar funcional em modo não identificado; personalização futura é uma camada opcional, não uma dependência do conteúdo público.

Antes dessa versão, será necessária uma discovery específica com jurídico/privacidade, hotel, Oracle/licenciador, segurança e operação. Nenhuma tabela do MVP deve ser desenhada como atalho para armazenar identidade futura.

## Mapa de arquivos relevantes

### Git e documentação

- `docs/CENTRAL_DE_VOOS_E_PMS.md`: decisão e plano desta Fase 0.
- `docs/SPRINT_46_8_MODULE_ENTITLEMENTS.md`: fundação de módulos.
- `docs/SPRINT_47_MULTI_HOTEL_ONBOARDING.md`: baseline/onboarding.
- `docs/SPRINT_50_PUBLIC_EXPERIENCE_COMPOSITION.md`: compositor que deve ser preservado.

### Módulos, Platform e Admin

- `lib/modules/catalog.ts`: chaves, catálogo e baseline.
- `lib/admin-entitlements.ts`, `lib/server-entitlements.ts`: leitura e enforcement.
- `lib/admin-navigation.ts`, `app/admin/layout.tsx`: sidebar filtrada.
- `app/platform/hoteis/[id]/page.tsx`, `app/platform/hoteis/[id]/actions.ts`: gestão do entitlement.
- `lib/platform-queries.ts`: leitura dos módulos pela Platform.
- `components/admin/ui.tsx`: componentes de formulário e superfícies.
- `supabase/migrations/202608150001_46_8_module_entitlements.sql`: contrato SQL atual.
- `supabase/migrations/202608180001_50_public_experience_composition.sql`: baseline/composição mais recente.

### Público, temas e rotas

- `components/public/hotel-public-page-content.tsx`: despacho de homes e home genérica.
- `components/public/grand-mercure/grand-mercure-public-home.tsx`.
- `components/public/mercure/mercure-public-home.tsx`.
- `components/public/novotel/novotel-public-home.tsx`.
- `components/public/hotel-public-area-content.tsx`: áreas públicas atuais.
- `app/hotel/[slug]/explorar/[area]/page.tsx`, `app/explorar/[area]/page.tsx`: entradas equivalentes.
- `lib/public-routes.ts`: helpers e allowlist de áreas.
- `lib/public-hotel-data.ts`: loader público atual.
- `lib/hotel-theme.ts`: tokens oficiais e CSS variables.
- `components/public/*-area-hero.tsx` e componentes de mobile navigation: peças reutilizáveis.
- `lib/experience-layout.ts`: contrato a preservar, não ampliar para o card de voos.

### Serviços, analytics e contexto

- `lib/service-options.ts`, `lib/service-action-types.ts`, `lib/service-destinations.ts`: categorias e destinos reutilizáveis.
- `lib/public-hotel-areas.ts`: detecção atual de turismo/transfer.
- `lib/analytics.ts`, `components/public/public-analytics.tsx`, `app/api/analytics/route.ts`: contrato fechado de analytics.
- `app/r/[roomToken]/route.ts`, `lib/room-context.ts`, `lib/room-links.ts`, `app/room-context/clear/route.ts`: contrato de apartamento a preservar.
- `types/database.ts`: tipos gerados; só deve mudar depois de uma migration real.

## Contratos que devem permanecer preservados

1. Baseline de 12 módulos; `travel.flights` é opt-in.
2. Entitlement é a autoridade para Admin, rota e card público.
3. Compositor da Sprint 50 permanece com seus blocos atuais.
4. Ordem e identidade visual aprovadas de Grand Mercure, Mercure e Novotel.
5. Bottom docks atuais, sem quinto item.
6. Paridade entre slug e subdomínio, inclusive idioma.
7. Isolamento multi-hotel e RLS; tenant nunca confiado do browser.
8. `roomToken` sem identidade ou voo.
9. Voo manual somente no dispositivo, temporário e sem dado pessoal.
10. Status sempre não verificado sem fonte licenciada.
11. Analytics agregado, com payload fechado e sem itinerário.
12. Platform governa entitlement; Admin governa operação.

## Riscos e mitigação

| Risco | Mitigação |
| --- | --- |
| Catálogo TypeScript e SQL divergirem | migration/teste matricial único cobrindo todas as listas fechadas |
| Módulo entrar acidentalmente no baseline | teste explícito de onboarding e assert de 12 módulos atuais |
| Configuração ser tratada como entitlement | capability server-side obrigatória para card, rota e Admin |
| Card alterar o compositor Sprint 50 | slot explícito fora de `experience-layout.ts` |
| Tema compartilhado apagar identidades | regra compartilhada com wrappers de marca e tokens existentes |
| Rota slug funcionar e subdomínio falhar | testes pareados dos dois entry points e do helper |
| UI insinuar tempo real | vocabulário obrigatório e testes de copy proibida |
| Storage causar hydration mismatch | componente client-only, leitura após mount e estado inicial neutro |
| Dado local sobreviver demais ou cruzar hotel | chave por UUID, TTL, validação e remoção automática/manual |
| Analytics vazar itinerário | evento sem campos de voo, allowlist e testes negativos |
| Ação parecer pedido confirmado | CTAs de contato/consulta, sem estado “solicitado” ou “agendado” |
| Link oficial ficar obsoleto ou inseguro | administração central, validação de esquema HTTPS e flag ativa |
| Aeroportos serem hardcoded por marca/slug | vínculo `hotel_airports` administrável |
| Futuro PMS contaminar room context | guest session e `guest_stays` em domínio separado |

## Critérios de saída da Sprint 51

- Módulo opt-in comprovado e governado pela Platform.
- Admin isolado por hotel e papel.
- Rotas slug/subdomínio equivalentes e protegidas.
- Card aparece somente quando habilitado, no slot aprovado e sem mudar docks/compositor.
- Voo manual funciona sem banco, expira e pode ser removido.
- Nenhum status ao vivo é inventado.
- Links oficiais, calendário e mapas não exigem API paga.
- Ações reutilizam serviços/canais reais sem falsa confirmação.
- Analytics não coleta itinerário, identidade ou roomToken.
- Testes cobrem RLS, entitlements, temas, responsividade, armazenamento e copy de segurança.
