# Sprint 43 — Auditoria do painel administrativo dos hotéis

Data: 10/08/2026

Branch: `sprint-43-admin-audit`

Escopo: diagnóstico estático de rotas, actions, loaders, helpers, tipos, queries e migrations versionadas. Nenhum código funcional, banco, schema, RLS ou dado foi alterado.

## 1. Resumo executivo

O painel administrativo do hotel já é operacional e **não deve ser reconstruído**. Existem dashboard, informações/identidade do hotel, serviços, departamentos, políticas, comunicados, banners, apartamentos/QR, analytics, usuários, quatro papéis e tradução PT/EN/ES. Há estados de leitura, empty states, toasts, loading/error boundaries e integração com a experiência pública.

Achados centrais:

- o contexto é single-hotel por `profiles.hotel_id`; não há `allowed_hotels`, hotel ativo ou troca de hotel;
- as rotas/actions auditadas usam `hotel_id` de forma consistente, sem acesso cruzado evidente;
- UI e server actions aplicam `visualizador`, `operador`, `editor` e `administrador`; não há `superadmin` ou permissão por módulo;
- as RLS recentes isolam o hotel, mas não repetem a hierarquia de papéis do servidor;
- analytics permite insert público direto e não tem rate limit; `banner_click` é emitido na UI pública, mas rejeitado pelo contrato/API/banco;
- há 56 ocorrências de mojibake em 11 arquivos funcionais do admin;
- listas carregam todos os registros, usam muitos `select('*')` e não têm paginação;
- mídia existe por contexto (logo, hero e banner); uma biblioteca geral ainda não se justifica antes do hardening do fluxo atual.

## 2. Fronteira arquitetural

`app/admin/*` é o painel operacional do hotel vinculado ao usuário e deve ser preservado. Não existe painel de plataforma para criar hotéis, definir `brand_code`, ativar módulos, administrar usuários globais, planos ou auditoria central. Essas funções pertencem ao futuro painel interno LibGuest, separado do admin do hotel.

## 3. Inventário técnico obrigatório

### Rotas → componente → action → entidade → permissão

| Rota | Componente/actions principais | Entidade | Permissão efetiva |
| --- | --- | --- | --- |
| `/admin` | `page.tsx`; `getAdminHotel`, readiness, analytics | `hotels`, sections, departments, policies, analytics | leitura `visualizador` |
| `/admin/hotel` | hotel page, subdomain/theme fields; update e upload/remove logo/hero | `hotels`, `hotel-assets` | `editor` |
| `/admin/servicos` | lista/cadastro; create/delete/toggle/retranslate | `hotel_sections`, translations | lista `visualizador`; mutação `operador` |
| `/admin/servicos/[id]` | edição; `updateSectionAction` | mesmas | `operador` |
| `/admin/departamentos` | lista/cadastro; create/delete/toggle/retranslate | departments, translations | lista `visualizador`; mutação `operador` |
| `/admin/departamentos/[id]` | edição; update | mesmas | `operador` |
| `/admin/politicas` | lista/cadastro; create/delete/toggle/retranslate | policies, translations | lista `visualizador`; mutação `operador` |
| `/admin/politicas/[id]` | edição; update | mesmas | `operador` |
| `/admin/comunicados` | lista/cadastro; create/delete/toggle/retranslate | announcements, translations | lista `visualizador`; mutação `operador` |
| `/admin/comunicados/[id]` | edição; update | mesmas | `operador` |
| `/admin/banners` | lista/cadastro; create/delete/toggle/retranslate | promotional banners, translations | lista `visualizador`; mutação `operador` |
| `/admin/banners/[id]` | edição/preview; update/upload/remove image | banners, translations, `hotel-assets` | `operador` |
| `/admin/apartamentos` | lista/formulários, `RoomQrCard`; create/update/toggle/regenerate | `hotel_room_links` | lista `visualizador`; mutação `editor` |
| `/admin/usuarios` | lista/cadastro; create/toggle | Supabase Auth, `profiles` | `administrador` |
| `/admin/usuarios/[id]` | edição; update | Auth, `profiles` | `administrador` |
| estados de rota | layout, loading, error, not-found, acesso-negado | sessão/profile | layout `visualizador` |

Helpers/tipos: `lib/auth.ts`, `lib/app-roles.ts`, `lib/queries.ts`, `types/database.ts`, `lib/form-utils.ts`, `lib/hotel-subdomain.ts`, `lib/hotel-theme.ts`, `lib/services/translation-*`, `lib/service-*`, `lib/room-*`, `lib/analytics.ts` e `app/api/analytics/route.ts`.

Componentes compartilhados: `components/admin/ui.tsx`, navegação desktop/mobile, campos de tema/subdomínio, seletor de ícones, QR card e `FeedbackToast`. Não há tabelas HTML: as listas usam cards. Não há paginação, biblioteca de mídia, breadcrumbs, logs em UI ou seletor de hotel.

## 4. Contexto multi-hotel

Fluxo: `requireAdminAccess()` resolve sessão e `profiles` por `auth.uid()`, exige perfil ativo/papel/`hotel_id`; `getAdminHotel()` busca `.eq('id', profile.hotel_id)`; páginas e actions derivam o hotel no servidor.

| Item | Classificação | Evidência |
| --- | --- | --- |
| `getAdminHotel()` | seguro | ID vem do perfil autenticado |
| leituras admin | seguro | entidades usam `.eq('hotel_id', hotel.id)` |
| updates/deletes | seguro | combinam ID do alvo + hotel e confirmam linha retornada |
| inserts | seguro | `hotel_id` é server-side |
| rotas `[id]` | seguro | ID + hotel; ausência vira 404/feedback |
| `allowed_hotels`/contexto ativo/troca | inexistente | perfil possui somente `hotel_id` |
| subdomínio | seguro com dependência | índice único é garantia final; checagem antecipada depende da visibilidade RLS |
| RLS de tabelas antigas | revisar | políticas centrais não estão versionadas neste repositório |
| RLS recentes | revisar | hotel/perfil ativo são verificados, papel mínimo não |

Não foi encontrado risco crítico de acesso cruzado nas rotas/actions. Multi-hotel exige associação usuário↔hotéis e contexto ativo explícitos; não deve sobrecarregar `profiles.hotel_id`.

## 5. Usuários e permissões

Hierarquia: `visualizador` < `operador` < `editor` < `administrador`; aliases `owner`/`admin` viram administrador. A UI oculta ações e as server actions repetem a autorização. O sistema impede auto-desativação, autorrebaixamento e remoção do último administrador em fluxo normal.

Riscos:

- **alto:** RLS versionadas de comunicados, banners, traduções, quartos e Storage não verificam papel; um cliente Supabase autenticado pode contornar a matriz da UI/actions dentro do próprio hotel;
- **médio:** check do último administrador é contagem seguida de update, sem transação e sujeito a concorrência;
- **médio:** update de usuário altera Auth antes de `profiles`; falha posterior gera divergência;
- **médio:** não há auditoria persistente de papéis/status, exclusões, mídia ou rotação de token;
- não há permissões por módulo nem superadmin; exclusão de usuário foi substituída por desativação.

## 6. Auditoria funcional por módulo

### Dashboard e analytics

Dashboard funcional com hotel/cidade, check-in/out, prontidão, atalhos por papel, hoje/7d/30d, comparação anterior, idiomas, ações e departamentos. Manter; refinar densidade e esclarecer deltas absolutos.

Eventos existentes: `page_view`, `language_selected`, `whatsapp_click`, `website_click`, `booking_click`, `department_click`. Faltam QR, cardápio, serviço, banner e origem/referrer. Não há funil ou impressões.

- **alto:** RLS de analytics permite `insert` anon/authenticated com `with check (true)`; o endpoint valida hotel/slug/departamento, mas acesso direto pode forjar eventos;
- **alto:** sem rate limit ou limite explícito de payload/volume;
- **médio:** `banner_click` Mercure é emitido, porém não pertence ao union/API/constraint;
- performance: todos os eventos do período atual+anterior são agregados em JavaScript.

### Serviços

CRUD, status, busca/filtro, categoria guiada/custom, ícone, CTA, URL, ordem numérica, tradução/retradução e destinos `standard`, `external_url`, `room_restaurant_menu` existem. Thex usa contexto de quarto. Faltam mídia, drag-and-drop, preview e evento de clique; feedbacks têm mojibake.

### Departamentos

CRUD, status, busca, nome, descrição, horário, texto de ação, URL e tradução existem e alimentam Contato Online. Faltam ordem e campos tipados para telefone/WhatsApp/e-mail; a edição contém textos corrompidos.

### Políticas

CRUD, status/publicação, busca, tradução, empty states e apresentação pública existem. Faltam ordem/preview; edição e feedbacks têm mojibake.

### Comunicados

CRUD, ativação, categorias, início/fim, expiração, filtros temporais, tradução e publicação pública existem. **Agendamento temporal já está implementado** no form, constraint, RLS e loader. Faltam imagem, prioridade, CTA e ordem; não reconstruir.

### Banners

CRUD, imagem, título/subtítulo, CTA, período, ativo, ordem, tradução, preview e publicação existem. **Agendamento já está pronto**. O loader limita a três banners elegíveis.

Lacunas/bugs: uma imagem para mobile/desktop, sem crop real ou métricas; `banner_click` rejeitado; delete não evidencia limpeza do Storage; falha após upload pode deixar órfão.

### Apartamentos / QR

Cadastro, edição, status, token aleatório de 144 bits, regeneração, QR, cópia e PNG individual existem. Cookie é `httpOnly`, `secure`, `sameSite=lax`; token/hotel/status são revalidados no servidor. Faltam exclusão, lote, busca/paginação e analytics QR/cardápio. Viewer e operador veem QR/token/URL/notas: confirmar se é deliberado. Nenhum token foi alterado.

### PT / EN / ES

PT fonte, EN/ES no save em paralelo, falha não bloqueante, retradução, badges e fallback público por campo já atendem o roadmap básico.

Limites: status admin mede existência da linha, não campos; `hasFallbackContent` trata opcionais nulos como incompletos; não há filtro por status, cópia base, preview por idioma ou edição manual.

### Identidade visual

Existem cinco presets neutros, Mercure/Novotel/Grand Mercure, cor sanitizada, logo, hero, `theme_preset` e `brand_code`. O hotel não edita `brand_code` e o update não o inclui. Admin recebe neutros + somente a marca compatível; preset oficial já salvo pode ser preservado na transição. Não há inferência por nome/slug/domínio.

### Mídia

- logo: URL ou JPEG/PNG/WEBP/SVG até 5 MB;
- hero: URL ou JPEG/PNG/WEBP até 10 MB, caminho por hotel e limpeza de variantes;
- banner: JPEG/PNG/WEBP até 2 MB, preview e remoção.

Não há inspeção de conteúdo/dimensões, compressão, crop, alt text, catálogo ou referência de uso. Remover logo só desvincula URL; delete de banner não limpa explicitamente; logo/banner podem deixar órfãos; SVG amplia a superfície. **Decisão:** não criar biblioteca agora; corrigir ciclo, validação, alt e uso antes de reavaliar.

### Configurações, domínio, onboarding e logs

Configurações estão em `/admin/hotel`. Subdomínio tem validação, reservados, unicidade e preview; slug é fallback e não é editado. Custom domain não existe. Onboarding é checklist, não wizard; criação de hotel permanece fora do painel. Logs são `console.error` estruturados e sem payload completo, mas não há persistência, ator, before/after ou UI.

## 7. UX, responsividade e acessibilidade

Pontos maduros: sidebar/sheet compartilham navegação/active state; cards, filtros, badges, empty states e toasts são consistentes; loading/error/not-found/acesso-negado existem; busca/filtro cobrem listas principais.

Problemas UX:

1. 56 strings com mojibake em 11 arquivos.
2. Exclusões e rotação irreversível do QR não têm confirmação.
3. Submits gerais não têm pending/disable; usuários são a exceção.
4. Sem breadcrumbs, paginação ou erro inline por campo.
5. Ordem numérica é inconsistente e algumas entidades não têm ordem.
6. Limite público de três banners não é claro no cadastro.

Avaliação estática dos breakpoints; uma sessão autenticada em navegador não foi executada nesta sprint documental e deve ser confirmada em preview:

| Viewport | Resultado |
| --- | --- |
| 390 | funciona, mas hotel e apartamentos/QR ficam apertados por padding e cards aninhados |
| 430 | funciona, ainda denso; ações quebram linha |
| 768 | funciona bem, formulários passam a duas colunas |
| 1024 | funciona; revisar densidade quando sidebar e layouts `lg` entram juntos |
| 1440 | funciona bem com `max-w-7xl` e grids amplos |

Não foi encontrado hard width causador de overflow: há `min-w-0`, wrap e quebra de URL. Hotel/apartamentos exigem desktop para operação confortável, não para leitura. Listas grandes são problema em qualquer viewport.

Acessibilidade:

- positivo: foco visível, menu rotulado, sheet, `aria-busy`, QR com role/label, dialog semântico e touch targets em geral 40–48 px;
- **alto impacto:** `AdminField` cria `<label>` sem `htmlFor`; inputs normalmente não têm `id`;
- buscas/selects de filtro não têm label programático;
- modal de ícones não tem focus trap, Escape, foco inicial/restauração ou `aria-pressed`;
- toasts não associam erro ao campo; alguns alvos têm 40 px; não há skip link/breadcrumbs;
- contraste não foi medido automaticamente.

## 8. Segurança e performance

| Severidade | Segurança | Ação |
| --- | --- | --- |
| alto | RLS recente não replica papéis | alinhar UI/actions/RLS e testar negativo por papel na Sprint 45 |
| alto | ingestão analytics pública/sem rate limit | endurecer caminho, payload, entidade e abuso |
| médio | RLS central antiga não versionada | inventariar ambiente e versionar baseline revisado |
| médio | Auth/profile não atômicos e último admin concorrente | compensação/idempotência e regra transacional |
| médio | upload confia em MIME; SVG aceito | assinatura, dimensões e política SVG |
| médio | sem trilha persistente | ator, hotel, ação, alvo e resultado |
| baixo | IDs expostos | mitigado por ID + hotel; manter testes |
| baixo | viewer vê QR/token/notas | aplicar mínimo privilégio se leitura não for requisito |

Performance:

- layout, página e helpers repetem auth/profile/hotel; dashboard resolve hotel várias vezes;
- `select('*')` é recorrente; sem `limit`, `range` ou paginação;
- filtros são aplicados após carregar coleções completas;
- traduções usam consulta separada em lote (não N+1), com cálculo em memória;
- cada card de quarto gera QR no cliente;
- imagens não são comprimidas no upload;
- revalidação pública não é totalmente uniforme.

Prioridade: paginação/selects mínimos e agregação de analytics antes de otimização cosmética.

## 9. Matriz obrigatória

| Módulo | Existe | Funcional | UX | Segurança | Mobile | Ação recomendada |
| --- | --- | --- | --- | --- | --- | --- |
| Dashboard | sim | sim | boa/densa | revisar analytics | boa | refinar Sprint 44 |
| Hotel/contexto | sim | single-hotel | longo | action segura; RLS revisar | apertado | revisar Sprint 45 |
| Serviços | sim | sim | boa; textos/confirmar | action escopada | boa | corrigir Sprint 44 |
| Departamentos | sim | sim | edição corrompida/campos genéricos | RLS não versionada | boa | corrigir Sprint 44 |
| Políticas | sim | sim | edição corrompida/sem ordem | RLS não versionada | boa | corrigir Sprint 44 |
| Comunicados | sim | sim/agendado | sem CTA/imagem/prioridade | RLS sem papel | boa | refinar Sprint 44 |
| Banners | sim | sim/agendado | madura; sem variantes/crop | RLS/Storage sem papel | edição apertada | corrigir Sprint 44 |
| Apartamentos/QR | sim | sim | denso/sem confirmação | token forte; RLS sem papel | apertado | refinar Sprint 44 |
| Analytics | sim | parcial | leitura boa | ingestão fraca | boa | revisar Sprint 45 |
| Usuários | sim | sim | clara | consistência/race | apertado | revisar Sprint 45 |
| Permissões | sim | hierárquica | leitura clara | server diverge RLS | n/a | revisar Sprint 45 |
| Identidade visual | sim | sim | madura | `brand_code` protegido | apertado | manter |
| Mídia | por contexto | parcial | útil | validação/órfãos | boa | refinar Sprint 44 |
| Traduções | sim | automática | status não granular | child IDs herdados | boa | refinar Sprint 44 |
| Configurações | em Hotel | sim | longa | escopada | apertado | refinar Sprint 44 |
| Subdomínio | sim | sim | madura | índice + escopo | boa | manter |
| Domínio personalizado | não | n/a | — | foundation | — | evoluir futura |
| Onboarding | checklist | parcial | útil | sem provisionamento | boa | revisar Sprint 45 |
| Logs/auditoria | console | parcial | sem UI | sem trilha | n/a | revisar Sprint 45 |
| Estados/loading/erros | sim | sim | toast sem inline | erro bruto oculto | boa | refinar Sprint 44 |
| Acessibilidade | parcial | parcial | labels/modal/filtros | — | touch razoável | corrigir Sprint 44 |

## 10. Backlog resultante

### Sprint 44 — correções/refinamentos existentes

1. Corrigir mojibake e revisar visualmente os 11 arquivos.
2. Associar labels/inputs, rotular filtros e melhorar erro inline/aria-live.
3. Confirmar exclusões e rotação de roomToken; adicionar pending/disable.
4. Corrigir o contrato comprovadamente divergente de `banner_click`, sem ampliar eventos nesta sprint.
5. Corrigir completude/fallback de tradução por campos aplicáveis.
6. Refinar hotel e QR em 390/430; validar 390, 430, 768, 1024 e 1440 em preview.
7. Fechar ciclo de mídia: rollback/limpeza, dimensão, alt e referência de uso.
8. Paginar listas de volume real, reduzir selects e explicitar limite de três banners.
9. Tornar modal de ícones acessível.

### Sprint 45 — governança, permissões e segurança

1. Inventariar/versionar RLS efetiva das tabelas antigas.
2. Alinhar UI, server actions e RLS aos quatro papéis com testes negativos.
3. Endurecer analytics contra spoofing/abuso e limitar payload/volume.
4. Criar auditoria para usuários, papéis, status, exclusões, mídia e QR.
5. Tratar Auth+profile e concorrência do último administrador.
6. Revisar uploads e acesso mínimo a QR/token/notas.
7. Só criar permissão por módulo com caso real.

### Sprint 46 — painel interno LibGuest

Ambiente separado para provisionar hotéis, `brand_code`, módulos, usuários globais, planos, governança e auditoria central. Não misturar com o CRUD operacional do hotel.

### Sprint 47 — onboarding multi-hotel

Modelar usuário↔hotéis, `allowed_hotels`, contexto ativo/default, troca, revogação e testes de acesso cruzado/deep link; integrar ao painel interno sem reconstruir CRUDs.

## 11. Módulos que não precisam ser reconstruídos

Dashboard, serviços/Thex, departamentos, políticas, comunicados/agendamento, banners/agendamento/tradução/mídia/preview, PT/EN/ES, identidade/presets, apartamentos/QR, usuários/papéis básicos, subdomínio/slug fallback, shell responsivo, estados vazios, loading, erro e toasts.

Lacunas reais: multi-hotel, painel interno, custom domain futuro, auditoria persistente e integridade/escala de analytics. Biblioteca de mídia, edição manual de tradução e permissão por módulo permanecem condicionadas a demanda comprovada.

## 12. Restrições cumpridas

- código funcional alterado: nenhum;
- SQL executado: nenhum;
- migration/schema/RLS/dados: nenhuma alteração;
- roomTokens: nenhuma alteração;
- commit, push, merge, deploy ou stash: não realizados;
- Sprint 44: não iniciada.
