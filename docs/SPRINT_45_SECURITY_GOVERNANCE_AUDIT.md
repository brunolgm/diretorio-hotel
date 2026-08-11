# Sprint 45 — Auditoria de governança, permissões e segurança

Data: 10/08/2026

Branch: `sprint-45-security-governance`

Escopo: auditoria estática do código e das migrations versionadas. Nenhum código funcional, SQL, migration, RLS, policy, Auth, Storage, dado ou infraestrutura foi alterado.

## 1. Resumo executivo

O painel possui uma camada server-side consistente: `requireAdminAccess()` exige usuário, perfil ativo, papel reconhecido e `hotel_id`; as server actions derivam o hotel no servidor e, nas mutações por ID, combinam alvo e hotel. Não foi encontrada ação administrativa que confie apenas na UI nem acesso cruzado evidente nas actions.

O principal risco é a divergência entre essa matriz e as RLS versionadas. Comunicados, banners, traduções associadas, links de apartamentos e policies de Storage autorizam qualquer usuário autenticado e ativo do hotel a escrever, sem repetir os papéis `operador` ou `editor`. Um cliente Supabase autenticado pode, portanto, contornar a UI e as server actions dentro do próprio hotel. Para `hotels`, `profiles`, `hotel_sections`, `hotel_departments` e `hotel_policies`, a baseline completa de RLS não existe no repositório; o estado efetivo do ambiente precisa ser exportado e comparado antes de qualquer mudança.

Analytics tem dois caminhos de ingestão: a API valida allowlist e coerência hotel/slug/departamento, mas não limita tamanho, volume ou frequência; e a RLS permite insert direto a `anon` e `authenticated` com `with check (true)`, contornando toda validação da API. O cooldown no navegador é somente UX e não é proteção contra abuso.

Não há risco crítico comprovado nesta leitura. Há três frentes altas: divergência RLS/papéis, insert público direto de analytics sem rate limit e ausência de uma baseline versionada verificável para tabelas centrais/traduções. Auth + profiles, último administrador, uploads, lifecycle de Storage, auditoria persistente e exposição de QR/notas são riscos médios ou decisões de produto.

Esta primeira etapa não autoriza implementação. A ordem recomendada é: 45A (hardening de código e testes), 45B (baseline, migrations/RLS/RPC e audit log) e 45C (rate limit distribuído, monitoramento e retenção).

## 2. Arquitetura atual de identidade e autorização

```text
usuário autenticado (Supabase Auth / auth.users)
  → sessão em cookie lida pelo cliente SSR com anon key
  → profiles.id = auth.uid()
  → profiles.is_active + profiles.role + profiles.hotel_id
  → requireAdminAccess(papel mínimo)
  → getAdminHotel() resolve hotels.id = profiles.hotel_id
  → rota ou server action
  → query/mutação com hotel_id derivado no servidor
  → RLS do usuário autenticado

fluxos excepcionais e server-only
  → createAdminClient() com SUPABASE_SERVICE_ROLE_KEY
  → ignora RLS
  → proteção depende integralmente da autorização e do escopo no código
```

### Componentes do modelo

- `proxy.ts` apenas redireciona `/admin` sem sessão e `/login` com sessão. Papel, perfil ativo e hotel são validados novamente nas rotas/actions.
- `requireUser()` usa `auth.getUser()`, não dados locais de sessão como fonte final.
- `requireAdminAccess()` busca `profiles` por `user.id`, normaliza quatro papéis e exige perfil ativo com hotel.
- Hierarquia: `visualizador` < `operador` < `editor` < `administrador`; aliases `owner` e `admin` viram administrador.
- `getAdminHotel()` deriva o hotel do perfil autenticado. Não existe seleção de hotel ativo, claims customizadas, `allowed_hotels` ou contexto multi-hotel.
- O cliente browser usa anon key. O cliente SSR usa anon key + sessão. A service role existe somente em `lib/supabase/admin.ts`, marcado `server-only`.
- Service role é usada em administração de Auth/perfis, hero/banner Storage e resolução pública de `roomToken`.

### Camadas efetivas

| Fluxo | UI | Rota/action | RLS | Service role |
| --- | --- | --- | --- | --- |
| Leitura admin | oculta por papel quando aplicável | exige ao menos visualizador | isola hotel onde versionada | usuários são lidos com service role após exigir administrador |
| Conteúdo operacional | oculta mutações para viewer | exige operador e escopa hotel | RLS recente não exige operador | não |
| Hotel/identidade | somente editor+ | exige editor e usa hotel do perfil | baseline não versionada | hero/remove usam service role no Storage |
| Apartamentos/QR | somente editor+ | exige editor e escopa hotel | qualquer usuário ativo do hotel pode escrever | resolução pública usa service role por token |
| Usuários | somente administrador | exige administrador, escopa o alvo ao hotel | ignorada | Auth e profiles usam service role |
| Analytics público | componente público | API valida parte do contrato | insert direto é irrestrito | não |

## 3. Matriz RLS versus actions

“RLS versionada” descreve apenas o que existe nas migrations do repositório, não garante o estado do ambiente. Policies podem ter sido criadas manualmente ou alteradas fora do versionamento.

| Tabela/objeto | SELECT | INSERT | UPDATE | DELETE | RLS versionada | Action atual | Divergência |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `hotels` | pública/admin, conforme loaders | não há create no admin | editor, ID derivado | não há | baseline ausente; migrations só adicionam colunas/constraints | editor | estado efetivo desconhecido; precisa inventário |
| `profiles` | próprio perfil e lista admin | admin via service role | admin via service role | sem delete de UI | baseline ausente; migration só adiciona `is_active` | administrador | service role ignora RLS; segurança está no código |
| `hotel_sections` | público ativo; admin do hotel | operador | operador, ID + hotel | operador, ID + hotel | baseline ausente | operador | estado efetivo desconhecido |
| `hotel_departments` | público ativo; admin do hotel | operador | operador, ID + hotel | operador, ID + hotel | baseline ausente | operador | estado efetivo desconhecido |
| `hotel_policies` | público ativo; admin do hotel | operador | operador, ID + hotel | operador, ID + hotel | baseline ausente | operador | estado efetivo desconhecido |
| traduções de serviços/departamentos/políticas | pública/admin via pai | upsert por action | upsert por action | cascade do pai | tabelas criadas sem `enable row level security` no repositório | operador por action pai | alto: baseline/RLS ausente no versionamento |
| `hotel_announcements` | público somente elegível; ativo do hotel vê tudo | qualquer usuário ativo do hotel | qualquer usuário ativo do hotel | qualquer usuário ativo do hotel | sim, isola hotel mas não papel | operador | alto: viewer pode mutar via cliente direto |
| `hotel_announcement_translations` | público se pai elegível; ativo do hotel vê | qualquer usuário ativo do hotel | idem | idem | sim, herda hotel do pai, sem papel | operador | alto: contorno da action |
| `hotel_promotional_banners` | público somente elegível; ativo do hotel vê tudo | qualquer usuário ativo do hotel | idem | idem | sim, isola hotel mas não papel | operador | alto: viewer pode mutar via cliente direto |
| `hotel_promotional_banner_translations` | pública se pai elegível; ativo do hotel vê | qualquer usuário ativo do hotel | idem | idem | sim, sem papel | operador | alto: contorno da action |
| `hotel_room_links` | qualquer usuário ativo do hotel | qualquer usuário ativo do hotel | idem | idem | sim, isola hotel, sem papel | editor; sem delete na UI | alto: viewer/operador podem criar, editar, rotacionar ou excluir diretamente |
| `hotel_analytics_events` | autenticado do mesmo hotel, sem exigir perfil ativo/papel | `anon` e `authenticated`, `with check (true)` | não há policy | não há policy | sim | API pública + dashboard visualizador | alto: API/allowlist podem ser contornadas; perfil inativo pode ler se sessão continuar válida e policy efetiva não exigir `is_active` |
| `storage.objects` para banners | bucket/pasta + hotel | qualquer usuário ativo do hotel | idem | idem | duas famílias aditivas de policies aceitam dois layouts de pasta | operador; parte usa service role | alto: papel não aplicado e superfície de paths duplicada |
| `storage.objects` para logo/hero | bucket público | depende do ambiente | depende do ambiente | depende do ambiente | policies completas não estão versionadas | editor; logo usa sessão, hero usa service role | estado efetivo desconhecido |

### Conclusão de RLS

Antes de escrever migrations, exportar do ambiente de homologação: `pg_policies`, flags `relrowsecurity/relforcerowsecurity`, grants de tabelas/sequences/functions e policies de `storage.objects`. A nova baseline deve ser revisada tabela por tabela e aplicada primeiro em preview. Não se deve inferir que “ausente no repositório” significa automaticamente “ausente no ambiente”.

## 4. Autorizações server-side

| Grupo de actions | Papel | Escopo/validação | Classificação |
| --- | --- | --- | --- |
| Serviços, departamentos e políticas | operador | hotel server-side; update/delete por ID + hotel; payload normalizado | correta; revisão baixa para limites máximos de texto |
| Comunicados e banners | operador | hotel server-side; janela temporal/URL/categoria validadas; alvo ID + hotel | correta no código; risco alto fica na RLS |
| Traduções | herda action operador | IDs vêm da linha recém-criada ou previamente escopada | correta via action; RLS/baseline precisa correção |
| Hotel e identidade | editor | hotel vem do perfil; allowlist de preset, URL, cor e subdomínio | correta; revisão média para campos sensíveis e Storage |
| Apartamentos e QR | editor | hotel server-side; IDs + hotel; URL validada; token randômico | correta; revisão baixa para limites de texto e retry de colisão |
| Upload de logo/hero | editor | path usa hotel server-side e limite de bytes/MIME declarado | risco médio: conteúdo real não validado e lifecycle desigual |
| Upload/remoção de banner | operador | banner é verificado por ID + hotel; path server-side | risco médio: conteúdo real/lifecycle; delete do banner não limpa arquivo |
| Criar/editar/status de usuário | administrador | alvo consultado por ID + hotel antes da service role mutar | risco médio: atomicidade e concorrência |

Nenhuma action auditada depende somente de ocultação na UI. O uso de service role em usuários é necessário para Admin Auth, mas aumenta a exigência de testes negativos. Nos fluxos de Storage, service role pode ser reduzida depois de policies por papel estarem corretas; não deve ser removida antes disso.

## 5. Analytics público

### Estado atual

- Eventos têm allowlist de seis valores e constraint equivalente no banco.
- A API exige `hotelId`, `hotelSlug` e evento; confirma que ID + slug representam o mesmo hotel e que o departamento pertence ao hotel.
- Idioma é normalizado. Metadados precisam apenas ser um objeto não-array.
- `sessionId`, `targetUrl`, slug, metadata, profundidade JSON e tamanho total não têm limites explícitos.
- Hotel e slug vêm do cliente. A dupla é validada, mas IDs/slugs são naturalmente públicos e podem ser reutilizados por scripts.
- Não há IP, user-agent, request ID, Origin/Referer validado, idempotency key ou deduplicação server-side.
- `sendBeacon`/fetch enviam same-origin; a ausência de CORS permissivo reduz abuso casual de browsers de terceiros, mas não impede scripts, bots ou acesso direto ao Supabase.
- Cooldowns em `sessionStorage` são manipuláveis e não constituem rate limit.
- A RLS `with check (true)` permite inserir qualquer hotel, slug, departamento, evento aceito pela constraint e metadata diretamente no banco, sem passar pela API.

### Arquitetura recomendada

1. Tornar `/api/analytics` o único gatekeeper.
2. Remover/revogar insert direto de `anon` e `authenticated` em migration revisada; a API deve persistir por função restrita ou credencial server-only com payload mínimo.
3. Derivar o hotel do contexto público resolvido quando possível; quando receber identificador, resolver e reconstruir o payload no servidor, nunca reutilizar o objeto do cliente.
4. Aplicar schema fechado por evento: limites de bytes e caracteres, UUID quando aplicável, URL `http/https`, metadata com chaves conhecidas e sem objetos arbitrários.
5. Rejeitar body acima de um limite pequeno antes do parse e registrar somente códigos de falha agregáveis.
6. Rate limit distribuído por combinação de IP pseudonimizado, hotel e classe de evento, com burst curto e janela sustentada.
7. Deduplicar page views/clicks com chave curta de hotel + sessão + evento + alvo + janela. Não usar a sessão do cliente como prova de identidade.
8. Manter respostas genéricas e não registrar payload integral, IP bruto permanente ou URLs com query sensível.

## 6. Rate limiting

| Superfície | Estado | Prioridade | Chave/estratégia sugerida |
| --- | --- | --- | --- |
| `/api/analytics` | nenhum server-side | alta | IP pseudonimizado + hotel + classe do evento; burst e janela sustentada |
| Login | chama Supabase Auth direto do browser | alta | proteções do provedor + camada de borda/WAF; alertas por IP/conta, sem revelar existência do e-mail |
| `/r/[roomToken]` | consulta com service role a cada GET | média | IP + prefixo de rota; cache negativo curto e limite contra varredura |
| Uploads | somente usuário autenticado por papel | média | usuário + hotel + bytes/janela e concorrência máxima |
| Server actions destrutivas/QR | autenticação e confirmação, sem frequência | média/baixa | usuário + hotel + ação; idempotência/audit log antes de limites agressivos |
| Rotas públicas de leitura | sem mutação | baixa | CDN/cache e proteção de borda contra volumetria |

Rate limit em memória local é inadequado para Vercel/serverless: instâncias são efêmeras e não compartilham estado. Opções compatíveis são um datastore distribuído Redis/KV com operação atômica e TTL, proteção de borda da plataforma, ou gateway/Edge Function com storage distribuído. A escolha do fornecedor, custo, regiões, tratamento de IP e comportamento em falha exige decisão de infraestrutura. Para analytics, falha do limitador deve degradar de forma controlada e observável, sem derrubar páginas públicas.

## 7. Auth + profiles

### Criação

`createHotelUserAction` cria primeiro `auth.users`, depois faz `upsert` de `profiles`. Se o profile falha, tenta excluir o usuário Auth. Isso é uma compensação útil, mas a falha do rollback não é verificada nem persistida; pode restar usuário Auth órfão. O inverso, profile órfão sem Auth, pode existir por operações externas, embora não seja criado por este caminho normal.

### Edição e status

Na edição, Auth (email, senha, metadata) é alterado antes de `profiles`. Se o update do profile falha, Auth permanece modificado. Não há snapshot/rollback, idempotency key ou job de reconciliação. A desativação altera somente `profiles`; a conta continua autenticável no Supabase, mas `requireAdminAccess()` nega o painel. Essa semântica deve ser explicitamente aceita pelo produto.

### Solução proposta

- Curto prazo/código: operações idempotentes, snapshot mínimo, compensação verificada, estado de erro auditável e rotina de reconciliação Auth↔profile.
- Fronteira recomendada: uma função server-only/Edge Function administrativa que centralize a orquestração e aceite apenas payload validado após autorização.
- Banco: RPC/transação pode proteger somente `profiles` e invariantes relacionais; não torna a Admin Auth API parte da mesma transação PostgreSQL.
- Não prometer atomicidade forte entre Auth API e Postgres. Usar saga/compensação, estados operacionais e reconciliação.

## 8. Proteção do último administrador

A regra atual conta outros administradores ativos e depois atualiza o perfil. Duas requisições concorrentes podem ler contagem positiva e rebaixar/desativar administradores diferentes, deixando zero administradores ativos. Auto-desativação e autorrebaixamento são bloqueados, mas não resolvem concorrência entre administradores.

Recomendação: mover a alteração de role/status e a verificação da invariante para uma única função transacional no banco. A função deve bloquear o conjunto do hotel (`advisory_xact_lock` derivado do hotel ou lock de uma linha estável), reler os administradores ativos, aplicar a mudança e falhar se o resultado for zero. Uma constraint simples não expressa “ao menos uma linha por hotel”; trigger pode funcionar, mas é mais difícil de testar e operar. RPC transacional explícita é preferível porque concentra autorização, lock, mudança e erro de domínio. Auth continua fora dessa transação e deve ser orquestrado separadamente.

## 9. Uploads

| Fluxo | Formatos declarados | Limite | Validação real | Risco |
| --- | --- | --- | --- | --- |
| Logo | JPEG, PNG, WEBP, SVG | 5 MB | `File.type`, nome/extensão do cliente | alto para SVG; médio para raster disfarçado |
| Hero | JPEG, PNG, WEBP | 10 MB | `File.type`; extensão gerada por MIME declarado | médio |
| Banner | JPEG, PNG, WEBP | 2 MB | `File.type`, nome/extensão do cliente | médio |

Não há magic bytes, decodificação real, dimensões, pixels máximos, remoção de metadata ou detecção de arquivo malformado. Logo e banner derivam a extensão do filename, permitindo divergência entre extensão e MIME. Paths contêm hotel e nomes controlados, o que evita path traversal pelo filename. `upsert` substitui objetos de nome determinístico.

Plano seguro: ler somente um buffer limitado; validar assinatura; decodificar raster em biblioteca server-only aprovada; impor dimensões e megapixels; re-encodar para formato permitido; remover metadata; gerar extensão/nome no servidor. SVG deve ser proibido por padrão ou passar por sanitização específica e ser servido com headers seguros fora de contexto executável. A decisão de manter SVG é de produto/branding e segurança. Nenhuma biblioteca deve ser instalada sem aprovação e avaliação de runtime/custo.

## 10. Lifecycle de Storage

- Logo sobrescreve `hotelId/logo.ext`; trocar extensão deixa variante antiga e falha do update de `hotels.logo_url` deixa arquivo enviado sem cleanup. Remover logo só limpa a URL, não o objeto.
- Hero faz upload determinístico, remove o arquivo novo se o banco falha e limpa variantes antigas após persistir. Porém `upsert` pode sobrescrever o arquivo atualmente referenciado antes do update de banco, impossibilitando rollback do conteúdo anterior.
- Banner faz upload determinístico e não remove o arquivo se o update do banco falha. Troca de extensão deixa variante antiga. Excluir o registro do banner não remove explicitamente o objeto.
- Remover imagem de banner apaga o objeto antes de limpar a referência no banco. Se o banco falha depois, fica URL persistida apontando para arquivo inexistente.
- URLs externas de logo/hero são aceitas; cleanup só deve ocorrer para URLs comprovadamente pertencentes ao bucket/path esperado.

Fluxo futuro recomendado:

```text
validar e normalizar arquivo
  → upload em chave nova/versionada
  → persistir nova referência com compare-and-set/versionamento
  → após sucesso, remover objeto antigo conhecido
  → em falha do banco, remover somente o novo objeto
  → registrar falhas de cleanup para reconciliação assíncrona
```

Um job periódico deve comparar referências válidas com objetos do prefixo do hotel e gerar relatório antes de apagar órfãos. Nunca fazer limpeza cega por prefixo em produção.

## 11. QR, roomToken e campos sensíveis

### QR/tokens

- `crypto.randomBytes(18).toString('base64url')` fornece 144 bits de entropia; o token é não sequencial e adequado contra enumeração prática.
- Há unique constraint global e índice por token. A action tenta cinco tokens, mas a checagem prévia sob RLS pode não enxergar token de outro hotel; a constraint ainda impede colisão, embora o retry não trate especificamente a colisão do insert. A probabilidade é desprezível.
- Regeneração substitui o token e invalida imediatamente o anterior. Nenhum histórico do token é mantido, o que é positivo para exposição, mas falta audit log.
- `/r/[roomToken]` usa service role, responde com o mesmo destino de erro para vazio, inexistente, inativo ou hotel ausente e não loga o token. Isso reduz enumeração por conteúdo.
- Não há rate limit/cache negativo. Diferenças de tempo entre token inválido e válido podem existir, mas 144 bits tornam descoberta por força bruta impraticável; o risco principal é vazamento do token.
- O cookie é `httpOnly`, `secure`, `sameSite=lax`, dura 24 horas e contém token, hotel e número do quarto. Não é assinado, mas todo uso sensível revalida token + hotel + status no servidor; adulteração não concede acesso a outro contexto sem token válido.

### Exposição de campos

| Campo | Onde aparece | Avaliação |
| --- | --- | --- |
| `room_token`/URL QR | HTML do admin para qualquer visualizador do hotel | baixo/médio; aplicar mínimo privilégio se viewer não precisar imprimir QR |
| `notes` e URL Thex | admin visível a visualizador/operador | decisão de produto; podem conter informação operacional sensível |
| número/label do quarto | cookie httpOnly e experiência pública contextual | necessário ao fluxo; não enviar a analytics |
| `wifi_password` | HTML público | intencional para hóspedes, mas é público na internet; confirmar política operacional |
| e-mails de usuários | páginas admin, lidas por service role | adequado somente a administrador; não logar payloads |
| URLs de destino | DOM público e analytics `target_url` | URLs públicas esperadas; remover query/fragment se puderem conter segredos |
| IDs de hotel/departamento | DOM/API analytics | identificadores não são segredo; autorização não pode depender de ocultação |

Não foram encontrados tokens ou senhas registrados explicitamente nos logs. `logOperationalError` registra módulo, ação, operação, hotel, alvo e mensagem; mensagens brutas do provedor ainda devem ser classificadas/redigidas para evitar PII acidental.

## 12. Auditoria persistente

Criar futuramente um log append-only para eventos administrativos relevantes: login de risco, criação/edição/exclusão, role/status, tema/subdomínio, QR, uploads/remoções e mudanças sensíveis.

Campos mínimos: `id`, `created_at`, `actor_user_id`, `hotel_id`, `action`, `entity_type`, `entity_id`, `result`, `request_id` e `metadata` com schema por ação. Incluir origem do canal e, quando necessário, hash/pseudônimo de contexto de rede com retenção curta.

Nunca armazenar senha, token de quarto, cookies, chaves, body integral, URL com segredo, arquivo ou before/after indiscriminado. Para alterações críticas, metadata pode conter nomes de campos alterados e valores não sensíveis normalizados; PII deve ser minimizada.

Somente service role/função controlada deve inserir. Administradores do hotel podem consultar eventos do próprio hotel conforme produto; usuários comuns não devem alterar/apagar. Retenção proposta para decisão: 180 dias pesquisáveis e até 12 meses em arquivo protegido quando houver necessidade operacional/legal, com deleção automatizada e exceção formal para investigação. A definição final depende de privacidade, contratos e custo.

## 13. Mínimo privilégio

- Anon key no browser é o padrão correto, desde que RLS e grants sejam a fronteira real.
- Usuários autenticados recebem escrita mais ampla que a matriz do produto em comunicados, banners, traduções, quartos e Storage.
- Service role está isolada em módulo server-only, mas é usada em leituras públicas de quarto e Storage. Cada chamada seleciona campos limitados e/ou usa token/paths derivados; ainda assim, qualquer regressão de escopo ignora RLS.
- Administração de Auth exige service role. Listagem/edição de profiles também usa service role por conveniência, embora a autorização de alvo seja aplicada no código.
- Hero/banner Storage pode migrar para cliente autenticado após policies por papel e paths estarem corretas. Resolução de roomToken pode usar uma função SQL `security definer` mínima, com retorno restrito, em vez de acesso geral por service role.
- Não criar permissões por módulo sem caso real. Primeiro alinhar os quatro papéis já existentes em UI, action e RLS.

## 14. Matriz de riscos

| Severidade | Ativo/cenário | Impacto e probabilidade | Pré-requisito | Correção | Tipo |
| --- | --- | --- | --- | --- | --- |
| alto | RLS de anúncios, banners, traduções, quartos e Storage não replica papéis | mutação indevida dentro do hotel; probabilidade moderada com usuário autenticado técnico | conta ativa de qualquer papel | policies por papel + testes negativos | RLS/migration |
| alto | analytics aceita insert direto com `with check (true)` | dados forjados, custo e dashboard contaminado; exploração simples | anon key pública | API única, revoke/policy, função restrita | código + RLS + migration |
| alto | baseline de RLS/grants de tabelas centrais e traduções não está versionada | impossibilidade de provar isolamento; impacto potencial alto | divergência ambiente/repo | exportar, revisar e versionar baseline | processo + migration |
| alto | analytics sem rate limit/tamanho server-side | volumetria, custo e ruído; exploração simples por script | endpoint público | limites de payload, rate limit distribuído, observabilidade | código + infraestrutura |
| médio | Auth atualizado antes de profile | divergência de email/metadata/status | falha intermediária | saga, compensação verificada e reconciliação | código/processo |
| médio | check do último admin sem transação | hotel sem administrador | duas alterações concorrentes | RPC com lock e invariante | migration/RPC |
| médio | uploads confiam em MIME/nome; SVG aceito | conteúdo ativo/disfarçado ou imagem-bomba | editor/operador autenticado | magic bytes, decode, dimensões, re-encode, decisão SVG | código + produto |
| médio | lifecycle não transacional | órfãos ou URLs quebradas | falha parcial/substituição | chave versionada, compensação, reconciliação | código/processo |
| médio | ausência de audit log | baixa rastreabilidade e resposta a incidente | ação sensível | tabela/policies + emissão controlada | migration + código |
| médio | notas/token disponíveis ao visualizador | vazamento operacional por privilégio amplo | conta viewer do hotel | decisão de acesso e selects mínimos | produto + código/RLS |
| médio | `/r/[roomToken]` e uploads sem rate limit | consumo e varredura; token continua forte | acesso público/autenticado | limite distribuído por classe | infraestrutura + código |
| baixo | cookie de quarto não assinado | adulteração causa contexto inválido, não autorização, pois há revalidação | controle do browser | opcionalmente assinar/selar; manter revalidação | código |
| baixo | mensagens brutas de erro em logs | PII incidental do provedor | erro específico | redaction e códigos internos | código/processo |
| informativo | IDs públicos | não são segredo | acesso à página pública | manter autorização por hotel/papel | processo |

Não há achado crítico confirmado. Se a exportação do ambiente mostrar RLS desativada com grants amplos em tabelas administrativas, a severidade deve ser reclassificada imediatamente.

## 15. Plano de implementação proposto

### 45A — Hardening sem banco

- Introduzir schemas e limites centralizados para server actions e analytics.
- Limitar body, strings, URLs e metadata; construir payloads server-side por evento.
- Implementar validação real de imagens após aprovação da dependência/runtime; proibir SVG até decisão explícita.
- Padronizar saga/compensação Auth + profiles e falhas de cleanup de Storage.
- Reduzir selects e exposição de notas/tokens conforme decisão de produto.
- Criar harness de testes unitários/integrados e matriz negativa antes de tocar RLS.
- Preparar interface de rate limit sem escolher fornecedor automaticamente.

### 45B — Baseline, RLS e migrations

- Exportar e revisar estado efetivo; versionar grants/RLS de todas as tabelas.
- Criar helper SQL seguro para perfil ativo/papel, evitando duplicação inconsistente nas policies.
- Alinhar SELECT/INSERT/UPDATE/DELETE aos quatro papéis e ao hotel.
- Fechar insert público de analytics e oferecer função/gatekeeper mínimo.
- Implementar RPC transacional do último administrador.
- Criar audit log append-only, RLS e rotina de retenção.
- Revisar policies de Storage e remover policies duplicadas somente após teste de paths reais.

### 45C — Infraestrutura e operação

- Adotar rate limit distribuído e proteção de borda para analytics, login, QR e uploads.
- Criar métricas/alertas de rejeição, volume, falha Auth/profile e cleanup pendente.
- Implementar reconciliação de Auth↔profiles e referências↔Storage.
- Definir retenção, runbooks, rotação de secrets e resposta a incidente.

### Decisões necessárias

- Viewer/operador precisam visualizar QR, token, URL Thex e notas?
- `wifi_password` deve permanecer publicamente renderizado ou exigir contexto válido de quarto?
- SVG é requisito real de branding ou pode ser removido?
- Desativar perfil deve também banir/revogar Auth imediatamente?
- Retenção e visibilidade do audit log.
- Fornecedor/região/custo e comportamento de falha do rate limiter.

## 16. Testes necessários

O projeto não possui scripts ou arquivos de testes unitários, integração, E2E ou RLS; `package.json` oferece apenas dev/build/start/lint.

Antes de qualquer RLS:

1. Seed isolado em ambiente descartável com hotel A/B e usuários viewer, operador, editor, administrador, inativo e sem perfil.
2. Matriz direta Supabase para cada tabela/operação: mesmo hotel, outro hotel, papel abaixo/acima, inativo, anon e service role somente onde esperado.
3. Testes de policies filhas/traduções e alteração de `hotel_id` no `with check`.
4. Analytics: evento válido, evento desconhecido, hotel/slug incompatíveis, departamento cruzado, body grande, metadata profunda, URL longa, replay, burst e acesso direto ao banco bloqueado.
5. Usuários: falha Auth, falha profile, falha de compensação, retry idempotente, dois rebaixamentos concorrentes e garantia de um admin ativo.
6. Uploads: magic bytes incompatíveis, extensão falsa, SVG/HTML, arquivo truncado, dimensões/pixels excessivos, bytes no limite, hotel/path cruzado e falhas em cada etapa do lifecycle.
7. QR: token válido/inativo/rotacionado/desconhecido, resposta uniforme, contexto de hotel divergente, cookie adulterado e limite de frequência.
8. Audit log: emissão, escopo por hotel, metadata redigida, imutabilidade e retenção.

Preview seguro: executar com dados sintéticos e contas de teste; validar admin, editor, viewer, inativo e hotel A×B. Não usar usuários, arquivos, QR ou dados produtivos. Capturar evidência das operações permitidas e negadas e comparar com a matriz antes do rollout.

## 17. Tipos de mudança

| Categoria | Itens |
| --- | --- |
| somente código | schemas/limites, redaction, validação de arquivo, saga/compensação, exposição mínima, interface do rate limiter |
| migrations | baseline versionada, RPC último admin, audit log, função restrita de analytics/roomToken |
| RLS/policies | papéis por operação, fechamento do insert analytics, Storage por path/papel, audit log |
| infraestrutura/configuração | rate limit distribuído, WAF/borda, métricas, alertas, jobs de reconciliação/retenção |
| decisão de produto | acesso a QR/notas/Wi-Fi, SVG, desativação Auth, retenção/audit log, tolerância do analytics |

## 18. Validação

Nesta etapa foram alterados somente `docs/SPRINT_45_SECURITY_GOVERNANCE_AUDIT.md` e `docs/PRODUCT_MAP.md`. O `git status --short` final confirma que não há arquivo funcional modificado.

Não foram executados build, SQL, migration, policy, RLS, criação/alteração de usuário, upload, delete, regeneração de QR, alteração de dados, commit, push, merge, deploy ou stash.
