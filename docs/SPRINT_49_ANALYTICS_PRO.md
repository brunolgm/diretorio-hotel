# Sprint 49 — Analytics Pro

## Estado encontrado

O analytics anterior já possuía uma base segura de ingestão: `/api/analytics` validava payloads de até 8 KiB, resolvia o hotel por slug em `public_hotels`, verificava `analytics.basic` e inseria com um cliente Admin exclusivamente server-side. Browser roles não podiam inserir diretamente.

A tabela `hotel_analytics_events` continha seis eventos canônicos (`page_view`, `language_selected`, `whatsapp_click`, `website_click`, `booking_click` e `department_click`), idioma, departamento, sessão efêmera, URL, metadata e `created_at`. Os índices existentes cobriam `(hotel_id, created_at)`, `(event_type, created_at)`, departamento e sessão por hotel.

O dashboard calculava métricas no servidor da aplicação, mas lia eventos brutos pela sessão `authenticated`, fazia agregações em memória e suportava apenas hoje, 7 e 30 dias. Não existiam ranking de serviços, série temporal dedicada, jornada completa nem página `/admin/analytics`. A policy de leitura 45B e o grant `SELECT` permitiam que o browser consultasse as linhas hotel-scoped diretamente, embora a interface não fizesse isso no client.

Gaps confirmados:

- nenhum evento identificava uma consulta real à página de detalhe de serviço;
- URLs completas e uma label livre limitada ainda eram persistidas em novos eventos;
- o ID efêmero de sessão era compartilhado entre hotéis na mesma aba;
- não havia período de 90 dias nem contrato agregado no banco;
- `analytics.advanced` já existia apenas como módulo `coming_soon` e permanece assim.

## Arquitetura escolhida

A migration `202608170003_49_analytics_pro.sql` cria uma única RPC agregadora, `get_current_hotel_analytics(p_period text)`. Ela resolve `auth.uid() → profile → hotel`, bloqueia archived, exige `analytics.basic` e retorna apenas um JSON de estrutura fixa com métricas, comparação, série diária, jornada e rankings.

Eventos brutos deixam de ser navegáveis por `authenticated`: a policy `45b_hotel_read_analytics` é removida e o grant `SELECT` é revogado. A ingestão continua exclusivamente em `/api/analytics`, com `INSERT` reservado a `service_role`. Não há RPC global nem acesso por `hotel_id` fornecido pelo administrador.

## Eventos canônicos

Eventos históricos preservados:

- `page_view`
- `language_selected`
- `whatsapp_click`
- `website_click`
- `booking_click`
- `department_click`

Evento adicionado:

- `service_view`: emitido ao abrir um detalhe público de serviço e associado a `service_id` validado no mesmo hotel.

Não foram adicionados `department_view` ou `quick_link_click`: `department_click` já é o sinal real disponível para interesse em departamentos, e os três canais externos já possuem eventos específicos. Essa escolha evita métricas novas sem instrumentação inequívoca.

A coluna nullable `service_id` participa de uma FK composta `(service_id, hotel_id) → hotel_sections(id, hotel_id)`. A chave única de apoio `(id, hotel_id)` torna impossível associar, mesmo por uma inserção privilegiada, um serviço de outro hotel. A exclusão mantém `hotel_id` e aplica `ON DELETE SET NULL` somente a `service_id`; um índice simples cobre a coluna nullable. Nenhum evento histórico é reescrito ou apagado.

O `department_id` legado possui apenas uma FK simples para `hotel_departments(id)` e, portanto, compartilha conceitualmente a fragilidade que existia no primeiro desenho de `service_id`. O endpoint atual já valida o departamento no mesmo hotel e os rankings fazem join por ID e hotel. Essa FK não foi alterada nesta revisão para evitar ampliar o escopo e modificar um contrato histórico sem uma migration dedicada.

## Privacidade e ingestão

O novo payload é fechado e aceita somente:

- `hotelSlug`
- `eventType`
- `language`
- `departmentId`, exclusivamente para `department_click`
- `serviceId`, exclusivamente para `service_view`

`hotel_id`, URL, metadata, PII, apartamento, reserva, Wi-Fi e campos livres são rejeitados. Para novos eventos, `target_url` é sempre `NULL` e `metadata` é sempre `{}`; as colunas continuam no schema para preservar o histórico. IDs de serviço e departamento são validados server-side contra o hotel resolvido.

Novos eventos não enviam nem persistem identificador de sessão: `session_id` é gravado como `NULL`, preservando apenas valores históricos. A deduplicação usa timestamps locais separados por hotel e evento em `sessionStorage`: 15 segundos para visualizações, 5 segundos para idioma e 2,5 segundos para cliques. Não há cookie, fingerprint, IP ou user-agent persistido.

## Períodos e comparações

Períodos aceitos:

- `today`
- `7d`
- `30d`
- `90d`

Qualquer valor desconhecido é normalizado para 7 dias no TypeScript e rejeitado pela RPC se chamado diretamente. Não há intervalo livre ou ilimitado.

Os períodos são dias-calendário, em janelas semiabertas `[início, fim)`, usando a meia-noite do banco como fronteira. `today` contém somente hoje; 7, 30 e 90 dias incluem hoje e, respectivamente, os 6, 29 e 89 dias anteriores. A janela atual termina na próxima meia-noite. A janela anterior possui exatamente a mesma quantidade de dias, termina no início da atual e nunca se sobrepõe a ela.

A série possui cardinalidade fixa: 1 ponto para hoje e exatamente 7, 30 ou 90 pontos para os demais períodos. Eventos anteriores ao início ou a partir do fim exclusivo não entram nos KPIs. Quando a base anterior é zero, a UI apresenta “Novo período” ou “Sem base anterior”; não calcula percentual, evitando `NaN` e `Infinity`.

## Métricas e jornada

KPIs:

- visualizações públicas: `page_view`;
- ações e engajamentos: eventos diferentes de `page_view`;
- cliques em WhatsApp: `whatsapp_click`;
- reservas e site: `booking_click + website_click`;
- trocas de idioma: `language_selected`.

Cada KPI traz valor atual, anterior, delta e percentual somente quando existe base válida.

A “Jornada de engajamento” apresenta contagens de visualizações, interações e cliques externos. São volumes de eventos agregados, não usuários únicos e não um funil financeiro. Cliques externos não comprovam reserva ou receita.

## Série, rankings e insights

A série diária contém somente data, visualizações, engajamentos e cliques externos. A UI usa SVG nativo responsivo, sem dependência de charts.

Rankings limitados:

- ações: WhatsApp, Reservas, Site oficial, Serviços e Departamentos, com contagem e participação;
- serviços: top 5 por `service_view`;
- departamentos: top 5 por `department_click`;
- idiomas mais utilizados: idioma registrado em `page_view`, por PT, EN e ES, com participação. Eventos `language_selected` permanecem restritos ao KPI de trocas de idioma.

Itens apagados são ignorados ou recebem fallback neutro sem expor conteúdo de outro hotel. Os insights são determinísticos e baseados apenas nos agregados: concentração de WhatsApp, área mais consultada e tendência de visualizações. Não há IA nem inferência comercial.

## Interface administrativa

`/admin/analytics` é protegida por role hotel-scoped e por `analytics.basic`. A sidebar mostra Analytics somente quando o entitlement está habilitado. A página inclui filtro de período, cinco KPIs, tendência, jornada, ranking de ações, serviços, departamentos, idiomas e leitura gerencial. Cards e rankings são responsivos e não usam tabelas largas.

O dashboard permanece leve: mostra apenas visualizações, ações e cliques externos dos últimos sete dias, com base anterior e link para a página completa. Se `analytics.basic` estiver desabilitado, não faz a consulta nem renderiza o resumo.

`analytics.advanced` continua `coming_soon`, sem rota, toggle funcional ou uso nas queries.

## Segurança e performance

A RPC é `STABLE SECURITY DEFINER`, usa `search_path = ''` e concede `EXECUTE` apenas a `authenticated`. Ela não aceita `hotel_id`, filtra período e hotel antes de agregar e não retorna sessão, URL, metadata ou linhas brutas. Draft e suspended podem consultar; archived permanece bloqueado pelo contexto administrativo.

O índice existente `(hotel_id, created_at DESC)` atende o recorte principal de todas as agregações. Os índices históricos são preservados e somente o índice de `service_id`, necessário para a nova FK e manutenção referencial, é criado. A solução faz uma única leitura agregada por página e evita N+1.

O preflight valida schema, constraints de eventos/idiomas, policy e grants 45B, índices, helpers de autorização/entitlement e ausência prévia da RPC/coluna.

## Testes preparados

- `49_analytics_pro_rls_verification.sql`: contrato da RPC, grants mínimos, sete eventos, FK/índice, ausência de policies e de leitura raw.
- `49_analytics_pro_behavioral_matrix.sql`: isolamento tenant, cardinalidades exatas 1/7/30/90, janelas adjacentes sem overlap, exclusão de eventos fora do período, comparação, rankings, `service_id` same-hotel/cross-hotel, entitlement disabled, evento inválido, privacidade, histórico preservado e rollback.
- `analytics-pro.test.ts` e `analytics.test.ts`: catálogo, payload, períodos, comparação sem base, rankings, insights, navegação, guard, privacidade, RPC única e UI.

Os SQLs usam `BEGIN/ROLLBACK`, fixtures `example.invalid` e destinam-se apenas ao laboratório descartável. Não são executados nesta implementação.

## Limitações e analytics.advanced

Não há usuários únicos confiáveis, conversão de reservas, receita, atribuição, exportação, analytics global, benchmark, tracking cross-hotel, geolocalização, fingerprinting ou session replay. `page_view` representa visualizações de páginas públicas, não pessoas distintas.

Uma evolução de `analytics.advanced` poderá trabalhar com agregados por hotel, retenção estritamente efêmera e definições formais de funil, sem reabrir a tabela bruta ao browser. Qualquer métrica comercial, integração externa ou comparação multi-hotel exigirá contrato de privacidade e autorização próprio.
