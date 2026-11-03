# Sprint 53 — Etapa A: auditoria integral e homologação autenticada local

[AUDITORIA FINAL] APROVADA no escopo de código e laboratório locais. Não autoriza
habilitação real, publicação de conteúdo ou integração técnica.

Escopo desta aprovação: somente Etapa A — catálogo F&B nativo. A Sprint 53 não
está concluída: B (pedidos/painéis) e C (impressão local) estão aprovadas e não
implementadas; D está planejada. Adendos, histórico, modos externo/nativo e matriz
visual permanente estão em SPRINT_53_FNB.md e PRODUCT_MAP.md, sem documento paralelo.
A auditoria técnica anterior continua válida para a Etapa A da Sprint 53.

Base preservada: sprint-53-fnb, HEAD e7b514620879f1feb91b2f62b5d27e9e529f843d.
Nenhum stage, commit, push, merge, deploy, acesso Supabase remoto ou alteração real.

## Escopo e evidência

Foram revisados os 45 paths iniciais (21 modificados e 24 novos), incluindo os
não rastreados. Não houve restauração ou descarte da implementação. Os resultados
do Turbo 1 permanecem históricos em SPRINT_53_FNB.md; regressão com adaptadores é
separada da homologação pela aplicação com GoTrue, PostgreSQL, PostgREST e Storage reais.

O laboratório usa imagens já instaladas, pull never, daemon local, recursos com
rótulos exclusivos e API em loopback. DB/Auth/Storage ficam em rede interna;
o gateway usa entrada sem masquerade. Next e browser bloqueiam destinos externos.
Credenciais e UUIDs são gerados por execução. O runner recusa banco populado e
não usa o laboratório 45B ou outro projeto.

O schema inicial anterior às migrations não está versionado:
53_fb_auth_baseline.sql reconstrói tabelas físicas a partir dos tipos e aplica
as 52 migrations, sem substituir contratos de autorização. Auth/Storage usam
schemas geridos pelos serviços reais. Uma remoção histórica de política de
analytics anterior à 45B não está na cadeia; a fixture local remove somente a
política antiga conhecida após validar sua definição. Isso não autoriza contornar
preflights de um banco remoto.

## Achados e correções dentro do contrato

1. **Identidade legada composta.** Guias do Quarto já criou a constraint
   hotel_sections_id_hotel_id_key UNIQUE(id,hotel_id). O conindid da FK nova
   demonstrou que PostgreSQL reutilizava esse índice mesmo com ordem inversa.
   A UNIQUE adicional da Sprint 53 foi retirada com essa evidência; a FK nova
   usa a ordem canônica e o preflight exige a identidade existente. Nenhuma
   migration antiga nem constraint de Guias foi alterada.
2. **Moeda/unidade mínima.** A regex aceitava ZZZ e a divisão fixa por 100 não
   representava JPY/KWD. Banco e TS agora validam um conjunto explícito de moedas;
   entrada e exibição respeitam seu expoente. Persistência continua inteira.
   Zero é válido; negativos, overflow, moeda inválida e amount + on_request
   são rejeitados. O rótulo pede valor decimal na moeda, não centavos.
3. **Mídia.** O RPC exige objeto existente no bucket, MIME/tamanho compatíveis e
   criação posterior ao snapshot da entidade. Não basta um prefixo plausível.
   A barreira também impede reutilizar objeto antigo durante cleanup pós-commit.
   UUID/upload continuam server-owned, upsert:false; browser roles não escrevem.
4. **Preflight Storage.** Inclui políticas aplicáveis por herança de roles,
   além de PUBLIC/anon/authenticated diretamente.
5. **RSC.** Editor e painel de mídia usam ID + revisão, evitando combinar campos
   locais antigos com revisão renovada. A lista usa o pai da entidade selecionada.
6. **Data API.** Leituras administrativas/idiomas percorrem páginas internas,
   validam count exato e recusam snapshot parcial ou ordem alterada. UI preservada.
   O laboratório limita respostas a 1000; há caso com 1005 criações autenticadas.
   Índices das traduções incluem tenant.
7. **Next Image.** F&B usa unoptimized, conforme o padrão existente, sem ampliar
   a configuração global de hosts.
8. **Reprodução.** esbuild está fixado em package/lock. Runners não dependem de
   out/hotfix-tools, outro projeto ou TEMP fixo. O runner SQL cria/remove seu
   próprio PostgreSQL sem rede, portas ou mounts.

As rodadas intermediárias também corrigiram premissas de fixtures: Serviço usa
UUID gerado pelo banco, respeitando os grants de coluna legados; a fotografia
positiva precisa ficar abaixo de 2 MiB; negativos de tamanho usam exatamente o
limite + 1. Dialogs esperam hidratação antes do clique. Não se ampliaram grants,
limites de mídia, Auth ou policies para acomodar os testes. Resultados parciais
interrompidos não contam como aprovação da matriz autenticada integral.

## Fundação, RLS, RPCs e publicação

Dez tabelas: quatro entidades, quatro traduções e duas associações. PKs/FKs
compostas mantêm relações no mesmo hotel. Menu pode ser compartilhado por outlets
próprios; remover associação/outlet preserva menu e filhos. Excluir menu/categoria
remove descendentes deliberadamente; excluir Serviço remove só o vínculo.

Todas têm RLS. authenticated recebe SELECT por perfil ativo visualizador+,
módulo e lifecycle, sem DML direto. anon não lê tabelas brutas; service_role não
ganha atalho de mutação. Writes usam RPCs autenticadas, tenant do perfil,
operador+, locks, revisão/PT409 e auditoria na mesma transação. SQL dinâmico tem
nomes controlados e valores parametrizados.

SECURITY DEFINER usa search_path vazio e ACL explícita; owner local está em
schema-audit.json. FORCE RLS não foi introduzido: segue Turismo com proprietário
confiável e APIs estreitas. Isso não dispensa checks nos RPCs. Schema privado não
expõe mutadores; authenticated executa somente o helper usado nas policies.

Elegibilidade: hotel active + core.directory + fb.menu; outlet publicado;
menu publicado/associado; categoria publicada; item publicado/disponível
editorialmente. Serviço exige habilitado + content.services. Alergênicos/dietary
ausentes são omitidos, sem declaração de ausência de alergênicos.

Governança altera somente a exclusão de disponibilidade de fb.menu. O laboratório
compara OID, owner, ACL, SECURITY DEFINER, search_path e definição antes/depois.
Baseline de 12 módulos/onboarding permanece igual. Opt-in é exclusivo do Platform
Admin ativo; não há backfill, auto-enable ou criação automática de conteúdo.

## Lock, tabela populada e reversão

A chave referenciada composta é necessária; PK(id) isolada não é essa chave
formal. A UNIQUE canônica já existe. A versão inicial acrescentava índice
redundante e build sob ACCESS EXCLUSIVE; a correção evita esse ALTER.

53_fb_populated_legacy_unique.sql recria somente a FK nova contra Serviços
populados; verifica índice usado, hash de todas as linhas, xmin/ctid e locks,
terminando em ROLLBACK. FK ainda exige lock de schema: sua janela futura deve
ser avaliada. O teste local não estima duração em banco remoto.

O ensaio com DROP/ADD da FK observou AccessShareLock, RowShareLock,
ShareRowExclusiveLock e AccessExclusiveLock sobre Serviços. Esse conjunto inclui
o caminho de reversão/recriação; não é medição isolada de CREATE TABLE/FK nem
promessa de ausência de bloqueio na instalação. O log integral é preservado em
legacy-unique-proof.log no diretório de resultados do laboratório.

Reversão funcional futura: opt-out autorizado e reversão do código, preservando
dados/objetos. Reversão estrutural remove primeiro dependências novas. Nunca
remover a UNIQUE antiga, usada por Guias do Quarto. Sem DROP/limpeza automática.

## Idiomas, Serviço e apartamentos

PT salva antes da tradução central em escrita; EN/ES são independentes.
Stale retorna false sem retry forçado; falha deixa PT salvo. Leitura não traduz.
Persistência/fallback/revisão são validados localmente com Google real desligado;
isso não homologa o provedor externo.

Associação usa somente UUID, sem heurística, e não altera tipo/URL/conteúdo do
Serviço, restaurant_menu_url, QR ou token. Fixtures separadas cobrem Filipe
standard, Room Service externo equivalente a Goomer e room_restaurant_menu.
O resolvedor existente usa DB real para contexto ausente, token inválido,
inativo, estrangeiro, válido e URL ausente/presente. Token não vira identidade
administrativa ou autorização de pedido.

Commit tardio: lock PostgreSQL real e proxy desconectam somente o cliente,
mantendo o request upstream. Observar estado antigo após perder resposta não
autoriza cleanup: commit posterior ainda pode associar o upload.

## Limites

Homologação sintética não é configuração de hotéis reais. Goomer não é chamado.
Histórico consultivo: pedidos, painéis e impressão eram excluídos do fechamento
original. Os adendos os posicionam fora somente da Etapa A, nas futuras B/C,
incluindo carrinho e disponibilidade por horário. Galeria segue 53.x.
Continuam fora da Sprint 53 atual: API TheX (58), PMS/OPERA/OHIP (59), pagamento
nativo, PIX/cartão, débito automático em apartamento, lançamento direto em PDV,
estoque em tempo real salvo decisão futura e Billing. A auditoria não validou B/C.

## Gates, matriz e inventário

Rodada integral final: out/libguest-fb-auth-17dd2f4f/report.json, modo full,
1434 verificações aprovadas, zero falhas, zero requests externos e zero pageerror.
13 usuários criados pelo GoTrue e autenticados por senha; 13 logins normais na
aplicação (Platform + seis Operator + seis Viewer). Não houve substituição de
server actions, JWTs emitidos manualmente para usuários ou helpers de RLS.

| Gate | Resultado desta auditoria |
|---|---|
| F&B direcionado | 90/90, subconjunto da suíte de segurança |
| Segurança completa | 715/715; antes eram 711 |
| PostgreSQL mínimo isolado | 197/197; rollback e container removido |
| Aplicação/Auth/DB/Storage reais locais | 1434/1434, modo full |
| Browser de componentes com adaptadores | 1524/1524, zero requests externos |
| SSR com adaptadores | 391/391, zero rede |
| Regressão V3/V4 existente | 152 cenários aprovados |
| TypeScript noEmit | Exit 0 |
| Lint | Sem erros; quatro avisos históricos |
| Build final | Exit 0; compilação, TypeScript e geração concluídas com rede externa bloqueada |
| Diff check | Sem erros |
| Integridade protegida | 81 hashes idênticos; 50 migrations antigas intactas |

Auth: logins normais e contextos distintos. DB: baseline físico local explícito
mais as 52 migrations. RLS: dez tabelas, Viewer/Operator, tenant estrangeiro,
anon e mutação service_role negada. Platform: opt-in/opt-out pela UI real nos
seis, sem conteúdo ou entitlement automático. Operator: criação, edição,
associações, reorder e publicação nas seis fixtures; mídia e hard delete/cascatas
completos no Bugan sintético. Viewer: leitura, UI bloqueada, seis chamadas de mutação negadas e
replay de server action real negado nos seis.

Concorrência: 18 pares de writes de outlet/item/publicação, com duas sessões
GoTrue, um vencedor, um PT409 HTTP409 e somente uma auditoria em cada par;
duas abas também exercitam conflito de mídia. Storage: upload real e leitura
pública, troca, remoção, byte/MIME/tamanho/dimensões, ownership, upsert:false,
path inventado/reuso antigo e papel browser negados. Perda de resposta com lock
PostgreSQL real preservou o objeto e o commit tardio.

Público: zero/um/múltiplos outlets, seis tipos, menus compartilhados, categorias,
itens, preço zero/sob consulta, alergênicos/dietary opcionais, tradução parcial,
imagem/ausência e ancestralidade/publicação/disponibilidade editorial. Slug e
subdomínio reais locais; PT/EN/ES em 390 e 1440 px. Idiomas preservam fallback
por campo e rejeitam revisão stale; Google real não foi usado.

QR: sem contexto, inválido, inativo, válido, URL ausente e token estrangeiro;
destino válido identificado por Location, sem segui-lo. Token não autorizou Admin.
Os 18 Serviços originais e 18 vínculos de apartamento sintéticos terminaram
idênticos. A fixture extra de Serviço usou o grant canônico, sem fornecer ID.
Escala: 1005 itens criados via RPC autenticada, cap real 1000/exact 1005,
último item disponível no Admin e Idiomas e cascade autorizado da fixture.

### Matriz dos cinco hotéis + Default técnico

Todas as colunas abaixo se referem exclusivamente às fixtures locais distintas.
O ensaio V4 sintético nos demais hotéis comprova compatibilidade, não migração
ou homologação das versões atuais dos tenants. A matriz permanente A/B/C exige
os quatro hotéis em suas experiências atuais, Bugan V4 Premium e Default fallback,
conforme SPRINT_53_FNB.md. Não houve migração visual nesta harmonização documental.
Home = OFF, ON vazio e ON com conteúdo, protegendo Hero, alerta, essenciais,
Voos, Turismo, comunicações, dock e tema. Detalhe = detalhe expansível nativo.

| Hotel | Arquitetura compartilhada | Entitlement lab | Sintético | Admin | Home | Catálogo/detalhe | Room Service/QR | PT/EN/ES | Mobile 390 | Desktop 1440 | Regressão V4 | Tenant real |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Grand Mercure Copacabana | Sim | OFF/ON/OFF/ON | Sim | OK | OK | OK | OK | OK | OK | OK | OK | Pendente |
| Novotel Leme | Sim | OFF/ON/OFF/ON | Sim | OK | OK | OK | OK | OK | OK | OK | OK | Pendente |
| Novotel Salvador Rio Vermelho | Sim | OFF/ON/OFF/ON | Sim | OK | OK | OK | OK | OK | OK | OK | OK | Pendente |
| Mercure Rio Boutique Copacabana | Sim | OFF/ON/OFF/ON | Sim | OK | OK | OK | OK | OK | OK | OK | OK | Pendente |
| Bugan Recife | Sim | OFF/ON/OFF/ON | Sim | OK | OK | OK | OK | OK | OK | OK | OK | Pendente |
| Default técnico | Sim | OFF/ON/OFF/ON | Sim | OK | OK | OK | OK | OK | OK | OK | OK | Não é hotel real |

### Evidência visual e pendências reais

170 PNGs da aplicação real: 108 Home, 36 catálogo, 24 Admin e duas de Storage.
As 24 capturas Admin foram recapturadas após os campos reais substituírem o
skeleton, com rechecagem de responsividade nas sessões normalmente autenticadas.
Também há 12 capturas da regressão isolada de componentes. Inspeção visual
incluiu Home Grand Mercure mobile, catálogo Mercure desktop e Bugan com fotografia
real mobile/desktop e Admin mobile. Isso não é aceite editorial de hotéis reais.

Exemplos no diretório out/libguest-fb-auth-17dd2f4f:
fb-lab-bugan-home-content-390-pt.png, fb-lab-bugan-home-content-1440-pt.png,
bugan-real-storage-390.png, bugan-real-storage-1440.png,
fb-lab-bugan-admin-operator-390.png, fb-lab-bugan-admin-viewer-1440.png.

Pendentes, fora da autorização desta rodada: inventário/preflight no banco real,
aplicação remota das migrations, opt-in/configuração/publicação de cada tenant,
aceite editorial/operacional e validação de tradução com provedor real.
Nenhuma decisão nova de produto foi tomada. Stage/commit/integração/deploy não
foram executados. Artefatos out/** e .next/**, logs, screenshots e credenciais
efêmeras não são aprovados para stage.

## Inventário exato para revisão e futuro stage

Nenhum stage executado. A lista exata abaixo está aprovada para revisão/futuro stage e cobre todos os 59 paths do diff
(23 modificados, 36 novos); a autorização desta rodada não inclui stage.

### Produção, incluindo documentação (32)

```text
app/admin/cardapio/actions.ts
app/admin/cardapio/page.tsx
app/admin/idiomas/page.tsx
components/admin/fb-editor.tsx
components/admin/fb-language-summary.tsx
components/public/hotel-public-area-content.tsx
components/public/hotel-public-page-content.tsx
components/public/public-experience-overview.tsx
components/public/public-fb-content.tsx
docs/PRODUCT_MAP.md
docs/SPRINT_53_FNB.md
docs/SPRINT_53_FNB_AUDIT.md
lib/authenticated-flight-preview.ts
lib/authenticated-hotel-preview.ts
lib/fb/admin.ts
lib/fb/currencies.ts
lib/fb/media.ts
lib/fb/pagination.ts
lib/fb/public.ts
lib/fb/read.server.ts
lib/fb/translations.ts
lib/fb/types.ts
lib/fb/validation.ts
lib/modules/catalog.ts
lib/public-experience-v4.ts
lib/public-hotel-data.ts
lib/security/image-upload.ts
lib/services/translation-service.ts
lib/tourism/image.ts
supabase/migrations/20261102223413_sprint_53_fb_foundation.sql
supabase/migrations/20261102230145_sprint_53_fb_governance_available.sql
types/database.ts
```

### Regressão (15)

```text
supabase/tests/53_fb_behavioral_matrix.sql
supabase/tests/53_fb_populated_legacy_unique.sql
tests/browser/fb-actions-stub.ts
tests/browser/fb-fixture.tsx
tests/browser/fb-ssr.tsx
tests/browser/public-experience-v4.mjs
tests/fixtures/fb.ts
tests/integration/fb-local-adversarial.mjs
tests/integration/fb-local-late-commit.mjs
tests/security/admin-information-architecture.test.ts
tests/security/fb.test.ts
tests/security/module-entitlements.test.ts
tests/security/platform-onboarding.test.ts
tests/security/tourism-governance.test.ts
tests/security/tourism-languages.test.ts
```

### Ferramenta permanente (12)

```text
package-lock.json
package.json
scripts/fb-local-lab.mjs
scripts/fb-local-network-guard.mjs
scripts/test-fb-sql-local.py
supabase/tests/53_fb_auth_baseline.sql
supabase/tests/53_fb_auth_legacy_transition.sql
supabase/tests/53_fb_local_bootstrap.sql
tests/browser/fb-ssr.mjs
tests/browser/fb.mjs
tests/integration/fb-authenticated.mjs
tests/integration/fb-local-seed.mjs
```

Remover/não commitar: nenhum path de fonte a descartar. out/**, .next/**,
logs, screenshots e credenciais/estado efêmeros são artefatos ignorados, fora
desta lista. Suspeitos: nenhum identificado na revisão; gates finais abaixo.
