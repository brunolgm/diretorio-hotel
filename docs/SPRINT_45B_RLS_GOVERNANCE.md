# Sprint 45B — RLS, governança transacional e auditoria persistente

Data: 11/08/2026

Branch: `sprint-45b-rls-governance`

Status: migrations e integração preparadas para revisão local. Nenhum SQL ou migration foi executado.

## 1. Diagnóstico e comparação da baseline

O repositório versionava integralmente apenas as tabelas criadas nas migrations recentes. A baseline de `hotels`, `profiles`, `hotel_sections`, `hotel_departments` e `hotel_policies` não estava presente; por isso, o estado remoto não podia ser inferido apenas a partir do Git e foi conferido diretamente pelo inventário read-only de produção.

Não foram encontrados triggers versionados. Também não havia grants declarativos nas migrations anteriores; os acessos dependiam dos defaults/estado remoto e das policies parciais.

### Inventário remoto real de produção

O inventário confirmou as policies legadas abaixo, que entram nas allowlists somente para que as migrations possam removê-las explicitamente e instalar a baseline revisada:

- `hotels`: `hotel_select_by_profile`, `hotel_update_by_profile`, `public_read_hotels`;
- `profiles`: `profile_select_own`, `profile_update_own`;
- conteúdo principal: `public_read_enabled_sections`, `sections_all_by_profile`, `public_read_enabled_departments`, `departments_all_by_profile`, `public_read_enabled_policies`, `policies_all_by_profile`;
- traduções de sections/departments/policies: para cada tabela, as policies remotas de INSERT, UPDATE e DELETE autenticados do próprio hotel e a leitura pública, com os nomes exatos registrados na migration 001;
- analytics: `Allow constrained public analytics inserts` e `Allow hotel users to view their analytics`;
- Storage: `Allow authenticated uploads to hotel-assets`, `Allow authenticated updates in hotel-assets` e as seis policies já conhecidas de banners nos dois formatos de path;
- comunicados, banners e traduções: permanecem os nomes conhecidos já registrados no inventário e na allowlist da migration 001.

Policies remotas não incluídas nesse conjunto continuam fazendo o preflight abortar. Em particular, `hotel_update_by_profile` e `profile_update_own` são removidas sem substituição por escrita de browser.

| Entidade | Estado versionado encontrado | Estado esperado | Lacuna e ação proposta |
| --- | --- | --- | --- |
| `hotels` | sem baseline RLS/grants | anon lê uma view explícita; autenticado lê somente o próprio hotel; UPDATE direto fica sem grant | inventariar policies remotas; habilitar RLS, criar `public_hotels` e mover updates para actions server-only |
| `profiles` | apenas coluna `is_active` | próprio perfil ou admin do hotel lê; escrita direta bloqueada | inventariar; declarar SELECT mínimo; mutação sensível por RPC/service role |
| `hotel_sections`, `hotel_departments`, `hotel_policies` | sem baseline | público lê somente ativos; hotel lê; operador escreve | habilitar RLS e declarar policies por hotel/papel |
| traduções dessas entidades | tabelas sem RLS versionada | público lê somente quando o pai está ativo; operador do hotel escreve | habilitar RLS e escopar via entidade pai |
| comunicados e banners + traduções | RLS por hotel, mas escrita para qualquer perfil ativo | leitura pública elegível; leitura do hotel; escrita operador+ | substituir policies de escrita permissivas |
| `hotel_analytics_events` | insert direto `anon/authenticated with check (true)` | SELECT visualizador+ do hotel; insert somente server-side | revogar INSERT e remover policy pública; API usa service role server-only |
| `hotel_room_links` | qualquer perfil ativo do hotel lê/escreve | editor+ do hotel; nenhum acesso anônimo | substituir policies e grants; rota pública continua via service role |
| `storage.objects` / `hotel-assets` | duas famílias de paths para banners, qualquer perfil ativo | sem acesso direto do browser; operador para banners e editor para logo/hero nas server actions | consolidar paths modernos e compatibilidade explícita de remoção legada |
| auditoria | inexistente | append-only, escrita server-only e leitura admin do próprio hotel | criar tabela, função restrita e RLS |

### Preflight remoto obrigatório

Antes de qualquer aplicação em preview, exportar e anexar à revisão:

- `pg_policies` para todas as tabelas acima e `storage.objects`;
- `relrowsecurity` e `relforcerowsecurity` de `pg_class`;
- grants de tabelas, sequences e functions para `anon`, `authenticated` e `service_role`;
- definição dos buckets e policies do bucket `hotel-assets`;
- privilégios efetivos de `service_role` em `storage.objects`, confirmando no catálogo remoto acesso suficiente para upload e cleanup executados exclusivamente pelas server actions antes de aplicar a migration 005;
- funções, owners, `prosecdef`, `proconfig` e grants de execução;
- triggers existentes em `profiles` e entidades administrativas.

O script read-only `supabase/tests/45b_remote_inventory.sql` reúne essas consultas para um preview/clone. Ele não foi executado.

A migration de baseline contém uma guarda contra policies inesperadas. Ela deve abortar em vez de apagar uma policy remota que não esteja na lista conhecida. Se o inventário encontrar nomes ou comportamentos adicionais, revisar a migration no Git antes de qualquer execução.

## 2. Papéis e capacidades esperadas

| Capacidade | visualizador | operador | editor | administrador |
| --- | ---: | ---: | ---: | ---: |
| ler conteúdo administrativo do próprio hotel | sim | sim | sim | sim |
| criar/editar/excluir conteúdo e traduções | não | sim | sim | sim |
| alterar hotel, identidade, logo e hero | não | não | sim | sim |
| gerenciar apartamentos, QR e notas | não | não | sim | sim |
| gerenciar banners e mídia de banners | não | sim | sim | sim |
| gerenciar usuários e ler auditoria | não | não | não | sim |

Aliases legados `admin` e `owner` são tratados somente como `administrador`. Nenhum papel novo foi criado.

### Fronteira de mínimo privilégio

`anon` não recebe mais SELECT em `public.hotels`. A view `public.public_hotels`, concedida a `anon` e `authenticated`, expõe explicitamente os campos atualmente consumidos pela experiência do hóspede: identidade e roteamento (`id`, `name`, `slug`, `subdomain`, `city`), destinos públicos, contato, Wi-Fi, horários, URLs de logo/hero e configuração visual pública. `created_at`, `updated_at` e qualquer coluna futura não entram automaticamente no contrato. `wifi_password` permanece na view porque a UI pública atual o renderiza intencionalmente; retirar esse campo exige uma decisão de produto separada.

O cliente público sem sessão e `/api/analytics` consultam essa view. Usuários autenticados também podem consultar a mesma projeção pública de qualquer hotel, evitando que uma sessão ativa quebre a experiência destinada ao hóspede. Leituras administrativas da tabela base continuam restritas ao próprio hotel por RLS.

`authenticated` não recebe grant nem policy UPDATE em `hotels`. As actions de hotel exigem editor, derivam o hotel no servidor, validam uma allowlist e só então atualizam pela service role com filtro por `id`. Assim, chamadas diretas do browser não conseguem alterar `brand_code`, `slug`, timestamps nem campos futuros.

Conteúdo genuinamente público — serviços, departamentos e políticas ativos, respectivas traduções, comunicados elegíveis e banners elegíveis — usa policies `to anon, authenticated`. As policies administrativas adicionais continuam expondo registros inativos e operações somente quando hotel e papel coincidem.

As demais actions de conteúdo usam hoje o cliente SSR com o JWT autenticado. Banco e browser não conseguem distinguir esse JWT quando a chamada parte de uma server action ou diretamente do cliente. Trocar todas essas mutações pela service role ampliaria o bypass de RLS; criar uma RPC por entidade seria um refactor maior. Portanto, os DML necessários permanecem em `authenticated`, limitados simultaneamente por papel/hotel na RLS e por grants de coluna:

| Tabela | INSERT permitido pelas actions | UPDATE permitido pelas actions | DELETE |
| --- | --- | --- | --- |
| `hotel_sections` | `hotel_id`, título, ícone, conteúdo, CTA, URL, categoria, action type, status, ordem | os mesmos campos mutáveis, sem `hotel_id` | pai, operador+ |
| `hotel_departments` | `hotel_id`, nome, descrição, horários, ação, URL, status | campos de conteúdo/status, sem `hotel_id` | pai, operador+ |
| `hotel_policies` | `hotel_id`, título, descrição, status | título, descrição e status | pai, operador+ |
| `hotel_announcements` | `hotel_id`, conteúdo, categoria, janela e status | conteúdo, categoria, janela, status e `updated_at`, sem `hotel_id` | pai, operador+ |
| `hotel_promotional_banners` | `hotel_id`, conteúdo, mídia, CTA, janela, status e ordem | os mesmos campos mutáveis e `updated_at`, sem `hotel_id` | pai, operador+ |
| cinco tabelas de tradução | FK do pai, idioma, campos traduzidos e `updated_at` | mesmos campos necessários ao upsert | sem grant direto; exclusão ocorre por cascade do pai |

Não há DML `authenticated` para `hotels` ou `profiles` nesta baseline. As demais exclusividades server-side do conjunto 45B são analytics INSERT, escrita de auditoria e gestão Auth/profile; Storage e room links são tratados nas migrations específicas, que não foram alteradas nesta revisão.

`updated_at` foi comparado com os payloads reais. Serviços, departamentos e políticas não o enviam e não recebem grant nessa coluna. Comunicados, banners e os cinco upserts de tradução enviam timestamps explicitamente e, como não há trigger versionado que os substitua, mantêm somente os grants de `updated_at` necessários. Nenhum trigger foi inventado.

## 3. Migrations propostas

Ordem obrigatória de revisão/aplicação futura:

1. `202608110001_45b_authz_helpers_and_rls_baseline.sql`: helper seguro, grants e baseline das tabelas públicas/administrativas;
2. `202608110002_45b_close_direct_analytics_insert.sql`: fecha insert direto e mantém leitura administrativa;
3. `202608110003_45b_admin_audit_log.sql`: tabela append-only, RLS e função server-only;
4. `202608110004_45b_last_admin_rpc.sql`: RPC transacional com advisory lock e auditoria na mesma transação;
5. `202608110005_45b_storage_policies.sql`: policies consolidadas do bucket;
6. `202608110006_45b_room_links_rls.sql`: mínimo privilégio para quartos/tokens/notas.

Nenhum desses arquivos foi executado.

Em preview, aplicar o conjunto em uma janela coordenada e publicar imediatamente o código compatível: a migration de analytics remove o INSERT usado pela versão antiga da API, enquanto a nova gestão de usuários depende da RPC criada. Executar então os verificadores SQL, smoke test público/admin e matriz sintética antes de considerar produção. Não aplicar parcialmente em produção.

## 4. Analytics

O fluxo esperado passa a ser browser → `/api/analytics` → validação 45A → resolução pública com cliente anon sem sessão → insert com cliente server-only. `anon` e `authenticated` perdem o grant e a policy de INSERT direto. A service role nunca é enviada ao browser.

## 5. Último administrador

`admin_update_hotel_user` valida `auth.uid()`, perfil ativo de administrador, hotel do alvo e valores canônicos de role. Um advisory lock derivado do hotel serializa mudanças concorrentes. A função bloqueia as linhas relevantes, impede auto-rebaixamento/desativação, aplica a alteração e verifica dentro da mesma transação que resta pelo menos um administrador ativo. Qualquer exceção desfaz a mudança.

Como regra de produto, um administrador não pode remover, rebaixar nem desativar o próprio acesso; outro administrador ativo do mesmo hotel deve executar a operação. O painel não possui atualmente uma action de exclusão de usuário. Se esse fluxo for criado, a exclusão do perfil deverá usar proteção transacional equivalente — lock por hotel, bloqueio das linhas e verificação do último administrador — antes de coordenar a remoção no Auth.

O evento de auditoria dessa RPC usa metadata rasa e escalar: `previous_role`, `new_role`, `previous_status` e `new_status`. Um `previous_role` SQL nulo é serializado como JSON `null`, que é escalar e compatível com a validação da migration 003.

A RPC protege a parte PostgreSQL. Alterações na Supabase Admin Auth API continuam fora da transação e preservam a compensação da Sprint 45A.

## 6. Audit log

`admin_audit_log` contém `id`, `created_at`, `actor_user_id`, `hotel_id`, `action`, `entity_type`, `entity_id`, `metadata` e `request_id`. A ausência de foreign keys para usuário/hotel é intencional: os UUIDs históricos precisam sobreviver à remoção das entidades. Metadata precisa ser objeto JSON de no máximo 2 KiB, sem objetos aninhados ou arrays e somente com valores escalares. Chaves equivalentes a senha, password, room token, token, JWT, service role, payload, cookie ou authorization são bloqueadas sem diferenciar caixa.

Nenhum papel da aplicação possui INSERT, UPDATE ou DELETE direto, e `service_role` também não possui SELECT da tabela. Administradores autenticados leem somente o próprio hotel por RLS. `service_role` possui exclusivamente EXECUTE em `record_admin_audit_event`; a função é `SECURITY DEFINER`, usa `search_path = ''`, valida ator ativo e hotel antes de inserir com schema qualification explícita.

Append-only significa imutável para `anon`, `authenticated` e `service_role` pelos caminhos da aplicação. O owner e superuser do banco mantêm autoridade operacional e não são apresentados como tecnicamente imutáveis.

Foram priorizados eventos de usuário, regeneração de QR e mudanças de hotel/mídia. A instrumentação restante pode ser adicionada incrementalmente sem ampliar o schema.

## 7. Storage

Os paths modernos aceitos são:

- `<hotel_id>/logo/<uuid>.<ext>` e `<hotel_id>/hero/<uuid>.<ext>` para editor+;
- `<hotel_id>/promotional-banners/<banner_id>/<uuid>.<ext>` para operador+.

As oito policies diretas legadas de Storage são removidas pela migration 005, sem criar uma nova policy para `hotel-assets`. Os grants estruturais de `storage.objects` são internos e gerenciados pelo Supabase, portanto não são revogados pela migration. A fronteira efetiva de autorização é o RLS: sem uma policy aplicável ao bucket, operações de browser são negadas mesmo quando `anon` ou `authenticated` conservam grants estruturais.

Assets continuam servidos por URL pelo bucket público, sem policy de listagem ou mutação de `hotel-assets` para o browser. A busca nos fluxos reais não encontrou consumidor browser de SELECT, INSERT, UPDATE ou DELETE no Storage: uploads e remoções de logo/hero usam server actions com editor+, e banners usam server actions com operador+, todas com service role. A service role bypassa RLS somente dentro dessas actions protegidas. Assim, mídia administrativa permanece exclusivamente server-side e a validação binária, de MIME/formato, dimensões e bytes da Sprint 45A não pode ser contornada pelo acesso direto ao Storage.

No laboratório local, após a migration 005, `pg_policies` retornou zero policies para `storage.objects`. Uma tentativa real de INSERT em `hotel-assets` com role `authenticated` e JWT sintético falhou por violação de RLS, apesar dos grants estruturais padrão. A matriz comportamental reproduz esse cenário dentro de uma transação com rollback e não interpreta os grants gerenciados como autorização suficiente.

Assets legados `<hotel_id>/logo.*` e `<hotel_id>/hero.*`, inclusive SVG histórico, continuam reconhecidos apenas para leitura pública por URL e cleanup pelas server actions. Eles não podem ser criados nem sobrescritos por `authenticated`; novos uploads permanecem limitados a PNG, JPEG e WebP validados e a paths gerados no servidor. Nenhum arquivo real é migrado.

O preflight da migration 005 lista e aborta diante de policies em `storage.objects` que mencionem `hotel-assets`, não filtrem bucket ou usem condições amplas/complexas com `OR`/`NOT`. Apenas uma policy com igualdade estrita e conjuntiva para outro bucket é automaticamente considerada exclusiva; qualquer caso mais complexo é identificado nominalmente para revisão manual antes da execução.

## 8. QR, tokens, notas e campos públicos

`hotel_room_links` não tem policy ou grant para `anon`. `authenticated` recebe somente SELECT, INSERT e UPDATE, cada operação coberta por policy editor+ e isolada pelo hotel; não existe grant nem policy de DELETE. A página e o item de navegação de Apartamentos também exigem editor+. `service_role` recebe somente SELECT para a resolução pública server-side em `/r/[roomToken]`, que retorna apenas o contexto necessário. Listagem pública direta de tokens é bloqueada.

Antes de adicionar a constraint nomeada `hotel_room_links_room_token_base64url_24_check`, a migration aborta se qualquer registro histórico não corresponder exatamente a 24 caracteres base64url (`^[A-Za-z0-9_-]{24}$`); nenhum token é corrigido ou rotacionado automaticamente. A geração continua baseada em `crypto.randomBytes(18).toString('base64url')`, e toda resolução pública valida `isRoomToken()` antes de consultar com service role.

A rotação registra apenas a action `room.qr_regenerated`, com metadata vazia. O token e listas de campos alterados não entram no audit log.

RLS é por linha, não por coluna. O loader público usa um cliente anon explícito e consulta `public_hotels`, nunca a tabela base. A view torna o contrato de colunas revisável, mas os campos de Wi-Fi continuam públicos por decisão vigente do produto.

## 9. Testes preparados

`supabase/tests/45b_rls_verification.sql` verifica de forma read-only o catálogo, grants, funções e policies após uma futura aplicação em banco descartável. `supabase/tests/45b_behavioral_matrix.sql` contém a matriz transacional A × B, editor, anon, analytics, room links e último administrador, exige apenas IDs de fixtures sintéticas via settings e termina em rollback. Testes estáticos conferem ainda os invariantes versionados das migrations e a troca do cliente de analytics.

O repositório não possui `supabase/config.toml`, seed local nem as migrations originais que criaram `hotels`, `profiles`, `hotel_sections`, `hotel_departments` e `hotel_policies`. Por isso, não é tecnicamente seguro fingir uma execução comportamental local completa. A matriz hotel A × B, anon, editor, audit log e concorrência do último administrador deve ser executada após importar uma baseline sanitizada em clone descartável e criar fixtures sintéticas revisadas.

Os testes de aplicação existentes continuam cobrindo validação de payload, upload e autorização pura. A prova definitiva de RLS exige aplicar as migrations somente em Supabase local/preview descartável após o preflight.

## 10. Rollback lógico

- baseline: revogar grants declarados, remover policies `45b_*`, remover o helper após retirar dependências e restaurar somente policies confirmadas pelo inventário anterior;
- analytics: restaurar policy/grant de INSERT anterior apenas como rollback emergencial, reabrindo conscientemente o risco;
- auditoria: revogar função/grants antes de arquivar ou remover tabela; preservar eventos conforme política legal;
- RPC: revogar EXECUTE e restaurar temporariamente a action anterior, aceitando novamente o risco de concorrência;
- Storage: remover policies `45b_*` e restaurar exatamente as policies exportadas, sem migrar objetos;
- room links: remover policies `45b_*` e restaurar a matriz exportada.

Não usar rollback cego. O snapshot remoto anterior é parte obrigatória do plano.

## 11. Riscos remanescentes

- estado remoto ainda precisa ser comparado antes de execução;
- a view de hotel ainda expõe Wi-Fi e configurações visuais porque são consumidos publicamente; qualquer redução exige adaptação de produto/loader;
- service role continua sendo uma fronteira crítica nas actions de Auth, analytics, Storage e roomToken;
- auditoria de todas as mutações de conteúdo ainda não foi instrumentada;
- Auth e Postgres não possuem atomicidade conjunta;
- rate limit distribuído, monitoramento, retenção e reconciliação continuam exclusivamente na Sprint 45C.
