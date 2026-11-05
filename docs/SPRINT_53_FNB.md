# Sprint 53 — F&B nativo por etapas

Implementação local na branch `sprint-53-fnb`, base
`e7b514620879f1feb91b2f62b5d27e9e529f843d`. Este documento descreve código e
validação com fixtures; não comprova configuração, publicação ou habilitação remota.

## Estado canônico — adendos aprovados após o início do Turbo 2

A Sprint 53 não está concluída. Os adendos ampliam seu escopo sem renumerar
as Sprints 54–62 e sem reabrir a implementação aprovada da Etapa A.

| Etapa | Estado | Escopo |
|---|---|---|
| A — Catálogo F&B nativo | [IMPLEMENTADO, AUDITADO E HOMOLOGADO LOCALMENTE] | Outlets, menus, categorias, itens, preços, traduções, mídia, Admin, publicação editorial, público, compatibilidade com Serviços, Goomer/room_restaurant_menu preservados e governança fb.menu. |
| B — Pedidos e painéis | [B1 PRESERVADO — B2+B3 IMPLEMENTADOS — B4 APROVADA LOCALMENTE] | Carrinho, cotação, checkout, acompanhamento e painel operacional sobre B1. GO técnico local para checkpoint Git; implantação, conteúdo e ativação operacional reais permanecem pendentes. |
| C — Impressão local | [C1+C2 PRESERVADOS — C3+C4+C5-LAB APROVADOS TECNICAMENTE — C5-REAL PENDENTE] | Admin integrado, adapter Windows Spooler e auditoria local concluídos; nenhuma propriedade/equipamento real ativado. Homologação física e operação assistida permanecem pendentes. |
| D — Evoluções posteriores | [PLANEJADO] | Detalhamento futuro; nenhum comportamento adicional é declarado implementado. |

A auditoria técnica anterior continua válida para a Etapa A da Sprint 53.
Os contratos históricos e resultados até Turbo 2 abaixo descrevem somente A;
a seção B1 ao final descreve a fundação posterior separadamente, e a seção
B2+B3 registra a jornada e operação adicionadas sobre ela em 03/11/2026.
A harmonização documental anterior não implementou B/C. A autorização posterior
de B1 implementou a fundação; a rodada B2+B3 acrescenta as superfícies descritas
ao final. O fechamento técnico local B4 está registrado abaixo; Cloud C1 e bridge C2 estão implementados e validados localmente nas seções finais. C3–C5 permanecem não implementadas.

### Histórico da decisão e seus impactos

- Decisão anterior: o fechamento consultivo excluía pedidos, carrinho, painéis
  e impressão do escopo então tratado como Sprint 53. Essa decisão fica preservada
  como histórico, não como limite vigente de toda a Sprint expandida.
- Nova decisão: catálogo é a Etapa A; pedidos/painéis são B e impressão é C,
  aprovadas e ainda não implementadas naquele checkpoint. A evolução posterior
  B1/B2/B3 está discriminada ao final. D permanece planejada.
- Motivo: incorporar os dois adendos aprovados por Bruno após o início do Turbo 2,
  distinguindo o catálogo homologado localmente do fluxo operacional futuro.
- Impacto técnico: preservar o domínio A; B/C exigem projeto, implementação e
  testes próprios de idempotência, snapshots, disponibilidade, estados, roteamento,
  fila e tratamento de falhas. Esse era o estado da harmonização documental;
  a implementação posterior de B1 está discriminada ao final, sem bridge.
- Impacto UX: manter as experiências públicas atuais e acrescentar os fluxos
  futuros conforme a etapa e o modo autorizado de cada hotel. Não redesenhar a Home.
- Pendências: detalhar e homologar B/C; avaliar D; executar a matriz permanente
  por etapa e obter autorização expressa para qualquer mudança operacional real.

## Modos externo e nativo — decisão canônica por hotel

Cada hotel poderá escolher individualmente o modo externo (TheX, Goomer ou outro
destino autorizado) ou o modo nativo LibGuest (catálogo, carrinho, pedidos e painéis
conforme a etapa homologada; impressão permanece futura). TheX como destino externo não implica integração
API TheX, que permanece na Sprint 58. Não há migração automática de modo.

Preservar QR existente, /r/[roomToken], hotel_room_links, restaurant_menu_url,
external_url e room_restaurant_menu. Histórico: o primeiro plano mantinha o
Room Service Bugan inicialmente externo/Goomer. A autorização B1 substituiu esse
alvo futuro: Restaurante Filipe, Room Service e cardápio serão native, com pedidos
no LibGuest. A substituição real exige B completa, homologação e autorização.
Goomer real, URLs, Serviços e tenant permanecem intocados nesta rodada.
A Etapa A já preserva destinos/associações explícitos; não se declara implementado
um seletor operacional público completo de modos. B1 acrescenta configuração/RPC
privada por outlet; a UX pública de B e a impressão C continuam pendentes.

## Adendo visual e independência do domínio

Complemento canônico aprovado em 03/11/2026: Gastronomia e Room Service nativos
acompanham a identidade e a versão pública atualmente utilizada por cada hotel.
Não bloquear o módulo nos quatro hotéis apenas por ainda não utilizarem V4.
Entitlements e ativação individual continuam obrigatórios em qualquer apresentação.

O domínio F&B é único e independente da versão visual. Bugan Recife usa V4 Premium;
Gastronomia, cardápio, carrinho e acompanhamento futuros devem seguir essa linguagem.
Mockups existentes são somente referência conceitual: não importar conteúdo fictício
nem redesenhar a Home V4 aprovada.
As referências são os mockups de Gastronomia V4 do chat Histórico e Planejamento;
não copiar pratos, preços, estabelecimentos, horários, fotografias ou informações
fictícias. Sua menção neste planejamento não equivale a uma nova comparação visual
com esses arquivos nem a uma homologação de carrinho/acompanhamento ainda inexistentes.

Grand Mercure Copacabana, Novotel Leme, Novotel Salvador Rio Vermelho e Mercure Rio
Boutique Copacabana permanecem nas respectivas experiências públicas atuais.
Não migrar esses quatro hotéis para V4 na Sprint 53. F&B deve funcionar nos temas
e apresentações atuais, sem duplicar regras de negócio por hotel ou versão.

[CONFIRMADO — SEM ALTERAÇÃO DE CÓDIGO NECESSÁRIA]

Conferência pontual somente leitura: lib/fb/types.ts e a migration foundation
identificam entidades por hotel/UUID e não armazenam versão visual operacional;
lib/fb/read.server.ts carrega por hotel, idioma e entitlement, sem gate V3/V4;
lib/fb/public.ts centraliza elegibilidade, preços e destino de Serviço;
components/public/public-fb-content.tsx usa essas regras e variáveis do tema.
hotel-public-area-content.tsx seleciona o catálogo por pageData.fb, sem exigir
Bugan ou V4. lib/public-hotel-data.ts lê apresentação e F&B separadamente.

As ramificações visuais existentes dos shells não são regras operacionais F&B.
Uma mudança futura apenas de apresentação para V4 não exige recadastro de
outlets/menus/itens, troca de QR, alteração de associações de Serviço ou de
configurações operacionais. B/C ainda precisarão preservar essa separação.
Não foi encontrada divergência objetiva que demande correção de código.

### Contrato de arquitetura e migração das Etapas B/C

Administração, pedidos, setores, painéis e impressão futuros deverão compartilhar
uma única estrutura de dados e regras operacionais, isoladas por tenant. Adaptar
componentes e apresentação ao tema/versão, reaproveitando lógica de negócio;
preservar entitlements, ativação individual, QR de apartamento e modos externo/nativo.
Não criar operações ou bancos paralelos por hotel, marca ou versão visual.

Quando os demais hotéis migrarem para V4 após as sprints planejadas, uma mudança
de apresentação deverá preservar IDs/dados e operação, sem recadastro de produtos,
migração desnecessária de pedidos, substituição dos QR Codes, perda de configurações
ou alteração dos vínculos entre cardápio, setores e impressoras. A apresentação
muda; os dados e a operação continuam preservados.

Esse contrato permanece obrigatório para B/C. A conferência original confirmou A;
B1 posterior acrescenta pedidos/setores transacionais e testes, sem impressão.
Não declara homologação operacional real ou preservação de impressoras inexistentes.

### Matriz visual permanente — obrigatória nas Etapas A/B/C

| Identidade | Apresentação exigida |
|---|---|
| Grand Mercure Copacabana | Versão pública atual |
| Novotel Leme | Versão pública atual |
| Novotel Salvador Rio Vermelho | Versão pública atual |
| Mercure Rio Boutique Copacabana | Versão pública atual |
| Bugan Recife | V4 Premium aprovada |
| Default | Fallback técnico |

Testar conforme a etapa: desktop/mobile, PT/EN/ES, entitlement ON/OFF,
externo/nativo e conteúdo presente/ausente. Fixtures não homologam tenants reais.
A matriz anterior com V4 sintético nos demais hotéis é evidência de compatibilidade,
não autorização de migração nem prova de suas configurações visuais atuais.

### Critérios de teste de compatibilidade e transição para V4

Na etapa correspondente, testar os cinco hotéis em suas versões/temas atuais e
Default como fallback, desktop/mobile, PT/EN/ES, entitlement ON/OFF e modos
externo/nativo, com conteúdo presente/ausente. A apresentação atual dos quatro
hotéis não deve ser inferida de uma fixture que os configure em V4.

Para a futura transição visual, usar fixtures isoladas e manter o mesmo tenant,
dados e IDs, alterando apenas a configuração de apresentação. Conferir catálogo,
associações de Serviço, QR/roomToken, destinos externos e configurações antes/depois;
em B/C, incluir pedidos/snapshots, setores, impressoras e seus vínculos. Validar que
não há recadastro, migração desnecessária, perda operacional ou duplicação de lógica.
Esse ensaio não autoriza migrar os hotéis reais nem antecipar V4 na Sprint 53.

Estado da evidência: a auditoria anterior de A e seus testes V3/V4 permanecem
válidos no escopo registrado. A matriz Auth/DB real local usou apresentações V4
sintéticas; não comprova sozinha versões atuais dos quatro tenants nem transição
com preservação de pedidos/impressoras. Esses critérios ficam como gates das etapas
correspondentes, sem declarar novos testes executados nesta atualização documental.

## RoomToken e identidade — decisão futura da Etapa B

roomToken pode fornecer contexto de apartamento. Para pedido nativo, hóspede
deverá informar nome e sobrenome e poderá informar observações. roomToken + nome
não autenticam hóspede, não comprovam reserva e não autorizam débito. Esses dados
não devem alimentar logs/analytics públicos com PII. Controles de coleta e proteção
pertencem a B. Na harmonização documental não houve implementação; B1 posterior
acrescenta persistência protegida, sem formulário público de pedido.

## Domínio

Outlets, menus, associação outlet/menu, categorias, itens, traduções e associação
Serviço/outlet pertencem ao hotel. Tipos de outlet controlados: restaurant, bar,
room_service, breakfast, cafe e other. Menu pode ser compartilhado explicitamente
por vários outlets do mesmo hotel. Categorias pertencem ao menu; itens à categoria.

Preço é informativo, em unidade monetária mínima com moeda controlada, ou sob consulta
(valor numérico nulo). Disponibilidade é editorial. Horários, alergênicos e
informações alimentares são texto cadastrado; campos ausentes ficam ocultos.
Não há inferência de ingredientes, disponibilidade operacional ou identidade.

## Segurança e governança

RLS e SELECT administrativo por hotel, perfil ativo visualizador+, módulo habilitado
e hotel não arquivado. Sem DML direto por anon/authenticated/service_role nas novas
tabelas. Mutações passam por RPCs autenticadas, com tenant derivado do perfil,
operador+, lock do hotel, revisão otimista/PT409 e auditoria na mesma transação.
Reordenação valida o conjunto completo de IDs e revisões do grupo. FKs compostas
impedem relações entre hotéis, inclusive Serviço/outlet.

Anon recebe somente a projeção mínima `get_public_hotel_fb`: hotel ativo,
core.directory e fb.menu, outlets e menus publicados/associados, categorias
publicadas e itens publicados/disponíveis. Timestamps administrativos e traduções
brutas não são expostos. Não há dados de hóspede ou roomToken no catálogo A;
a PII de B1 fica segregada em tabelas privadas próprias, sem token bruto.

`fb.menu` está available no código após fechamento local. A migration de governança
remove somente seu bloqueio de ativação explícita, preservando a função existente,
ACL e demais regras. Preflight aborta diante de definição/segurança inesperadas.
Não entra no baseline/onboarding; nenhum entitlement ou conteúdo é provisionado.
Platform Admin ativo continua sendo o único responsável pelo opt-in.

## Admin e idiomas

`/admin/cardapio` é o Admin real: seleções kind/id/parent, lista e detalhe,
associações UUID, CRUD, publicação, ordenação e exclusão confirmada com cascatas.
Visualizador lê; operador+ edita. A confirmação de exclusão também é validada na
server action; mídia só é limpa após resposta inequívoca da exclusão.

PT salva primeiro. EN/ES usam o serviço central, independentemente, após commit PT.
A origem possui source_revision distinta da revisão de edição: mídia/ordenação
não invalidam traduções. Tradução stale retorna false, não é sucesso e não recebe
retry forçado. Falha não desfaz PT. `content.languages` desligado impede chamadas
ao tradutor. Leitura pública usa fallback PT por campo, sem APIs de tradução.
`/admin/idiomas` inclui status Ausente/Parcial/Completo por campos preenchidos na
origem e revisão correspondente. Não foi criado editor manual EN/ES.

## Mídia

Imagem principal opcional para outlet/item. Upload usa os helpers existentes:
bytes/MIME/dimensões, 2 MiB, 6000×4000/24 MP, UUID server-owned, upsert:false,
prefixo hotel/fb/tipo/entidade. Escrita Storage somente no servidor após autenticação,
módulo e leitura da entidade própria. Associação usa CAS e reaproveita o fluxo
conservador já testado em Turismo, parametrizando apenas ownership; comportamento
de Turismo permanece o mesmo. Resposta ambígua preserva o upload novo.

O RPC também verifica a existência e os metadados do objeto no Storage e sua
criação após a versão lida, impedindo caminhos inventados e reutilização de
objetos antigos durante cleanup. As imagens F&B usam Image unoptimized, sem
alterar configuração global. Formulário/painel usam ID + revisão após revalidação.

Preflight recusa políticas de Storage que possam permitir escrita por browser em
hotel-assets; políticas estritamente limitadas a outros buckets são preservadas.

Galeria fica para refinamento 53.x. Slot editorial restaurant não é importado,
copiado ou associado automaticamente ao domínio F&B.

## Público, Home e legado

`/explorar/cardapio`, variante por slug e preview privado usam o catálogo nativo
somente com módulo habilitado. Outlets têm detalhe expansível e âncoras; menus
compartilhados, navegação por categoria, itens, preços e informações opcionais.
Zero outlets produz estado vazio. Home/V4 utiliza a entrada existente de Gastronomia;
sem conteúdo nativo elegível, não fabrica acesso. Nenhum item novo foi criado no dock.

Módulo desligado mantém o Cardápio legado, inclusive seu estado vazio e o primeiro
Serviço room_restaurant_menu. Serviços standard, external_url e room_restaurant_menu
continuam com os mesmos destinos. Associação F&B reutiliza o resolvedor existente;
não modifica service_action_type, restaurant_menu_url, QR impressos ou tokens.
URL própria de outlet deve ser HTTPS segura. Serviço associado conserva destinos
HTTP/HTTPS válidos do legado; URLs com credenciais/protocolos perigosos não viram CTA.

Restaurante Filipe e Room Service/Goomer são cenários sintéticos de preservação.
Nenhum registro real Bugan foi consultado ou modificado. Não há heurística por nome,
ícone/categoria/URL, migração automática ou chamada a Goomer.

## Cinco hotéis e validação

Contrato compartilhado para Grand Mercure Copacabana, Novotel Leme, Novotel Salvador
Rio Vermelho, Mercure Rio Boutique Copacabana e Bugan Recife. Default é somente a
sexta identidade técnica. Fixtures usam seis UUIDs de tenant distintos, sem UUID
de produção; isso não constitui homologação dos tenants reais.

Matriz cobre Admin, Home, Gastronomia, Menu e Room Service, PT/EN/ES, mobile/desktop,
entitlement ON/OFF, conteúdo presente/ausente e destino presente/ausente.
Há duas camadas distintas: browser/SSR com adaptadores de server actions para
regressão de componentes; e fb-authenticated.mjs, que faz login normal na aplicação
com GoTrue, PostgREST, DB e Storage locais reais, sem substituir ações centrais.
Nenhuma das duas equivale à homologação de um tenant real no Supabase remoto.

Execução SQL: `scripts/test-fb-sql-local.py` cria seu próprio container descartável
e banco vazio `fb_s53`, sem rede, portas ou mounts. Runner valida
isolamento e aplica bootstrap mínimo, helper de role/auditoria canônicos, função
de governança canônica, migrations novas e matriz dentro de BEGIN/ROLLBACK.
Não é restauração integral do schema remoto nem reprodução de toda a migration chain.

Reprodução local requer a imagem já instalada:

```powershell
python scripts/test-fb-sql-local.py
node scripts/fb-local-lab.mjs up
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types tests/integration/fb-authenticated.mjs
node scripts/fb-local-lab.mjs down
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/security/fb.test.ts
$env:V3_BROWSER_CHANNEL='chrome'
node tests/browser/fb.mjs
node tests/browser/fb-ssr.mjs
```

Evidências em out/fb-*.log, out/fb-browser/report.json e screenshots locais.
Resultados finais são registrados no relatório da execução; nenhum teste chama
Goomer, TheX, OPERA ou Google reais.

## Migrations e reversão

- `20261102223413_sprint_53_fb_foundation.sql`: domínio, FKs, RLS, RPCs, projeção,
  traduções, mídia e auditoria. Reutiliza a UNIQUE(id,hotel_id) já criada por
  Guias do Quarto; não adiciona índice nem ALTER na tabela hotel_sections.
  O preflight recusa baseline sem a identidade composta canônica.
- `20261102230145_sprint_53_fb_governance_available.sql`: opt-in explícito, sem dados.

Migrations antigas permanecem intactas. Antes de aplicação futura, comparar schema,
ACLs e funções reais; preflights não autorizam contorno de drift. Aplicar schema antes
de código que usa a funcionalidade e antes de qualquer opt-in real.

Reversão funcional: desabilitar fb.menu somente mediante autorização operacional,
retornando ao legado, e reverter código se necessário. Preservar tabelas, conteúdo e
objetos Storage; não usar DROP/limpeza destrutiva como rollback automático.

## Limites da Etapa A e pendências

Sem ativação remota, conteúdo real, publicação, commit, push, merge ou deploy nesta
rodada. Homologação editorial e operacional dos cinco hotéis depende de leitura
autenticada e configuração aprovada, posteriormente. Limites por hotel: 50 outlets,
100 menus, 500 categorias e 5000 itens; textos e uploads também são limitados.

Histórico consultivo: galeria, adicionais/modificadores, carrinho, checkout,
pagamento, pedido, cozinha, impressão, mesa, PDV, débito, estoque e status em tempo
real eram excluídos do fechamento original. Com os adendos, pedidos, carrinho,
painéis e impressão estão fora somente da Etapa A, nas futuras B/C acima.
Galeria continua como refinamento 53.x; não há escopo adicional implícito para mesa.

Continuam fora da Sprint 53 atual: integração API TheX (58), PMS/OPERA/OHIP (59),
pagamento nativo, PIX/cartão, débito automático em apartamento, lançamento direto
em PDV, estoque em tempo real salvo decisão futura e Billing. Sem external_id
obrigatório, credenciais, jobs, webhooks ou metadata de integração sem uso atual.
Turismo não foi reaberto; nenhum dado de seus hotéis, conteúdo ou governança mudou.


## Turbo 1 — resultados históricos preservados

Estes números são anteriores à auditoria autenticada desta rodada:

| Gate | Turbo 1 |
|---|---|
| F&B direcionado | 86/86 |
| Segurança completa | 711/711 |
| PostgreSQL mínimo isolado | 194/194, com rollback |
| Browser com adaptadores | 1524/1524, seis identidades e 12 screenshots |
| SSR com adaptadores | 391/391 |
| Regressão V3/V4 existente | 152 cenários |
| TypeScript | Sem erros |
| Lint | Sem erros, quatro avisos históricos |
| Build e diff check | Aprovados naquela rodada |

Os adaptadores não homologam login/Auth/Storage. O verificador V4 foi alinhado
ao baseline aprovado e7b5146, que já apresentava essenciais no desktop.
A árvore inicial tinha 21 modificados e 24 novos, sem stage.

## Auditoria e laboratório autenticado — Turbo 2

Contrato, achados, auditoria de migrations, locks, matriz por hotel, resultados
atuais e classificação integral de paths estão em
[SPRINT_53_FNB_AUDIT.md](SPRINT_53_FNB_AUDIT.md).

O laboratório exclusivo usa PostgreSQL, GoTrue, PostgREST e Storage reais,
52 migrations e tabelas iniciais físicas reconstruídas do contrato versionado.
Não é dump/restauração de produção. A transição histórica local de analytics é
explícita e não autoriza contornar drift remoto.

As portas 4317/54347 devem estar livres. Docker deve usar socket local e possuir
as imagens fixadas em scripts/fb-local-lab.mjs; não há pull/download automático.
Node 22 e dependências do checkout são necessários; browser usa Chrome instalado
ou canal explicitamente configurado. Execute down mesmo após falha de teste.
Credenciais são aleatórias e os arquivos efêmeros são removidos no down.
Não reutilize containers/dados de outra execução ou projeto.

A leitura administrativa usa páginas internas com count exato: não trunca itens,
associações ou status de idiomas no limite da Data API. O layout não foi paginado.
Preços respeitam unidade mínima da moeda; o editor recebe valor decimal.
Guias do Quarto mantém sua UNIQUE original; a Sprint 53 não cria a duplicata.
Nenhuma operação remota, habilitação real, conteúdo real ou publicação técnica
é autorizada por este relatório local.

## Etapa B1 — fundação transacional local (03/11/2026)

[B1 IMPLEMENTADO LOCALMENTE] A Etapa B completa não está concluída.
B2 (experiência de oferta/carrinho/checkout), B3 (UI de painéis/acompanhamento) e
B4 (consolidação/ativação operacional) continuam pendentes. C não foi implementada.
Não há nova rota HTTP de checkout, carrinho público ou alteração da Home.

### Nova decisão Bugan — substitui o primeiro plano operacional

O alvo aprovado passa a ser Restaurante Filipe, Room Service e cardápio native,
com pedidos registrados pelo LibGuest quando houver ativação operacional.
O primeiro plano de Room Service inicialmente Goomer fica registrado como histórico,
não como alvo futuro vigente. A troca real exige B completa, homologação e autorização.
Não foi removida URL, desativado Serviço, consultado tenant real ou executada migração
operacional. External/Goomer permanece suportado genericamente e em regressão histórica.
O cenário B nativo usa fixtures próprias; os arquivos históricos de A não foram editados.

### Schema, configuração e fronteiras

Migration aditiva: 20261103035109_sprint_53_b1_orders_foundation.sql, criada pela CLI.
O schema fb_order_private segue a convenção privada já usada por fb_private e
flight_private. São 27 tabelas separando configuração, fatos, credenciais e PII:

- Configuração: hotel_settings, outlet_settings, service_entrypoints, sectors,
  operator_grants, item_fulfilment, modifier_groups, modifier_options, combos,
  combo_slots, combo_choices, combo_menus, availability_scopes,
  availability_windows e availability_exceptions.
- Operação/fatos: orders, order_groups, order_lines, order_line_options,
  order_events e cancellation_requests.
- Dados protegidos/temporários: order_private_data, order_line_notes,
  guest_sessions, idempotency, order_access_tokens e admission_buckets.

Separações mantidas por diferenças reais de retenção, ACL e imutabilidade; não
foram criadas tabelas de impressora, bridge ou job físico. FKs compostas isolam
hotel e pedido. Índices de referências reversas protegem exclusões existentes em A.
IDs de origem nos snapshots não têm FKs destrutivas para catálogo vivo.

Não há provisionamento por hotel ou auto-enable. Master switch ausente/desligado
impede novos pedidos; modo é por outlet. Sem configuração B, A/legado seguem iguais.
service_entrypoints resolve explicitamente o caso de vários outlets no mesmo Serviço,
sem alterar service_action_type. Nenhum nome de hotel ou versão visual participa do
schema. Os adaptadores visuais permanecem uma responsabilidade de B2/B3.

RLS em todas as tabelas, sem policies genéricas e sem grants diretos de tabela/schema
para anon, authenticated ou service_role. Helpers privados sem EXECUTE público.
RPCs têm ACL específica, SECURITY DEFINER, search_path vazio e autorização interna.
Service role só executa a fronteira pública server-side e manutenção; não assume
capabilities administrativas. Mutações administrativas usam JWT real, perfil ativo,
hotel derivado do perfil, role mínima, capability e CAS/PT409. Revisão nula é rejeitada.

### Capabilities e configuração

Não há nova role. As capabilities são orders.read, orders.transition, orders.cancel,
orders.supervise, orders.pii.read e orders.configure. Operador+ pode receber escopo
por setor; configuração exige editor+; somente administrador concede/revoga.
Concessões são explícitas e auditadas, inclusive para o próprio administrador.
Visualizador não recebe pedidos; Platform Admin não herda PII. Desativação de setor
impede novas confirmações, preservando histórico e leitura autorizada para drenagem.

save_current_hotel_fb_order_config é uma superfície com kind/fields permitidos,
tipos estritos, pais imutáveis, limites e CAS; não é persistência de JSON arbitrário.
get_current_hotel_fb_order_config devolve somente configuração do hotel autorizado.
Configurações têm teto inicial de 10000 linhas por tabela/hotel.

### Confirmação e segurança pública

begin_fb_order_session emite contexto técnico via servidor; não faz login de hóspede.
quote_fb_order recalcula oferta e confirm_fb_order faz a transação completa:
validar sessão/hotel/módulo/modo, horário, ancestrais publicados, opções, moeda,
quantidades, preço, contexto de apartamento, setores; inserir pedido, snapshots,
PII segregada, grupos, evento inicial, credencial e resultado idempotente; commit.
Não existe sucesso parcial. Resposta registered significa aguardando aceite operacional.

Pedido pertence a um hotel/outlet/moeda. Limites iniciais: 20 linhas comerciais,
60 folhas de produção, 100 unidades expandidas e 16 opções por item.
Valores são unidades mínimas inteiras; total limitado a 10^12; sob consulta não vira zero.
Cotação divergente retorna conflito. B2 ainda deve construir o contrato HTTP de
cotação reconhecida pelo usuário, origem/CSRF, cookies e checkout, sem confiar em
preço do browser. As funções B1 são server-only e não há INSERT anon.

Sessão usa segredo aleatório de 32 bytes; o banco guarda digest. Acompanhamento
usa outro segredo opaco de 256 bits por tentativa/pedido. HKDF padrão, com separação
de contexto, permite recompor a mesma credencial após resposta perdida, sem guardar
segredo bruto. Não é criptografia de campo. Factories de cookies HttpOnly/Secure/
SameSite=Lax têm paths restritos; aplicação HTTP dos cookies fica em B2/B3.
Não usar segredo em URL/query/log/analytics.

Idempotência: hotel + sessão + UUID da tentativa; fingerprint da intenção normalizada
sem body persistido. Mesma chave/mesma intenção recupera resultado, divergência PT409,
concorrência cria uma vez, rollback não deixa sucesso. Validade de 24h; sessão expirada
não pode abrir nova criação. Replay confirmado é recuperável mesmo com módulo OFF.
Não renova indefinidamente chave, sessão ou token.

Entrega exige roomToken revalidado contra hotel/token/ativo e rooms.qr. Número de
quarto do browser não é aceito. roomToken não autentica hóspede nem autoriza débito.
Sem contexto, somente retirada explicitamente habilitada. Nome/sobrenome são
autodeclarados. Não se coletam CPF, contato ou pagamento.

### Adicionais, combos, horários e setores

Grupos por item: single/multi, min/max, ordem e disponibilidade. Opções têm acréscimo
na mesma moeda do item; duplicação da mesma opção, inclusive variação de caixa do UUID,
é rejeitada. Observação não substitui opção obrigatória.

Combo é entidade própria com slots/escolhas/multiplicidade, menus e preço-base
explícitos. Sem combo aninhado ou desconto inferido. Uma linha comercial cobra o
combo; componentes de produção cobram zero separadamente e seus acréscimos apontam
para a linha comercial. Setores podem ser distintos, sem duplicar pedido/cobrança.

Horário usa timezone explícito validado no catálogo PostgreSQL, dias/janelas,
meia-noite, intervalos [início,fim), exceções e fechamento manual com término opcional.
Outlet exige calendário explícito ou always_open controlado. Menu/item sem regra
adicional herdam restrições; nunca reabrem ancestral fechado. display_mode permite
hide/show_unavailable para consumidores futuros. opening_hours textual de A não
é interpretado. Exceção de fechamento prevalece em sobreposição.

Setor vem do item naquele outlet ou do padrão do outlet. Ausência/setor inativo
bloqueia confirmação. Não existe inferência por nome, categoria ou marca.

### Leitura, estados, cancelamento e C

RPCs get_current_hotel_fb_order/panel retornam fatos filtrados por setor;
get_current_hotel_fb_order_pii é separada, exige read + pii.read no escopo e audita
somente IDs. get_fb_order_status exige credencial opaca, sem PII. Paginação de painel
é keyset, limitada a 50, com pedidos abertos e terminais recentes.

Grupos: registered → accepted → preparing → ready → out_for_delivery → delivered;
retirada usa ready → delivered. Sem regressões ou printed. Estado geral conserva
o menor progresso dos grupos; não declara aceite/entrega integral antecipadamente.
Cada write válido grava evento e auditoria administrativa na mesma transação.
Criação pública grava evento guest, sem inventar ator administrativo.

request_fb_order_cancellation cancela automaticamente somente antes de qualquer
aceite, conforme janela/auto/livre do hotel; após aceite cria solicitação.
decide_current_hotel_fb_order_cancellation exige capability em todos os setores;
após saída exige também supervisão. Entregue não é cancelado por essa operação.
Cancelar não exclui pedido nem afirma cancelamento de impressão física.

get_current_hotel_fb_acceptance_events fornece event_id/contract_version/hotel/
order/group/sector/revision/timestamp/line refs estáveis, sem PII. É fronteira C,
não fila física ou impressão. Polling de 3–5s com backoff/pausa/reconexão está
aprovado para B3; B1 prepara leitura, sem UI ou consumidores Realtime.

### Retenção, redaction, admissão e operação futura

PII em order_private_data/order_line_notes: 7 dias após terminal; pedido nunca
encerrado tem teto de 7 dias e alerta, sem fingir cancelamento/entrega.
Fatos/histórico: 180 dias desde criação. Token: min(criação+7d, terminal+24h).
Idempotência: 24h. Leitura já oculta PII/credenciais vencidas antes do expurgo.
Dados expirados não são ressuscitados por terminal tardio.

purge_expired_fb_order_data faz expurgo físico restrito, em lotes, alerta pedidos
abertos antigos e remove fatos ao final da retenção. Agendamento/monitoramento
efetivos são gate obrigatório de B4 antes da ativação real; nenhum scheduler remoto
foi configurado nesta rodada. Não se promete remoção imediata de backups.
Criptografia de campo adicional segue em análise de key-management; não foi criada.

admit_fb_order_attempt usa buckets próprios e incremento distribuído atômico;
não compartilha quotas AirLabs. Tetos conservadores por minuto: sessão 5, quarto 10,
rede/acesso 60 e hotel 120. Nova confirmação impõe sessão/hotel no banco. B2 deve
orquestrar admissão também antes de parsing/trabalho caro e nos endpoints de
sessão/consulta; digest de rede só de contexto confiável, nunca IP/roomToken bruto.
Falha não libera confirmação ilimitada.

Boundary server-only normaliza erros por código, sem repassar mensagens/details
do provedor, nomes, quarto, body ou segredos. Não há emissão para analytics públicos.
Snapshots e eventos têm proteção append-only; somente manutenção restrita expira fatos.

### Evidência e pendências

Runners novos: tests/integration/fb-b1.mjs, fb-b1-adversarial.mjs e
fb-b1-lost-response.mjs; matriz supabase/tests/53_b1_foundation_matrix.sql e
tests/security/fb-b1.test.ts. Usam o laboratório descartável existente, Auth real,
19 usuários sintéticos e seis identidades distintas. Nenhum tenant real foi lido.
O contador legado do launcher A imprime 52; a cadeia atual tem as 52 anteriores
mais a migration B1 (53), sem editar o launcher histórico.

Fechamento desta execução:

| Gate | Resultado |
|---|---|
| B1 real Auth/PostgREST/DB | 617/617; seis tenants, 19 usuários sintéticos, 53 migrations |
| Matriz SQL B1 | 214/214, rollback |
| Matriz SQL A | 197/197, rollback |
| Direcionados B1 | 9/9, incluídos na segurança completa |
| Segurança completa | 724/724; antes 715 |
| TypeScript | Exit 0 |
| Lint | Zero erros, quatro avisos históricos |
| Build | Exit 0, rede externa bloqueada e provedores desativados |
| Diff check | Sem erros |

Evidência da rodada integral: out/libguest-fb-auth-90a62495/b1-report.json e
b1-sql-matrix.log. Logs de gates em out/fb-b1-*.log; não são aprovados para stage.
Matriz: Grand Mercure Copacabana, Novotel Leme, Novotel Salvador Rio Vermelho,
Mercure Rio Boutique, Bugan e Default usam UUIDs distintos; todos exercitam
external/native/misto, OFF/ON, contexto válido/inválido/ausente, permissão/PII,
idiomas e mudança apenas de apresentação preservando o mesmo pedido.
Bugan termina no alvo nativo dos dois outlets; o teste externo é regressão separada.
É homologação transacional sintética, sem UI visual B1 ou tenant real homologado.

Concorrência real: criação idempotente e CAS de grupos com dois usuários;
falha tardia imposta por trigger com rollback de pedido/chave; proxy HTTP
desconecta o cliente durante lock real, upstream confirma e retry recupera um
único pedido/evento. Snapshot persiste após edição/exclusão de catálogo.
PII expirada fica invisível antes do purge; purge físico e alerta foram exercitados.
Os Serviços e vínculos QR originais das seis fixtures terminaram idênticos.

Reprodução B1 em laboratório novo (imagens já em cache, sem pull):

~~~powershell
node scripts/fb-local-lab.mjs up
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types tests/integration/fb-b1.mjs
node --input-type=module -e "import{labSql}from'./scripts/fb-local-lab.mjs';import{readFileSync}from'node:fs';console.log(labSql(readFileSync('supabase/tests/53_b1_foundation_matrix.sql','utf8')))"
node scripts/fb-local-lab.mjs down
~~~

Executar down também após falha; não reaproveitar outro projeto. A emissão de
usuários é GoTrue real local; não há mocks substituindo Auth, RLS ou transação.
Os 714 arquivos rastreados fora dos dois documentos canônicos foram comparados
por SHA-256 com o checkpoint: preservados, incluindo código A, testes históricos,
auditoria A e as 52 migrations anteriores. Nenhum stage/commit/push/deploy.

B2: montagem/cotação/checkout HTTP, UX e modos visuais reais.
B3: UI operacional/acompanhamento e polling.
B4: carga, integração final, scheduler/monitoramento de retenção, runbooks de
drenagem antes de arquivamento, homologação e ativação autorizada.
Não se declaram esses itens ou tenants reais homologados a partir das fixtures.

## B2+B3 — jornada pública e operação local sobre B1 (03/11/2026)

Estado desta seção: **B2+B3 implementados e validados localmente; B4 e C pendentes**.
**GO técnico local B2+B3**, com a regressão autenticada A completa reconfirmada.
Isso não é homologação editorial/operacional nem autorização de ativação real. Base
conferida antes das escritas: `sprint-53-fnb`, HEAD
`f8d8769e96c60df25bd356c1ceed4dd57db8bc0f`, igual à referência local de origem,
árvore limpa. Não há autorização para stage, commit, push, merge, deploy,
Supabase remoto, ativação real ou alterações no worktree content-bridge.

### Fronteiras e apresentação

Um único B1 continua sendo a autoridade de intenção, preço, snapshots, setores,
idempotência, transições, cancelamento e retenção. B2 adiciona oferta/UX/HTTP;
B3 adiciona a superfície operacional no Admin existente. Não há domínio de
pedidos por hotel, lógica condicionada à marca no banco, pagamento, PMS/TheX,
Realtime, bridge, fila de impressão ou estado printed.

`/hotel/[slug]/explorar/cardapio` e `/explorar/cardapio` carregam a oferta B
somente nessa área, por importação tardia. Home, Turismo e demais áreas não
carregam o adaptador de oferta. Os componentes da Home não foram alterados.
Outlets sem modo native mantêm o catálogo/destino A. Bugan usa os tokens e a
apresentação V4; as outras quatro propriedades e Default mantêm as versões
atuais. O adaptador acompanha uma futura V4 sem alterar catálogo, pedidos, QR,
setores ou configurações. As duas referências locais de Gastronomia são apenas
conceituais: nenhum prato, preço, horário ou foto fictícia foi copiado.

Carrinho e checkout usam memória transitória por hotel/outlet/moeda. Seleções
single/multi, min/max, ordem, atividade, acréscimos, escolhas de slots e
multiplicidades vêm da oferta; B1 valida novamente. Combos têm uma cobrança
raiz e componentes de produção sem cobrança duplicada. Itens sem preço
ordenável não oferecem adição. Calendários usam B1/IANA e não interpretam
opening_hours textual. hide retira a oferta; show_unavailable desabilita a
adição. Um carrinho/resultado já existente mantém o caminho de recuperação.

### HTTP, cotação reconhecida e recuperação

`/api/fb/hotel/[slug]/[operation]`: oferta, quote, confirm e reinício explícito
de sessão. JSON allowlisted/UTF-8 limitado a 32 KiB, origem e contexto de domínio
conferidos, nenhuma autoridade de preço/moeda/hotel/setor/nome comercial aceita
do browser. Corpo do reinício é vazio. Entrega exige QR ativo do próprio hotel
já na cotação e novamente no B1 na confirmação; número/claims do cookie não
substituem o vínculo real. Retirada depende da configuração do outlet.

A migration aditiva `20261103050831_sprint_53_b23_public_journey_operations.sql`,
criada pelo CLI instalado, acrescenta quotes privadas com RLS e sem grants
diretos. Guarda somente digests ligados à sessão, preço/snapshots comerciais
produzidos pelo B1 e o vínculo da confirmação; não guarda intenção bruta,
nome/sobrenome ou observações na cotação. Referência aleatória de 256 bits,
somente seu digest no banco, validade de cinco minutos, até 20 referências
não consumidas e 200 registros retidos por sessão. A referência fica apenas na memória
do checkout, nunca em URL ou Web Storage. A cotação não reserva estoque nem
promete disponibilidade futura.

Confirmação confere referência/sessão/basket, expiração e igualdade do preço
comercial completo atual, não só total. Mudança exige nova revisão. Entrega a
intenção bruta ao normalizador original do B1; não reintroduz a representação
interna normalizada como novo input. B1 efetiva a transação; o vínculo da
cotação é gravado na mesma transação. A cotação consumida não aceita outra
chave nem outra intenção. Replay reconhecido usa a mesma idempotência B1 por
24 horas, inclusive após expirar a cotação ou desligar admissões. Credencial
de acesso continua sendo HKDF B1 determinístico por sessão/hotel/outlet/chave.
Resposta perdida/503 mantém a tentativa congelada; não troca a chave. Prazo de
recuperação encerrado pede verificar com o hotel, sem criar outro pedido.

Cookies B1 são aplicados em HTTP: sessão e acesso HttpOnly, Secure, SameSite=Lax,
host-only, paths por hotel e por pedido. A sessão fica disponível no browser
até o fim da janela possível de replay; isso não estende sua admissão no banco.
Nome/sobrenome autodeclarados e observações são removidos do estado após ACK.
Não se persiste carrinho/PII/credencial de pedido em Web Storage. Recarregar ou
fechar a aba descarta o rascunho/tentativa em memória; isso não cancela fatos
já confirmados no servidor.

Admissão HTTP separada/commitada usa sessão/credencial opaca e orçamento do
hotel, sem IP bruto ou fingerprint de dispositivo. Por credencial/minuto:
quote 15, confirm 20, cancel 10, restart 5, offer/status 60. Sem credencial,
bootstrap usa somente o teto do hotel. Teto do hotel/minuto: offer/status 1800,
restart 120, demais 240; a admissão de criação B1 sessão 5/hotel 120 continua
valendo. Validação falha não devolve o orçamento HTTP. Limites são conservadores
locais e demandam carga/observabilidade B4 antes de ativação.

### Acompanhamento e Admin

`/hotel/[slug]/pedidos/[id]` e `/pedidos/[id]` usam o cookie restrito de acesso
no endpoint `/api/fb/orders/[id]/[slug]`; UUID, referência amigável, quarto e QR
isolados não autorizam. DTO público contém apenas referência, itens/opções,
total, estados/horários, progresso e política/solicitação de cancelamento.
Não expõe PII, IDs de operador ou auditoria administrativa. Respostas privadas
são no-store/Vary Cookie/Host e no-referrer; segredo não entra em URL, analytics
ou logs. Não declara aceite, preparo, entrega ou impressão antes do evento real.

`/admin/pedidos`, navegação administrativa existente, API autenticada
`/api/admin/fb-orders` e Server Actions repetem a autorização no banco.
Nenhuma capability é concedida por role ou por ativar o módulo. Leitura/linhas
ficam no setor autorizado; PII exige read+pii.read, consulta explícita e auditoria
apenas com IDs. Transição requer read+transition; decisão de cancelamento requer
os escopos completos e supervisão quando saiu para entrega. CAS e histórico
append-only continuam no B1. Revisão concorrente gera conflito controlado.

Polling visível: quatro segundos após snapshot completo, sem sobreposição;
erro faz backoff até 30 segundos; página oculta pausa, retorno/reconexão
atualiza imediatamente. Paginação por cursor busca todas as páginas de 50 antes
de substituir o snapshot; limite defensivo de 200 páginas falha explicitamente,
sem apresentar uma lista parcial como completa. Mudança de tenant/capabilities
descarta o escopo anterior. PII é descartada ao ocultar, perder conexão/permissão
ou vencer, inclusive antes de GC; expirado tem mensagem própria.

### Drenagem sem ampliar o Admin global

Módulo/master desligado, external, suspended/draft/archived impedem novas
admissões. Pedidos existentes permanecem operáveis por perfil ativo do próprio
tenant com capabilities explícitas. A migration evolui somente os entrypoints
operacionais B1 para um actor F&B de drenagem e mantém configure/catálogo sob
os guardas anteriores. O helper global da governança continua negando archived;
nenhuma policy RLS/global Auth foi afrouxada. A consulta operacional retorna só
a identidade visual mínima do próprio hotel para essa superfície.

O proxy sobrescreve o marcador de caminho, aceitando o shell especial apenas
em `/admin/pedidos`; header recebido do cliente não abre outras rotas. Layout,
página, API e ação exigem seus guardas. A prova local confirma helper global
false e configuração negada 42501 em archived, enquanto a transição F&B
autorizada confirma e audita atomicamente. O acompanhamento seguro também
preserva os pedidos existentes com identidade mínima quando o público fecha.

GC original continua com retenções B1. Quotes antigas são removidas em lote
limitado; sessões com quotes esperam a coleta destes registros, evitando expandir
o lote por cascata. Não há agendamento remoto instalado. O rollback técnico
deve preservar as tabelas e fatos: desabilitar novas admissões, drenar e reverter
somente a apresentação/entrypoints conforme plano B4; não apagar pedidos.

### Validação e pendências desta execução

Execução consolidada B2+B3, sem foco reduzido: **2.015 verificações, zero falhas**,
seis tenants sintéticos, 31 usuários GoTrue reais, 54 migrations, 36 percursos
desktop/mobile/PT/EN/ES, zero requisições externas e zero erros de browser.
Relatório: `out/libguest-fb-auth-a56467f6/b23/report.json`; 139 screenshots em
`out/libguest-fb-auth-a56467f6/b23/screenshots/`. Auth, cookies, HTTP, PostgreSQL,
PostgREST/RLS, Storage e Server Actions são reais, sem mocks de autorização ou
transação. A recuperação simula perda da resposta somente depois de confirmar
o commit upstream real. Rollback usa falha SQL controlada apenas na fixture.

| Gate | Resultado desta rodada | Evidência ignorada pelo Git |
|---|---|---|
| B2+B3 completo | 2.015/2.015 | `out/fb-b23-final-integration.log` |
| B1 original integrado + adversos | 620/620 | `out/fb-b23-final-b1-regression.log`, `out/libguest-fb-auth-e34665a8/b1-report.json` |
| SQL B1 atual | 229/229 | `out/libguest-fb-auth-a56467f6/b23/53_b1_foundation_matrix.sql.log` |
| SQL B2+B3 | 63/63 | `out/libguest-fb-auth-a56467f6/b23/53_b23_journey_operations.sql.log` |
| SQL A original | 197/197 | `out/fb-b23-a-sql.log` |
| Segurança completa | 734/734; nenhum skip | `out/fb-b23-final-security.log` |
| SSR A original | 391/391 | `out/fb-b23-a-ssr.log` |
| Browser A original | 1.524/1.524; zero requisições externas | `out/fb-b23-a-browser.log`, `out/fb-browser/` |
| Browser V3/V4 existente | 152/152; zero chamadas API | `out/fb-b23-v3-v4.log`, `out/v4-universal/browser-report.json` |
| Auth A original completo | 1.434/1.434, mode full; zero requisições externas | `out/fb-b23-final-a-auth-retry.log`, `out/libguest-fb-auth-c5a1661b/report.json` |
| TypeScript | Zero erros | `out/fb-b23-final-tsc.log` |
| Lint completo | Zero erros; somente quatro avisos históricos de imagem | `out/fb-b23-final-lint.log` |
| Build | Aprovado; Next/Turbopack, rede externa bloqueada | `out/fb-b23-final-build.log`, `out/fb-b23-build-status.log` |

Os totais são de cada suíte, não uma soma de cenários independentes. Os testes
B1 antigos só tiveram sua cardinalidade ampliada de 27 para 28 tabelas, incluindo
a nova quote privada; nenhuma expectativa de autorização foi removida/reduzida.
O banner do gerenciador local ainda imprime o contador histórico 52; o inventário
e o relatório consolidado conferem os **54 arquivos SQL efetivamente aplicados**.

Verificação de ponta a ponta: o hóspede monta o carrinho na área Cardápio →
HTTP server-side valida sessão/QR/cotação → RPCs B1 persistem atomicamente →
cookie protegido acompanha o pedido → Admin autenticado/CAS atualiza os fatos →
polling do hóspede mostra o estado confirmado no banco.

| Fronteira | Evidência consolidada |
|---|---|
| UI renderiza | 139 capturas, zero erros de browser e seis temas/tenants |
| Client → API | Requests reais quote/confirm/status/cancel, allowlist e cookies verificados |
| API → banco | Auth/PostgREST/SQL reais; adversos, RLS, rate limit e rollback sem fatos parciais |
| Banco → resposta | Conferência dos registros persistidos, snapshots, preços e replay do mesmo pedido |
| Resposta → UI | Confirmação só depois do ACK, acompanhamento e painel sincronizados com CAS |
| Ambiente/terminal | API 127.0.0.1:54347; app local 4317; variáveis só do laboratório, rede externa bloqueada, build exit 0 |

A cobertura inclui revogar read e PII separadamente, perfil inativo/role reduzida
com cookie GoTrue ainda válido, replay de ação capturada, mais de 50 pedidos,
conflito de revisão, recuperação idempotente com admissão OFF e coleta real de
quotes limitada a uma por passagem antes de remover a sessão vazia. Os seis
tenants preservaram seus registros originais de Serviços e QR byte por valor.
A regressão A completa também reconfirmou edição/resumo além de 1.000 registros
com 1.005 itens criados por RPC autenticada, sem publicação, e removidos apenas
da fixture. Em OFF, ON vazio e ON com conteúdo, as regiões
protegidas mantiveram o mesmo DOM/identidade. Nenhum tenant real foi consultado.

Referências de screenshot, todas de fixtures sintéticas nessa pasta consolidada:

- `fb-lab-bugan-native-menu-1440-pt.png` e `fb-lab-bugan-native-menu-390-pt.png`.
- `fb-lab-bugan-checkout-1440-pt.png` e `fb-lab-bugan-checkout-390-es.png`.
- `fb-lab-bugan-tracking-1440-en.png` e `fb-lab-bugan-tracking-390-es.png`.
- `fb-lab-bugan-operations-1440-pt.png` e `fb-lab-bugan-operations-390-pt.png`.
- As mesmas jornadas públicas em PT/EN/ES e os painéis desktop/mobile existem
  para Grand Mercure, Novotel Leme, Novotel Salvador, Mercure e Default.

### Arquivos e preservação

12 arquivos existentes intencionalmente modificados: `app/admin/layout.tsx`,
`proxy.ts`, os dois `app/**/explorar/[area]/page.tsx`,
`components/public/hotel-public-area-content.tsx`,
`components/public/public-fb-content.tsx`, `lib/public-hotel-data.ts`,
`supabase/tests/53_b1_foundation_matrix.sql`, `tests/integration/fb-b1.mjs`,
`tests/integration/fb-authenticated.mjs`
e os dois documentos canônicos desta rodada.

28 novos arquivos: sete entradas page/route/action sob `app/admin/pedidos/`,
`app/api/admin/fb-orders/`, `app/api/fb/`, `app/hotel/[slug]/pedidos/` e
`app/pedidos/`; os componentes `fb-orders-panel`, `native-ordering-outlet`,
`order-tracking` e CSS nativo; oito adaptadores/DTOs em `lib/fb/orders/`
(`http-request`, `http.server`, `journey`, `offer.server`, `operations.server`,
`operations`, `rpc.server`, `tracking-page.server`); uma migration, uma matriz
SQL, seis arquivos de integração `fb-b23*.mjs` e `tests/security/fb-b23.test.ts`.

Inventário exato com SHA-256 contra os 725 arquivos do checkpoint inicial em
`out/fb-b23-preservation.json`: 53 migrations anteriores intactas, Home e demais
arquivos fora do escopo intactos. Nova migration é a 54ª. O domínio transacional
B1 continua único; somente a migration aditiva evolui validadores/entrypoints
operacionais e a coleta, sem editar o SQL B1 commitado ou abrir policies globais.

Branch `sprint-53-fnb`; HEAD inicial/final
`f8d8769e96c60df25bd356c1ceed4dd57db8bc0f`; referência local de origem igual.
Working tree contém intencionalmente 12 modificados e 28 não rastreados, todos
sem stage. Nenhum commit, push, merge ou deploy. Não houve fetch remoto nesta
rodada; a igualdade é com a referência local registrada no checkpoint.

A primeira execução Auth A parou após 145 verificações na espera do harness
por uma propriedade interna React do botão de confirmação, antes de confirmar
a desativação. O harness passa a clicar o trigger e aguardar o diálogo real
visível, sem depender da identidade do nó SSR. O diálogo/componente Platform
não foi modificado. Todas as verificações antigas de resultado no banco, URL,
permissões e regiões Home continuam; há ainda assert explícito do diálogo aberto.
Falha original preservada em `out/fb-b23-final-a-auth.log` e
`out/libguest-fb-auth-a3026834/failure.json`. A repetição completa usa outro
laboratório vazio e terminou em **1.434/1.434**, sem remoção de cenários para obter
aprovação. Nenhum componente Platform foi alterado.

Chrome headless fixa a visibilidade nativa como visible. Para testar pausa/retorno,
somente o evento/estado ambiental de visibilidade é controlado na fixture; rede,
Auth, API, timers e banco continuam reais. Offline/reconexão e revogação de
capability são exercitados de verdade. Isso não é homologação de equipamentos
ou de dispositivos físicos.

No checkpoint B2+B3 então encerrado, B4 estava pendente: carga, consolidação, scheduler/monitoramento de retenção,
runbooks/observabilidade/reversão, revisão e homologação editorial/operacional,
dispositivos reais e virada autorizada do Bugan. C continua não implementada.
Uma implantação futura precisa aplicar a migration aditiva e validar seus RPCs
e credenciais server-only antes de servir as novas rotas; ativação real é outro
gate e não decorre de publicar código. Nenhum desses passos foi executado aqui.
Não houve stage/commit/push/merge/deploy, tenant real, Supabase remoto, chamada
Goomer/TheX/OPERA/OHIP/Google/AirLabs, impressão ou alteração de conteúdo real.

Fechamento: `out/fb-b23-final-evidence.json` consolida os gates e o inventário
exato de 40 arquivos (12 modificados + 28 novos). Diff check aprovado; zero stage.
Os 713 demais arquivos do checkpoint e as 53 migrations anteriores preservam
os hashes originais. Laboratórios próprios encerrados, credenciais temporárias
removidas, sem servidor na porta 4317; relatórios e screenshots permanecem em
`out/` ignorado. A suíte A completa gerou outras 170 capturas sintéticas.

### B4 — inventário exato do diff para revisão

Nenhum stage executado. Classificação por path do diff acumulado B2+B3+B4;
`out/**`, `.env*`, `.next/**`, dumps, logs e credenciais ficam fora do checkpoint.

| Path | Classificação |
|---|---|
| `app/admin/layout.tsx` | PRODUÇÃO |
| `app/admin/pedidos/actions.ts` | PRODUÇÃO |
| `app/admin/pedidos/page.tsx` | PRODUÇÃO |
| `app/api/admin/fb-orders/route.ts` | PRODUÇÃO |
| `app/api/fb/hotel/[slug]/[operation]/route.ts` | PRODUÇÃO |
| `app/api/fb/orders/[id]/[slug]/route.ts` | PRODUÇÃO |
| `app/explorar/[area]/page.tsx` | PRODUÇÃO |
| `app/hotel/[slug]/explorar/[area]/page.tsx` | PRODUÇÃO |
| `app/hotel/[slug]/pedidos/[id]/page.tsx` | PRODUÇÃO |
| `app/pedidos/[id]/page.tsx` | PRODUÇÃO |
| `app/r/[roomToken]/route.ts` | PRODUÇÃO |
| `components/admin/fb-orders-panel.tsx` | PRODUÇÃO |
| `components/public/hotel-public-area-content.tsx` | PRODUÇÃO |
| `components/public/native-ordering-outlet.tsx` | PRODUÇÃO |
| `components/public/native-ordering.css` | PRODUÇÃO |
| `components/public/order-tracking.tsx` | PRODUÇÃO |
| `components/public/public-fb-content.tsx` | PRODUÇÃO |
| `docs/PRODUCT_MAP.md` | PRODUÇÃO |
| `docs/SPRINT_53_FNB.md` | PRODUÇÃO |
| `lib/fb/orders/diagnostics.server.ts` | PRODUÇÃO |
| `lib/fb/orders/http-request.ts` | PRODUÇÃO |
| `lib/fb/orders/http.server.ts` | PRODUÇÃO |
| `lib/fb/orders/journey.ts` | PRODUÇÃO |
| `lib/fb/orders/offer.server.ts` | PRODUÇÃO |
| `lib/fb/orders/operations.server.ts` | PRODUÇÃO |
| `lib/fb/orders/operations.ts` | PRODUÇÃO |
| `lib/fb/orders/rpc.server.ts` | PRODUÇÃO |
| `lib/fb/orders/tracking-page.server.tsx` | PRODUÇÃO |
| `lib/public-hotel-data.ts` | PRODUÇÃO |
| `lib/room-links.ts` | PRODUÇÃO |
| `next.config.ts` | PRODUÇÃO |
| `proxy.ts` | PRODUÇÃO |
| `scripts/fb-local-lab.mjs` | FERRAMENTA PERMANENTE |
| `scripts/fb-order-maintenance.mjs` | FERRAMENTA PERMANENTE |
| `supabase/migrations/20261103050831_sprint_53_b23_public_journey_operations.sql` | PRODUÇÃO |
| `supabase/migrations/20261103095658_sprint_53_b4_maintenance_hardening.sql` | PRODUÇÃO |
| `supabase/tests/53_b1_foundation_matrix.sql` | TESTE REGRESSIONAL |
| `supabase/tests/53_b23_journey_operations.sql` | TESTE REGRESSIONAL |
| `supabase/tests/53_b4_maintenance_matrix.sql` | TESTE REGRESSIONAL |
| `supabase/tests/53_b4_temporal_matrix.sql` | TESTE REGRESSIONAL |
| `tests/integration/fb-authenticated.mjs` | TESTE REGRESSIONAL |
| `tests/integration/fb-b1.mjs` | TESTE REGRESSIONAL |
| `tests/integration/fb-b23-adversarial.mjs` | TESTE REGRESSIONAL |
| `tests/integration/fb-b23-compatibility.mjs` | TESTE REGRESSIONAL |
| `tests/integration/fb-b23-operations.mjs` | TESTE REGRESSIONAL |
| `tests/integration/fb-b23-public.mjs` | TESTE REGRESSIONAL |
| `tests/integration/fb-b23-seed.mjs` | TESTE REGRESSIONAL |
| `tests/integration/fb-b23.mjs` | TESTE REGRESSIONAL |
| `tests/integration/fb-b4-backend.mjs` | TESTE REGRESSIONAL |
| `tests/integration/fb-b4-browser.mjs` | TESTE REGRESSIONAL |
| `tests/integration/fb-b4-contracts.mjs` | TESTE REGRESSIONAL |
| `tests/integration/fb-b4-migration.mjs` | TESTE REGRESSIONAL |
| `tests/integration/fb-b4-temporal-maintenance.mjs` | TESTE REGRESSIONAL |
| `tests/integration/fb-b4.mjs` | TESTE REGRESSIONAL |
| `tests/security/fb-b23.test.ts` | TESTE REGRESSIONAL |
| `tests/security/fb-b4.test.ts` | TESTE REGRESSIONAL |

Inventário SHA-256 completo: `out/fb-b4-inventory.json` (ignorado).
<!-- END B4 INVENTORY -->

## B4 — auditoria adversarial e fechamento técnico local (03/11/2026)

**APROVADA — GO técnico local para checkpoint Git; NO-GO operacional real.** Checkpoint inicial confirmado antes
das escritas: sprint-53-fnb, HEAD/origem local f8d8769, exatamente 12 modificados
+ 28 novos B2+B3, zero stage. Baseline SHA-256 em `out/fb-b4-before.json`.
Nenhuma autorização de commit/push/merge/deploy, Supabase remoto, dados reais,
chamadas Goomer/TheX/OPERA ou impressão decorre desta auditoria.

### Escopo revisto e correções B4

Auditoria do diff completo, 28 untracked B2+B3, migration, routes, ações,
cookies, DTOs, carrinho, cotação, checkout, tracking, painel/polling, capabilities,
cancelamento, runners e documentação. Classificação exata no inventário acima.

- Polling de hóspede e Admin passa a descartar respostas de gerações anteriores
  antes de aplicar dados/erros/permissões ou programar outro timer. Abort sozinho
  não é uma garantia para uma resposta já recebida/na fila. Pausa/offline/unmount
  invalidam a geração e o Admin continua apagando PII.
- Painel SSR começa com ações desabilitadas até o primeiro snapshot autenticado
  do cliente; HTML renderizado no servidor não pode anunciar prontidão de handlers
  ainda não hidratados. Regressão bloqueia JavaScript e confere os botões. O runner
  ganha timeout de captura/API e progresso técnico, sem retirar asserts anteriores.
  Cada nova operação limpa a mensagem da anterior. O harness exige resposta HTTP,
  nova confirmação da UI, snapshot sincronizado e os mesmos fatos de banco; não
  confunde a espera por EOF do stream RSC no Playwright com confirmação comercial.
- Diagnóstico F&B fechado: código, diagnostic_id UUID e order_id validado quando
  aplicável. Sem body, URL, query, guest name, quarto, observação, cookies,
  secret, roomToken ou mensagem de provider. Erros HTTP devolvem somente código
  estável e X-FB-Diagnostic-ID. Falhas de polling emitem código fixo na primeira
  falha, com backoff; nada é enviado a analytics/plataforma externa.
  `cancellation_confirmed` confirma processamento bem-sucedido do RPC; não substitui
  o estado comercial. Uma solicitação pending ou decisão de negar não significa
  pedido cancelled. O diagnóstico sempre deve ser confrontado com fatos/eventos.
- QR legado mantém tokens, destinos, cookie e comportamento. O redirect recebe
  no-referrer/no-store; a rota /r é excluída do access log de desenvolvimento e
  o erro do resolver deixa de imprimir mensagem bruta do provider. O token no
  caminho inicial do QR continua sendo o contrato de bootstrap existente; não
  é propagado às URLs/queries/referrers de F&B nem serve como identidade.
- Perfis locais de teste desabilitam caches HMR/persistentes; o runner verifica
  a porta por bind TCP, sem confundir um servidor ocupado/lento com porta livre.
  A execução final usa build local de produção, sem recompilação durante a carga.
  Essas configurações de cache só valem com FB_LOCAL_LAB=1.

### Migration, concorrência e rollback de schema

As 54 migrations anteriores, inclusive B2+B3 ainda não commitada, permanecem
byte-idênticas. Nova migration **20261103095658_sprint_53_b4_maintenance_hardening.sql**:
tabela privada maintenance_runs com RLS sem policies/grants diretos, índice
temporal, dois RPCs service-only com search_path vazio e ACL explícita.
O coletor anterior ganha somente contabilidade por categoria; guards, retenções,
batch, skip locked e proteção de sessão/quotes B23 permanecem.

A evolução B23 é aditiva de domínio: tabela/índices novos, helpers operacionais
estreitos e expansão do CHECK dos correlatores. A troca de CHECK toma lock
ACCESS EXCLUSIVE e revalida linhas populadas; não é um ALTER sem lock. B4 não
remove o lock conservador por hotel dos pedidos. Não há rewrite de pedidos,
auto-enable, grant automático de capability, mudança global de Auth/RLS ou URL.

Prova populada: seis pedidos B1 reais sintéticos e 5.000 correlatores, 67 tabelas
comparadas por contagem/digest; 27 verificações aprovadas. Transação escritora
real bloqueou a DDL: lock_timeout=200ms abortou a migration inteira, sem quotes
residuais nem dados alterados. Repetição limpa: B23 171ms e B4 193ms, incluindo
transporte Docker. Esses tempos locais não predizem a janela real. Em produção,
medir cardinalidades/backlog/longas transações, definir janela, usar lock_timeout
curto/statement_timeout no executor canônico e abortar/reagendar em vez de esperar
indefinidamente. B4 já define lock_timeout local de 5s. Não reaplicar migration
registrada nem executar os testes de fault injection em base real.

Rollback de schema é forward-only por migration futura revisada, preservando
pedidos, fatos imutáveis, credenciais vigentes e entrypoints de drenagem/tracking.
Não executar DROP/TRUNCATE, apagar fatos ou restaurar cegamente os guards B1 que
impediriam drenar archived. A reversão funcional preferencial bloqueia admissões.

### Expurgo restrito, observabilidade e agendamento

Não foi encontrado cron/job canônico no repositório. Não se criou cron remoto,
Vercel config, pg_cron ou plataforma Logs & Health da Sprint 54.

- `run_fb_order_maintenance(batch)` exige service_role, batch 1–1000 e usa advisory
  transaction lock para não multiplicar workers. Concorrente recebe skipped.
- Registra última execução/sucesso/falha, início/fim, run_id, SQLSTATE fechado e
  quantidades explícitas: pii, notes, alerts, facts, tokens, idempotency, sessions,
  correlators, quotes. Nunca guarda SQLERRM, payload ou PII nessa evidência.
- A falha do coletor é capturada em subtransação: nada é parcialmente expurgado;
  o registro de falha é persistido. Cancelamento externo/queda pode impedir esse
  registro; exit code do job e atraso de last_success_at cobrem essa condição.
- Histórico técnico de manutenção: 30 dias, coleta limitada ao batch. Valores
  representam deleções explícitas por categoria, não contagem de todas as linhas
  filhas removidas por cascata de fatos ao fim dos 180 dias.
- `get_fb_order_maintenance_status()` é service-only, sem herança de Platform ou
  capabilities administrativas. Dados reais continuam inacessíveis por anon/Auth.
- `scripts/fb-order-maintenance.mjs` não lê .env e, por padrão, apenas consulta
  status. Só executa com --execute; aceita --batch=1..1000 e --passes=1..10,
  não segue redirects, usa timeout e devolve saída allowlisted sem URL/chave.

Agendamento real é **gate remoto posterior** permitido pelo escopo B4. Preparar
executor server-side autorizado com FB_MAINTENANCE_SUPABASE_URL e
FB_MAINTENANCE_SERVICE_KEY em secret store; nunca NEXT_PUBLIC, argumentos ou logs.
Validar destino/HTTPS e RPCs antes de conceder o segredo ao job. Cadência inicial
proposta: a cada cinco minutos, batch 100, até dez passagens, com alerta em falha,
skipped persistente ou last_success_at ausente/mais antigo que 15 minutos.
Ajustar após carga/backlog, sem prometer SLA com esses números de laboratório.
Sem execução/monitoramento agendados comprovados, ativação real permanece NO-GO.

### Contratos adversariais e limites

Idempotência B1: JSON keys, modifiers e escolhas de combo são normalizados;
ordem das linhas comerciais continua significativa para seus snapshots/posição.
Não se reordena o carrinho para inventar uma nova semântica. B1 não tem chave UUID
reservada antes de commit: antes de criar, valem sessão e cotação reconhecida;
um UUID isolado não contém prazo de emissão. Depois de confirmado, replay tem
24h. Encerrado esse prazo, orientar verificação com hotel, não criar outro pedido
automaticamente. Fechar a aba perde a tentativa transitória; não cancela fatos.

As ondas de 10/25/50/100 confirmações mantêm locks e limites intactos. Métricas
separam chaves distintas, mesma chave, outlets/setores distintos, rejeições e
esperas observadas em pg_stat_activity. O monitor Docker também custa tempo:
não extrapolar throughput comercial. Limites HTTP/B1 continuam conservadores;
limiter indisponível falha fechado. Não há IP bruto, roomToken ou correlator de
NAT único bloqueando todos os hóspedes. Fixtures zeram seus próprios buckets
somente entre cenários funcionais independentes, nunca durante uma onda medida.

Pedido cancelado já terminal tem replay idempotente B1: duas solicitações podem
responder cancelled, mas só há um evento. Aceite/cancelamento e transições
concorrentes usam CAS; não se fabrica conflito onde o contrato prevê replay.
Drenagem archived é intencional e restrita ao F&B com perfil ativo/capabilities;
não reabre catálogo, configuração ou outras áreas do Admin.

### Runbook de ativação — não executado remotamente

1. Revisar inventário, migrations e gates; autorizar separadamente implantação e
   piloto. Bugan é o piloto futuro; não alterar Goomer/Serviços/QR nessa preparação.
2. Fazer preflight de backup/restore canônicos, longas transações, locks e dados
   populados. Aplicar migrations 54/55 pelo executor canônico antes das novas rotas.
   Validar ACL/RLS/search_path e ausência de auto-enable; abortar em timeout/drift.
3. Preparar secrets server-only e domínio/HTTPS/cookies; redigir/excluir caminhos
   /r/[token] também dos access logs de proxy/hosting/observabilidade externos.
   O ajuste local Next não controla os logs da hospedagem. Nunca enviar PII a analytics.
4. Ativar e comprovar agendamento/monitor de retenção. Testar expiração antes do
   expurgo e alertas de falha/backlog; observar só IDs/códigos/contagens.
5. Homologar editorialmente catálogo/preços/fotos/traduções, setores, horários/IANA,
   retirada/entrega, cancelamento e operadores. Atribuir as seis capabilities por
   tenant/setor explicitamente; nenhum role/module fornece concessão automática.
6. Manter master OFF durante preflight. Validar entitlement fb.menu, modo native,
   accepting e disponibilidade por outlet em ambiente autorizado; abrir admissões
   somente após GO operacional explícito. Nenhum passo presume dados de mockup.
7. Smoke HTTPS por slug/subdomínio/QR, PT/EN/ES, mobile/desktop, cookies protegidos,
   cotação/confirm/tracking, painel e drenagem. Homologar dispositivos reais antes
   da operação. Não chamar integrações externas nem imprimir para validar B.

### Runbook de reversão funcional e incidentes

- Reversão: desligar novas admissões pelo master/accepting autorizado; preservar
  fatos, QR, tokens e rotas de acompanhamento/Admin para concluir/cancelar pedidos
  existentes. Só retornar outlet ao external após decisão autorizada e verificação
  do destino previamente aprovado. Não remover dados/Serviços nem inventar URL.
- Duplicidade suspeita: interromper novas tentativas; reunir referências, IDs,
  horários e códigos. Conferir resultado idempotente e fatos/eventos por acesso
  autorizado, sem exportar PII. Não trocar chave nem excluir/cancelar automaticamente.
- Checkout indisponível: consultar validation_rejected/idempotency_conflict/
  rate_limited/unavailable e verificar configuração, catálogo, clock e admissão.
  Não liberar limiter, aumentar limite às cegas ou desativar validação de preço.
- Painel sem atualização: sinalizar snapshot stale, checar conexão/capabilities e
  refresh completo. Confirmar DB antes de repetir ação; nunca forçar status/CAS.
- PII/permissão: interromper consulta, validar perfil/tenant/setores/capabilities,
  revogar acesso indevido por fluxo autorizado e inspecionar diagnósticos sem PII.
  Não reconstruir campos expirados nem imprimir/exportar payload para diagnóstico.
- Expurgo falhando: alertar por exit code/last_success_at/SQLSTATE; bloquear ativação
  ou novas admissões conforme incidente, preservar evidência técnica e corrigir
  dependência/lock. Repetir job restrito; não apagar dados manualmente.
- Pedido preso: conferir grupos, relógio, permissões e eventos; operador autorizado
  conclui/cancela conforme política. Alerta de retenção não finge entrega/cancelamento.
- Lifecycle archived: a drenagem estreita usa sessão Auth válida e capabilities
  explícitos nas rotas de pedidos; o login administrativo geral conserva a regra
  vigente que recusa hotel arquivado. Planejar drenagem antes de arquivar e manter
  operadores/sessões válidos; não ampliar Auth ou o restante do Admin por esse motivo.
- Cancelamento divergente: reler revisão/estado e solicitação antes de decidir.
  Depois do aceite não declarar cancelled sem evento/decisão; entregue não cancela.

### Fronteira C e deployment readiness

Aceite e evento versionado persistem na mesma transação. event_id, contract_version,
hotel/order/group/sector, revisão, timestamp e line_refs estáveis permitem buscar
snapshots imutáveis autorizados. Replay não duplica evento; falha de sua inserção
deve impedir aceite. Consumidor C futuro precisará deduplicar por event_id e ter
contrato próprio de confirmação física — nada disso foi implementado em B4.

Checklist de implantação posterior: migrations/locks/timeouts, secrets, HTTPS e
scoping de cookies, redaction dos logs externos, cron/monitor, ACL/RLS/capabilities,
entitlement/master/modo, setores/IANA, smoke, rollback/drain e piloto autorizado.
Preparação local não autoriza deploy, mudança de conteúdo ou ativação real.
Bridge, spooler, printer_id obrigatório, printed, pagamento/PMS/PDV e OPERA/TheX
continuam fora desta entrega. Worktree content-bridge permanece intocado.

### B4 — gates finais reconfirmados

Execução completa **2.503/2.503**, sem foco reduzido, Next otimizado local,
55 migrations, seis tenants sintéticos, 31 usuários GoTrue reais, PT/EN/ES,
390/1440, **141 screenshots**, zero requisições externas e zero erros de browser.
Relatório: `out/libguest-fb-auth-d7b68d94/b23/report.json`.

| Gate | Resultado | Evidência local ignorada |
|---|---|---|
| B2+B3+B4 completo | 2.503/2.503 | `out/fb-b4-consolidated-final.log` |
| B1 integrado original + adversariais | 623/623 | `out/libguest-fb-auth-80b7a015/b1-report.json` |
| Auth A completo, sem focus-core | 1.434/1.434 | `out/libguest-fb-auth-10604449/report.json` |
| SQL B1 / B2+B3 | 232 / 63 | `out/libguest-fb-auth-d7b68d94/b23/53_b1_foundation_matrix.sql.log`, `53_b23_journey_operations.sql.log` |
| SQL manutenção / temporal B4 | 20 / 15 | Mesmo diretório, `53_b4_maintenance_matrix.sql.log`, `53_b4_temporal_matrix.sql.log` |
| SQL A | 197/197 | `out/fb-b4-sql-a-final.log` |
| Migration populada + lock/rollback | 27/27 | `out/libguest-fb-auth-9087b3f4/b4-migration-report.json` |
| Segurança | 740/740; zero skips | `out/fb-b4-security-final.log` |
| SSR A / browser A / V3-V4 | 391 / 1.524 / 152 | `out/fb-b4-ssr-final.log`, `fb-b4-browser-a-final.log`, `fb-b4-v3v4-final.log` |
| TypeScript / build | exit 0 / exit 0 | `out/fb-b4-tsc-final.log`, `fb-b4-final-build.log`, `fb-b4-build-final-status.log` |
| Lint completo / direcionado final | zero erros, quatro avisos históricos / zero avisos | `out/fb-b4-lint-final.log`, `fb-b4-directed-lint-final.log`, `fb-b4-late-tests-lint.log` |
| Diff / integridade / Git | sem erro; 54 migrations anteriores intactas; zero stage | `out/fb-b4-inventory.json`, `out/fb-b4-final-evidence.json` |

B1/SQL B1 aumentam de 620/229 para 623/232 pela cobertura de ACL da nova tabela
privada de manutenção para os três roles testados. Nenhuma expectativa anterior
foi removida. Os 53 arquivos de migration commitados e a migration B2+B3 conservam
os bytes anteriores. O diagnóstico backendOnly de 263 casos era preliminar;
o gate aprovado é a execução integral acima, incluindo navegador/HTTP/DB.

### Carga medida — exclusivamente laboratório

Confirmações RPC reais via PostgREST, mesmo hotel/outlet por onda, dois setores,
chaves distintas. Os locks conservadores e os limites B1/HTTP não foram removidos.

| Concorrência | Sucessos | Rejeições | p50 ms | p95 ms | Máx. ms | Janela ms | Esperas Lock máximas observadas |
|---|---|---|---|---|---|---|---|
| 10 | 10 | 0 | 43 | 87 | 87 | 463 | 0 |
| 25 | 25 | 0 | 76 | 264 | 265 | 711 | 0 |
| 50 | 50 | 0 | 297 | 314 | 324 | 733 | 6 |
| 100 | 100 | 0 | 347 | 605 | 617 | 1067 | 9 |

Dez confirmações entre dois outlets nativos/setores: 10 sucessos, 52ms de janela.
Cinquenta confirmações simultâneas da mesma chave: exatamente um pedido. Zero
duplicidade, fato parcial ou erro de servidor nas ondas medidas. O pool PostgREST
limita a concorrência efetiva no PostgreSQL; o monitor Docker síncrono acrescenta
custo e as amostras não capturam toda espera. Não extrapolar capacidade de produção.
Dados: `out/libguest-fb-auth-d7b68d94/b23/b4-load.json`.

### Fechamento adversarial, retenção e matriz visual

- JSON/modifiers/escolhas de combo reordenados recuperam o mesmo pedido; payload
  divergente, cotações/sessões/chaves vencidas e quote consumida não criam substituto.
  Respostas perdidas de checkout e aceite são exercitadas após commit real.
- Injeções de falha em dez fronteiras transacionais deixam zero fato parcial;
  ausência de evento de aceite impede o aceite. Replay não duplica evento C.
- TOCTOU de preço/modifier/combo/setor/fechamento/admissão é revalidado; três setores
  mantêm agregado conservador. Combos Cozinha/Bar em preparing/ready só cancelam
  após decisão explícita, inclusive módulo OFF; capability revogada é recusada.
- Bursts reais B1 de sessão/quarto/acesso respeitam os tetos 5/10/60; digests
  distintos têm orçamento independente. HTTP conserva limitação após erro de
  validação; indisponibilidade do limiter retorna 503 sem criar pedido.
- PII/observações/tokens/idempotência/correlatores vencidos são expurgados de verdade;
  expiração bloqueia leitura antes da coleta. Pedido aberto antigo recebe alerta
  único; fatos só saem no limite de retenção. Worker concorrente recebe skipped,
  falha não expurga parcialmente e histórico técnico maior que 30 dias é removido.
- Resposta 403 antiga não apaga snapshot novo; registered antigo não sobrescreve
  accepted. Hidden/offline/reconexão, erro 500, backoff e retorno ao timer de 4s
  passam. Quatro operadores simultâneos, mais de 100 pedidos e centenas de eventos
  conferem exatamente com a projeção autorizada de banco, sem truncar páginas.

Todos os nomes, preços, fotografia reutilizada e publicações abaixo pertencem
às fixtures locais. Não constituem cadastro ou homologação editorial real.

| Hotel em fixture | Apresentação | Modos e cobertura | Regressão | Pendente real |
|---|---|---|---|---|
| Grand Mercure Copacabana | Versão atual / tema Grand Mercure | external/native/misto; menu, escolhas, carrinho, checkout, tracking, QR, ON/OFF; PT/EN/ES; 390/1440 | A/Auth/SSR/browser e futura V4 sem alterar fatos/vínculos | Editorial, operação, equipamentos e ativação autorizada |
| Novotel Leme | Versão atual / tema Novotel | Mesma matriz completa | Mesmas regressões e futura V4 | Mesmos gates reais |
| Novotel Salvador Rio Vermelho | Versão atual / tema Novotel | Mesma matriz completa | Mesmas regressões e futura V4 | Mesmos gates reais |
| Mercure Rio Boutique Copacabana | Versão atual / tema Mercure | Mesma matriz completa; painel grande e polling simultâneo | Mesmas regressões e futura V4 | Mesmos gates reais |
| Bugan Recife | V4 Premium | Filipe e Room Service native, QR de apartamento, adicionais/setores; external genérico preservado; matriz completa | Home V4 e vínculos preservados; zero chamada Goomer | Futuro piloto somente após autorização e homologações |
| Default técnico | Fallback atual | Mesma matriz, domínio/subdomínio, estado ON/OFF | Fallback e migração visual isolada | Compatibilidade real quando aplicável |

Capturas finais em `out/libguest-fb-auth-d7b68d94/b23/screenshots/` (141, ignoradas).
Inspeção visual adicional: Grand Mercure 390 ES e Bugan 1440/390 PT; painel
`fb-lab-grand-mercure-b4-panel-recovered-1440-pt.png`. Painel de carga:
`fb-lab-mercure-b4-large-history-panel-1440-pt.png`. Automação verifica responsividade
e matrizes restantes; isso não é homologação física ou aprovação estética/editorial.

**B2+B3 implementados e revalidados; B1 preservado; C continua pendente.** Runbooks
de ativação, reversão e incidentes e checklist de deployment estão acima. Cron,
secrets, redaction de logs de hosting, migrations remotas, catálogo real, permissões,
piloto e dispositivos exigem etapa/autorização posteriores. Nenhum tenant real
foi ativado, consultado ou alterado; nenhum provedor foi chamado e nada foi publicado.

Branch `sprint-53-fnb`, HEAD/origin local `f8d8769e96c60df25bd356c1ceed4dd57db8bc0f`.
Diff acumulado: 16 modificados + 40 novos, lista/classificação exatas acima,
zero suspeitos, zero staged/commit/push/merge/deploy. `out/**`, env, estado,
credenciais, imagens de teste, caches e dumps não entram no checkpoint. Os containers
próprios e suas credenciais temporárias são removidos; relatórios/capturas ficam
preservados. O verificador final exige ausência do estado/credenciais do lab.

**Sprint 53 — Etapa B está tecnicamente pronta para checkpoint Git, mas não para ativação operacional real.**

### Incidentes de validação preservados

As execuções interrompidas não contam como gates verdes. Em desenvolvimento,
cache gerado de tipos/rotas ficou truncado e uma execução encontrou recompilação
HMR enquanto o código era editado. Somente esse cache gerado foi isolado em
`out/fb-b4-corrupt-dev-cache`; nenhum código B2/B3 foi restaurado ou descartado.
Os testes finais usam build otimizado local, sem HMR e sem alterações de produto
durante sua execução. O perfil de Auth A desabilita cache de laboratório também.

Nas execuções `out/fb-b4-production-final.log` e
`out/fb-b4-bounded-diagnostic.log`, a espera por `response.finished()` de uma
Server Action permaneceu pendente após o processamento. A segunda tem timeout
explícito e captura em `out/libguest-fb-auth-c9375a47/b23-failure-11-0.png`:
operação confirmada, lista atualizada e pedido cancelado já visíveis. A consulta
do laboratório anterior também confirmou as solicitações negada/aprovada e o
pedido cancelado. O harness passa a validar ACK novo + snapshot + DB, preservando
os asserts anteriores e acrescentando sucesso HTTP; não presume sucesso por timeout.
Essas evidências não provam uma falha de commit, nem substituem a execução final.

O primeiro gate completo posterior chegou a 2.473 verificações antes de falhar
no comparador da falha HTTP 500. O número salvo no início do cenário precedia um
novo pedido real, portanto não era o snapshot imediatamente anterior à falha.
O teste passa a capturar essa referência no momento correto, exige que ela seja
não vazia e mantém igualdade exata após o erro. O código de retenção do snapshot
não foi alterado para atender ao teste. O artefato interrompido permanece em
`out/libguest-fb-auth-659d180c/b23-failure.json`; não conta como execução aprovada.

## C1 — Cloud de impressão (03/11/2026)

Estado: **[C1 IMPLEMENTADO — GO TÉCNICO LOCAL]**. Implementação limitada ao
backend Cloud. A Sprint 53 e a Etapa C completa não estão concluídas. Nenhuma
impressora, bridge Windows ou operação real está homologada por este relatório.

### Checkpoint e preservação

Branch `sprint-53-fnb`, HEAD inicial `259cf39a6a2fb5c6f99af16f000905b410140b4a`,
mensagem `feat: complete F&B native ordering operations`; árvore e stage vazios
antes da primeira escrita. A referência local `origin/sprint-53-fnb` era igual.
Não houve fetch ou consulta remota. O snapshot `out/fb-c1-before.json` registra
764 arquivos rastreados e as 55 migrations anteriores. O fechamento compara
seus hashes, sem alterar migrations B1/B23/B4, Auth, RLS existentes, Admin visual,
Home V4, temas ou o worktree `libguest-content-bridge`.

### Migration e domínio C

Única migration nova: `20261103162805_sprint_53_c1_print_cloud.sql`, aplicada
somente em bancos Docker descartáveis. Schema `fb_print_private`, 15 tabelas:
`settings`, `grants`, `devices`, `credentials`, `pairings`, `destinations`,
`printers`, `routes`, `processing`, `jobs`, `attempts`, `events`, `commands`,
`http_buckets`, `maintenance_runs`. Todas possuem RLS, sem políticas abertas ou
acesso direto de `anon`, `authenticated` ou `service_role`. Wrappers privilegiados
têm `search_path` vazio e ACL explícita: humano autenticado ou serviço, nunca ambos
por conveniência. Helpers privados não são executáveis por esses três papéis.

A migration não insere settings, permissões, dispositivos, credenciais ou hotéis
habilitados. O único acréscimo estrutural em B é um índice parcial para a leitura
dos eventos `orders.accepted`; regras, funções, estados e migrations B permanecem
preservados. C não modifica automaticamente `order.status` ou `group.status`.

### Materialização e ativação

Fonte: evento imutável B `orders.accepted` de **grupo**, com hotel, pedido, grupo,
setor e referências já materializados por B. Não se espera o pedido agregado
ficar `accepted`. A reconciliação usa essa fonte e as linhas/opções históricas B,
sem reconstruir pelo cardápio atual e sem acrescentar escrita ao comando B.

O snapshot mínimo contém IDs do pedido/grupo/setor, referência operacional,
modalidade, timezone, timestamps, componentes daquele grupo, opções e contexto
necessário do combo pai. Quantidades são copiadas de B, sem nova multiplicação
e sem recalcular preços. Cada setor recebe somente suas próprias linhas.

Unicidades do original: `(hotel, source_event, destination, copy_number)` e
`(hotel, group, destination, copy_number)`. Reconciliação padrão 50, máximo 100;
fontes bloqueadas por rota/configuração são registradas e revisitadas. A ordenação
pela última tentativa evita repetir indefinidamente o mesmo início bloqueado.
Não há cursor baseado exclusivamente no relógio nem descarte silencioso sem rota.

Default OFF. Ativação/reabertura exige `printing.configure`, revisão CAS e o
**mesmo lock da linha do hotel utilizado por B na aceitação**. Sob esse lock,
eventos anteriores entram em baseline explícito, inclusive bloqueados anteriores
numa reativação. Os dois ordenamentos de aceitação concorrente foram exercitados:
commit B anterior pertence ao baseline; commit posterior permanece elegível.
Jobs já materializados não têm seus snapshots reescritos pela ativação.

### Roteamento, payload e estados

Destino lógico vincula bridge principal e backup, impressoras/configuração e
prioridade. Rotas são por tenant/setor/destino/cópia. Backup é representado, sem
active-active ou failover físico automático. Fan-out default OFF; habilitação
explícita gera jobs separados e numerados, inclusive duas cópias no mesmo destino.
Não existe condição por marca, domínio público, hotel Bugan ou versão V3/V4.

O job congela rota, destino, dispositivo e revisão da impressora, além das
políticas privadas. Alterações posteriores não reescrevem esses campos. Destino,
dispositivo ou impressora incompatível/desativado bloqueia o job pré-I/O com
código técnico; não o encaminha silenciosamente para outro equipamento.

Tipos: `order`, `test`, `reprint`. Estados: `queued`, `leased`, `dispatching`,
`submitted`, `confirmed`, `retry_wait`, `blocked`, `ambiguous`, `expired`,
`cancelled`. Guards impedem mutações do snapshot/hash e transições inválidas;
attempts/events são imutáveis, salvo expurgo autorizado. O journal distingue
atores humanos reais, dispositivos e sistema; dispositivo não recebe perfil
humano fictício.

Protocolo, payload e renderer suportados: versão **1**. O envelope fornece
`snapshot_canonical`: texto JSONB canônico serializado pelo Cloud, cujos bytes
UTF-8 são a entrada exata do SHA-256. A futura bridge valida esses bytes, depois
interpreta o JSON; não recalcula o hash usando a serialização própria do .NET.
Os testes recalculam o hash em Node e pelo transporte HTTP. Limite comercial do
snapshot: 1 MiB. O hash garante integridade e não substitui autenticação.

### Identidade, pairing e protocolo HTTP

Dispositivo tem identidade própria, sem sessão humana. Credencial é seletor UUID
mais segredo aleatório de 256 bits, formato `UUID.secret`; só o SHA-256 do segredo
é persistido. O seletor é normalizado. Validade 90 dias, rotação revoga anteriores
e revogação/inativação é revalidada em cada operação. UUID, hash do job ou `hotel_id`
informado não são autoridade. O tenant vem da credencial verificada.

Pairing exige humano com `printing.configure`: código forte de uso único por
5 minutos, ligado ao dispositivo/hotel, consumo e emissão atômicos. Cinquenta
consumidores concorrentes produziram uma única credencial. Código usado, expirado,
inválido ou cruzado é negado. O segredo é devolvido uma vez; perda da resposta de
exchange exige novo pareamento administrativo, sem recuperação do segredo antigo.

Máquina: `POST /api/fb/printing/device/{exchange,heartbeat,claim,receipt,dispatch,result}`.
Bearer próprio de dispositivo, TLS obrigatório; exceção somente no laboratório
explícito e loopback. Sem JWT humano, service key na bridge ou exigência de Origin
de browser como identidade de máquina. Heartbeat informa compatibilidade e estado
declarado do software; `printer_ready` permanece `null`, sem alegar prova física.

Humano: `POST /api/admin/fb-printing`, sessão normal e Origin da aplicação;
operações `grant`, `config`, `activate`, `pairing`, `rotate`, `revoke`, `reconcile`,
`test`, `reprint`, `read`, `read_config`. Allowlist por operação, JSON até 8 KiB,
timeout de leitura/RPC 10 segundos e cancelamento da leitura pendente. Leitura
técnica paginada até 50 por cursor `(created_at,id)`. Não foi criada UI C3.

Respostas private/no-store e no-referrer. Erros têm códigos fechados e ID de
diagnóstico; não devolvem corpo/mensagem de provider, segredo, observação ou PII.
Rate limits atômicos: emissão de pairing 5/dispositivo/minuto, exchange 20/código/
minuto, dispositivo 300/credencial/minuto e bootstrap global 1.200/minuto. Contadores
guardam correlação irreversível, sem tokens ou IP bruto. O gateway HTTP foi
testado com limites reais, JSON inválido, excesso de corpo e Content-Type indevido.

### Claim, receipt, dispatch e resultados

Claim transacional atribui owner, attempt, lease de 60 segundos, fence crescente
e revisão. Cinquenta claims por tenant e uma disputa principal/backup demonstram
um único owner válido. Antes da autorização de I/O, lease vencido permite novo
fence. Fence anterior não dá receipt, dispatch ou resultado da nova tentativa.

`receipt` registra a declaração de persistência do cliente simulado, sem autorizar
hardware. A persistência SQLite e a recuperação de crash real pertencem a C2.
`dispatch` separado revalida credencial, ownership, fence, receipt, revisão,
hash, versões, lease, TTL, destino, impressora, fonte e política privada. Repetição
não renova lease nem cria nova tentativa. `dispatch_authorized` só é verdadeiro
durante `dispatching` com lease/TTL válidos; `dispatch_recorded` distingue evidência
histórica de autorização vigente.

Depois do dispatch, timeout/offline/lease vencido preserva incerteza como
`ambiguous`, sem requeue ou transferência automática do original. Retry exige
resultado explícito `pre_send_failed`, código fechado e `no_io:true`; timeout
isolado não vale como prova. C1 valida o contrato do dispositivo simulado; a
comprovação local da etapa de I/O será responsabilidade de C2/C4.

ACKs repetidos têm um efeito. `submitted` significa aceitação técnica declarada
do envio/spooler/transporte, **não papel impresso**. `confirmed` consta do domínio,
mas resultado físico `confirmed` é recusado em C1. ACK tardio válido reconcilia
somente a tentativa original, sem sobrescrever uma reimpressão criada depois.

Reimpressão é novo job `reprint`, com vínculo ao original, autor humano, motivo
allowlisted, idempotency key, marca **REIMPRESSÃO** e `duplicate_risk` quando cabível.
Exige `printing.reprint` e `orders.read` no setor. Não é retry cego do original.
Teste exige `printing.test`, rota/setor autorizado, job `test` e identificação
**TESTE DE IMPRESSÃO**, sem pedido comercial falso ou I/O físico.

### PII, retenção e capabilities

PII pertence a B. C não armazena nome, apartamento, observações, QR/session secret
ou tokens brutos no snapshot, dedup ou journal. Só o dispatch projeta dados B ainda
válidos, restritos ao tenant/grupo/finalidade, política atual e política congelada.
Nome default OFF; ON exige configuração humana explícita e auditada. Auditoria
registra revisão e estado dessa política, sem dados do hóspede. Voltar OFF redige
inclusive uma resposta repetida de dispatch. Observação do combo pai só acompanha
os componentes pertinentes ao grupo. PII expirada/expurgada não é reconstruída.

Validade privada: mínimo entre fonte B, TTL do job e 24 horas. Default do ticket
automático: **15 minutos por hotel**, configurável de 1 a 120 minutos. Expiração
pré-I/O não cancela pedido B; pós-dispatch preserva a incerteza/evidência.

Retenção C: jobs comerciais herdam `B.orders.retain_until`; reprint herda o
limite original, sem renová-lo. TTL de dispatch também é limitado pelo prazo
comercial. Claim/replay/receipt/dispatch/result recusam fatos comerciais vencidos
antes mesmo da execução do coletor. Testes/metadados necessários até 180 dias;
attempts/events acompanham o expurgo do job. Dedup retém apenas prova técnica,
sem snapshot, string canônica, routing ou projeção privada, por 180 dias. Credenciais
obsoletas são purgadas após 180 dias da emissão; pairing expirado após um dia,
correlatores após duas horas, histórico de manutenção após 30 dias.

`run_fb_print_maintenance` é service-only, bounded (1–1.000), idempotente e com
advisory lock próprio. Falha faz rollback da coleta parcial e registra só SQLSTATE;
segundo worker é `skipped`. Nenhum scheduler foi implantado ou executado remotamente.
Não há FK de C que retenha orders/groups/lines/events B. Expurgo B autorizado foi
testado com jobs C existentes, sem recuperar a PII apagada.

Capabilities privadas: `printing.configure`, `printing.test`, `printing.reprint`.
Nenhum grant automático. Administrador concede explicitamente; configure exige
papel mínimo editor/admin, enquanto teste/reprint respeitam setor e leitura B.
`orders.supervise` não concede impressão implicitamente. `orders.read` pode ler
somente metadados operacionais do próprio escopo; configuração física permanece
restrita a configure. Não houve criação de papel global ou ampliação de RLS/Auth.

### Matriz multi-hotel e limites da homologação

| Identidade | Arquitetura / fixture | C1 local | Ativação real | Pendências |
|---|---|---|---|---|
| Grand Mercure Copacabana | Compartilhada, tenant sintético distinto | SQL/RPC/HTTP/Auth/PII/concorrência | Não executada; remoto não consultado | C2–C5 |
| Novotel Leme | Compartilhada, tenant sintético distinto | SQL/RPC/HTTP/Auth/PII/concorrência | Não executada; remoto não consultado | C2–C5 |
| Novotel Salvador Rio Vermelho | Compartilhada, tenant sintético distinto | SQL/RPC/HTTP/Auth/PII/concorrência | Não executada; remoto não consultado | C2–C5 |
| Mercure Rio Boutique Copacabana | Compartilhada, tenant sintético distinto | SQL/RPC/HTTP/Auth/PII/concorrência | Não executada; remoto não consultado | C2–C5 |
| Bugan Recife | Mesmo domínio, fixture distinta; V4 não condiciona rotas | SQL/RPC/HTTP/Auth/PII/concorrência | Não executada; remoto não consultado | C2–C5 |
| Default técnico | Mesmo domínio, tema fallback | SQL/RPC/HTTP/Auth/PII/concorrência | Não executada; remoto não consultado | C2–C5 |

C1 não altera apresentação de nenhum hotel. C2 será Windows Service .NET, com
SQLite e DPAPI; C3 será Admin visual; C4 terá adapters (spooler primeiro, raw/ESC-POS
depois); C5 será instalação e homologação física. Nenhum desses entregáveis foi
antecipado. Não há GO de impressão operacional, equipamento ou papel impresso.

### Gates e evidências

C1 final em aplicação otimizada: **767 verificações**, seis tenants, zero chamadas
externas e zero impressão física; SQL C1 **221**, segurança geral **745** (cinco
testes C1 novos), SQL histórico A **197**, SSR **391**, browser A **1.524** e
V3/V4 **152**. Build otimizado passou; lint mantém somente quatro warnings históricos.
Regressões completas: B1 **623**, B2+B3+B4 **2.503**, Auth/DB/RLS/Storage **1.434**.
SQL B1 **232**, B23 **63**, manutenção B4 **20**, temporal B4 **15** também verdes.
TypeScript (`tsc --noEmit`), lint, build otimizado e `git diff --check` passaram;
os 17 fontes novos não têm whitespace indevido. Esses números pertencem às
respectivas suítes e não devem ser somados como se fossem casos independentes.

Evidência C1 final: `out/libguest-fb-auth-88e55f6f/c1/report.json`, matriz SQL e log
da aplicação no mesmo diretório; build em `out/fb-c1-gate-build.log`. Sumário de
gates em `out/fb-c1-gates.json`; inventário em `out/fb-c1-inventory.json`.
Regressões: B1 `out/libguest-fb-auth-b4f4e54f/`, B23+B4
`out/libguest-fb-auth-ea36c8ad/b23/`, Auth `out/libguest-fb-auth-ba3f7237/`.
Os 17 fontes ficaram congelados durante o gate final, com hashes reconfirmados.
Os 764 arquivos rastreados iniciais tiveram 762 hashes preservados; os dois
documentos canônicos são as únicas alterações intencionais nesses arquivos.
As 55 migrations anteriores ficaram byte a byte idênticas. Execuções de
diagnóstico anteriores, interrompidas ou vermelhas, não contam como gate aprovado.
As ambiguidades SQL encontradas foram corrigidas exclusivamente na migration
nova. O parser de booleano/NULL e as expectativas de CHECK foram ajustados somente
nas fixtures C1 novas, sem diminuir ou alterar qualquer teste histórico.

A primeira regressão Auth chegou a 1.300 asserts e parou no timeout padrão de
30 segundos do `waitForURL` após remoção de imagem. O banco confirmou ponteiro
nulo/revisão 8; um objeto ainda permanecia no Storage. Isso não comprovava a
limpeza, portanto não contou como gate. Evidência: `out/libguest-fb-auth-acbf4f01/`
e `out/fb-c1-auth-removal-probe.log`. A repetição completa usa o adapter temporário
`out/fb-c1-auth-regression.mjs`: Chrome real, timeout bounded de 120 segundos
para ações/navegação, igual ao já usado no upload, sem mocks, filtros ou alteração
de asserts. Nenhum runner histórico ou código de imagem foi modificado.
A repetição passou os **1.434 asserts**, inclusive limpeza efetiva no Storage;
o primeiro timeout permanece documentado como execução vermelha, sem ser usado
como evidência de aprovação.

### Inventário C1 e exclusões do futuro commit

Modificados: `docs/SPRINT_53_FNB.md`, `docs/PRODUCT_MAP.md`.

Novos (17):

```text
app/api/admin/fb-printing/route.ts
app/api/fb/printing/device/[operation]/route.ts
lib/fb/printing/contracts.ts
lib/fb/printing/credentials.server.ts
lib/fb/printing/diagnostics.server.ts
lib/fb/printing/http.server.ts
lib/fb/printing/rpc.server.ts
lib/fb/printing/validation.ts
supabase/migrations/20261103162805_sprint_53_c1_print_cloud.sql
supabase/tests/53_c1_print_cloud_matrix.sql
tests/integration/fb-c1-adversarial.mjs
tests/integration/fb-c1-concurrency.mjs
tests/integration/fb-c1-fixture.mjs
tests/integration/fb-c1-http.mjs
tests/integration/fb-c1-temporal.mjs
tests/integration/fb-c1.mjs
tests/security/fb-c1.test.ts
```

Temporários/evidências excluídos do futuro commit: `out/fb-c1-*`, diretórios
`out/libguest-fb-auth-*` desta rodada, artefatos/screenshots de regressão em
`out/fb-browser`, `out/fb-ssr`, `out/v4-universal`, `out/supabase-c1-cli`, helpers diagnósticos de
build/SQL sob `out/`, `.next/`, caches e dependências. Não incluir credenciais,
configs de laboratório ou logs no futuro commit. Os containers/redes e arquivos
de credenciais pertencentes aos laboratórios são removidos ao encerrá-los;
relatórios e evidências permanecem ignorados. Nenhum arquivo rastreado foi excluído.

Sem stage, commit, push, merge, deploy, Supabase remoto, tenant real, API externa,
conteúdo publicado, instalação .NET, SQLite/DPAPI implementados ou impressão física.

## C2 — Bridge Windows (04/11/2026)

### [C2 IMPLEMENTADO]

**GO técnico local C2**, após os gates abaixo. Escopo: software Windows
self-contained, protocolo C1 real, SQLite/DPAPI, recuperação e simulador LAB.
Sprint 53 continua aberta. C3, C4 e C5 permanecem posteriores; nenhuma operação
real de hotel, impressão, instalação de serviço ou homologação física foi feita.
O histórico C1 acima descreve a rodada de 03/11; esta seção atualiza o estado C2.

### [CHECKPOINT]

Antes das escritas: `sprint-53-fnb`, HEAD e referência local
`origin/sprint-53-fnb` em `3a00e49850e9726f3e10b9afad96178d34e3b793`,
`feat: add F&B printing cloud foundation`, árvore limpa e zero staged.
Os mesmos branch/HEAD/ref foram preservados. Não houve fetch ou consulta remota.
C1, A e B continuam byte a byte preservados; **779 arquivos históricos** fora dos
três arquivos autorizados de documentação/ignore e **56 migrations** inalterados.
Worktree `libguest-content-bridge` não foi acessado/modificado.

### [TOOLCHAIN .NET]

Inspeção encontrou somente SDK **10.0.403**, runtime **10.0.14**, Windows x64.
.NET 10 adotado e fixado em `bridge/global.json`, roll-forward desativado;
RID `win-x64` e RuntimeFrameworkVersion 10.0.14 fixados. Build sem warnings/erros;
publish self-contained validado. Runtime packs oficiais Microsoft restaurados
somente para build no cache `out/fb-c2-dotnet`, sem instalar SDK global.
O executável foi testado com DOTNET_ROOT apontando a diretório inexistente;
runtimeconfig contém includedFrameworks 10.0.14, distribuído na pasta do publish.

### [ESTRUTURA DA BRIDGE]

`bridge/LibGuest.PrintingBridge` contém Cloud, Engine, Storage, Diagnostics,
configuração, CLI e lifetime SCM; `bridge/LibGuest.PrintingBridge.Tests` contém
testes nativos e ferramentas exclusivamente LAB. `scripts/fb-c2-build.ps1`
reproduz restore com lockfiles, build, testes, certificado efêmero e publish.
Instruções detalhadas e configuração inválida de exemplo em `bridge/README.md`
e `bridge/config.production.example.json`. Nenhum componente Next/cliente muda.

### [WINDOWS SERVICE]

Integração nativa SCM implementa start, stop/shutdown e CancellationToken;
console permite laboratório sem depender de UI permanente. Comando futuro de
registro e preparação de conta/perfil/ACL estão documentados no README, sem
execução. Nenhum serviço instalado, conta criada ou política Windows alterada.
Execução real sem usuário logado e reboot/queda de energia continuam para C5.

### [PAIRING]

`pair` usa exchange C1 real; segredo entra oculto ou por stdin de supervisor,
nunca CLI/env/config/log. Código de uso único não é persistido. Se a resposta do
exchange se perder, o operador precisa gerar novo pairing C1. `reprovision` foi
testado com código novo e journal preservado. Device revogado continua bloqueado
pelo Cloud; CLI não reativa device. Novo device exige identidade/diretório
próprios e preservação do journal antigo para reconciliação.

### [CREDENTIAL STORAGE]

`credential.dpapi`, ligado ao device, é escrito com arquivo temporário,
Flush(true) e rename. Credencial ilegível bloqueia antes de HTTP. Rotação C1
revoga a anterior imediatamente, sem overlap: nova credencial é verificada por
heartbeat antes da troca atômica; falha conserva o arquivo anterior. Importação
e reprovisionamento reais passaram no LAB. 403 exige operador e preserva ACKs.

### [DPAPI]

**CurrentUser**, sem prompt nativo, DACL protegida contendo somente o SID atual,
herdada pelos arquivos. Pareamento e serviço deverão usar a mesma identidade com
perfil DPAPI carregado. Proteção real e ACL foram testadas com a identidade local;
não foi criada conta de serviço para testar outra identidade. DPAPI não protege
contra comprometimento do próprio usuário, administrador/kernel ou memória viva.

### [SQLITE]

`winsqlite3.dll` do Windows, versão observada **3.53.4**; WAL, synchronous FULL,
foreign keys, busy_timeout 3000 ms, secure_delete, temp_store MEMORY e
trusted_schema OFF. Tabelas `metadata`, `jobs`, `contents`, `outbox`, `events` e
`simulator_calls`. Transactions e constraints asseguram intent, resultado e
outbox; escrita concorrente de resultados aceita um único resultado/ACK.
FileShare.None no lock local impede segunda instância no mesmo journal.
Destino operacional padrão: ProgramData/LibGuest/PrintingBridge/device-id;
produção recusa caminho fora da raiz aprovada. Testes usam diretórios isolados.

### [MIGRATIONS LOCAIS]

Schema 0→1→2, application_id próprio, migrations transacionais e integrity_check.
Testados banco novo/existente, incremento com dados preservados, interrupção nas
duas etapas, versão desconhecida, banco estrangeiro, corrupção e device distinto.
Falha bloqueia; não há reset/apagamento silencioso do journal.

### [POLLING]

HTTPS outbound, ativo padrão 5s, idle 20s, jitter, timeout, pooling, cancelamento
e backoff exponencial limitado. Cadência ativa mínima verificada com dois jobs
em processo contínuo. Bridge não abre listener. HTTPS 4318 pertence somente ao
harness Node LAB, que termina TLS e encaminha aos endpoints C1 reais locais.

### [HEARTBEAT]

Somente campos aceitos por C1: protocol_version, software_version e observed_state.
Software LAB identificado `c2-lab-1.0.0`; printer_ready permanece null.
Relógio Cloud + Stopwatch fornece âncora de lease e expurgo técnico; antes do
primeiro heartbeat não se apagam ACKs/tombstones por relógio local incorreto.
Resultado pendente foi recuperado com âncora histórica 1900 e OS intacto.
Produção C2 sem adapter fica em heartbeat/degraded e não faz claims novos.

### [CLAIM]

Chave do claim persistida antes da rede. Envelope, versões, IDs, fence, hash dos
bytes UTF8 exatos de snapshot_canonical e igualdade com snapshot validados.
Commit de job + conteúdo DPAPI + receipt outbox precede ACK. Falha de proteção
impede persistência/receipt. Hash/versão inválidos, replay e respostas regressivas
bloqueiam sem entrar na zona simulada. Tenant é derivado pelo Cloud.

### [RECEIPT]

ACK apenas significa persistência local; chave/estado duráveis permitem repetir
rede sem imprimir. Receipt é drenado antes de novos claims. Fence antigo
rejeitado por C1 é reconciliado, bloqueado e diagnosticado com código sanitizado.

### [DISPATCH AUTHORIZATION]

Operação separada após receipt; autorização e projeção mínima protegida são
commitadas antes do intent. Reinício elimina todo conteúdo em cache e solicita
autorização nova quando houve autorização sem intent. Lease/fonte inválidos
impedem entrada no simulador. Rejeição após possível autorização exige operador.

### [DISPATCH INTENT]

Job/attempt/fence, timestamp e metadados de versão são registrados duravelmente
antes da entrada no simulador. Unicidade job/fence impede segunda entrada. Intent
sem resultado conclusivo recupera como ambiguous; não é tratado como no-I/O.

### [SIMULATOR]

Único adapter C2, exclusivo LAB explícito; success, safe_failure, ambiguous,
delay e no_response. Não há renderer/layout físico, spooler, USB, socket 9100,
ESC/POS, execução de shell ou carregamento arbitrário de executável. Snapshot
comercial C1 não é reinterpretado: nenhuma busca de catálogo/cálculo de combo.
Reprint independente e test emitido pelo Cloud passaram nos seis tenants.
`simulator_calls` registra entrada durável na zona simulada, sem prova de papel.

### [RESULT ACK]

Resultado commitado antes do HTTP; chave e fingerprint estáveis. Endpoints reais
aceitaram submitted/transport_accepted, pre_send_failed/no_io e
ambiguous/unknown_after_send. Confirmed físico não pode ser emitido pela C2.
Resposta perdida após commit Cloud foi provocada: ACK repetido, um evento Cloud,
uma entrada no simulador. Novo fence só admite retry após falha comprovada no-I/O.

### [CRASH RECOVERY]

Executável self-contained encerrado por processo nos 12 pontos, com SQLite real:

| Ponto | Recuperação | Entradas simuladas finais |
|---|---|---|
| before_claim | Claim novo após sincronização | 1 |
| after_claim | Repetir claim de chave durável | 1 |
| after_persist | Drenar receipt | 1 |
| before_receipt | Repetir receipt | 1 |
| after_receipt | Solicitar dispatch | 1 |
| before_dispatch | Retomar solicitação durável | 1 |
| after_authorization | Reautorizar, sem reutilizar projeção anterior | 1 |
| after_intent | Recuperar/reportar ambiguous | 0 |
| during_simulator | Recuperar/reportar ambiguous | 1, sem segunda entrada |
| after_result | Reenviar resultado já persistido | 1 |
| before_ack | Reenviar ACK | 1 |
| after_ack | Respeitar tombstone terminal | 1 |

Também passaram offline antes do claim/após receipt/antes de dispatch/após
resultado, segunda instância e liberação do lock após kill. Isso demonstra crash
de processo; não substitui teste de reboot/energia/hardware em C5.

### [AMBIGUOUS]

Sem resultado depois de intent, nenhuma nova execução automática. Cloud termina
ambiguous; C1 preserva sua regra de não requeue automático após possível I/O.
Revogação foi aplicada em cinco fronteiras e o processo reiniciado: zero entrada
indevida. Não se promete cancelar retroativamente envio já autorizado; não houve
envio físico nesta etapa. Intervenção humana/reprint continuam sujeitos a C1.

### [PROTOCOL VERSION]

Bridge 1.0.0, protocolo/payload/renderer v1; incompatibilidade bloqueia, sem
fallback parcial. Campos adicionais de autoridade são rejeitados. C1 foi lido
nos contratos/endpoints/validation/credentials/RPC/SQL/diagnostics reais e
permaneceu integralmente inalterado; nenhuma lacuna exigiu correção C1.

### [RETENTION]

Conteúdo no mínimo da validade da fonte e 24h; projeção privada respeita também
seu próprio expires_at. Metadados técnicos até 180 dias. Terminal remove conteúdo;
startup limpa todo conteúdo antes de relógio/rede. Purge técnico só com âncora
Cloud; idle/backoff também expurgam. Serviço parado não executa GC: ciphertext
pode permanecer no disco até startup/expurgo; DPAPI/ACL permanecem aplicadas.
Não se promete eliminação forense de backups externos ou GC de banco corrompido.

### [PII]

Conteúdo comercial e privado separados de tombstones e protegidos por DPAPI em
SQLite/WAL. Testes leram bytes reais de banco/WAL e não encontraram marcador
privado plaintext. TTL anterior da fonte, limite 24h e preservação de dedup após
expurgo passaram. Nenhum nome/apartamento/nota/roomToken entra no log.

### [LOGGING]

JSON com eventos, UUIDs técnicos, fence e error_code sanitizado; no máximo três
arquivos de 1 MiB. Sem headers, payloads ou exceções brutas. Scan dos logs de
todos os processos e logs estruturados LAB passou para pairing, bearer e PII.

### [SECURITY]

TLS normal em produção. Certificado LAB efêmero validado por cadeia customizada,
hostname, validade e pin, restrito a loopback/LAB; pin errado impediu claim.
Não foi instalado certificado no Windows. Sem service key/JWT humano entregue
no protocolo, sem autoridade hotel local, sem comando/endereço de impressora
executável e sem auto-update. Credencial ilegível/expirada/revogada exige operador.

### [FIVE-HOTEL MATRIX]

| Hotel | Fixture | C1↔C2 | Equipamento real | Pendências |
|---|---|---|---|---|
| Grand Mercure Copacabana | Tenant sintético isolado | Mesmo binário, combo/grupos, reprint e test | Não usado | C3–C5 |
| Novotel Leme | Tenant sintético isolado | Mesmo binário, combo/grupos, reprint e test | Não usado | C3–C5 |
| Novotel Salvador Rio Vermelho | Tenant sintético isolado | Mesmo binário, combo/grupos, reprint e test | Não usado | C3–C5 |
| Mercure Rio Boutique Copacabana | Tenant sintético isolado | Mesmo binário, combo/grupos, reprint e test | Não usado | C3–C5 |
| Bugan Recife | Somente fixture sintética | Mesmo binário, Cozinha/Bar, reprint e test | Não usado | C3–C5 |
| Default técnico | Tenant sintético/fallback | Mesmo binário, combo/grupos, reprint e test | Não usado | C3–C5 |

Home V4 Bugan, temas/versões atuais dos demais hotéis, Goomer e operação real
preservados. Nenhum recadastro, migração de apresentação ou ativação real.

### [DEPENDENCIES]

Zero PackageReference/NuGet direto; locks gerados. Runtime/framework Microsoft
10.0.14, SDK 10.0.403; bibliotecas Windows SQLite, Crypt32/Kernel32, Advapi32 e
ACL via BCL. Inventário completo no README. Runtime packs oficiais foram
restaurados para build; nenhuma API externa de negócio foi usada. Não há pacote
de impressora, dependência npm nova ou modificação de package.json/lock web.

### [TESTES]

| Gate executado nesta rodada | Resultado |
|---|---|
| .NET nativo Windows, SQLite/DPAPI/ACL/HTTP negativo/migrations/retention/concurrency/clock | **99/99** |
| C1↔C2 real, seis tenants, HTTPS, self-contained, 12 crashes e adversariais | **204/204** |
| Regressão C1 completa, aplicação otimizada e Auth normal | **767/767** |
| SQL C1 metadata/ACL/RLS | **221/221**, rollback |

Correções da própria C2 durante validação: RID consistente nos locks; leitura
compartilhada de WAL no teste Windows; checkpoint durante o método simulador;
resultado concorrente atômico; guard de estado antes da entrada; cadência ativa;
GC técnico aguardando âncora Cloud e limpeza conservadora de conteúdo no startup.
Nenhuma alteração em C1, histórico de testes ou migrations anteriores.

### [WEB REGRESSION]

Segurança **745/745**, SSR F&B **391/391**, browser V3/V4 **152/152**;
TypeScript sem erro; lint sem erro, somente **quatro warnings históricos** de img,
e zero warning nos dois novos harnesses; Next build otimizado aprovado. Diff
check inclui arquivos novos. Não houve alteração de UI, Auth, RLS ou código web.

### [ARQUIVOS]

Modificados: `.gitignore`, `docs/SPRINT_53_FNB.md`, `docs/PRODUCT_MAP.md`.
Novos (28):

```text
bridge/Directory.Build.props
bridge/global.json
bridge/NuGet.Config
bridge/README.md
bridge/config.production.example.json
bridge/LibGuest.PrintingBridge/LibGuest.PrintingBridge.csproj
bridge/LibGuest.PrintingBridge/packages.lock.json
bridge/LibGuest.PrintingBridge/BridgeFault.cs
bridge/LibGuest.PrintingBridge/Configuration.cs
bridge/LibGuest.PrintingBridge/Program.cs
bridge/LibGuest.PrintingBridge/WindowsService.cs
bridge/LibGuest.PrintingBridge/Cloud/CloudClient.cs
bridge/LibGuest.PrintingBridge/Cloud/CloudClock.cs
bridge/LibGuest.PrintingBridge/Cloud/JobEnvelope.cs
bridge/LibGuest.PrintingBridge/Diagnostics/BoundedLog.cs
bridge/LibGuest.PrintingBridge/Engine/BridgeWorker.cs
bridge/LibGuest.PrintingBridge/Engine/LabCheckpoints.cs
bridge/LibGuest.PrintingBridge/Engine/Simulator.cs
bridge/LibGuest.PrintingBridge/Storage/CredentialVault.cs
bridge/LibGuest.PrintingBridge/Storage/Journal.cs
bridge/LibGuest.PrintingBridge/Storage/SqliteDatabase.cs
bridge/LibGuest.PrintingBridge/Storage/WindowsProtection.cs
bridge/LibGuest.PrintingBridge.Tests/LibGuest.PrintingBridge.Tests.csproj
bridge/LibGuest.PrintingBridge.Tests/Program.cs
bridge/LibGuest.PrintingBridge.Tests/packages.lock.json
scripts/fb-c2-build.ps1
tests/integration/fb-c2-runtime.mjs
tests/integration/fb-c2.mjs
```

Gerados/excluídos do Git: `bridge/**/bin`, `bridge/**/obj`, `out/fb-c2-publish`,
cache/artefatos .NET, bancos/WAL/SHM, vaults DPAPI, certificados/chaves efêmeros,
configs/logs LAB, `.next` e evidências de regressão. Nenhum arquivo rastreado foi
excluído. Temporários/helpers de checkpoint/review/build sob `out/fb-c2-*`.
Evidências principais:
`out/libguest-fb-auth-3bcf1efd/c2/report.json` (204),
`out/libguest-fb-auth-073b78eb/c1/report.json` (767),
`out/fb-c2-build-final.log` (99 e publish), `out/fb-c2-security.log`,
`out/fb-c2-ssr.log`, `out/fb-c2-v3v4.log`, `out/fb-c2-lint-accepted.log`,
`out/fb-c2-lint-directed.log`, `out/fb-c2-review.json` e fonte congelada por SHA256
em `out/fb-c2-source-freeze.json`. Não incluir qualquer artefato operacional,
segredo, banco, configuração ou relatório contendo fixtures no futuro commit.

### [GIT]

Branch `sprint-53-fnb`; HEAD inicial/final `3a00e49` (hash completo acima).
Árvore deliberadamente com três modificados e 28 novos arquivos de fonte/doc,
zero staged; zero commit, push, merge, reset, clean, restore destrutivo ou deploy.
Os 28 arquivos novos permaneceram congelados no gate final; C1 preservado.

### [REMOTO]

Zero deploy/Vercel, Supabase remoto, tenant real, conteúdo publicado, API externa
de negócio, impressão física ou instalação de serviço. Único restore externo:
runtime packs oficiais Microsoft para o build self-contained. Laboratórios são
locais, descartáveis, com rede Docker interna; endpoints Next/HTTPS são fixtures
encerradas após os testes. Isso é GO técnico local C2; homologação editorial da
Home, instalação SCM em hotel e homologação operacional/física não são concedidas.
Laboratório final encerrado pelo gerenciador com `otherProjectsTouched:false`;
chave TLS efêmera removida. Nenhum arquivo de fonte foi removido.

## Recuperação C3/C4/C5-LAB — checkpoint intermediário de 05/11/2026 (superado abaixo)

Base preservada: `sprint-53-fnb`, HEAD e referência local origin em
`25199232fe1a41a191fe3d12312ff7fafb29715f`. Recuperação encontrou 16 modificados
e 22 novos candidatos, zero staged. C3 tinha gate 175 e C4 69 + 7 health/ACL;
C5 tinha somente a regressão CAS de três verificações. Matriz ampliada estava
escrita e ainda não concluída. Nenhuma implementação foi reiniciada ou descartada.

Nesta continuação, C5 reproduziu bloqueio de ACK após reprint avançar a revisão
do original. A bridge agora reconcilia somente o resultado já durável do mesmo
job/attempt/fence/hash e conserva sua chave; não faz novo claim ou I/O. Nove testes
nativos adicionais passaram: .NET total 162, build e publish self-contained locais.
A correção CAS administrativa anterior também foi preservada: mesma chave retorna
a cópia existente; intenção independente com revisão consumida recebe PT409.

Direcionados finais: C3 **181**, C4 **75**, C5-LAB **104**, todos zero falhas.
Evidências: `out/libguest-fb-auth-e4f4cb8e/c3/report.json`,
`out/libguest-fb-auth-32ba3836/c2/c4-report.json`,
`out/libguest-fb-auth-055153df/c2/c5-report.json` e
`out/fb-c345-dotnet-reconciliation.log`. Segurança 748, SSR 391, browser F&B 1524,
V3/V4 152, SQL A 197, TypeScript e diff check passaram; lint somente quatro
warnings históricos. Capturas C3 desktop/mobile dos seis tenants ficam no diretório
do relatório C3. Comparação SHA256 confirmou zero alteração nas 56 migrations
commitadas. As duas migrations novas continuam candidatas locais.

**Checkpoint em regressão final:** C2, C1, B e Auth/RLS ainda não aprovados nesta
continuação. Não interpretar os direcionados como encerramento global do C5-LAB.
Somente após essas regressões haverá relatório final consolidado abaixo.

Sem stage, commit, push, merge, deploy, Supabase remoto, tenant real, API externa
de negócio, instalação de serviço, alteração de firewall ou submissão a fila real.
C5-REAL continua pendente; Home/Goomer, Auth e RLS já commitados foram preservados.

## C3 + C4 + C5-LAB — relatório final local, 05/11/2026

### [RECUPERAÇÃO DA EXECUÇÃO ANTERIOR]

Recuperados 16 modificados e 22 novos, com HEAD/origin local em 25199232fe1a41a191fe3d12312ff7fafb29715f, zero
staged. C3 já tinha implementação/gate 175; C4 já tinha adapter, gate 69 e 7
health/ACL. C5 tinha regressão CAS 3; sua matriz ampliada ainda não estava concluída.
Implementações válidas foram preservadas. Nenhum reset, restore, clean, troca de
branch, descarte ou reimplementação do zero.

Esta continuação validou a matriz e corrigiu um bloqueio de ACK quando o reprint
administrativo avançava a revisão do original. Antes: resultado durável ficava
retido com attempt_reconciliation_required. Depois: mesmo job/attempt/fence/hash,
receipt/dispatch comprovados e revisão superior permitem apenas revisar o CAS e
reenviar o mesmo ACK. Sem novo claim, renderer ou I/O. Nove regressões nativas
cobrem submitted, ambiguous e pre_send_failed. A correção CAS já recuperada foi
mantida: mesma chave é idempotente; chave independente com revisão consumida é PT409.
Execuções anteriores que pararam em asserção são diagnóstico, não aprovação final.

### [C3 GATE]

**APROVADO — 181 direcionados finais.** Segurança, SSR, browser,
TypeScript, lint, Next build e diff check passaram. Gate inicial C3 precedeu C4;
após os defeitos encontrados em C5, regressões pertinentes foram repetidas.

### [C4 GATE]

**APROVADO tecnicamente em LAB — 75 direcionados finais e 162
nativos.** Gate inicial C4 precedeu C5-LAB. Sem submissão a fila real.

### [C5-LAB]

**APROVADO — 104 direcionados e regressões completas abaixo.** Cadeia
B→C1→C2→C3→C4 exercitada somente com fixtures próprias e bancos locais descartáveis.

### [C3 ADMIN]

Impressão integrada ao Admin existente em /admin/impressao e à navegação autorizada.
/admin/pedidos recebe estado técnico por grupo, independente do status comercial;
leitura de printing é best-effort e não muda checkout, preço, cancelamento ou pedido.
Printing e nome continuam default OFF; ativação, TTL, políticas, fan-out e grants
exigem autorização/confirmação/CAS/auditoria conforme C1. Nada ativado em propriedade real.

### [DEVICES]

Nome/ID seguro, revisão, ativo/revogado, heartbeat, protocolo, versão e estado.
Sem digest, bearer, material DPAPI ou pareamento consumido na leitura administrativa.

### [PAIRING]

Código gerado no servidor, validade C1, exibição única em RAM por até 60 segundos;
limpeza ao ocultar/sair/revogar permissão. Sem URL, storage, analytics ou log.
Rotação/revogação explícitas e auditadas, sem apagar histórico.

### [DESTINATIONS]

Destino lógico separado da impressora; principal, backup, prioridade e políticas
por tenant. RAW TCP/ESC-POS permanecem sem implementação/homologação.

### [ROUTING]

Setor→destino, revisão/CAS, principal/backup e fan-out explícito, default OFF.
Job existente preserva routing congelado. Backup não assume automaticamente após
possível I/O. Failover pré-I/O controlado exige decisão explícita e novo job marcado.

### [QUEUE]

Cursor estável por created_at/id, 25 itens por página, máximo 50; filtros por
estado/setor/tipo/destino. Detalhe técnico com versões/hash/original/tentativas/eventos,
sem snapshot ou PII. Carga com mais de 100 jobs, paginação sem perda/duplicação.
Polling com geração, abort, pause hidden, retorno online, backoff e snapshot válido;
403/200 atrasados não sobrescrevem autorização nem reapresentam segredo.

### [AMBIGUOUS UX]

Resultado incerto destacado e explicado: não repetir automaticamente para evitar
duplicidade. Sem botão genérico de retry. Estado comercial permanece independente.

### [REPRINT]

printing.reprint + orders.read no setor, motivo enumerado, confirmação e aviso de
duplicidade. Novo job vinculado/auditado, marca REIMPRESSÃO; original preservado.
Comando C3 consome revisão do original na mesma transação serializada por tenant.
Teste de concorrência antes da correção aceitou duas intenções na mesma revisão;
regressão final aceita uma, conflita a segunda e mantém replay da mesma chave.

### [TEST JOB]

printing.test setorial cria job C1 test na mesma infraestrutura; contador de pedidos
permanece igual. Renderer marca TESTE LIBGUEST — NÃO É PEDIDO. Somente fixtures locais.

### [HEALTH]

Heartbeat/compatibilidade/stale da bridge, backlog autorizado, idade e erro atual.
Observação autenticada de fila unknown/offline/paper_out/error por printer/revisão;
não incrementa revisão de configuração. Último submit/erro permanece no histórico
técnico. Bridge online não significa impressora fisicamente pronta.

### [C4 ADAPTER]

Windows Spooler nativo, renderer separado, destino autorizado pelo Cloud e validado
contra device/destination/printer/configuração/revisão. Sem shell, RAW, TCP 9100,
ESC/POS, USB direto, caminho executável vindo de conteúdo ou fallback para padrão.

### [RENDERER]

V1 lê snapshot canônico/hash e linhas já expandidas do próprio setor; preserva
quantidades/modifiers/contexto do combo sem recalcular preço/quantidade. Hotel,
referência operacional, horário/timezone, setor e modalidade; nome default OFF,
quarto/notas somente sob política e TTL. Lista explícita exclui campos de segredo,
CPF/e-mail/telefone e IDs internos desnecessários. Controles de dispositivo/bidi e
tamanho são limitados; texto comercial é dado, não comando físico/executável.

### [WINDOWS SPOOLER]

- Implementação: Winspool/GDI, enumeração/metadata, validação, StartDoc/ID, páginas,
  deadline final e encerramento/abort conservador.
- Teste técnico: metadata nativa real + IWindowsSpooler/LaboratorySpooler controlados,
  executável self-contained e journal/DPAPI reais.
- Filas virtuais: OneNote e Microsoft Print to PDF identificadas, zero submissões;
  PDF padrão não foi considerado destino LAB seguro por UI/arquivo.
- Equipamento físico: nenhum modelo, fila de hotel, driver ou papel homologado.

Compatibilidade arquitetural SCM e CurrentUser preservada; nenhum serviço registrado.
Conta de serviço, perfil DPAPI e filas por identidade exigem validação C5-REAL.
Chamada nativa de driver pode bloquear; cancelamento não garante interrupção imediata.

### [SUBMISSION SEMANTICS]

**submitted ≠ confirmação física.** Máximo emitido pelo adapter após aceitação é
submitted/spooler_accepted. Nenhuma execução emitiu confirmed.

### [SPOOL JOB ID]

ID positivo capturado pela implementação e persistido em SQLite por job/fence,
com printer/revisão/fila/observação. Testes exercitaram IDs de abstraction LAB;
nenhum ID real de submissão Windows foi produzido. ID não comprova papel.

### [RECOVERY]

Persistência→receipt→autorização→intent→renderer/adapter→resultado durável→ACK.
Sem resultado após intent: ambiguous, sem nova submissão. Com resultado: mesmo
ACK/chave, sem nova chamada ao adapter. 12 fronteiras de encerramento forçado
testadas no adapter; reboot é simulado por reinício do processo/journal, não OS real.

### [DUPLICATE PREVENTION]

ACK perdido, Cloud retry, timeout, resposta fora de ordem, crashes e lease/fence
antigos não produziram segunda submissão automática após possível I/O. Ausência
comprovada de I/O usa somente o retry seguro C1. Duas identidades/20 claims mantêm
um owner; backup não toma dispatch incerto. Dois processos não compartilham journal.

Matriz C5: Cloud offline em quatro fronteiras; PostgreSQL próprio realmente pausado;
SQLite write lock/corrupção reais; credenciais inválidas/revogadas/expiradas; versões,
hash e payload incompatíveis; fila adulterada; configuração/rename; resposta atrasada,
perdida/fora de ordem; concorrência administrativa, cancelamento antes de autorização,
routing congelado, failover controlado e 12 crashes. Evidências sintéticas preservadas.

### [PII]

Projeção privada não é snapshot comercial e não é reconstruída após expiração.
Entrega com PII expirada foi bloqueada; renderer expira nome/quarto/notas. DPAPI
CurrentUser + ACL da identidade e TTL; cache removido no startup/terminal. Scans de
logs, journals/WAL/temp próprios e respostas/UI verificaram marcadores privados e
segredos; zero tentativa externa no browser. Artefatos com fixtures são temporários.
secure_delete/checkpoint são expurgo lógico: não se promete eliminação física em
SSD, páginas recuperáveis, snapshots/backups; bridge parada não executa GC.

### [FIVE-HOTEL MATRIX]

Mesmo Admin, domínio e binário; sem fork Bugan. Fixtures incluem Restaurante Filipe,
Room Service e múltiplos setores; Goomer e apresentações V3/V4 foram preservados.

| Fixture | Dados | C3 | C4 LAB/renderer | C1↔C2 | Equipamento real | Ativação real | Pendência |
|---|---|---|---|---|---|---|---|
| Grand Mercure Copacabana | Sintética local | Aprovado | Aprovado | Aprovado | Não | Não | C5-REAL por equipamento/conta/fila |
| Novotel Leme | Sintética local | Aprovado | Aprovado | Aprovado | Não | Não | C5-REAL por equipamento/conta/fila |
| Novotel Salvador Rio Vermelho | Sintética local | Aprovado | Aprovado | Aprovado | Não | Não | C5-REAL por equipamento/conta/fila |
| Mercure Rio Boutique Copacabana | Sintética local | Aprovado | Aprovado | Aprovado | Não | Não | C5-REAL por equipamento/conta/fila |
| Bugan Recife | Sintética local | Aprovado | Aprovado | Aprovado | Não | Não | C5-REAL por equipamento/conta/fila |
| Default técnico | Sintética local | Aprovado | Aprovado | Aprovado | Não | Não | Somente LAB; não é propriedade piloto |

Cada fixture passou por device/destination/routing/queue, combo Cozinha/Bar,
reprint/test/ambiguous e autorização. Desktop 1440/mobile 390; doze capturas em
out/libguest-fb-auth-e4f4cb8e/c3. Bugan desktop/mobile também inspecionados visualmente.

### [B REGRESSION]

B1 623; B2+B3+B4 2503, completos, sem falhas.
Carrinho/cotação/checkout, PII, cancelamento, grupos, estados, modo externo,
compatibilidade pública, atomicidade, manutenção e polling preservados.

### [C1 REGRESSION]

767 completos, SQL 250; Auth administrativo normal e protocolo HTTP
real nos seis tenants. 56 migrations commitadas preservadas por SHA256.

### [C2 REGRESSION]

204 C1↔C2 real/HTTPS + 162 nativos. Seis operações C1
originais continuam no modo C2; endpoints Spooler são extensão opcional separada.
Crash/journal/DPAPI/polling/rotação/reprovisionamento e relógio cobertos.

### [TESTES]

Contagens por suíte, sem somar execuções interrompidas ou contar novamente os
checks nativos antigos dentro do total novo. SQL é informado separadamente.

| Suíte final | Aprovados, zero falhas |
|---|---:|
| C3 direcionado | 181 |
| C4 direcionado | 75 |
| C5-LAB direcionado | 104 |
| CAS reprint, regressão isolada | 3 |
| .NET unit/integração nativa | 162 |
| C1 completo, modo full | 767 |
| C1↔C2 executável real/HTTPS | 204 |
| B1 completo | 623 |
| B2+B3+B4 completos | 2503 |
| Auth/DB/RLS/Storage completo | 1434 |
| Segurança web | 748 |
| SSR | 391 |
| Browser F&B | 1524 |
| Browser público V3/V4 | 152 |
| SQL A / B1 / B23 | 197 / 232 / 63 |
| SQL B4 manutenção / temporal | 20 / 15 |
| SQL C1, incluindo ACLs novas | 250 |

TypeScript, lint (somente quatro warnings históricos img), Next production build,
.NET build e publish self-contained e git diff --check aprovados. Carga: 20 jobs no
worker contínuo com journal/ACK drenados, >100 no Admin, 50 materializações/claims
concorrentes C1. Todo volume do adapter usa abstraction; zero papel real.

Evidências finais:
- c3: C:/Users/bruno/diretorio-hotel/out/libguest-fb-auth-e4f4cb8e/c3/report.json
- c4: C:/Users/bruno/diretorio-hotel/out/libguest-fb-auth-32ba3836/c2/c4-report.json
- c2: C:/Users/bruno/diretorio-hotel/out/libguest-fb-auth-5e3b965e/c2/report.json
- c1: C:/Users/bruno/diretorio-hotel/out/libguest-fb-auth-8609337b/c1/report.json
- b1: C:/Users/bruno/diretorio-hotel/out/libguest-fb-auth-6c823714/b1-report.json
- b23-b4: C:/Users/bruno/diretorio-hotel/out/libguest-fb-auth-0531fa13/b23/report.json
- auth: C:/Users/bruno/diretorio-hotel/out/libguest-fb-auth-7fdf31da/report.json
- C5-LAB: out/libguest-fb-auth-055153df/c2/c5-report.json
- .NET: out/fb-c345-dotnet-reconciliation.log
- Segurança/SSR/browser/V3V4/SQL: out/fb-c345-*-final.log e out/fb-c345-sql-a.log
- Auditoria/inventário/hashes: out/fb-c345-inventory.json e out/fb-c345-final-gates.json

### [MIGRATIONS]

20261104231319_sprint_53_c3_print_admin.sql: aditiva; leitura administrativa
paginada/escopada, índice, comandos CAS/idempotentes, ACLs e auditoria C1.
20261104235347_sprint_53_c4_spooler_authorization.sql: necessária para contexto de
hotel/printer/fila autorizado e sinais autenticados, sem alterar snapshot ou seis
endpoints C1. Reutiliza tabelas; sem seed, ativação ou conteúdo. Somente LAB local.
SQLite local 2→3 aditivo/transacional; rollback de upgrade preserva v2. Nenhuma
migration já commitada foi modificada.

### [ARQUIVOS]

42 candidatos: 19 modificados, 23 novos. Classificação completa:

**PRODUÇÃO (28)**

```text
app/admin/impressao/page.tsx
app/admin/layout.tsx
app/api/admin/fb-printing/console/route.ts
app/api/fb/printing/spooler/dispatch/route.ts
app/api/fb/printing/spooler/observation/route.ts
bridge/Directory.Build.props
bridge/LibGuest.PrintingBridge/BridgeFault.cs
bridge/LibGuest.PrintingBridge/Cloud/CloudClient.cs
bridge/LibGuest.PrintingBridge/Cloud/JobEnvelope.cs
bridge/LibGuest.PrintingBridge/Configuration.cs
bridge/LibGuest.PrintingBridge/Engine/BridgeWorker.cs
bridge/LibGuest.PrintingBridge/Engine/LabCheckpoints.cs
bridge/LibGuest.PrintingBridge/Printing/TicketV1.cs
bridge/LibGuest.PrintingBridge/Printing/WindowsSpooler.cs
bridge/LibGuest.PrintingBridge/Printing/WindowsSpoolerAdapter.cs
bridge/LibGuest.PrintingBridge/Program.cs
bridge/LibGuest.PrintingBridge/Storage/Journal.cs
components/admin/fb-orders-panel.tsx
components/admin/fb-printing-config.tsx
components/admin/fb-printing-console.tsx
lib/fb/orders/operations.server.ts
lib/fb/orders/operations.ts
lib/fb/printing/admin-validation.ts
lib/fb/printing/admin.server.ts
lib/fb/printing/admin.ts
lib/fb/printing/http.server.ts
supabase/migrations/20261104231319_sprint_53_c3_print_admin.sql
supabase/migrations/20261104235347_sprint_53_c4_spooler_authorization.sql
```

**DOCUMENTAÇÃO (3)**

```text
bridge/README.md
docs/PRODUCT_MAP.md
docs/SPRINT_53_FNB.md
```

**TESTE REGRESSIONAL (9)**

```text
bridge/LibGuest.PrintingBridge.Tests/Program.cs
bridge/LibGuest.PrintingBridge.Tests/RevisionTests.cs
bridge/LibGuest.PrintingBridge.Tests/SpoolerTests.cs
tests/integration/fb-c3-polling.mjs
tests/integration/fb-c3.mjs
tests/integration/fb-c4.mjs
tests/integration/fb-c5-lab.mjs
tests/integration/fb-c5-reprint-race.mjs
tests/security/fb-c3.test.ts
```

**FERRAMENTA PERMANENTE (2)**

```text
tests/integration/fb-c2-runtime.mjs
tests/integration/fb-printing-lab.mjs
```

**TEMPORÁRIO — EXCLUIR DO FUTURO COMMIT:** out/** (relatórios, capturas, certificados,
configs, vaults DPAPI, fixtures, helpers desta execução e caches), .next/**,
bridge/**/bin/**, bridge/**/obj/**, publish/**, SQLite/WAL/SHM, logs, .env, segredos,
pairing, spool/PDF e tsbuildinfo. Não são candidatos de produto. Nenhum path
desconhecido/suspeito; nenhuma fonte ou evidência anterior descartada.

### [C5-REAL PENDENTE]

Homologação física controlada ainda pendente: hotel piloto autorizado; PC/mini-PC;
Windows/SQLite suportados; conta de serviço/perfil DPAPI/ACL; instalação SCM real;
fila real, modelo, driver, papel/margens/fontes; rede/cabo; reboot/energia;
internet indisponível; impressora offline; paper out; spool/resultado incerto;
reprint assistido; roteamento por setor e operação acompanhada. Validar acesso à
fila sem usuário logado, stop/recovery SCM e chamadas bloqueantes do driver.
Não se declara a Sprint 53 operacionalmente encerrada nem impressora homologada.

### [GIT]

sprint-53-fnb; HEAD inicial/final 25199232fe1a41a191fe3d12312ff7fafb29715f, referência origin local igual. Zero
staged, commit, push, merge; working tree preservado para revisão humana. Sem
alteração no worktree libguest-content-bridge.

### [REMOTO]

Zero deploy, Supabase remoto, tenant/hotel real, API externa de negócio, instalação
em hotel, registro de serviço, firewall, listener da bridge ou submissão real.
Laboratório final encerrado pelo gerenciador com otherProjectsTouched:false;
chave TLS privada efêmera removida. Sem processo da bridge ou listener LAB nas
portas 4317/4318 após encerramento. Evidências e fontes permanecem disponíveis;
artefatos temporários continuam excluídos do futuro stage.

**C3 + C4 + C5-LAB tecnicamente aprovados. A arquitetura de impressão nativa está
pronta para checkpoint Git; C5-REAL permanece pendente e nenhuma propriedade real
foi ativada.**
