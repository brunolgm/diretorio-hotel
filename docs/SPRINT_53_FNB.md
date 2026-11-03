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
| B — Pedidos e painéis | [B1 IMPLEMENTADO LOCALMENTE — B2/B3/B4 PENDENTES] | Fundação transacional descrita ao final; carrinho/checkout público, UI dos painéis e consolidação operacional ainda não entregues. |
| C — Impressão local | [APROVADO — NÃO IMPLEMENTADO] | Bridge local no hotel, fila, múltiplas impressoras, roteamento por setor, confirmação, retry seguro, falha ambígua e reimpressão controlada. |
| D — Evoluções posteriores | [PLANEJADO] | Detalhamento futuro; nenhum comportamento adicional é declarado implementado. |

A auditoria técnica anterior continua válida para a Etapa A da Sprint 53.
Os contratos históricos e resultados até Turbo 2 abaixo descrevem somente A;
a seção B1 ao final descreve a implementação posterior separadamente.
A harmonização documental anterior não implementou B/C. A autorização posterior
de B1 implementa somente a fundação descrita ao final; C permanece não implementada.

### Histórico da decisão e seus impactos

- Decisão anterior: o fechamento consultivo excluía pedidos, carrinho, painéis
  e impressão do escopo então tratado como Sprint 53. Essa decisão fica preservada
  como histórico, não como limite vigente de toda a Sprint expandida.
- Nova decisão: catálogo é a Etapa A; pedidos/painéis são B e impressão é C,
  aprovadas e ainda não implementadas. D permanece planejada.
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
destino autorizado) ou o modo nativo LibGuest (catálogo e, futuramente, carrinho,
pedido, painéis e impressão). TheX como destino externo não implica integração
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
