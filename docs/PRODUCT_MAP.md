# PRODUCT MAP

Documento vivo para manter uma fonte única de verdade sobre a evolução do produto, decisões técnicas, branding, domínios, processo de trabalho e próximos ciclos.

Importante:
- Produto atual: `LibGuest`
- Nome anterior/legado: `GuestDesk`
- Domínio operacional atual: `guestdesk.digital`
- Status do domínio: operacional por enquanto, mas pendente de decisão futura de rebranding/domínio
- Assinatura institucional atual: temporariamente neutralizada
- Assinatura legada: `GuestDesk by BLID Tecnologia`

## 1. Product identity

### Nome do produto
- Nome principal atual: `LibGuest`
- Nome anterior/legado: `GuestDesk`
- Assinatura institucional/comercial atual: neutralizada temporariamente, com uso preferencial de `LibGuest`
- Assinatura legada: `GuestDesk by BLID Tecnologia`
- Domínio operacional atualmente configurado: `guestdesk.digital`

### O que o produto é
- Plataforma de diretório digital para hotelaria com painel administrativo e experiência pública para hóspedes.
- Produto orientado a operação hoteleira, apresentação digital e clareza da jornada do hóspede.

### O que o produto entrega hoje
- Painel administrativo protegido por autenticação.
- Gestão de dados principais do hotel.
- Gestão de serviços, departamentos e políticas.
- Página pública do hotel.
- Tradução salva em PT -> EN/ES no momento do save.
- Analytics básicos da experiência pública.
- Resolução pública por slug e por subdomínio de produto.
- Theming controlado do hotel na experiência pública.

### Público principal
- Decisores de hotel.
- Equipes operacionais.
- Times de recepção, atendimento e gestão.
- Uso comercial para demo, portfólio e apresentação.

## 2. Current architecture

### Stack principal
- Next.js com App Router.
- Tailwind CSS.
- Supabase Auth.
- Supabase Database.
- Supabase Storage.
- Google Cloud Translation para save-time translation.

### Estrutura funcional
- `app/admin/*`: painel administrativo.
- `app/hotel/[slug]/*`: fallback público por slug.
- `app/page.tsx`: landing do produto ou raiz pública do hotel quando resolvido por subdomínio de produto.
- `app/servicos/[id]/page.tsx`: detalhe interno de serviço na experiência por subdomínio.

### Blocos importantes da arquitetura
- `lib/domain-context.ts`: leitura e classificação de host/domínio.
- `lib/public-hotel-data.ts`: loaders compartilhados da experiência pública.
- `lib/public-routes.ts`: geração de links públicos com compatibilidade entre slug e subdomínio.
- `lib/service-destinations.ts`: lógica de CTA/destino de serviços.
- `lib/services/translation-service.ts`: integração server-only com tradução.
- `lib/hotel-theme.ts`: presets visuais e override seguro de acento.
- `lib/hotel-subdomain.ts`: validação e normalização de subdomínio do hotel.

### Arquitetura pública atual
- Root domain do produto mostra landing.
- Subdomínio de produto pode resolver um hotel.
- Slug continua sendo fallback público seguro.
- Detalhe interno de serviço funciona tanto em slug quanto em subdomínio.

## 3. Current domains and host behavior

### Estado atual
- `guestdesk.digital`: domínio operacional atual do produto.
- `www.guestdesk.digital`: tratado como root do produto.
- `{subdomain}.guestdesk.digital`: resolve hotel quando houver correspondência.
- `/hotel/[slug]`: fallback público por slug.
- `/hotel/[slug]/servicos/[id]`: detalhe de serviço por slug.
- `/servicos/[id]`: detalhe de serviço quando a experiência está sendo servida no subdomínio do hotel.

### Status de naming e domínio
- O produto ativo deve ser tratado como `LibGuest`.
- `GuestDesk` deve ser tratado como naming legado.
- `guestdesk.digital` permanece operacional por compatibilidade e continuidade.
- A decisão final de domínio público futuro ainda está em aberto e pode acompanhar o rebranding.

### Regra atual de resolução
1. Se o host for root do produto, mostrar landing.
2. Se o host for subdomínio candidato do produto:
   - tentar resolver por `hotels.subdomain`
   - se não encontrar, tentar fallback por `hotels.slug`
3. Se não houver match, retornar `404` no contexto de subdomínio.
4. As rotas por slug continuam válidas e independentes do subdomínio.

### Limites atuais
- Ainda não existe custom domain por cliente.
- Ainda não existe painel de gestão de domínios.
- Ainda não existe canonical host management completo.
- A foundation para custom domains agora está documentada, mas segue deliberadamente inativa.

## 4. Working process with ChatGPT, Codex, and Cursor

### Papel de cada ferramenta
- ChatGPT:
  - estratégia de produto
  - definição de sprint
  - priorização
  - arquitetura de alto nível
  - copy e direcionamento comercial
- Codex:
  - implementação
  - hotfixes
  - documentação
  - validação local
  - ajustes incrementais orientados a segurança
- Cursor:
  - apoio visual
  - direção de UI refinada
  - comparação de densidade/ritmo/layout
  - ajuda em iterações de interface

### Forma de trabalho recomendada
1. Definir objetivo e restrições da sprint.
2. Fazer análise de arquivos exatos antes de editar.
3. Implementar em branch de preview.
4. Validar em preview/Vercel.
5. Só depois considerar merge para `main`.

### Regras que têm funcionado bem
- mudanças incrementais
- evitar refatorações amplas
- preservar comportamento estável validado
- separar sprint de produto, hotfix de regressão e sprint de documentação
- usar documentação curta e operacional

## 5. Closed sprints summary

### Sprint 1
- Hardening inicial.
- Escopo seguro de ações por `id` + `hotel_id`.
- Helper mínimo de admin/auth.
- Primeiros utilitários leves de parsing/normalização.

### Sprint 2
- Landing inicial do produto.
- Login com visual mais premium.
- Active state no admin.
- Primeira camada de polish visual.

### Sprint 2.1
- Consolidação visual/admin.
- Pequenos componentes reutilizáveis de UI admin.
- Mais consistência de superfícies, listas e empty states.

### Sprint 3
- Visibilidade de status de tradução no admin.
- Retranslate manual.
- Melhor feedback não bloqueante de falha de tradução.

### Sprint 4
- Acabamento comercial.
- Naming e branding mais consistentes.
- Assinatura legada `GuestDesk by BLID Tecnologia`.

### Sprint 5
- Documentação operacional em `docs/`.
- Deploy, ambiente, onboarding, admin guide e workflow.

### Sprint 6
- Busca/filtro no admin para serviços, departamentos e políticas.
- Melhorias de usabilidade diária do painel.

### Sprint 7
- Base comercial em `docs/commercial/`.

### Sprint 8
- Robustez técnica.
- Validação e redução de falhas previsíveis.
- Hardening de envs e fluxos críticos.

### Sprint 9
- Base de analytics da experiência pública.
- Eventos importantes salvos em banco.

### Sprint 9.1
- Analytics visíveis no admin dashboard.
- Filtro de período e leitura gerencial leve.

### Sprint 9.x refinements
- Sessão, deduplicação e cooldown mais inteligentes para analytics.

### Sprint 10
- Onboarding/admin guidance in-product.
- Help text e empty states mais claros.

### Sprint 11
- Expansão do kit comercial com materiais mais reutilizáveis.

### Sprint 12
- Evolução leve de leitura analítica para gestão.

### Sprint 13
- Refinamento premium de UI.

### Sprint 13.1
- Theming seguro por hotel com presets premium + override controlado.

### Sprint 14
- Usuários e permissões básicas por papel.
- Área de usuários no admin.

### Sprint 14.1
- Guided service creation.
- Ícones e categorias guiadas.

### Sprint 15
- Smart service destinations.
- Páginas internas de detalhe de serviço.

### Sprint 15.1
- Reconstrução visual da página `/admin/servicos`.

### Sprint 16
- Cobertura de tradução pública mais completa.
- Melhor coerência de fallback PT/EN/ES.

### Sprint 17
- Fundação de landing/domain presence para `guestdesk.digital`.

### Sprint 18
- Fundação técnica para host/subdomain behavior.

### Sprint 19
- Refinamento comercial e narrativo da landing.

### Sprint 20
- Resolução real de hotel por subdomínio do produto.
- Root domain preservado.
- Fallback por slug preservado.

### Sprint 21
- Campo dedicado de subdomínio por hotel.
- Admin management de subdomínio.
- Resolução pública agora prefere `subdomain` e cai para `slug`.

### Sprint 21.0.1
- Rebranding controlado para `LibGuest`.
- Atualização de naming visível em landing, login, admin, metadata e elementos institucionais.
- `guestdesk.digital` preservado como domínio operacional atual por compatibilidade.

### Sprint 21.1
- Polish do admin de subdomínio.
- Feedback visual consistente para estado vazio, válido, inválido e reservado.
- Prévia mais clara da URL pública principal em `https://{subdomain}.guestdesk.digital`.
- Reforço operacional de que `guestdesk.digital` segue como domínio atual e a rota por slug continua como fallback seguro.

### Sprint 21.2
- Hardening operacional leve do fluxo de subdomínio.
- Correção da decisão de navegação pública para preferir o subdomínio dedicado do hotel quando configurado.
- Validação revisada para casos comuns de erro de entrada, sem alterar a arquitetura principal.

### Sprint 22
- Canonical host strategy leve sem redirects agressivos.
- Regras de root domain, `www` e subdomínio candidato centralizadas em helpers reutilizáveis.
- Comportamento público preservado: landing no root, hotel no subdomínio e fallback por slug obrigatório.

### Sprint 23
- Leitura de analytics orientada à gestão no dashboard admin.
- Microcopy mais clara para interpretar visualizações, interações e interesse por idioma/departamento.
- Estados vazios mais úteis e leitura executiva sem transformar a área em dashboard pesado.

### Sprint 24
- Refinamento do onboarding de hotel novo em `/admin/hotel`.
- Clareza maior sobre identidade do hotel, slug como fallback, subdomínio preferencial e tema visual público.
- Checklist operacional leve para preparar a validação da experiência pública.

### Sprint 25
- Foundation leve para custom domains sem ativação.
- Classificação de host do produto centralizada para reduzir risco futuro.
- Documentação técnica curta criada para separar estado atual de preparação futura.

### Sprint 26
- Cobertura documental mais madura para handoff de cliente.
- Checklist central de entrega criado para separar validação técnica, revisão do cliente e acompanhamento inicial.
- Documentação operacional conectada entre onboarding, deploy, pós-deploy e operação diária.

## 6. Closed hotfixes summary

### Hotfixes recorrentes já tratados
- Correções de texto corrompido/UTF-8 em páginas públicas e admin.
- Correção de nested button no mobile menu do admin.
- Correções de hidratação e props server/client em navegação.
- Ajustes em `next/image` quando um uso específico causava regressão.
- Correções em overlays/modais presos no fluxo de usuários/admin.
- Correções de responsividade e overflow em cards e listas.
- Fixes incrementais em analytics reading e deduplicação.
- Hotfix pré-Sprint-21 para resiliência visual dos cards de serviço público no mobile.

### Observação
- O histórico detalhado de cada hotfix pode ser expandido neste arquivo quando necessário, mas a intenção é manter o mapa operacional e enxuto.

## 7. Important technical decisions

### Decisões já tomadas
- Português é a língua canônica.
- Tradução acontece no save, não no page visit.
- EN/ES vivem em translation tables, não nas tabelas principais.
- Fallback para PT é obrigatório quando tradução estiver ausente.
- O produto não usa framework pesado de validação neste momento.
- O produto evita refatorações amplas sem necessidade real.
- UI pública e admin seguem evolução incremental, não redesign amplo.
- Theming público é controlado por presets, não por editor visual livre.
- Slug permanece como fallback seguro.
- Subdomínio agora é identificador público preferencial quando configurado.

### Decisões deliberadamente adiadas
- custom domains por cliente
- editor manual de traduções
- filas/workers de tradução
- permission matrix complexa
- multi-tenant completo por host/custom domain
- dashboard analítico pesado

## 8. Supabase/security status

### Status geral
- Auth com Supabase.
- Profiles vinculados a `hotel_id`.
- Proteção admin/roles já existente.
- Save actions críticas endurecidas com scoping por `id` + `hotel_id`.

### Banco atual
- tabelas principais de hotel, seções, departamentos e políticas
- translation tables para seções, departamentos e políticas
- eventos de analytics públicos
- perfis com papel e status ativo
- campos de tema do hotel
- campo dedicado de subdomínio do hotel

### Pontos de segurança já cobertos
- API keys de tradução mantidas server-only.
- Tradução não bloqueia publicação em PT.
- Políticas de leitura de analytics por hotel já adicionadas.
- Validação de subdomínio e restrição de nomes reservados.

### Pontos a observar
- revisar periodicamente políticas RLS
- revisar uso de `service_role`
- acompanhar warnings de `img`
- manter validação mínima consistente nas actions

## 9. Branding/naming status

### Naming ativo
- Produto: `LibGuest`
- Assinatura institucional atual: neutralizada temporariamente
- Naming legado: `GuestDesk`
- Assinatura legada: `GuestDesk by BLID Tecnologia`

### Regras atuais
- `LibGuest` deve ser tratado como nome principal do produto.
- `GuestDesk` deve ser tratado como nome anterior/legado.
- `guestdesk.digital` continua válido operacionalmente até decisão futura sobre domínio/rebranding.
- O produto deve aparecer prioritariamente apenas como `LibGuest` até decisão futura sobre assinatura institucional.
- `GuestDesk by BLID Tecnologia` deve ser tratado como branding legado.

### Sprint 21.3
- Neutralização da assinatura institucional visível ligada a `BLID Tecnologia`.
- `LibGuest` passa a ser a marca principal nas superfícies visíveis e materiais comerciais atuais.
- `BLID Tecnologia` permanece apenas em contexto legado, histórico ou interno bem explicado.

### Estado atual de branding
- landing já orientada a produto comercial
- interface principal já exibe `LibGuest` como nome ativo do produto
- domínio atual ainda reflete o naming anterior
- branding está em fase de transição controlada de `GuestDesk` para `LibGuest`

### Registro curto da Sprint 21.0.1
- Status: concluída
- Objetivo: atualizar o naming visível do produto para `LibGuest` sem alterar domínio, rotas ou comportamento validado
- Arquivos alterados:
  - `app/layout.tsx`
  - `app/page.tsx`
  - `app/login/page.tsx`
  - `app/admin/layout.tsx`
  - `app/admin/page.tsx`
  - `app/admin/servicos/page.tsx`
  - `app/admin/servicos/[id]/page.tsx`
  - `app/admin/usuarios/page.tsx`
  - `app/admin/hotel/page.tsx`
  - `components/admin/mobile-menu.tsx`
  - `components/public/hotel-public-page-content.tsx`
  - `components/public/hotel-service-detail-content.tsx`
  - `lib/hotel-theme.ts`
  - `docs/PRODUCT_MAP.md`
- Validação realizada:
  - `npm run lint`
  - `npm run build` com falha local recorrente em `spawn EPERM` após compilação
- Pendências conhecidas:
  - base documental/comercial legada ainda contém várias referências históricas a `GuestDesk`
  - domínio operacional continua em `guestdesk.digital`
- Próximo passo recomendado: `Sprint 21.1`

### Registro curto da Sprint 21.1
- Status: concluída
- Objetivo: melhorar clareza operacional, ajuda contextual e validação visual do campo de subdomínio em `/admin/hotel` sem alterar a arquitetura principal de host/subdomínio
- Arquivos alterados:
  - `app/admin/hotel/page.tsx`
  - `components/admin/hotel-subdomain-field.tsx`
  - `lib/hotel-subdomain.ts`
  - `lib/domain-context.ts`
  - `lib/product-domain.ts`
  - `docs/PRODUCT_MAP.md`
- Validação realizada:
  - `npm run lint`
  - `npm run build` com falha local recorrente em `spawn EPERM` após compilação
- Pendências conhecidas:
  - ainda não existe canonical host management completo
  - custom domains por cliente seguem fora do escopo
- Próximo passo recomendado: `Sprint 21.2`

### Registro curto da Sprint 21.2
- Status: concluída
- Objetivo: validar operacionalmente a base de subdomínio e corrigir pequenos edge cases antes da Sprint 22 de canonical host strategy
- Arquivos alterados:
  - `app/admin/hotel/actions.ts`
  - `components/admin/hotel-subdomain-field.tsx`
  - `components/public/hotel-public-page-content.tsx`
  - `components/public/hotel-service-detail-content.tsx`
  - `lib/hotel-subdomain.ts`
  - `lib/public-routes.ts`
  - `docs/PRODUCT_MAP.md`
- Validação realizada:
  - `npm run lint`
  - `npm run build` com falha local recorrente em `spawn EPERM` após compilação
  - busca por `libguest.digital` sem ocorrência encontrada
  - confirmação de `guestdesk.digital` preservado nos pontos esperados
  - revisão orientada por helper para casos de entrada: vazio, válido, reservado, maiúsculas, espaços, acentos, caracteres especiais e hífen nas pontas
- Pendências conhecidas:
  - canonical host strategy segue fora do escopo desta sprint
  - validação manual em preview ainda é recomendada para confirmar host real `{subdomain}.guestdesk.digital`
  - há textos mojibake remanescentes em áreas antigas do projeto fora do fluxo de subdomínio
- Próximo passo recomendado: `Sprint 22`

### Registro curto da Sprint 21.3
- Status: concluída
- Objetivo: neutralizar a assinatura institucional ativa ligada a `BLID Tecnologia`, mantendo `LibGuest` como marca principal sem alterar comportamento funcional
- Arquivos alterados:
  - `app/admin/layout.tsx`
  - `app/login/page.tsx`
  - `app/page.tsx`
  - `components/admin/mobile-menu.tsx`
  - `components/public/hotel-public-page-content.tsx`
  - `docs/commercial/guestdesk-commercial-faq.md`
  - `docs/commercial/guestdesk-commercial-outline.md`
  - `docs/commercial/guestdesk-demo-script.md`
  - `docs/commercial/guestdesk-executive-onepager.md`
  - `docs/commercial/guestdesk-outreach-templates.md`
  - `docs/commercial/guestdesk-positioning.md`
  - `docs/commercial/guestdesk-product-description.md`
  - `docs/commercial/guestdesk-proposal-blocks.md`
  - `docs/commercial/guestdesk-screenshot-plan.md`
  - `docs/commercial/guestdesk-value-proposition-variants.md`
  - `docs/PRODUCT_MAP.md`
- Validação realizada:
  - `npm run lint`
  - `npm run build` com falha local recorrente em `spawn EPERM` após compilação
- Pendências conhecidas:
  - definição futura da assinatura institucional/empresa ainda está em aberto
  - `BLID Tecnologia` permanece apenas como referência legada/interna documentada
- Próximo passo recomendado: `Sprint 22`

### Registro curto da Sprint 22
- Status: concluída
- Objetivo: organizar a estratégia de host/canonical com helpers leves e seguros, sem alterar o domínio operacional e sem ativar redirects agressivos
- Arquivos alterados:
  - `lib/product-domain.ts`
  - `lib/domain-context.ts`
  - `lib/public-routes.ts`
  - `app/page.tsx`
  - `app/servicos/[id]/page.tsx`
  - `docs/PRODUCT_MAP.md`
- Validação realizada:
  - `npm run lint`
  - `npm run build` com falha local recorrente em `spawn EPERM` após compilação
  - busca por `libguest.digital`
  - confirmação de `guestdesk.digital` preservado
- Pendências conhecidas:
  - redirects canônicos continuam deliberadamente desativados
  - custom domains seguem fora do escopo
  - validação manual em preview ainda é recomendada para `guestdesk.digital`, `www.guestdesk.digital`, `{subdomain}.guestdesk.digital` e rotas por slug
- Próximo passo recomendado: `Sprint 23`

### Registro curto da Sprint 23
- Status: concluída
- Objetivo: melhorar a leitura gerencial dos analytics no admin com blocos mais claros, explicações operacionais e estados vazios mais úteis, sem alterar a base técnica sensível
- Arquivos alterados:
  - `app/admin/page.tsx`
  - `docs/PRODUCT_MAP.md`
- Validação realizada:
  - `npm run lint`
  - `npm run build` com falha local recorrente em `spawn EPERM` após compilação
  - busca por `libguest.digital`
  - confirmação de `guestdesk.digital` preservado
- Pendências conhecidas:
  - analytics continuam leves e executivos, sem detalhamento por serviço porque esse evento ainda não existe na base atual
  - validação manual do dashboard com período e dados reais ainda é recomendada em preview
- Próximo passo recomendado: `Sprint 24`

### Registro curto da Sprint 24
- Status: concluída
- Objetivo: melhorar a clareza do onboarding/configuração inicial de um hotel no admin, especialmente sobre identidade, slug, subdomínio, domínio operacional e tema visual
- Arquivos alterados:
  - `app/admin/hotel/page.tsx`
  - `components/admin/hotel-subdomain-field.tsx`
  - `docs/guestdesk-new-hotel-playbook.md`
  - `docs/PRODUCT_MAP.md`
- Validação realizada:
  - `npm run lint`
  - `npm run build` com falha local recorrente em `spawn EPERM` após compilação
  - busca por `libguest.digital`
  - confirmação de `guestdesk.digital` preservado
- Pendências conhecidas:
  - ainda não existe wizard estruturado de múltiplas etapas para onboarding, por decisão de escopo
  - validação manual em preview continua recomendada para `/admin/hotel`, subdomínio, tema e rota pública por slug
- Próximo passo recomendado: `Sprint 25`

### Registro curto da Sprint 25
- Status: concluída
- Objetivo: preparar a base técnica e documental para custom domains no futuro sem ativar custom domains agora e sem alterar o comportamento público já validado
- Arquivos alterados:
  - `lib/product-domain.ts`
  - `lib/domain-context.ts`
  - `docs/guestdesk-custom-domain-foundation.md`
  - `docs/guestdesk-overview.md`
  - `docs/PRODUCT_MAP.md`
- Decisões importantes:
  - `guestdesk.digital` continua sendo o domínio operacional atual
  - `www.guestdesk.digital` continua tratado como root do produto
  - hosts externos continuam classificados como desconhecidos/não suportados, sem ativação de custom domain
  - nenhuma estratégia de redirect foi ativada nesta sprint
- Validação realizada:
  - `npm run lint`
  - `npm run build` com falha local recorrente em `spawn EPERM` após compilação
  - busca por `libguest.digital`
  - confirmação de `guestdesk.digital` preservado
- Pendências conhecidas:
  - custom domains seguem inativos
  - ainda não existe associação explícita de host externo a hotel
  - canonical redirects seguem fora do escopo
- Próximo passo recomendado: `Sprint 26`

### Registro curto da Sprint 26
- Status: concluída
- Objetivo: melhorar a documentação operacional e o material de handoff para entrega, revisão e validação de um cliente/hotel sem alterar comportamento do produto
- Arquivos alterados:
  - `docs/README.md`
  - `docs/guestdesk-client-handoff.md`
  - `docs/guestdesk-new-hotel-playbook.md`
  - `docs/guestdesk-post-deploy-validation.md`
  - `docs/guestdesk-admin-guide.md`
  - `docs/guestdesk-deploy-checklist.md`
  - `docs/PRODUCT_MAP.md`
- Validação realizada:
  - revisão dos arquivos alterados
  - confirmação de que nenhuma migration foi criada
  - confirmação de que nenhum arquivo sensível de host/domínio foi alterado
  - busca por `libguest.digital`
  - confirmação de `guestdesk.digital` preservado
- Pendências conhecidas:
  - o handoff continua assistido e ainda não existe fluxo automatizado de aprovação do cliente
  - custom domains seguem inativos e fora da entrega operacional atual
- Próximo passo recomendado: `Sprint 27`

## 10. Known pending items

### Produto e arquitetura
- custom domains por cliente
- canonical host e redirects estratégicos
- gestão completa de domínios no admin

### Tradução
- tradução de mais superfícies públicas auxiliares quando necessário
- eventual UI manual de edição de tradução
- controle mais refinado de status por campo

### Admin
- refinamentos adicionais de usabilidade em módulos específicos
- melhoria contínua de densidade/ritmo de páginas sensíveis
- onboarding de hotel novo ainda pode evoluir no futuro sem virar wizard pesado

### Analytics
- leitura mais executiva sem virar dashboard pesado
- possíveis resumos por hotel/período mais sofisticados

### Robustez
- investigar a causa raiz do `spawn EPERM` no build local
- revisar warnings pendentes de `img`
- limpeza de imports não usados em arquivos remanescentes

## 11. Roadmap from Sprint 21.1 to Sprint 35

### Sprint 21.1
- concluída: polish do admin de subdomínio com feedback visual e ajuda operacional refinada

### Sprint 21.2
- concluída: validação operacional e hardening leve do fluxo de subdomínio

### Sprint 22
- concluída: canonical host strategy leve com helpers centralizados e sem redirects agressivos

### Sprint 23
- concluída: melhoria de analytics orientada à leitura por gestão com blocos mais claros de interpretação e uso

### Sprint 24
- concluída: refinamento do onboarding de hotel novo com subdomínio, slug fallback e tema visual

### Sprint 25
- concluída: preparo de foundation para custom domains sem ativação completa

### Sprint 26
- concluída: maior cobertura operacional/documental para handoff de cliente

### Sprint 27
- refinamento do fluxo de tradução e visibilidade operacional

### Sprint 28
- melhorias leves de mídia/identidade visual do hotel, se seguras

### Sprint 29
- expansão controlada de permissões por papel, se houver necessidade real

### Sprint 30
- camada leve de qualidade/observabilidade para erros e eventos importantes

### Sprint 31
- melhorias de comercial/demo mode e material de showcase do produto

### Sprint 32
- primeira fase segura de custom domain management

### Sprint 33
- canonical redirects e política de host principal

### Sprint 34
- hardening avançado de operação multi-hotel sem abrir refactor amplo

### Sprint 35
- consolidação para readiness mais madura de produto/SaaS hotel-tech

### Nota de roadmap
- Este roadmap é direcional e pode ser repriorizado.
- Nenhuma sprint futura deve remover fallback por slug sem uma transição explícita e validada.

## 12. Standard branch/deploy workflow

### Fluxo recomendado
1. `main` permanece estável.
2. Cada sprint trabalha em branch dedicada.
3. Implementação e validação ocorrem primeiro em preview.
4. Hotfixes pequenos continuam preferindo mudanças locais e seguras.
5. Só depois de validado em preview considerar merge para `main`.

### Convenção prática
- branch por sprint ou hotfix
- validação local
- validação em preview
- revisão final
- merge

### Checklist curto por entrega
- confirmar escopo e restrições
- listar arquivos a alterar antes de editar
- implementar incrementalmente
- validar `lint`, `tsc` e `build` quando possível
- registrar decisões relevantes em docs

## Como atualizar este arquivo

Atualizar após:
- fechamento de sprint
- hotfix importante
- mudança de domínio/host behavior
- mudança de branding/naming
- decisão arquitetural relevante
- alteração de fluxo operacional

Regra de manutenção:
- preferir atualização curta e objetiva
- preservar histórico resumido
- evitar transformar este arquivo em changelog detalhado de código

## Regra fixa de manutenção desta documentação

Este arquivo deve ser atualizado depois de toda sprint, hotfix ou decisão relevante de produto sempre que a mudança afetar pelo menos um destes pontos:

- estado atual do produto
- status de sprint
- roadmap
- branding/naming
- domínios e comportamento de host
- Supabase/segurança
- arquitetura
- workflow operacional
- pendências conhecidas

Mudanças pequenas e estritamente de implementação não precisam atualizar este documento quando:

- não alteram o estado do produto
- não geram decisão importante
- não criam observação operacional relevante
- não mudam prioridades, comportamento público ou arquitetura

Em toda atualização futura deste arquivo, incluir quando aplicável:

- nome da sprint ou hotfix
- status
- arquivos alterados, quando for relevante para contexto
- decisões importantes
- resultado de validação
- pendências conhecidas
- próximo passo recomendado
