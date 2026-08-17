# Sprint 46.8 — Module Entitlements Foundation

## Resultado arquitetural

O `/platform` governa quais módulos um hotel possui. O `/admin` opera somente os módulos habilitados para o hotel do profile autenticado. Entitlement não representa lifecycle nem saúde/configuração operacional e desabilitar um módulo nunca apaga conteúdo.

## Catálogo canônico

A fonte tipada única está em `lib/modules/catalog.ts`, com 19 chaves. `lib/admin-modules.ts` permanece apenas como reexport compatível. As áreas Dashboard, Usuários, Configurações e Informações do hotel são estruturais e, por isso, não fazem parte do catálogo contratável.

Grupos: Experiência, Conteúdo, Operação, Analytics, Integrações e Governança. Labels e descrições existem somente em TypeScript; o banco persiste a chave canônica.

## Modelo e baseline

`public.hotel_module_entitlements` usa PK `(hotel_id, module_key)`, CHECK fechado de 19 chaves, FK do hotel com `ON DELETE CASCADE` e atores sem FK destrutiva. Timestamps/atores de habilitação e desabilitação são mutuamente coerentes. A tabela tem RLS habilitada, zero policies e nenhum DML/SELECT direto para `anon`, `authenticated` ou `service_role`.

O backfill determinístico habilita onze capacidades já existentes em todos os hotéis presentes na aplicação da migration:

- `core.directory`
- `content.services`
- `content.departments`
- `content.policies`
- `content.announcements`
- `content.banners`
- `rooms.qr`
- `content.languages`
- `experience.appearance`
- `experience.preview`
- `analytics.basic`

`experience.appearance` foi incluído porque o tema por bandeira já é funcional. `experience.preview` é disponível porque a Sprint 46.7 entregou e homologou o preview público real sandboxed. Nenhum módulo futuro é inferido de conteúdo. Hotéis criados depois recebem baseline pelo onboarding da Sprint 47.

Módulos disponíveis: `core.directory`, `content.services`, `content.departments`, `content.policies`, `content.announcements`, `content.banners`, `rooms.qr`, `content.languages`, `experience.appearance`, `experience.preview` e `analytics.basic`.

Continuam `coming_soon`: `experience.navigation`, `experience.seo`, `fb.menu`, `content.tourism`, `analytics.advanced`, `integrations.thex`, `integrations.opera` e `audit.access_logs`. Eles aparecem no catálogo global como “Em breve”, sem ação operacional, e a RPC rejeita tentativas de habilitação com `platform_module_not_available`.

## Contratos estreitos

- `get_platform_hotel_modules(hotel_id)`: somente platform admin ativo; retorna o catálogo completo com estado e timestamps, sem atores.
- `update_platform_hotel_module(hotel_id, module_key, enabled)`: valida ator, hotel e chave, bloqueia a linha/hotel, é idempotente e altera um único módulo.
- `get_current_hotel_modules()`: deriva hotel pelo profile ativo, não aceita hotel do client e bloqueia archived.
- `is_hotel_module_enabled(hotel_id, module_key)`: predicado booleano canônico usado por policies e resolvers server-only.

`core.directory` é obrigatório e não pode ser desabilitado. Um módulo disponível diferente do próprio core só pode ser habilitado quando `core.directory` já estiver ativo; caso contrário, a RPC retorna `platform_module_dependency_required`. Não há cascata automática entre módulos. Dependências mais complexas ficam para uma evolução explícita.

## Governança e audit

A seção “Módulos e funcionalidades” do detalhe global usa apenas as RPCs. Desabilitação exige confirmação e informa que os dados permanecem armazenados. Itens `coming_soon` são informativos e não possuem toggle. As mutations chamam o writer controlado `record_platform_audit_event`, que registra `hotel.module_enabled` ou `hotel.module_disabled` em `platform_audit_log`, com apenas `module_key` nos metadados e na mesma transação. Falha do writer desfaz a mutation.

## Consumo no admin

O layout resolve entitlements pelo cookie de sessão e filtra a sidebar após aplicar a hierarquia de papéis. Cada rota modular possui layout/guard server-side e as server actions operacionais existentes também validam o módulo. URL direta redireciona para `/admin/modulo-indisponivel`, cuja mensagem não revela plano ou condição comercial.

O entitlement `experience.preview` controla o preview sandboxed entregue na 46.7: desligado, remove o iframe da visão geral, oculta sua aba e bloqueia a URL direta da aba; ligado novamente, restaura o preview sem perda de configuração.

Lifecycle continua prioritário: archived não obtém contexto administrativo; draft e suspended conservam o acesso corretivo definido na 46C, limitado aos módulos habilitados.

## Público, QR e analytics

`public_hotels` exige lifecycle `active` e `core.directory`. As policies públicas de serviços, departamentos, políticas, anúncios e banners exigem simultaneamente hotel ativo, diretório e módulo específico. Traduções também exigem `content.languages`; sem ele, as tabelas base em português continuam disponíveis e as traduções deixam de ser expostas.

Os resolvers QR usam verificação server-only de `rooms.qr`, porque o caminho existente usa client privilegiado e não pode depender apenas de RLS. A API de analytics valida `analytics.basic` antes do insert. Desabilitar preserva room links, eventos e conteúdo existentes.

## Segurança e preflight

A migration aborta diante de tabela/RPC preexistente, ausência dos contratos 46A/46C ou drift. Antes de qualquer `DROP`, valida individualmente tabela, nome, comando, roles, `qual` e `with_check` das 23 policies substituídas. A view `public_hotels` precisa ser uma view com projeção/ordem exatas da 46C, lifecycle `active` e nenhuma referência anterior a module/entitlement. O writer de audit também precisa corresponder ao contrato conhecido da 46C antes de ser ampliado. Não cria SELECT global em `hotels`, policy para platform admin, DML de entitlement no browser nem uso de service role no client.

Os testes SQL, preparados mas não executados nesta etapa, cobrem catálogo/RLS/grants e uma matriz transacional com platform admin ativo/inativo, dois hotéis, hotel archived, isolamento hotel-scoped, idempotência, audit/rollback e preservação de dados.

## Fora desta sprint

- operational status (`configuring`, `healthy`, `error`) e observabilidade;
- planos, preços, upsell e dependências automáticas;
- Analytics Pro (`analytics.advanced`);
- implementação funcional de F&B, Turismo, SEO, navegação, preview, integrações e logs;
- baseline/onboarding de novos hotéis, responsabilidade da Sprint 47.

## Riscos e decisões futuras

O catálogo existe em TS e em CHECK/VALUES SQL; os testes de cardinalidade e chaves devem impedir drift, mas qualquer nova chave exige migration e alteração tipada coordenadas. `core.directory` permanece invariável nesta fase; eventual encerramento comercial deve continuar sendo tratado pelo lifecycle, não por uma desativação silenciosa do módulo fundamental.
