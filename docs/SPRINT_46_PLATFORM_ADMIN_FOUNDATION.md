# Sprint 46 — Fundação do admin global da plataforma

Data da auditoria: 13 de agosto de 2026  
Branch auditada: `sprint-46-platform-admin-foundation`

## 1. Escopo e conclusão executiva

Este documento começou como a auditoria estática da fundação. A Sprint 46A posteriormente versionou, sem aplicar no Supabase, a primeira migration de identidade global, o guard independente, a resolução de login e o shell mínimo de `/platform`. Não houve onboarding, dashboard de hotéis, governança de hotéis, auditoria global completa, commit ou push.

O sistema atual possui uma fronteira coerente para a operação de um hotel: a sessão do Supabase Auth é associada a exatamente um `profiles.hotel_id`, o papel do `profile` define a hierarquia operacional, e páginas/actions de `/admin` resolvem o hotel no servidor. Essa fronteira não deve ser estendida para representar administração global.

Os dois impedimentos principais para simplesmente adicionar `/platform` são:

1. `requireAdminAccess`, o login e `getAdminHotel` assumem que todo usuário administrativo tem `profile` ativo, papel operacional e `hotel_id`. Um usuário global sem `profile` seria desconectado no login ou redirecionado para `/acesso-indisponivel`.
2. A tabela `hotels` contém no mesmo registro identidade pública, operação, credenciais de Wi-Fi, tema e atributos de plataforma. Conceder a um platform admin uma policy de leitura global na tabela base daria acesso a campos de hotéis que o dashboard global não necessita.

A arquitetura recomendada é criar uma fronteira paralela, e não um papel adicional em `profiles.role`:

- `/admin`: operação de um hotel, autorizada por `profiles` e `profiles.hotel_id`;
- `/platform`: governança global da LibGuest, autorizada por uma futura associação independente `platform_users`;
- leitura global de hotéis: contrato explícito e mínimo, por função/RPC ou outra projeção controlada, sem SELECT global na tabela base;
- mutações de governança: exclusivamente server-side, por operações estreitas que validem o ator novamente no banco;
- auditoria global: `platform_audit_log` separado do `admin_audit_log` do hotel.

Não foi identificado bloqueador para introduzir essa fundação, desde que autenticação, autorização, leitura de hotéis e auditoria permaneçam separadas das abstrações hotel-scoped existentes.

## 2. Estado atual

### 2.1 Autenticação e autorização

`lib/auth.ts` possui duas camadas:

- `requireUser()` cria o cliente SSR, chama `auth.getUser()` e redireciona ausência de sessão para `/login`;
- `requireAdminAccess(requiredRole)` carrega `profiles` por `user.id` e exige simultaneamente `profile`, `hotel_id`, `is_active === true` e papel reconhecido.

O retorno tipado `AdminProfile` torna `hotel_id`, `is_active` e `normalizedRole` obrigatórios. Essa é uma boa invariável para `/admin`, mas é deliberadamente incompatível com usuário global sem `profile`.

`lib/app-roles.ts` normaliza aliases legados e aplica esta hierarquia:

| Papel operacional | Nível | Uso atual |
|---|---:|---|
| `visualizador` | 1 | leitura do hotel e dashboards |
| `operador` | 2 | conteúdo, serviços, departamentos, políticas, comunicados e banners |
| `editor` | 3 | informações do hotel, mídia e apartamentos/QR |
| `administrador` | 4 | usuários do hotel |

`admin` e `owner` são aliases de `administrador`; não são papéis globais. `hasMinimumRole` implementa a comparação numérica, e `canAccessHotelResource` também exige igualdade entre hotel do usuário e hotel do recurso.

A mesma matriz foi replicada no banco por `has_active_hotel_role` e `has_active_hotel_path_role`. As funções verificam `auth.uid()`, `profiles.hotel_id`, atividade e papel mínimo. Isso reforça que `profiles` é uma associação operacional com um hotel, não um diretório global de identidades.

### 2.2 Login, sessão e redirects

`app/login/page.tsx` autentica no browser e, logo após o Supabase Auth, consulta `profiles`. Se o perfil não existir, não tiver hotel, estiver inativo ou tiver papel inválido, a página executa `signOut()`. Todo login válido segue para `/admin`.

`proxy.ts` apenas renova/valida a sessão nas rotas do matcher `['/admin/:path*', '/login']`:

- acesso anônimo a `/admin` vai para `/login`;
- qualquer usuário autenticado em `/login` vai para `/admin`;
- `/platform` não está no matcher nem possui tratamento;
- o proxy verifica somente sessão; o layout de `/admin` realiza a autorização de perfil/papel.

Consequência: um futuro usuário somente de plataforma seria mandado de `/login` para `/admin` pelo proxy caso já possuísse cookie, e então para `/acesso-indisponivel` pelo layout. No fluxo de login interativo, seria desconectado antes disso.

`lib/supabase/server.ts` usa cookie SSR e anon key; `lib/supabase/admin.ts` é `server-only` e cria o cliente com `SUPABASE_SERVICE_ROLE_KEY`. A separação física do cliente privilegiado é positiva, mas seu uso sempre ignora RLS e exige guards e filtros server-side completos.

### 2.3 Estrutura de `/admin`

`app/admin/layout.tsx` chama `requireAdminAccess('visualizador')`, deriva a navegação do papel e envolve todas as páginas no shell operacional. As rotas atuais são:

- `/admin`: dashboard operacional;
- `/admin/hotel`;
- `/admin/apartamentos`;
- `/admin/servicos` e `/admin/servicos/[id]`;
- `/admin/departamentos` e `/admin/departamentos/[id]`;
- `/admin/politicas` e `/admin/politicas/[id]`;
- `/admin/comunicados` e `/admin/comunicados/[id]`;
- `/admin/banners` e `/admin/banners/[id]`;
- `/admin/usuarios` e `/admin/usuarios/[id]`;
- `/admin/acesso-negado`, além de `loading`, `error` e `not-found` locais.

Não há rota `app/platform`. Não existe conflito de filesystem routing para criá-la como árvore irmã. O conflito é conceitual: reutilizar o layout/guard/login de `/admin` importaria a dependência de hotel para dentro do contexto global.

`lib/queries.ts#getAdminHotel()` resolve o hotel exclusivamente a partir de `profile.hotel_id`; não aceita hotel enviado pelo browser. As páginas e actions administrativas chamam `requireAdminAccess` e/ou `getAdminHotel`, e mutações de entidades incluem `.eq('hotel_id', hotel.id)` ou gravam `hotel_id: hotel.id`. Essa é a invariável correta para `/admin` e não deve ser generalizada para `/platform`.

## 3. Hotels: contrato atual e governança

### 3.1 Campos atuais de `public.hotels`

O contrato versionado em `types/database.ts` contém:

| Grupo | Campos | Classificação recomendada |
|---|---|---|
| Identificador | `id` | plataforma/infraestrutura; imutável na UI do hotel |
| Identidade do hotel | `name`, `city` | operacional, legível pela plataforma |
| Roteamento público | `slug`, `subdomain` | governança compartilhada hoje; deve ter controle de plataforma no provisionamento |
| Bandeira | `brand_code` | governança exclusiva da plataforma |
| Tema | `theme_preset`, `theme_primary_color` | configuração visual operacional atual; a plataforma pode ler e validar compatibilidade |
| Canais comerciais | `booking_url`, `website_url`, `instagram_url`, `whatsapp_number` | operacional |
| Estadia | `wifi_name`, `wifi_password`, `breakfast_hours`, `checkin_time`, `checkout_time` | estritamente operacional/sensível ao contexto do hotel |
| Mídia | `logo_url`, `hero_image_url` | operacional |
| Controle técnico | `created_at`, `updated_at` | plataforma/infraestrutura, somente leitura |

Não existe campo de status/lifecycle do hotel no tipo atual. Portanto, “hotéis por status” não pode ser implementado corretamente apenas com o schema atual. Inferir status por completude, conteúdo, `brand_code` ou presença de subdomínio criaria uma regra ambígua. Um atributo futuro explícito — por exemplo `status` com estados pequenos e documentados — é provável, mas não foi criado nesta etapa.

`brand_code` aceita atualmente `mercure`, `novotel` e `grand-mercure` por constraint versionada. O comentário da migration o define como identidade permanente administrada pela plataforma e independente de `theme_preset`. A página `/admin/hotel` apenas lê `brand_code` para validar/explicar a bandeira; o formulário e `updateHotelAction` não enviam esse campo. Assim, o browser não possui hoje um controle de edição de `brand_code` no admin do hotel.

`theme_preset` e `theme_primary_color` são editáveis por `editor` do hotel. `subdomain` também é editável nessa página, com normalização, validação, checagem antecipada de unicidade e índice único como garantia final. `slug` é exibido como fallback e não é incluído no payload de update.

Recomendação de fronteira:

- manter `brand_code` exclusivamente em operações de plataforma;
- manter tema como operação do hotel nesta fundação, sem acoplar papel de plataforma ao editor visual;
- tratar `slug` e `subdomain` como identificadores de roteamento que a plataforma pode provisionar/governar; a decisão final de permitir edição posterior pelo hotel deve ser explícita antes do onboarding da Sprint 47;
- não expor Wi-Fi, horários internos ou demais campos operacionais no diretório global só porque estão na mesma linha.

### 3.2 Actions que alteram `hotels`

As mutações atuais são server actions protegidas por `editor`:

| Arquivo/action | Alteração |
|---|---|
| `app/admin/hotel/actions.ts#updateHotelAction` | nome, subdomínio, cidade, URLs/canais, Wi-Fi, horários, logo/hero por URL, tema e cor |
| `app/admin/hotel/actions.ts#removeHotelLogoAction` | remove `logo_url` e tenta remover o objeto do Storage |
| `app/admin/hotel/actions.ts#removeHotelHeroImageAction` | remove `hero_image_url` e tenta remover o objeto do Storage |
| `app/admin/hotel/upload-logo-action.ts#uploadHotelLogoAction` | faz upload validado e atualiza `logo_url` |
| `app/admin/hotel/upload-hero-image-action.ts#uploadHotelHeroImageAction` | faz upload validado e atualiza `hero_image_url` |

Essas actions usam service role somente após `requireAdminAccess` e `getAdminHotel`, e filtram o update por `hotel.id`. A baseline 45B removeu UPDATE direto de `hotels` para `anon`/`authenticated`; por isso `brand_code`, `slug` e futuros campos de plataforma não podem ser alterados diretamente do browser pelas permissões versionadas atuais.

Ainda assim, toda action com service role é uma fronteira crítica: adicionar `brand_code` ao `FormData` ou espalhar um payload sem allowlist voltaria a tornar o atributo editável pelo hotel. A proteção deve continuar baseada em payload explícito, teste negativo e operação separada de plataforma.

## 4. Usuários e identidade

### 4.1 Vínculo atual

`profiles.id` corresponde ao UUID de `auth.users`. O perfil contém e-mail, nome, papel, `hotel_id`, atividade e timestamps. `profiles.hotel_id` referencia `hotels.id` e o desenho atual atribui cada perfil a no máximo um hotel.

A criação em `createHotelUserAction`:

1. exige `administrador` do hotel atual;
2. cria o usuário por `auth.admin.createUser` com service role;
3. faz `upsert` do `profile` com o `hotel.id` resolvido no servidor;
4. apaga o auth user como compensação se o perfil falhar;
5. registra `user.created` na auditoria do hotel.

A edição carrega o alvo com `id` e `hotel_id`, usa a RPC `admin_update_hotel_user` para atualizar o perfil e depois `auth.admin.updateUserById`, com compensação do perfil se Auth falhar. A RPC valida ator administrador, mesmo hotel, proteção contra auto-rebaixamento/desativação e concorrência do último administrador; também grava `user.access_updated`.

Não há delete de usuário na UI. Listagem, detalhe, status e edição sempre escopam o perfil pelo hotel atual.

### 4.2 Usuário global sem `profile`

As dependências que quebrariam são:

- `app/login/page.tsx`, que desconecta a sessão sem profile/hotel/papel;
- `proxy.ts`, que direciona qualquer sessão em `/login` para `/admin`;
- `requireAdminAccess` e qualquer helper derivado (`requireAdmin`, `getUserProfile`);
- `getAdminHotel` e todas as páginas/actions operacionais;
- helpers RLS `has_active_hotel_role`/`has_active_hotel_path_role`;
- `record_admin_audit_event`, que exige profile ativo no mesmo hotel.

As rotas públicas que consultam a projeção `public_hotels` não precisam de `profile`; o risco está nos fluxos administrativos e na resolução pós-login.

Um usuário pode, no futuro, pertencer simultaneamente a `profiles` e `platform_users`, pois ambos podem usar o mesmo UUID de Auth. Essa capacidade não deve resultar em união implícita de privilégios: cada árvore de rota deve consultar apenas sua associação própria. Para uma identidade dupla, o destino deve vir de uma intenção válida (`next` allowlisted ou seletor de contexto), não de “platform sempre vence”.

## 5. Auditoria atual

`lib/audit.ts#recordAdminAuditEvent` usa o cliente server-only para chamar `record_admin_audit_event`. O writer no banco:

- só pode ser executado por `service_role`;
- exige `actor_user_id` e `hotel_id`;
- confirma um `profile` ativo, reconhecido e pertencente ao hotel;
- aceita apenas metadata rasa, escalar, limitada a 2 KiB e sem chaves sensíveis conhecidas;
- grava em `admin_audit_log`, que é append-only para papéis da aplicação;
- permite SELECT somente a administrador ativo do próprio hotel por RLS.

Essa estrutura é adequada para auditoria operacional por hotel. Ela não pode ser reutilizada diretamente por ações globais: `hotel_id` é obrigatório e o ator precisa ter profile naquele hotel. Forjar um profile/hotel para satisfazer a função destruiria a separação arquitetural e atribuiria uma ação global a um tenant arbitrário.

Também não é recomendado tornar `hotel_id` opcional na estrutura atual. Isso misturaria escopo, política de leitura, retenção e semântica de atores em uma tabela cujo nome, índice principal e writer são hotel-scoped.

Recomendação: futura `platform_audit_log`, com writer próprio e associação a `platform_users`. Contrato provável:

- `id`, `created_at`, `actor_user_id`, `action`, `entity_type`, `entity_id`, `metadata`, `request_id`;
- `target_hotel_id` opcional para indicar o hotel afetado, sem transformar o evento em auditoria operacional do hotel;
- append-only, metadata mínima e sanitizada, sem segredos;
- leitura restrita ao papel global apropriado;
- para mudanças sensíveis de governança, escrita do dado e do audit log na mesma transação e falha fechada se a auditoria não puder ser persistida.

O helper atual retorna `false` quando a auditoria falha e não desfaz a mutação. Esse comportamento pode ser aceitável para parte da operação atual, mas não deve ser copiado automaticamente para alteração de bandeira, status ou privilégio global.

## 6. RLS e objetos de banco provavelmente necessários

Esta seção é uma proposta; nenhum objeto foi criado.

### 6.1 `platform_users`

Associação independente entre `auth.users` e acesso global. Campos mínimos prováveis:

- `id` (UUID correspondente ao Auth user);
- `role` (allowlist global separada);
- `is_active`;
- `created_at`, `updated_at`;
- opcionalmente identidade de exibição apenas se não for obtida de fonte segura já existente.

Para a primeira versão, um único papel efetivo `platform_admin` reduz ambiguidade. `platform_viewer` ou `platform_operator` só devem ser adicionados quando houver casos de uso e matriz de permissões concretos. Em nenhuma hipótese `platform_admin` deve entrar em `profiles.role` ou nos níveis de `AppRole`.

O bootstrap e a gestão de platform admins precisam de processo privilegiado separado. Um platform admin não deve poder promover a si mesmo nem criar outros administradores globais por uma mutação genérica no browser. A futura RLS deve negar escrita direta e proteger leitura conforme necessidade.

### 6.2 Helper de autorização global

É provável uma função estreita, por exemplo `has_active_platform_role(required_role)`, que resolve `auth.uid()` internamente, usa `SECURITY DEFINER`, `search_path = ''`, allowlist de papéis e privilégios mínimos. Ela não deve aceitar um `user_id` escolhido pelo cliente nem consultar `profiles`.

O código de aplicação deve possuir `requirePlatformAccess`, separado de `requireAdminAccess`, retornando `user` e associação global tipada. O guard da aplicação melhora redirects/UX; a autorização no banco continua necessária nas leituras/mutações sensíveis.

### 6.3 Leitura global de hotéis

Não se recomenda adicionar uma policy global de SELECT em `public.hotels`. Hoje `authenticated` já tem grant de SELECT na tabela e a RLS limita por hotel. Uma policy que aceite platform admin liberaria todas as colunas da linha, inclusive `wifi_password`, contrariando mínimo privilégio.

A opção recomendada é uma API de leitura explícita no banco — RPC/função estável ou projeção controlada equivalente — que:

- valida `auth.uid()` em `platform_users`;
- retorna somente `id`, `name`, `brand_code`, futuro `status`, `theme_preset`, `slug`, `subdomain` e timestamps realmente necessários;
- oferece agregações de total, bandeira e status sem carregar campos operacionais;
- não concede acesso à tabela base nem às tabelas filhas do hotel;
- suporta filtros/paginação quando o volume justificar.

A view pública `public_hotels` não serve para o dashboard global: ela foi desenhada para hóspedes, inclui Wi-Fi e dados operacionais e não contém status/timestamps. Reutilizá-la ampliaria dados e confundiria contratos.

### 6.4 Status e mutações de governança

Um campo explícito de lifecycle/status em `hotels`, ou objeto de governança 1:1 equivalente, será necessário para “hotéis por status”. A escolha precisa definir estados, transições, efeito sobre experiência pública e possibilidade de reversão antes de qualquer migration.

Mutações de `brand_code`, status, slug e subdomain devem usar funções/actions dedicadas, payloads allowlisted e revalidação global no banco. RLS não restringe colunas; portanto, UPDATE global genérico na tabela base não é uma proteção suficiente. RPCs estreitas permitem validar transição, unicidade e auditoria atomicamente.

### 6.5 `platform_audit_log`

Tabela e writer separados conforme a seção anterior. A associação do ator deve validar `platform_users`; `target_hotel_id` é contexto opcional. Não conceder INSERT/UPDATE/DELETE direto a `authenticated` ou ao browser.

## 7. Arquitetura proposta no código

### 7.1 Separação `/admin` x `/platform`

| Aspecto | `/admin` | `/platform` |
|---|---|---|
| Objetivo | operação do hotel | governança global LibGuest |
| Associação | `profiles` | futura `platform_users` |
| Escopo | exatamente `profiles.hotel_id` | conjunto global com projeção mínima |
| Papéis | visualizador → operador → editor → administrador | namespace global independente; inicialmente `platform_admin` |
| Guard | `requireAdminAccess` | futuro `requirePlatformAccess` |
| Hotel corrente | obrigatório | nenhum hotel corrente implícito; hotel alvo explícito e validado |
| Auditoria | `admin_audit_log` | futura `platform_audit_log` |
| Shell | operacional do hotel | shell global próprio |

Estrutura provável:

```text
app/
  admin/                 # preservado
  platform/
    layout.tsx           # guard global e shell próprio
    page.tsx             # dashboard global
    hotels/
      page.tsx           # diretório
      [id]/page.tsx      # detalhe de governança
lib/
  auth.ts                # preserva auth do hotel
  platform-auth.ts       # tipos/guard globais
  platform-queries.ts    # projeções e agregados mínimos
  platform-audit.ts      # writer global separado
```

Os nomes são indicativos. Não se recomenda adicionar condicionais de plataforma em `getAdminHotel`, `AdminProfile` ou `normalizeAppRole`.

### 7.2 Resolução de login e sessão

O fluxo de autenticação deve deixar de exigir `profile` no componente client imediatamente após `signInWithPassword`. Uma resolução server-side pós-login deve distinguir associações sem expor service role ao browser:

1. validar a sessão com `getUser()`;
2. avaliar acesso ao destino solicitado com `next` estritamente allowlisted;
3. resolver associação global e/ou profile do hotel;
4. encaminhar platform-only para `/platform`, hotel-only para `/admin` e identidade dupla para o contexto solicitado ou uma escolha explícita;
5. negar associação ausente/inativa sem revelar detalhes sensíveis.

`proxy.ts` deverá incluir `/platform/:path*` no matcher para refresh da sessão e redirecionamento anônimo. Ele pode fazer a barreira barata de sessão, mas a autorização global deve permanecer no layout/guard e no banco. O redirect automático de todo usuário autenticado em `/login` para `/admin` precisa ser substituído pelo resolvedor.

Também deve ser decidida a política de host: `/platform` deve ser servido apenas nos domínios institucionais/produto autorizados, não acidentalmente em subdomínios de hotel. Essa validação é complementar à autorização, nunca substituta.

### 7.3 Server actions

Actions de `/platform` não devem chamar `getAdminHotel`. Para detalhe/mutação, recebem um hotel alvo, validam formato, executam `requirePlatformAccess` e chamam uma operação de banco estreita que revalida `auth.uid()` e o privilégio global.

Não compartilhar actions entre `/admin/hotel` e `/platform/hotels/[id]`: elas têm atores, campos permitidos e auditorias diferentes. Helpers puros de validação (`brand_code`, slug, subdomain) podem ser compartilhados.

## 8. UI reutilizável

### 8.1 Reutilização segura

`components/admin/ui.tsx` possui primitivas visuais sem dependência de dados do hotel que podem ser reutilizadas inicialmente ou extraídas gradualmente para um namespace neutro:

- `AdminPageHero`, `AdminSurface`, `AdminSectionTitle`;
- `AdminStatCard`, `AdminInfoBadge`, `AdminStatusPill`;
- `AdminFilterBar`, `AdminSearchInput`, `AdminSelect`, `AdminListSummary`;
- `AdminEmptyState`, `AdminListItem`, grupos/botões;
- `AdminBreadcrumbs`;
- inputs, textarea, field/help/error e grids.

`FeedbackToast` é neutro em contexto e pode ser usado no `/platform`. Os componentes base em `components/ui` (`alert`, `badge`, `button`, `card`, `dialog`, `input`, `select`, `sheet`, `table` não existe hoje) também são candidatos. `AdminConfirmAction` é visualmente reutilizável, desde que a action fornecida tenha guard global próprio e a consequência seja descrita com clareza.

Não há uma abstração de tabela administrativa compartilhada; as listagens atuais usam principalmente cards/list items. O diretório inicial pode reutilizar essas peças, mas uma tabela acessível e responsiva provavelmente exigirá componente novo ou extração neutra.

### 8.2 Acoplamentos que impedem reutilização direta

- `app/admin/layout.tsx` chama `requireAdminAccess` e monta menus conforme papel do hotel;
- `NavLinks` trata `/admin` como raiz especial, possui união fechada de ícones e semântica operacional;
- `MobileMenu` fixa “Painel administrativo”, importa `NavLinks` do admin e recebe o sign-out do layout operacional;
- badges de tradução em `components/admin/ui.tsx` conhecem PT/EN/ES e não pertencem ao dashboard global;
- `HotelSubdomainField`, `ThemeColorField`, QR e guided fields conhecem regras do hotel;
- páginas e cards do dashboard atual chamam `getAdminHotel` e exibem readiness/analytics do hotel.

Recomendação: criar shell próprio de plataforma e extrair apenas primitivas visuais realmente neutras. Não renderizar o layout do hotel com outro menu e não introduzir `platformMode` em componentes que carregam dados ou autorização.

## 9. Dashboard global mínimo proposto

A primeira versão deve ser majoritariamente read-only:

1. total de hotéis;
2. contagem por `brand_code`, incluindo “não definido” de forma explícita;
3. contagem por status, somente após existir status canônico;
4. listagem/diretório de hotéis;
5. por hotel: nome, `brand_code`, status, `theme_preset`, slug e subdomain;
6. link para `/platform/hotels/[id]`;
7. detalhe inicial com os mesmos dados de governança e timestamps, sem carregar conteúdo operacional.

Estados de loading, vazio, erro e acesso negado devem existir no namespace `/platform`. Filtros iniciais por busca, bandeira e status são suficientes. Paginação pode ser implementada desde o início se a consulta for server-side; caso o volume atual seja pequeno, o contrato deve ao menos permitir sua adição sem expor toda a tabela.

Ficam fora da primeira versão: impersonation, entrada automática no `/admin` de um hotel, leitura de hóspedes/conteúdo/Wi-Fi, criação completa de hotel, convite de equipe, upload de mídia, analytics cross-tenant detalhado e edição genérica da linha `hotels`.

## 10. Riscos de segurança

| Severidade | Risco | Impacto | Mitigação recomendada |
|---|---|---|---|
| crítico se implementado incorretamente | policy global de SELECT em `hotels` | platform admin recebe Wi-Fi e todos os campos operacionais de todos os hotéis | projeção/RPC mínima; nenhuma policy global na tabela base |
| alto | usuário global sem profile entra no fluxo atual | logout, loop `/login` → `/admin` → indisponível e impossibilidade de acesso | resolvedor pós-login e guard global separados |
| alto | adicionar `platform_admin` em `profiles.role` | quebra semântica de tenant, helpers RLS e escalada entre contextos | `platform_users` e papéis em namespace separado |
| alto | browser altera `brand_code` ou status | troca de identidade/lifecycle do tenant | sem UPDATE direto; action + RPC allowlisted + auditoria atômica |
| alto | service role usada como DAL global genérica | qualquer falha de filtro ignora RLS e atravessa tenants | preferir JWT + RPC autorizada; service role apenas onde inevitável e após guard |
| alto | confiar somente no layout/proxy | chamadas diretas a action/RPC podem contornar UI | revalidar em toda action e no banco com `auth.uid()` |
| alto | platform admin ganha acesso operacional “por conveniência” | violação de mínimo privilégio e maior blast radius | nenhum acesso a tabelas filhas; elevação explícita, auditada e futura se houver caso real |
| alto | gestão aberta de `platform_users` | criação de novos superusuários e autoelevação | bootstrap controlado, escrita direta negada e fluxo dedicado com proteção do último admin |
| médio | misturar auditoria global e do hotel | eventos atribuídos ao tenant errado, visibilidade e retenção incorretas | `platform_audit_log` separado |
| médio | identidade dupla resolve sempre para maior privilégio | acesso acidental ao contexto global | destino explícito/allowlisted e guards por rota |
| médio | `/platform` disponível em host de hotel | confusão de origem, superfície e phishing | allowlist de host institucional além de auth |
| médio | status inferido por completude | decisões incorretas e filtros inconsistentes | lifecycle canônico antes do dashboard por status |

Não há vulnerabilidade crítica comprovada no estado atual, porque `/platform` ainda não existe e o admin de hotel não envia `brand_code`. O primeiro risco da tabela torna-se crítico caso a fundação seja implementada com uma policy global sobre a tabela base.

## 11. Plano de implementação em etapas

Este plano descreve trabalho futuro; não foi executado nesta auditoria.

### Etapa 1 — Contratos e decisões

- fechar papéis globais mínimos e processo de bootstrap;
- definir status/lifecycle e seus efeitos;
- decidir governança de slug/subdomain após onboarding;
- definir host autorizado para `/platform`;
- registrar matriz de dados permitidos no dashboard.

### Etapa 2 — Fundação de banco revisável

- preparar migration de `platform_users`, helper de autorização e RLS/grants mínimos;
- preparar projeções/RPCs read-only para resumo, diretório e detalhe;
- preparar `platform_audit_log` e writer próprio;
- criar testes negativos de acesso antes da aplicação em preview;
- inventariar o ambiente remoto antes de qualquer SQL, seguindo o preflight adotado na Sprint 45B.

### Etapa 3 — Auth e routing

- criar `requirePlatformAccess` e tipos globais;
- criar resolvedor pós-login e tratamento de identidades hotel-only, platform-only, dual e sem associação;
- incluir `/platform` na renovação de sessão do proxy;
- adicionar layout, loading, error, not-found e acesso negado próprios;
- aplicar restrição de host.

### Etapa 4 — Dashboard read-only

- implementar agregados mínimos;
- implementar diretório filtrável/paginável;
- implementar detalhe de hotel pela projeção de governança;
- confirmar que nenhuma consulta carrega campos operacionais ou tabelas filhas.

### Etapa 5 — Mutações de governança

- adicionar somente as mutações aprovadas de `brand_code`, status e identificadores;
- validar transições/unicidade no banco;
- gravar auditoria global atomicamente;
- cobrir manipulação de FormData, ID de outro hotel, ator inativo e chamada direta.

### Etapa 6 — Homologação de segurança

- matriz de Auth/RLS para anônimo, usuário de hotel por papel, platform admin ativo/inativo e identidade dupla;
- confirmar negação de SELECT operacional cross-hotel;
- confirmar negação de escrita direta em `hotels`, `platform_users` e audit logs;
- validar redirects, cookies, hosts e ausência de loops;
- revisar grants reais do preview antes de deploy.

## 12. Critérios de aceite da fundação

- `/admin` continua exclusivamente hotel-scoped e sem `platform_admin` em `profiles.role`.
- `/platform` possui guard, layout, navegação, erros e redirects independentes.
- Um platform admin pode existir e autenticar sem `profile`.
- Um usuário de hotel sem associação global não acessa nenhuma rota, consulta ou action de plataforma.
- Identidade dupla não recebe união implícita de contexto e navega por destino explícito.
- Dashboard retorna apenas os campos aprovados; Wi-Fi, conteúdo, QR, analytics detalhado e dados operacionais não são lidos.
- `brand_code` não é editável pelo admin do hotel nem por chamada direta do browser.
- Nenhuma mutação global depende apenas de proxy/layout; banco revalida `auth.uid()` e associação ativa.
- Service role não é usada como cliente global genérico.
- Auditoria de plataforma é separada, append-only, sanitizada e vinculada ao ator global.
- Total, bandeira, status, diretório e detalhe possuem fonte canônica; status não é inferido.
- Testes negativos cobrem anônimo, tenant, platform inativo, ID manipulado, papel inválido e escalada.
- Migrations futuras possuem preflight, revisão de grants/RLS e aplicação somente em ambiente autorizado.

## 13. Explicitamente reservado para a Sprint 47

A Sprint 47 será responsável pelo onboarding multi-hotel. Não pertence à fundação da Sprint 46:

- criação completa e idempotente do registro de hotel;
- coleta/validação do conjunto completo de dados iniciais;
- provisionamento definitivo de `brand_code`, slug, subdomain, tema e status inicial conforme as decisões aprovadas;
- criação/convite do primeiro administrador operacional e vínculo Auth ↔ `profiles`;
- fluxo de e-mail/senha, convite, expiração e reenvio;
- seeds de conteúdo, configuração inicial, mídia e checklist operacional;
- compensação/reconciliação entre Auth, hotel, profile e demais recursos;
- prevenção de duplicidade e retomada de onboarding interrompido;
- transferência entre hotéis ou modelo de usuário operacional multi-hotel;
- ativação comercial, billing/contrato e automações de implantação;
- entrada do platform admin no contexto operacional de um hotel ou impersonation.

A Sprint 46 deve entregar os limites e contratos que tornam esse onboarding seguro; não deve antecipar o workflow completo.

## 14. Impacto esperado no código

Arquivos existentes que provavelmente exigirão alteração quando a fundação for implementada:

- `proxy.ts`: matcher e resolução de destino autenticado;
- `app/login/page.tsx`: remover a suposição de profile obrigatório e delegar o pós-login;
- `lib/auth.ts`: preservar o contrato do hotel; no máximo compartilhar `requireUser` neutro sem misturar papéis;
- `types/database.ts`: somente após objetos aprovados/aplicados e regeneração de tipos;
- testes de segurança: nova matriz global e regressão do isolamento do hotel.

Arquivos/áreas novas prováveis:

- `app/platform/**`;
- `lib/platform-auth.ts`, queries e auditoria globais;
- componentes de shell/navegação de plataforma;
- migration(s) futuras e testes SQL específicos, após autorização;
- testes de autorização, redirects e projeção mínima.

`app/admin/**`, `getAdminHotel`, `AppRole` e os helpers RLS por hotel devem permanecer semanticamente estáveis.

## 15. Inventário auditado

Leitura direta e busca estática foram realizadas sobre:

- autenticação/sessão: `lib/auth.ts`, `lib/app-roles.ts`, `lib/supabase/server.ts`, `lib/supabase/client.ts`, `lib/supabase/admin.ts`, `app/login/page.tsx`, `proxy.ts`;
- rotas: toda a árvore `app/admin/**`, além de páginas públicas e API referenciadas pelas buscas de sessão/hotel;
- contexto/queries: `lib/queries.ts`, `lib/domain-context.ts`, `lib/product-domain.ts`, `lib/public-hotel-data.ts`, `lib/hotel-subdomain.ts`, `lib/hotel-theme.ts`, `lib/room-links.ts`;
- usuários: `app/admin/usuarios/**`, `lib/security/user-consistency.ts`, `lib/security/identifiers.ts`;
- hotel: `app/admin/hotel/**` e `types/database.ts`;
- auditoria: `lib/audit.ts`, `202608110003_45b_admin_audit_log.sql` e a chamada transacional em `202608110004_45b_last_admin_rpc.sql`;
- RLS/grants: `202608110001_45b_authz_helpers_and_rls_baseline.sql`, demais migrations 45B, migrations de `brand_code`, tema, subdomain e atividade de profile, testes SQL 45B e `tests/security/**`;
- UI: `components/admin/ui.tsx`, `nav-links.tsx`, `mobile-menu.tsx`, `confirm-action.tsx`, campos específicos do hotel, `components/feedback-toast.tsx` e `components/ui/**`;
- documentação anterior: auditorias e entregáveis das Sprints 43, 44 e 45, além do mapa do produto.

O schema efetivo remoto não foi consultado. As conclusões de banco descrevem exclusivamente os tipos e migrations presentes no repositório; drift do ambiente deve ser inventariado antes de implementação/aplicação futura.

## 16. Restrições observadas nesta etapa

Na auditoria inicial, o único arquivo criado foi esta documentação. Na Sprint 46A, uma migration foi apenas adicionada ao repositório e não executada. Não foram executados SQL, Supabase CLI, migration, `db push`, `db reset`, alteração remota de schema/RLS/dados, commit, push, deploy, upload, criação/edição de usuário ou qualquer mutação externa.

## 17. Sprint 46A — Platform Identity & Authorization

Status: concluída e homologada em produção conforme a abertura da Sprint 46B.

### 17.1 Modelo versionado

A migration `202608130001_46a_platform_identity_authorization.sql` propõe `public.platform_users` com:

- `user_id uuid primary key`;
- FK para `auth.users(id) on delete cascade`;
- `role text not null`, restrito pelo CHECK ao valor canônico `platform_admin`;
- `is_active boolean not null default true`;
- `created_at` e `updated_at` obrigatórios com `now()` como default;
- nenhum `hotel_id` e nenhuma dependência de `profiles`.

A FK com `on delete cascade` foi considerada segura para esta associação: apagar a identidade de Auth deve revogar e remover a capacidade global correspondente, e `platform_users` não é uma trilha histórica. Audit logs futuros não devem usar cascata destrutiva. `updated_at` não possui trigger nesta fase; como nenhum DML da aplicação foi aberto, uma futura operação administrativa de atualização deve atribuí-lo explicitamente ou introduzir automação com preflight próprio.

A migration aborta se a tabela, a RPC ou `auth.users` estiverem em estado inesperado. Não usa `CREATE OR REPLACE`.

### 17.2 Estratégia de autorização

`platform_users` tem RLS habilitada, nenhuma policy e todos os privilégios de tabela revogados de `public`, `anon`, `authenticated` e `service_role`. Consequentemente, ela não pode ser enumerada ou alterada pelo browser e também não virou uma DAL privilegiada genérica da aplicação. O bootstrap inicial permanece uma operação deliberada do database owner, fora do fluxo web.

A única superfície para a sessão autenticada é `get_current_platform_access()`. A função `SECURITY DEFINER`, com `search_path = ''`, resolve `auth.uid()` internamente e retorna somente `role` e `is_active` da própria associação. Apenas `authenticated` recebe EXECUTE. A migration não referencia `hotels`, não cria policy em `hotels` e não amplia acesso a dados hotel-scoped.

`lib/platform-auth.ts#requirePlatformAccess()` valida `auth.getUser()`, chama essa RPC, normaliza o papel canônico e exige associação ativa. Não chama `requireAdminAccess`, não consulta `profiles` e não exige `hotel_id`.

### 17.3 Login, precedência e rotas

`/platform` foi incluído no matcher do proxy. Usuário anônimo recebe `/login?next=/platform`; o layout continua sendo a fronteira autoritativa para a associação global.

Login e proxy usam a mesma regra pura de destino:

1. pedido explícito e allowlisted de `/platform` usa `/platform` quando há acesso global ativo;
2. no login genérico, acesso de hotel preserva precedência e segue para `/admin` — inclusive para identidade dupla;
3. usuário somente de plataforma segue para `/platform` sem precisar de profile;
4. conta sem associação válida não entra em nenhum painel.

Isso não implementa troca de contexto. Um usuário de hotel sem associação global que tentar `/platform` diretamente é recusado pelo guard, mesmo que o proxy reconheça a sessão.

Foram criados apenas `app/platform/layout.tsx` e `app/platform/page.tsx` para provar a fronteira, além de uma página externa de acesso negado. O conteúdo é neutro LibGuest e não consulta hotéis.

### 17.4 Roadmap consolidado

| Fase | Escopo |
|---|---|
| 46A | identidade global, RLS privada, RPC da própria sessão, guard, login e shell mínimo |
| 46B | dashboard read-only, agregados e listagem/detalhe por projeção mínima, sem SELECT global em `hotels` |
| 46C | governança de plataforma, mutações estreitas e auditoria global completa |
| 46.5 | redesign visual do admin operacional do hotel, sem misturar autorização global |
| 47 | onboarding multi-hotel idempotente e provisionamento coordenado de hotel/Auth/profile |

### 17.5 Pendente para 46B

- definir e versionar projeções/RPCs mínimas para total, bandeira, listagem e detalhe;
- manter Wi-Fi, conteúdo, QR, analytics detalhado e tabelas filhas fora do contrato global;
- implementar UI de dashboard, filtros, vazio, erro e paginação;
- não criar métrica por status até existir lifecycle canônico;
- adicionar testes de autorização e mínimo privilégio para cada nova consulta;
- validar a migration 46A em ambiente preview autorizado antes de depender dela em deploy.

## 18. Sprint 46B — Platform Dashboard & Hotel Directory

Status: concluída e homologada em produção conforme a abertura da Sprint 46C.

### 18.1 Contratos globais read-only

A migration `202608140001_46b_platform_dashboard_directory.sql` cria duas RPCs autoautorizadas:

- `get_platform_hotel_metrics()`: total de hotéis e distribuição agregada por `brand_code`;
- `list_platform_hotels(p_search, p_page, p_page_size)`: diretório paginado e pesquisável.

Ambas usam `SECURITY DEFINER`, `search_path = ''`, validam `auth.uid()` e exigem `platform_users.role = 'platform_admin'` com `is_active = true`. EXECUTE é concedido somente a `authenticated`. Nenhuma policy, grant ou SELECT global foi adicionado a `public.hotels`.

O diretório expõe exclusivamente:

- `total_count` como metadado de paginação;
- `id`;
- `name`;
- `slug`;
- `subdomain`;
- `city`;
- `brand_code`;
- `theme_preset`;
- `logo_url`.

`created_at` e `updated_at` foram retirados do contrato inicial porque dashboard e diretório não os utilizam. O detalhe read-only foi adiado para evitar uma terceira RPC e uma superfície sem caso de uso nesta fase.

Campos e relações explicitamente proibidos:

- `wifi_name` e `wifi_password`;
- horários, contatos e demais configuração operacional;
- profiles ou usuários;
- analytics detalhados;
- room tokens e notas internas;
- conteúdo, comunicados, banners e tabelas filhas;
- qualquer segredo, credencial ou payload operacional.

### 18.2 Métricas

O dashboard implementa:

- total global de hotéis;
- contagem por `brand_code`;
- grupo explícito `unassigned` para hotéis sem bandeira;
- CTA para o diretório.

Não existe métrica por status. Lifecycle continua sem definição canônica e não é inferido por completude, bandeira, slug ou subdomínio.

### 18.3 Busca e paginação

A aplicação normaliza os parâmetros no servidor e o banco revalida os limites:

- página entre 1 e 100.000;
- limite entre 1 e 50, com default 12 na UI;
- busca de até 100 caracteres;
- busca apenas em nome, slug, subdomínio e cidade;
- `%`, `_` e `\` são escapados e tratados literalmente;
- nenhuma SQL dinâmica é usada;
- ordenação determinística por nome normalizado e UUID;
- nenhuma consulta sem limite é exposta ao diretório.

`lib/platform-queries.ts` chama `requirePlatformAccess()`, usa o cliente SSR autenticado e acessa somente as duas RPCs aprovadas. Não consulta `public.hotels` diretamente nem usa service role.

### 18.4 UI e estados

`/platform` passa a ter shell neutro com navegação para Dashboard e Hotéis. O dashboard possui métricas, distribuição por bandeira, estado vazio, loading e erro controlado. `/platform/hoteis` possui busca GET, paginação server-side, cards institucionais, logo opcional e estados vazio/erro.

Não há edição, criação, onboarding, troca de contexto, status ou mutation. O chrome global permanece LibGuest neutro e nenhuma tela de `/admin` foi redesenhada.

### 18.5 Homologação e riscos

Foram preparados testes SQL separados de catálogo e comportamento. Eles verificam grants, SECURITY DEFINER, projeções, limites, autorização negativa, ausência de acesso global via RLS, busca literal contra payload de injeção e não exposição de valores secretos sintéticos.

Riscos residuais:

- funções SECURITY DEFINER exigem revisão de owner/grants no ambiente antes de produção;
- paginação por offset é suficiente para o volume inicial, mas poderá migrar para cursor se houver escala comprovada;
- URLs de logo são dados públicos controlados pelo hotel e devem continuar renderizadas sem ampliar permissões de Storage;
- qualquer novo campo no contrato exige revisão explícita; `select *` continua proibido.

### 18.6 Escopo futuro preservado

- Sprint 46C: governança, mutações estreitas, auditoria global e eventual detalhe read-only de hotel;
- Sprint 46.5: redesign visual exclusivo do `/admin` operacional do hotel;
- Sprint 47: onboarding multi-hotel, criação e provisionamento coordenado.

## 19. Sprint 46C — Platform Hotel Governance

Status: implementação local preparada para homologação, sem executar migration, SQL ou Supabase nesta etapa.

### 19.1 Lifecycle final

`public.hotels.platform_status` é o estado canônico explícito da governança:

- `draft`: cadastro em preparação;
- `active`: hotel operacional na plataforma;
- `suspended`: uso temporariamente suspenso por decisão de governança;
- `archived`: registro histórico inativo e não removido.

A coluna é `text not null default 'active'` e possui CHECK fechado nesses quatro valores. O default mantém todos os hotéis existentes em `active`; nenhuma inferência usa completude, conteúdo, `brand_code`, tema, slug ou subdomínio.

Transições permitidas:

| Origem | Destinos permitidos |
|---|---|
| `draft` | `active`, `archived` |
| `active` | `suspended`, `archived` |
| `suspended` | `active`, `archived` |
| `archived` | nenhum nesta fase |

No-op é rejeitado. `archived` é terminal na 46C; reativação futura exige decisão explícita, não uma flexibilização silenciosa da RPC.

O lifecycle também é uma regra operacional, não apenas um rótulo:

| Estado | Experiência pública/analytics | QR e contexto de apartamento | `/admin` do hotel | `/platform` |
|---|---|---|---|---|
| `active` | disponível | disponível | disponível | disponível |
| `draft` | indisponível | indisponível | disponível para preparação | disponível |
| `suspended` | indisponível | indisponível | disponível para correção | disponível |
| `archived` | indisponível | indisponível | contexto operacional bloqueado | disponível |

Todos os registros existentes recebem `active` pelo default da adição da coluna; não existe UPDATE de backfill que derive outro estado. A view `public_hotels` preserva a projeção anterior, mas passa a conter `where platform_status = 'active'`. As dez policies públicas de conteúdo da 45B foram mantidas com os mesmos nomes e critérios temporais/`enabled`, acrescidas da função booleana estreita `is_hotel_publicly_active(hotel_id)`. Assim, filtrar a view não deixa um bypass via REST anon em tabelas filhas.

Os helpers conhecidos `has_active_hotel_role` e `has_active_hotel_path_role` foram evoluídos, após preflight de definição, para recusar somente `archived`. Isso mantém `draft` e `suspended` operacionais no admin e bloqueia o hotel arquivado em páginas, actions, RLS e caminhos de Storage que dependem desses helpers. Login, proxy e `requireAdminAccess()` também confirmam a existência do contexto não arquivado para evitar encaminhamento enganoso.

Os resolvedores server-side de room token, contexto e menu exigem `hotels.platform_status = 'active'` na mesma consulta que lê o link. Um token válido não contorna draft, suspensão ou arquivamento. Falhas de QR e resoluções públicas ausentes usam a mesma tela neutra “Experiência indisponível”; ela não informa se o hotel existe nem revela o lifecycle. A API de analytics continua validando via `public_hotels` e, portanto, deixa de aceitar eventos de hotéis não ativos.

### 19.2 Contratos read-only

`get_platform_hotel_detail(p_hotel_id uuid)` retorna somente:

- `id`, `name`, `slug`, `subdomain`, `city`;
- `brand_code`, `theme_preset`;
- `logo_url`, `hero_image_url` somente para referência read-only;
- `platform_status`, `created_at`, `updated_at`.

Wi-Fi, horários, WhatsApp, dados operacionais, profiles, apartamentos/tokens, analytics, conteúdo, notas e credenciais permanecem fora do contrato. A RPC é `SECURITY DEFINER`, usa `search_path = ''`, resolve `auth.uid()` internamente e exige `platform_admin` ativo.

Os contratos conhecidos da 46B foram recriados de forma explícita, sem `CREATE OR REPLACE`:

- `get_platform_hotel_metrics()` adiciona `hotels_by_status`, mantendo total e distribuição por bandeira;
- `list_platform_hotels(...)` adiciona apenas `platform_status` à projeção institucional paginada.

Isso separa `unassigned` (ausência de bandeira) de `draft` (lifecycle) e mantém o dashboard sem SELECT direto na tabela base.

### 19.3 Mutations estreitas

As únicas mutations globais da fase são:

- `update_platform_hotel_brand(p_hotel_id uuid, p_brand_code text)`;
- `update_platform_hotel_status(p_hotel_id uuid, p_status text)`.

Ambas revalidam `auth.uid()` e o `platform_admin` ativo no banco, rejeitam hotel inexistente, usam `SELECT ... FOR UPDATE`, alteram somente o campo autorizado e `updated_at`, e registram o evento global antes de concluir. Slug, subdomínio, tema, mídia e campos operacionais não são aceitos como payload.

`brand_code` continua permitindo `NULL` para onboarding/mapeamento ainda incompleto. Valores não nulos permanecem fechados em `mercure`, `novotel` e `grand-mercure`. O admin do hotel não recebeu policy, grant ou action para editar bandeira.

Hotel `archived` não aceita alteração de bandeira e retorna `platform_hotel_archived`. A verificação ocorre depois do lock da linha e antes de UPDATE/audit. O lifecycle arquivado continua terminal pelas transições já definidas.

### 19.4 Audit global

`public.platform_audit_log` é separado de `admin_audit_log` e não possui `hotel_id` obrigatório nem FKs destrutivas. Guarda UUID histórico do ator/alvo, action, entity, timestamp, metadata rasa e request ID opcional.

RLS fica habilitada sem policy. `anon`, `authenticated` e `service_role` não recebem SELECT/INSERT/UPDATE/DELETE direto. `record_platform_audit_event(...)` também não concede EXECUTE a papéis da aplicação: somente as governance RPCs, executando sob seu owner, chamam o writer na mesma transação.

Eventos iniciais:

- `hotel.brand_updated` com `previous_brand` e `new_brand`;
- `hotel.status_updated` com `previous_status` e `new_status`.

Metadata deve ser objeto JSON raso, escalar, limitado a 2 KiB e sem chaves sensíveis. Uma falha de audit aborta a RPC e reverte a alteração do hotel.

### 19.5 UI e autorização

`/platform/hoteis/[id]` apresenta identidade institucional, referências read-only e lifecycle. Somente bandeira e estado possuem controles. Alteração de bandeira usa confirmação; suspensão e arquivamento descrevem explicitamente a consequência em Dialog acessível. Não há `window.confirm`, `requireAdminAccess`, `getAdminHotel`, service role ou consulta direta a `hotels`.

O dashboard agora mostra distribuição por lifecycle e o diretório liga cada hotel ao detalhe de governança. O shell continua neutro LibGuest e `/admin` não foi redesenhado.

### 19.6 Homologação e critérios de aceite

Foram preparados, sem execução:

- `46c_platform_governance_rls_verification.sql`: catálogo, lifecycle, projeções, SECURITY DEFINER, grants, audit append-only e regressão das policies/grants de `hotels`;
- `46c_platform_governance_behavioral_matrix.sql`: fixtures sintéticas, platform admin ativo sem profile, inativo, admin de hotel, usuário sem associação e anon; detalhe mínimo, mutations, transições, audit e rollback forçado quando o audit falha.

Critérios de aceite:

- somente platform admin ativo executa detalhe e mutations;
- lifecycle e bandeiras recusam valores fora da allowlist;
- hotel inexistente e transição inválida são recusados;
- audit e mutation são atômicos sob lock da linha;
- browser não recebe UPDATE direto em `hotels` nem DML/leitura direta em `platform_audit_log`;
- nenhum dado operacional aparece no detalhe;
- platform admin sem profile funciona sem ganhar acesso às tabelas hotel-scoped;
- dashboard separa métricas por bandeira e por lifecycle.
- somente `active` resolve em `public_hotels`, conteúdo anon, analytics e QR;
- `draft` e `suspended` preservam o admin para preparação/correção;
- `archived` bloqueia o contexto operacional do hotel, mas permanece visível à plataforma;
- a constraint e a RPC rejeitam qualquer bandeira fora de `NULL`, `mercure`, `novotel` e `grand-mercure`;
- a listagem global continua incluindo todos os lifecycle.

### 19.7 Escopo preservado

Sprint 46.5 permanece exclusivamente responsável pelo redesign visual do `/admin` operacional, sem alterar a autorização global.

Sprint 47 permanece responsável por onboarding multi-hotel: criação de hotel, escolha inicial de lifecycle/bandeira, slug/subdomínio, provisionamento coordenado de Auth/profile, idempotência, compensação e experiência completa. Também ficam fora da 46C exclusão de hotel, domínio customizado, cobrança/plano, gestão completa de `platform_users`, impersonation e acesso operacional do platform admin.

Risco pendente para homologação: confirmar owner e grants efetivos das funções `SECURITY DEFINER` no ambiente descartável antes de produção. A matriz SQL deve ser aplicada apenas após inventário do alvo e nunca em produção.
