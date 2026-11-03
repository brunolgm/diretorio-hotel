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
| B — Pedidos e painéis | [APROVADO — NÃO IMPLEMENTADO] | Carrinho, adicionais/modificadores, combos, nome e sobrenome, observações, confirmação idempotente, pedidos, snapshots de itens/preços/opções, disponibilidade por horário, setores, painéis operacionais, status e cancelamento. |
| C — Impressão local | [APROVADO — NÃO IMPLEMENTADO] | Bridge local no hotel, fila, múltiplas impressoras, roteamento por setor, confirmação, retry seguro, falha ambígua e reimpressão controlada. |
| D — Evoluções posteriores | [PLANEJADO] | Detalhamento futuro; nenhum comportamento adicional é declarado implementado. |

A auditoria técnica anterior continua válida para a Etapa A da Sprint 53.
Os contratos de código e resultados abaixo descrevem somente a Etapa A.
Aprovação de B/C não autoriza implementá-las nesta harmonização documental.

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
  fila e tratamento de falhas. Não há schema, endpoints, permissões ou bridge
  dessas etapas implementados por este documento.
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
external_url e room_restaurant_menu. Bugan permanece com Goomer até implantação,
homologação e autorização expressa de mudança operacional. Essa é a decisão
canônica; não foi feita leitura ou alteração do tenant real nesta rodada.
A Etapa A já preserva destinos/associações explícitos; não se declara implementado
um seletor operacional completo de modos nem os fluxos nativos de B/C.

## Adendo visual e independência do domínio

O domínio F&B é único e independente da versão visual. Bugan Recife usa V4 Premium;
Gastronomia, cardápio, carrinho e acompanhamento futuros devem seguir essa linguagem.
Mockups existentes são somente referência conceitual: não importar conteúdo fictício
nem redesenhar a Home V4 aprovada.

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

## RoomToken e identidade — decisão futura da Etapa B

roomToken pode fornecer contexto de apartamento. Para pedido nativo, hóspede
deverá informar nome e sobrenome e poderá informar observações. roomToken + nome
não autenticam hóspede, não comprovam reserva e não autorizam débito. Esses dados
não devem alimentar logs/analytics públicos com PII. Controles de coleta e proteção
pertencem ao projeto de B; nenhuma coleta ou fluxo de pedido foi implementado aqui.

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
brutas não são expostos. Não há dados de hóspede ou roomToken no domínio F&B.

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
