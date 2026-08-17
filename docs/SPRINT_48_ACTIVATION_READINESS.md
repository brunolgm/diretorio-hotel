# Sprint 48 — Activation Readiness & Go-Live Foundation

## Filosofia e arquitetura

Readiness não é lifecycle. O lifecycle homologado (`draft`, `active`, `suspended`, `archived`) continua sendo o único estado oficial do hotel; a prontidão é uma leitura calculada em tempo real a partir dos dados operacionais, usuários e entitlements existentes. Não há coluna, tabela, cache ou estado paralelo de setup/go-live.

O banco concentra a avaliação em `calculate_hotel_readiness(uuid)`, helper interno sem `EXECUTE` para roles de aplicação. Duas RPCs estreitas expõem a mesma projeção tabular para os contextos autorizados. O TypeScript mantém o catálogo de apresentação — categoria, label, descrição e rota funcional — e normaliza o resultado para `/admin` e `/platform`. Assim, regras de decisão permanecem únicas no banco e textos de interface não são duplicados em SQL.

O retorno contém somente identificadores de checks, severidade, resultado booleano e resumo. Valores operacionais e conteúdos completos não são expostos; em especial, nenhuma credencial de Wi-Fi é retornada.

## Contrato canônico

`ready_to_activate` significa exclusivamente `blocking_count = 0`. Recomendações não bloqueiam publicação.

Checks bloqueantes:

- `identity.name`
- `identity.city`
- `identity.slug`
- `identity.subdomain`
- `admin.active`
- `module.core_directory`

Checks recomendados:

- `operation.checkin`
- `operation.checkout`
- `operation.breakfast`
- `contact.primary`
- `visual.logo`
- `visual.hero`
- `content.services`
- `content.departments`
- `content.policies`
- `content.banners`
- `rooms.qr`
- `languages.translations`
- `experience.preview`

Os checks de conteúdo, QR, traduções e preview só existem no resultado quando o entitlement correspondente está habilitado. Um módulo desabilitado não gera cobrança artificial. Serviços, departamentos e políticas são recomendações: um hotel vazio pode ser ativado se os seis requisitos essenciais estiverem atendidos.

## RPCs e autorização

`get_platform_hotel_readiness(p_hotel_id uuid)` exige `platform_admin` ativo e permite consultar qualquer lifecycle, inclusive o histórico mínimo de um hotel arquivado. Ela não amplia `SELECT` em `hotels` nem usa service role no browser.

`get_current_hotel_readiness()` não recebe `hotel_id`. Ela resolve `auth.uid() → profiles → hotel`, exige profile ativo e permite `draft`, `active` e `suspended`. Hotel arquivado permanece bloqueado, em conformidade com o contexto operacional atual.

As RPCs são `STABLE SECURITY DEFINER`, usam `search_path = ''` e concedem `EXECUTE` apenas a `authenticated`. O avaliador interno não é diretamente executável por `anon`, `authenticated` ou `service_role`.

## Lifecycle e ativação

Somente a primeira transição `draft → active` é condicionada à prontidão. `update_platform_hotel_status(uuid, text)` mantém `FOR UPDATE`, reavalia os blockers dentro da mesma transação e retorna `platform_hotel_not_ready` quando algum falha. Esse controle no banco protege também contra chamadas fora da UI e contra mudanças entre a leitura do card e a mutation.

As demais transições homologadas não recebem o gate de readiness. Um hotel `active` continua exibindo o checklist como health, sem desativação automática. Um hotel `suspended` continua privado pelo lifecycle e pode corrigir pendências no `/admin`. Um hotel `archived` permanece terminal e fora do contexto operacional.

No detalhe de `/platform`, hotel draft pronto exige confirmação explícita de que ficará público e que links/QR poderão ser utilizados. Com blockers, a ativação não é oferecida e somente as pendências bloqueantes são destacadas. Não existe override nesta Sprint.

## Entitlements e publicação pública

Readiness respeita o catálogo canônico de 19 módulos, mas não substitui entitlement. A publicação continua dependendo das regras existentes: lifecycle `active`, `core.directory` habilitado e os demais controles específicos. A Sprint 48 não altera `public_hotels`, policies públicas, resolução de slug/subdomínio ou QR.

O checklist apenas governa a decisão de primeiro go-live. Depois da ativação, alterações de conteúdo podem gerar warnings ou blockers de health sem mudar o lifecycle por conta própria.

## Experiência no `/admin`

O dashboard e Informações do hotel consomem `get_current_hotel_readiness()`. Em draft, o resumo aparece como “Em preparação”; em active, como “Publicado”, mantendo recomendações visíveis. Os próximos passos são derivados dos checks falhos e apontam somente para rotas administrativas existentes.

O componente compartilhado respeita os tokens visuais do admin brand-aware. A página de Experiência também consulta o mesmo contrato para sua composição de progresso, sem manter uma segunda definição das regras.

## Experiência no `/platform`

O detalhe global possui card neutro com status, quantidade de bloqueantes e recomendações e checklist agrupado. A consulta ocorre em paralelo às demais leituras do detalhe e não exige acesso global às tabelas operacionais. Métricas agregadas no dashboard e badges no diretório foram deixados de fora para evitar scans por hotel e N+1 nesta fundação.

## Audit e consistência

A ativação preserva exclusivamente `hotel.status_updated`, escrito por `record_platform_audit_event(...)` na mesma transação, com metadata rasa:

```json
{
  "previous_status": "draft",
  "new_status": "active"
}
```

Não existe evento de leitura ou recálculo e nenhum snapshot de readiness é persistido. Se o gate, update ou audit writer falhar, toda a mutation é revertida.

As páginas consultam as RPCs dinamicamente e as mutations administrativas já revalidam suas rotas. Não foi introduzido cache adicional. A avaliação usa `EXISTS` e agregação de entitlements, sem carregar conteúdos completos.

## Migration e preflight

`202608170002_48_activation_readiness.sql` valida antes de alterar objetos:

- schema e nullability dos campos usados;
- lifecycle e brand canônicos;
- catálogo exato dos 19 module keys, incluindo `_`;
- helpers de autorização/entitlements;
- contrato do onboarding da Sprint 47;
- view pública ainda protegida por lifecycle e `core.directory`;
- definição conhecida da RPC de status 46C;
- ausência prévia das três funções de readiness.

O replace da RPC de status é feito por `DROP/CREATE` somente após o contrato conhecido passar. Não há migration executada nesta etapa.

## Testes preparados

- `48_activation_readiness_rls_verification.sql`: catálogo, `SECURITY DEFINER`, `search_path`, grants, checks canônicos, ausência de dados sensíveis/persistência, gate de lifecycle, audit e isolamento público.
- `48_activation_readiness_behavioral_matrix.sql`: anon, platform admin ativo/inativo, isolamento hotel-scoped, draft bloqueado/pronto, warnings, módulos desabilitados, suspended, archived, audit, publicação e rollback transacional.
- `activation-readiness.test.ts`: catálogo compartilhado, normalização, próximos passos, segurança estática, integração das duas UIs, confirmação explícita e ausência de estado duplicado/service role.

Os testes SQL usam `BEGIN/ROLLBACK`, fixtures sintéticas `example.invalid` e destinam-se exclusivamente ao laboratório local descartável. Eles não são executados nesta implementação.

## Limitações e roadmap

Ficam fora do escopo: override, dupla aprovação, SLA, billing/contratos, DNS/SSL, validação de URLs externas, SEO funcional, QA automatizada de conteúdo, métricas globais de prontidão e health monitoring.

Uma evolução de operational health pode adicionar sinais não bloqueantes, histórico e observabilidade. Isso deve permanecer separado do lifecycle, evitar persistência prematura e definir novos blockers somente com evidência operacional. A eventual validação real de DNS/SSL e políticas comerciais exige contrato próprio antes de entrar no go-live.
