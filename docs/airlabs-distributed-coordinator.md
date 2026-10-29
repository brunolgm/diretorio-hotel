# AirLabs: infraestrutura distribuída v1

Esta etapa não ativa a integração. Não há budget, rate policy, segredo ou período
operacional inserido pela migration. A falta de configuração bloqueia fetch.

## Fluxo

A rota resolve o hotel pelo slug e verifica entitlement e aeroporto. O coordenador
repete a autorização, preserva a janela schedules de 10 horas e chama a RPC de
admissão. A RPC verifica novamente o hotel público e a configuração pública do
aeroporto antes de qualquer cache hit. Nenhuma regra de aeroporto foi ampliada.

`flight_private.query_cache` guarda a identidade
`airlabs:1:query_type:flight_iata:departure_date:departure_airport:arrival_airport`.
Não há hotel ou pessoa na identidade ou no conteúdo aeronáutico. Schedule guarda
uma projeção normalizada fechada; live guarda somente status, tipo de fonte e
timestamp. Live em cache é novamente validado contra o schedule atual em memória.
Não há payload bruto, URL, chave, idioma ou identificador de hóspede persistido.

`admit_airlabs_query` serializa admissões por account scope com advisory lock e
adquire o lock da linha da consulta. Conta os buckets global, hotel e ocorrência
(incluindo query_type), inclusive em hits. Retorna cache fresco sem renovar TTL;
lease ativo retorna `in_progress`. Somente um miss sem lease reserva uma unidade
no budget e ganha token UUID aleatório, válido por 15 segundos. A transação acaba
antes do HTTP. O transporte exige permissão explícita de uso único, vinculada à
identidade e ao vencimento; a rota não importa o cliente bruto.

`publish_airlabs_query` valida projeção, TTL e proprietário ainda vigente.
`close_airlabs_query` publica not_found por 10 minutos. Erros técnicos geram
cooldown de 60 segundos em `query_cooldowns`, separado por ocorrência e account
scope. O scope vem do proprietário do lease, nunca de um argumento do encerramento.
`provider_error` não pode ser persistido como resultado do cache aeronáutico; a
admissão retorna `provider_cooldown`, sem permissão de fetch ou nova reserva.
Outro scope pode adquirir o lease após o encerramento, sem receber o erro de A.
Cache positivo ou not_found elegível permanece compartilhado e pode ser lido
mesmo durante um cooldown técnico. Ambos recusam token errado, consumido ou vencido. Falha/timeout não
devolve quota. Crash após reserva pode consumir crédito sem resposta e, após
expiração, permitir nova tentativa: não há garantia exactly-once. Falha na RPC ou
resposta de admissão desconhecida impede novo fetch; erro de publicação não vira
sucesso. Não há retry automático nem fallback direto ao fornecedor.

`cleanup_airlabs_queries` limpa até 1.000 consultas, 1.000 buckets e 1.000 cooldowns expirados por
chamada usando SKIP LOCKED. Não remove budgets. Nenhum agendamento foi criado.

## Configuração posterior

O operador deverá configurar, por canal administrativo seguro:

- `AIRLABS_ACCOUNT_SCOPE`, identificador técnico sem segredo, igual para todos os
  consumidores da mesma conta AirLabs;
- uma linha em `flight_private.rate_policies`, com janela em segundos e limites
  global/hotel/ocorrência definidos operacionalmente;
- um budget `provider='airlabs'`, account scope correspondente, início e fim
  explícitos, limite 900 e consumo inicial reconciliado com a conta real.

Não se presume mês civil. Zero ou mais de um período vigente bloqueia novas
reservas; período suspenso ou esgotado também bloqueia. Cache fresco continua
disponível sem crédito, sujeito a autorização e rate limit. Configuração ausente
de rate policy bloqueia inclusive cache. Os valores 10.000/3.600 usados nas
fixtures são exclusivamente técnicos, não defaults comerciais.

Todos os deployments que compartilham uma conta devem usar esta mesma autoridade
Postgres e o mesmo scope. Contas ou bases independentes não coordenam quota entre
si. Alterar limites/períodos requer reconciliação operacional; estas tabelas não
têm acesso direto de service_role nem RPC pública de administração.

TTL do servidor: schedule a mais de 3h (até 10h), 60min; até 3h ou ativo, 15min;
live, 5min; landed, 6h; cancelled, 60min. Retenção de consulta: 1 dia após
publicação. Leituras não modificam fetched_at/fresh_until. Os limites são política
LibGuest, não promessa de cobertura do fornecedor. Erros de quota/configuração
retornam HTTP 503; rate limit 429; lease em andamento 409; not_found 404; janela
não consultável 422. Erros de live podem acompanhar schedule válido na proveniência.

## Segurança e testes locais

As cinco tabelas ficam em `flight_private`, fora dos schemas expostos em
`supabase/config.toml`, com RLS habilitada e nenhum grant para browser/service_role.
Os quatro wrappers são SECURITY DEFINER, search_path vazio, sem EXECUTE de
PUBLIC/anon/authenticated; somente service_role recebe EXECUTE. O validador
privado não é exposto. Migrations antigas e políticas de outros módulos permanecem
intactas.

O contrato canônico de flight_iata exige companhia com dois caracteres ASCII
alfanuméricos, pelo menos uma letra, seguida de um a quatro dígitos e sufixo
opcional de uma letra. Entrada SQL, constraint da tabela, projeção airlineCode e
normalização de respostas TypeScript aplicam essa mesma regra. A normalização
de entrada TypeScript (trim/uppercase) permanece antes da construção da chave.
Datas SQL são convertidas em bloco controlado e comparadas ao texto ISO original;
datas inexistentes retornam SQLSTATE 22023 / `airlabs_query_invalid`, sem
normalização silenciosa e antes de locks, rate limit ou reserva.

O procedimento segue o laboratório descartável já documentado em
`supabase/tests/45b_last_admin_concurrency.md`:

```powershell
./supabase/tests/51_airlabs_local_lab.ps1
```

O alvo é fixo: container `supabase_db_libguest-45b-lab`, banco postgres. Não aceita
URL remota. Primeiro aplica migration e fixtures dentro de transação, executa a
matriz e faz ROLLBACK. Para concorrência, confirma temporariamente migration e
fixtures sintéticas, abre cinco sessões para a mesma chave e doze para chaves
distintas. Isso é necessário para visibilidade entre sessões e não é chamado de
rollback-only. O finally remove os objetos e fixtures, usando o rollback explícito.
Preflights abortam se o schema ou namespace sintético já existir. Se o processo
for encerrado à força, inspecionar o lab antes de repetir; não apagar dados de
origem desconhecida. Nunca usar esse procedimento em banco remoto/produção.

O rollback estrutural está em `supabase/tests/51_airlabs_rollback.sql`; remove
apenas os objetos novos, mas descarta histórico de quota. Em ambiente implantado,
exige interrupção dos callers e decisão operacional explícita. Não foi aplicado
a ambiente remoto.

## Diagnóstico operacional de 29/10/2026

O único orçamento interno encontrado em produção cobre
`2026-09-07T02:27:19Z` até `2026-10-07T00:00:00Z`: teto 900,
17 unidades reservadas. É histórico e expirado. Nenhum contador ou período foi
alterado. `AIRLABS_API_KEY` e `AIRLABS_ACCOUNT_SCOPE` estão configurados no escopo
de produção, sem inspeção/divulgação dos valores; presença não valida a chave.

O usuário informou aproximadamente quatro requisições usadas e mil disponíveis
no painel do provedor, sem datas exatas do ciclo. Portanto período de faturamento,
reconciliação de consumo e teto interno vigente continuam não confirmados.
Disponibilidade aproximada no provedor não autoriza reset do controle LibGuest.
Antes de outro teste real é necessária configuração operacional autorizada com
início/fim válidos, consumo reconciliado e teto aprovado, preservando o histórico
e os controles existentes; não há RPC pública para administrar esse orçamento.

O teste controlado autorizado tinha limite de duas requisições ao provedor. A
ocorrência fornecida manualmente foi Azul AZU4277 / IATA AD4277, 29/10/2026,
REC–CGH, partida programada 16:40 America/Recife. O POST canônico respondeu HTTP
503 `budget_unavailable`, antes da chamada externa. Uma sondagem sintética anterior
também foi bloqueada. Total AirLabs: zero requisições; consumo interno permaneceu
17. Sem retry, polling, mudança de plano, extração da Aena ou status inventado.
As duas sondagens passam pelos registros operacionais normais de rate buckets e
cache do coordenador, antes da validação de orçamento; isso não reserva crédito
nem modifica o contrato v1 ou dados do voo manual.

Estimativa 16:55, terminal T1, portão 16 e “CONFIRMADO” são somente a referência
manual do usuário na Aena, não dados retornados pela AirLabs. Não houve match nem
status do provedor e não é possível comparar fontes operacionalmente. A integração
real permanece NÃO CONFIRMADA / NO-GO até resolver a configuração e obter evidência
real elegível. Testes com fixtures não alteram essa classificação.

O normalizador de consulta reconhece o alias Azul AZU → AD do catálogo oficial
compartilhado, preservando o voo manual v1 e zeros. Identificadores conflitantes,
ICAO desconhecido e codeshares não são convertidos arbitrariamente. Referência de
identidade: [diretório oficial de companhias da Aena](https://www.aenabrasil.com.br/en/airports/maceio-zumbi-dos-palmares-international-airport/airline-companies.html).
O fallback Azul usa o link oficial já existente. REC tem link oficial desabilitado
no catálogo atual; não foi inserida URL por fora de seu contrato administrativo.

## Decisão operacional — renovação conservadora (29/10/2026)

Sprint 51.1 permanece aprovada e identity-agnostic: voo manual, sem PMS, OPERA,
reserva, identidade pessoal ou roomToken. Homologação histórica G3 1888 GIG–SSA
em 10/09/2026 é o checkpoint aprovado informado pelo responsável. A expiração
atual não demonstra falha do provedor nem invalida aquela entrega.

Decisão anterior: períodos explícitos, configuração administrativa reconciliada,
teto 900, sem renovação. Não há associação automática ao Billing AirLabs.
Nova regra: rollover opt-in no orçamento, desabilitado por default. Na admissão
já autorizada, sem período vigente, a última linha encerrada, não suspensa e
habilitada gera uma sucessora de 720 horas a partir do instante real do banco.
São datas operacionais, NÃO datas de cobrança. Limite novo = limite anterior
menos consumo anterior; consumo da nova linha começa em zero. Datas, 17/900 e
timestamps da linha anterior permanecem. FK identifica predecessor na mesma
conta; UNIQUE permite uma só sucessora. Advisory lock, cache, leases, cooldowns,
rate policies, autorização, grants e contrato v1 permanecem iguais.

Impacto registrado antes da ativação: cadeia originada em 900 com 17 consumidos
permite no máximo 883 chamadas futuras, não 900 a cada período. Renovar vigência
não aumenta capacidade global. Esgotamento continua quota_exhausted; reposição
exige decisão e reconciliação explícitas. A política pode subutilizar o plano,
mas não inventa ciclo/saldo do fornecedor. Os valores aproximados quatro usadas
ou mil disponíveis informados pelo operador não são usados como contador exato.

Sem opt-in, suspensão, período futuro ou múltiplos períodos vigentes, permanece
fail-closed. Cache fresco continua elegível sem nova reserva. Configuração pelo
canal administrativo seguro existente, sem grant direto ou novo RPC de orçamento
para browser/service_role. Desabilitar rollover na última linha impede novas
vigências; suspender a vigente impede fetch. Rollback comportamental não apaga
histórico. Sem scheduler, polling, retries ou chamada ao provedor na renovação.

Validação reproduzível local: powershell -NoProfile -File
./supabase/tests/51_airlabs_local_lab.ps1 -BudgetRollover. Executa matriz legada,
matriz de renovação e duas corridas concorrentes no lab fixo; limpa somente a
infraestrutura/fixtures sintéticas instaladas pelo teste. Migration remota/local
alinhada: 20261029231150_airlabs_operational_budget_rollover.sql. Aplicação da
migration mantém opt-in desligado; ativação é um checkpoint operacional separado.
