# LibGuest AI Analytics — Fundação (Fase 1)

## Objetivo e limites

Esta fase define uma telemetria server-side, fechada e sem conteúdo para o LibGuest AI. Ela mede caminhos de resolução, tentativas de chamadas upstream, resultados e latências sem persistir eventos.

Não há tabela, migration, RPC, RLS, endpoint Admin, dashboard, moeda, consulta de saldo/consumo do GPTMaker, webhook, n8n, MCP ou identificação do hóspede. O sink padrão é no-op: não grava, não chama rede e não escreve no console.

## Auditoria do analytics existente

O analytics público atual foi preservado sem alteração:

- `components/public/public-analytics.tsx` observa page views e cliques no browser, aplica deduplicação temporária em `sessionStorage` e envia somente o catálogo público permitido.
- `lib/analytics.ts` mantém o catálogo fechado, limites e validação estrita do payload. Campos desconhecidos são rejeitados.
- `app/api/analytics/route.ts` recebe o slug público, resolve o hotel server-side em `public_hotels`, verifica `analytics.basic`, valida que departamento/serviço pertencem ao hotel e insere com cliente administrativo. `session_id` e `target_url` são nulos; metadata só admite uma action fechada da Central de Voos.
- A Central de Voos estende apenas o catálogo fechado com eventos sem itinerário, companhia, aeroporto, quarto ou identidade do hóspede.
- Analytics Pro lê agregados por uma RPC ligada ao hotel autenticado e não dá ao browser leitura crua de `hotel_analytics_events`. Os períodos são fechados e comparações sem denominador retornam `null`.
- Os guards existentes compõem resolução server-side, entitlement e isolamento de tenant. O rate limit do assistente ocorre antes da resolução do hotel.

O AI Analytics não chama `/api/analytics`, não amplia o catálogo SQL e não grava em `hotel_analytics_events`. Ele reutiliza os padrões seguros — catálogo fechado, resolução server-side do tenant, best-effort e agregação isolada — sem misturar um evento operacional de IA com eventos de navegação do browser.

## Fluxo de instrumentação

1. A rota valida conteúdo, tamanho e payload. Rejeições anteriores a um request público válido não geram evento.
2. O rate limiter mantém o algoritmo atual. Um bloqueio gera, no máximo, um evento `unattributed`, sem IP, hash, slug ou conteúdo.
3. `runAssistantChat` resolve primeiro o hotel público e ativo. Nenhum classificador ou Maya é chamado antes dessa resolução segura.
4. `runAssistantChat` mede, com relógio monotônico, a tentativa classificadora e a tentativa de full AI. O resultado recebe metadados internos não enumeráveis; eles não mudam o objeto público serializado.
5. A borda server-side converte o resultado ou erro tipado em um evento final único.
6. O recorder valida o contrato e entrega ao sink. A chamada é destacada da resposta; exceções e promises rejeitadas são absorvidas, sem retry ou log de conteúdo.

O JSON público continua contendo apenas os campos funcionais já existentes (`answer`, `action`, `pendingRequest` e `responseLanguage`). Não contém `hotelId`, `assistantRoute`, `usageTrace` ou analytics.

## Contrato do evento

```ts
type AssistantAnalyticsEvent = {
  schemaVersion: 1;
  occurredAt: string;
  hotelScope: { kind: 'resolved'; hotelId: string } | { kind: 'unattributed' };
  language: 'pt' | 'en' | 'es' | null;
  assistantRoute: 'deterministic' | 'capability' | 'clarification' | 'classification' | 'ai';
  resolutionPath:
    | 'deterministic'
    | 'direct_ai'
    | 'classifier_to_capability'
    | 'classifier_to_ai'
    | 'classifier_failed_to_ai';
  outcome:
    | 'success'
    | 'privacy_blocked'
    | 'rate_limited'
    | 'hotel_unavailable'
    | 'assistant_failed'
    | 'invalid_upstream_response';
  capability:
    | 'human_handoff'
    | 'reception_contact'
    | 'housekeeping_contact'
    | 'housekeeping_request'
    | null;
  housekeepingRequestType: 'towels' | 'room_cleaning' | null;
  actionType: 'open_url' | 'confirm_request' | null;
  tourismSource: 'libguest_curated' | 'general_ai' | 'unavailable' | null;
  classifierIntent:
    | 'human_handoff'
    | 'reception_contact'
    | 'housekeeping_contact'
    | 'housekeeping_request_towels'
    | 'housekeeping_request_room_cleaning'
    | 'hotel_information'
    | 'flight_information'
    | 'tourism'
    | 'sales'
    | 'general_chat'
    | 'unknown'
    | null;
  classifierConfidenceBand: 'high' | 'medium' | 'low' | 'invalid' | null;
  classifierCalls: 0 | 1;
  fullAiCalls: 0 | 1;
  totalUpstreamCalls: 0 | 1 | 2;
  totalLatencyMs: number;
  classifierLatencyMs: number | null;
  fullAiLatencyMs: number | null;
};
```

O validador rejeita campos extras, valores fora dos catálogos, hotel resolvido sem UUID, latências negativas/não inteiras/acima de dez minutos e combinações incoerentes.

## Invariantes de chamadas

Sempre vale:

```text
totalUpstreamCalls = classifierCalls + fullAiCalls
```

| resolutionPath | classifier | full AI | total |
| --- | ---: | ---: | ---: |
| `deterministic` | 0 | 0 | 0 |
| `direct_ai` | 0 | 1 | 1 |
| `classifier_to_capability` | 1 | 0 | 1 |
| `classifier_to_ai` | 1 | 1 | 2 |
| `classifier_failed_to_ai` | 1 | 1 | 2 |

Ausência, formato inválido ou isolamento inválido de `GPTMAKER_CLASSIFIER_AGENT_ID` desabilita o classificador antes da tentativa. O caminho é `direct_ai` (0/1/1), nunca `classifier_failed_to_ai`. Este último exige que uma tentativa classificadora tenha começado e falhado.

`resolutionPath` descreve o caminho e não substitui o resultado final. Se o classificador falhar, mas o fallback Maya responder, o evento é `classifier_failed_to_ai` com `outcome: success` e 1/1/2. Se Maya também falhar, o outcome é `assistant_failed` ou `invalid_upstream_response`, conforme a causa final. O catálogo não possui `classifier_failed`, pois no fluxo atual uma falha isolada do classificador nunca impede o atendimento.

Uma mensagem gera no máximo um evento final, ainda que passe por classificador, Maya e capability. As contagens no próprio evento evitam dupla contagem.

## Latência e confidence band

As latências são inteiros não negativos, limitados defensivamente a dez minutos. `totalLatencyMs` começa imediatamente depois da validação completa do payload e termina quando o evento final é montado; portanto inclui rate limiter, resolução segura do hotel, roteamento e chamadas que realmente ocorrerem. Em um evento `rate_limited`, ele mede somente o tempo gasto pelo processamento pós-validação até a decisão do limiter — não representa latência de IA. `classifierLatencyMs` e `fullAiLatencyMs` são `null` quando a respectiva tentativa não aconteceu, inclusive no rate limit. Falhas finais preservam a latência da tentativa que falhou. Não há chamada adicional para medir nem timestamps intermediários persistidos.

A confidence do classificador é reduzida às faixas:

- `high`: valor maior ou igual a 0,90;
- `medium`: valor maior ou igual a 0,70 e menor que 0,90;
- `low`: valor menor que 0,70;
- `invalid`: parser inválido ou tentativa classificadora que falhou;
- `null`: classificação não tentada.

Esses thresholds são política operacional ainda não calibrada. A confidence informada pelo modelo não é uma probabilidade estatística comprovada, e nenhuma explicação textual é coletada.

## Dados proibidos

O evento não possui campos para mensagem, resposta, prompt, contexto público, histórico, `contextId`, contexto do classificador, `sessionStorage`, IP/hash, user-agent, URL/query string, telefone, e-mail, nome, quarto/apartamento, reserva, `roomToken`, CPF, API key, Authorization, corpo de erro, stack trace, chat remoto ou explicação/confidence textual.

`hotelId` vem exclusivamente do hotel resolvido server-side. Ele não é aceito do browser, enviado ao GPTMaker ou devolvido no JSON público. Rate limits acontecem antes da resolução segura e, por isso, usam `hotelScope: { kind: 'unattributed' }`; o slug não é usado para atribuição. Eventos `unattributed` são excluídos de qualquer resumo filtrado por `hotelId`. Em uma fase futura, eles só poderão aparecer em visão global explicitamente autorizada de Plataforma/segurança, nunca em uma visão tenant-scoped de hotel.

Capabilities, tipos de housekeeping, actions e turismo registram somente suas categorias fechadas. Quantidade de toalhas, URL/label do CTA, telefone, departamento textual, lugares e estabelecimentos não são coletados.

## Definições formais das métricas

Os filtros são aplicados antes dos cálculos. O helper suporta resumo global de teste e filtros por `hotelId` resolvido, idioma, capability e `resolutionPath`.

- `totalHandledMessages`: número de eventos selecionados.
- `aiEligibleMessages`: eventos selecionados exceto `privacy_blocked`, `rate_limited` e `hotel_unavailable`. Inclui strong intents, capabilities, clarificações, perguntas abertas, classificações válidas e falhas ocorridas durante processamento elegível.
- `zeroUpstreamMessages`: mensagens com zero chamada upstream.
- `classifierMessages`, `fullAiMessages` e `twoCallMessages`: mensagens com, respectivamente, uma tentativa classificadora, uma tentativa full AI e duas tentativas totais.
- `totalClassifierCalls`, `totalFullAiCalls` e `totalUpstreamCalls`: soma dos respectivos campos.
- `averageLatencyMs`: média aritmética das latências totais dos eventos selecionados, ou `null` para vazio.
- `p95LatencyMs`: nearest-rank sobre latências ordenadas (`ceil(n * 0,95)`), ou `null` para vazio.

### Baseline All Maya

O baseline operacional assume que cada mensagem AI-eligible seria enviada uma vez para Maya:

```text
baselineCalls = aiEligibleMessages
actualCalls = totalUpstreamCalls
upstreamCallsAvoidedVsAllMaya = baselineCalls - actualCalls
upstreamCallReductionRate = upstreamCallsAvoidedVsAllMaya / baselineCalls
```

As métricas derivadas são `null` quando `aiEligibleMessages` é zero. O valor de chamadas evitadas não é limitado a zero: `classifier_to_ai` usa duas chamadas conceituais e pode tornar a redução negativa.

### Full AI deflection

```text
fullAiDeflectionRate = mensagens AI-eligible com fullAiCalls = 0 / aiEligibleMessages
```

Ela inclui caminhos determinísticos, capabilities, clarificações e `classifier_to_capability`. Não é igual à redução total de chamadas: uma capability encontrada pelo classificador deflete Maya, mas ainda usa uma chamada upstream classificadora.

## Exemplo numérico

Para 1.000 mensagens AI-eligible:

- 600 `deterministic`;
- 100 `classifier_to_capability`;
- 50 `classifier_to_ai`;
- 250 `direct_ai`.

Resultado:

```text
classifier calls = 100 + 50 = 150
full AI calls = 50 + 250 = 300
total upstream = 450
baseline All Maya = 1.000
chamadas upstream evitadas = 1.000 - 450 = 550
full AI deflection = (600 + 100) / 1.000 = 70%
upstream call reduction = 550 / 1.000 = 55%
```

Uma redução estimada de 55% na quantidade de chamadas não significa automaticamente 55% de economia financeira. Agentes, modelos, tokens e tipos de requisição podem ter cobranças diferentes.

## Limitações da Fase 1

- O sink padrão descarta todos os eventos; métricas só existem sobre coleções fornecidas em teste.
- Não há retry, fila, garantia de entrega ou observabilidade da indisponibilidade do sink.
- `totalUpstreamCalls` representa as tentativas conceituais do Router (classificador e full AI), não requisições HTTP internas do protocolo do provedor.
- Não há cálculo financeiro nem reconciliação com consumo real do GPTMaker.
- Não há API ou autorização Admin para consultar eventos.

## Fase 2: persistência, RPC e painel Admin

Uma evolução segura pode implementar `SupabaseAssistantAnalyticsSink` sem alterar Router, capabilities ou clientes GPTMaker:

1. criar armazenamento dedicado e versionado para o contrato de AI Analytics, sem ampliar indevidamente `hotel_analytics_events`;
2. aceitar apenas eventos validados do sink server-side, com política explícita para eventos `unattributed`;
3. criar RPCs agregadas por período e tenant, sem leitura crua pelo browser;
4. aplicar RLS/grants e guards: administrador de hotel vê somente seu `hotelId`; Platform recebe apenas agregados autorizados;
5. integrar os agregados ao Analytics Pro/painel Admin como uma seção distinta, sem fazer o chat chamar `/api/analytics`;
6. consumir futuramente endpoints oficiais de saldo/consumo do GPTMaker em um pipeline separado e reconciliar custos reais por política documentada.

Até essa fase, nenhuma mensagem, resposta, PII, segredo ou identificador de hóspede é coletado ou persistido pelo AI Analytics.
