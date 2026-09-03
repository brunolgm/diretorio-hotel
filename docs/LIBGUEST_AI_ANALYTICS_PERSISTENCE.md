# LibGuest AI Analytics — Persistência (Fase 2)

## Objetivo e limites

A Fase 2 persiste o contrato fechado `AssistantAnalyticsEvent` v1 para análises agregadas do uso do LibGuest AI. Ela não cria dashboard, gráficos, endpoint público, exportação, cálculo financeiro, integração GPTMaker adicional, n8n, MCP ou telemetria global de abuso.

O chat não depende desta persistência. Com a feature flag desligada, ou diante de qualquer falha do sink, o atendimento mantém exatamente a mesma resposta pública.

## Arquitetura

O fluxo é unidirecional:

1. a rota encerra uma mensagem com um único evento agregado;
2. a instrumentação escolhe um sink server-side pela feature flag;
3. o sink valida novamente o evento;
4. eventos `unattributed` terminam localmente, sem criar client, rede ou log;
5. eventos com `hotelScope.kind = 'resolved'` são projetados em 19 argumentos tipados;
6. uma única RPC `record_assistant_analytics_event` grava a linha;
7. leituras futuras usam exclusivamente RPCs agregadas autorizadas.

A implementação reaproveita o client administrativo server-only, `has_active_hotel_role`, `is_hotel_module_enabled(..., 'analytics.basic')` e a identidade isolada `platform_users` existentes. `hotel_analytics_events` e o Analytics Pro atual não são alterados.

## Tabela e dicionário de dados

`public.assistant_analytics_events` é uma tabela tenant-scoped append-only.

| Campo | Finalidade |
| --- | --- |
| `id` | UUID gerado no banco |
| `schema_version` | Versão fechada do evento; inicialmente `1` |
| `occurred_at` | Instante do evento no servidor da aplicação |
| `recorded_at` | Instante de gravação gerado no banco |
| `hotel_id` | Tenant resolvido server-side e validado por FK |
| `language` | `pt`, `en`, `es` ou `null` |
| `assistant_route` | Rota final do assistente em catálogo fechado |
| `resolution_path` | Caminho de resolução e padrão de chamadas |
| `outcome` | Resultado público/final do atendimento |
| `capability` | Capability determinística, quando aplicável |
| `housekeeping_request_type` | Pedido fechado de governança, quando aplicável |
| `action_type` | Tipo fechado da ação retornada |
| `tourism_source` | Origem fechada de turismo |
| `classifier_intent` | Intent fechado, quando a classificação produziu um |
| `classifier_confidence_band` | Faixa fechada; obrigatória quando houve classifier |
| `classifier_calls` | `0` ou `1` |
| `full_ai_calls` | `0` ou `1` |
| `total_upstream_calls` | Soma das duas chamadas, entre `0` e `2` |
| `total_latency_ms` | Processamento do assistente medido pela Fase 1, limitado a 600.000 ms |
| `classifier_latency_ms` | Somente quando `classifier_calls = 1` |
| `full_ai_latency_ms` | Somente quando `full_ai_calls = 1` |

Não existem colunas de texto livre ou payload arbitrário. A tabela não possui mensagem, resposta, prompt, contexto, JSON/JSONB, `contextId`, IP, user-agent, URL, slug, token de quarto, quarto, reserva, nome, telefone, e-mail, CPF, erro bruto, stack, segredo, `Authorization` ou identificador remoto.

## Catálogos e invariantes

Os `CHECK` constraints reproduzem os catálogos TypeScript da Fase 1. Strings desconhecidas são rejeitadas. `schema_version = 1` e:

| `resolution_path` | classifier | Maya/full AI | total |
| --- | ---: | ---: | ---: |
| `deterministic` | 0 | 0 | 0 |
| `direct_ai` | 0 | 1 | 1 |
| `classifier_to_capability` | 1 | 0 | 1 |
| `classifier_to_ai` | 1 | 1 | 2 |
| `classifier_failed_to_ai` | 1 | 1 | 2 |

`classifier_failed_to_ai + outcome success` é intencional: o classifier falhou, mas Maya entregou resposta válida. `classifier_failed` não faz parte do catálogo de outcomes. Falha intermediária não vira `assistantFailures`.

Latências precisam ser inteiras entre 0 e 600.000 ms e obedecer à presença da chamada correspondente. Quando não há classifier, intent, confidence e latência do classifier também são `null`.

## Append-only, RLS e permissões

A tabela tem RLS habilitada e forçada, sem policies de browser. `public`, `anon`, `authenticated` e `service_role` não recebem DML nem leitura direta. A role de serviço recebe apenas `EXECUTE` nas RPCs estreitas de ingestão e purge; não recebe `INSERT`, `UPDATE`, `DELETE` ou `SELECT` na tabela.

Há somente dois índices:

- `(hotel_id, occurred_at desc)` para agregação tenant-scoped;
- `(occurred_at)` para período global e retenção.

Não há endpoint de eventos individuais nem RPC que retorne linhas cruas.

## RPCs

### Ingestão

`record_assistant_analytics_event(...)` é `SECURITY DEFINER`, usa `search_path = ''`, recebe somente parâmetros escalares tipados e allowlisted, valida a existência do hotel e deixa os constraints validarem o contrato. `id` e `recorded_at` são gerados server-side. Somente `service_role` pode executá-la.

### Resumo do hotel

`get_hotel_assistant_analytics_summary(p_hotel_id, p_from, p_to)` aceita o intervalo half-open `[p_from, p_to)`, com `p_from < p_to` e máximo de 366 dias. Exige usuário autenticado, hotel ativo associado com papel mínimo `visualizador` e entitlement `analytics.basic`. O `hotel_id` é aplicado dentro da consulta agregada, impedindo leitura cross-hotel.

### Resumo da Plataforma

`get_platform_assistant_analytics_summary(p_from, p_to, p_hotel_id default null)` usa as mesmas métricas, com filtro opcional por hotel. Só uma identidade `platform_admin` ativa pode executar. Ela não depende de perfil de hotel. Um administrador comum de hotel é recusado.

### Retenção

`purge_assistant_analytics_events(p_retention_days default 180)` aceita de 30 a 730 dias, remove somente `occurred_at` anterior ao cutoff e retorna a quantidade removida. Somente `service_role` pode executá-la. A migration não instala `pg_cron`; produção deve chamar a RPC por um job separado, seguro, monitorado e alertável. Purge nunca ocorre no caminho de uma mensagem do hóspede.

## Sink, feature flag e falhas

`ASSISTANT_ANALYTICS_PERSISTENCE_ENABLED` é estritamente server-side:

- ausente ou diferente de `true`: `NoOpAssistantAnalyticsSink`;
- `true`: `SupabaseAssistantAnalyticsSink`.

O sink reutiliza `NEXT_PUBLIC_SUPABASE_URL` apenas como URL do projeto no servidor e `SUPABASE_SERVICE_ROLE_KEY` como credencial exclusivamente server-side. Nenhuma nova credencial é enviada ao browser.

O evento é validado novamente antes da RPC. A projeção não inclui campos fora do contrato. Há uma chamada RPC, sem retry e sem log. O recorder absorve exceções. Se a flag estiver ligada e a configuração estiver ausente ou inválida, a primeira tentativa falha silenciosamente no limite best-effort e o chat continua; uma health check operacional futura deverá detectar essa configuração, sem incluir segredos em logs.

## Eventos unattributed e write amplification

Somente `hotelScope.kind = 'resolved'` pode chegar à RPC. `unattributed` é ignorado antes da criação do client Supabase. Isso cobre especialmente rate limits ocorridos antes da resolução segura do hotel: o slug informado pelo browser nunca atribui o evento a um tenant e ataques não geram writes no banco comercial.

Consequentemente, eventos unattributed nunca entram em resumos por hotel e `rateLimitedMessages` tende a zero/não aplicável nesta tabela. Uma futura visão global de Plataforma/segurança deverá usar pipeline separado e explicitamente autorizado.

## Métricas

As duas RPCs retornam o shape fechado de `AssistantAnalyticsSummary`. AI-eligible exclui `privacy_blocked`, `rate_limited` e `hotel_unavailable`.

- baseline All Maya = `aiEligibleMessages`;
- chamadas reais = `totalUpstreamCalls`;
- chamadas evitadas = baseline − chamadas reais, sem mascarar valores negativos;
- deflexão full AI = AI-eligible com `full_ai_calls = 0` ÷ AI-eligible;
- redução upstream = chamadas evitadas ÷ AI-eligible.

`classifier_to_capability` deflete Maya, mas tem uma chamada upstream. `classifier_to_ai` e `classifier_failed_to_ai` têm duas. Esses números não são apresentados como economia financeira. Com denominador zero, taxas e chamadas evitadas são `null`, nunca `NaN` ou infinito.

A média é arredondada a duas casas. P95 usa `percentile_disc(0.95)`, equivalente ao nearest-rank usado pelo agregador TypeScript para a série ordenada.

## Validação local no lab

Somente contra um Supabase local comprovado em `127.0.0.1`/`localhost`:

```powershell
npx supabase status
npx supabase db reset --local
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/assistant_analytics_persistence_behavioral_matrix.sql
npx supabase db lint --local
npx supabase migration list --local
```

A behavioral matrix executa 31 controles em uma transação e termina com `ROLLBACK`. Nunca usar `db push --linked`, migration repair, SQL Editor remoto ou `.env.local` para validar esta migration.

## Rollback operacional

Primeiro, definir `ASSISTANT_ANALYTICS_PERSISTENCE_ENABLED=false`. A aplicação volta ao sink no-op sem afetar o chat. A migration não deve ser revertida automaticamente em produção; eventual remoção exige migration nova e revisada. Eventos existentes continuam sujeitos à retenção definida.

## Próximas fases

A Fase 3 poderá consumir as RPCs agregadas em Server Components autenticados e criar o painel Admin, sem acesso raw. A Fase 4 poderá medir consumo real do GPTMaker mantendo o mesmo princípio de dados fechados. Antes delas, são recomendados health check de configuração, monitoramento de falhas silenciosas do sink e job de retenção com alertas.
