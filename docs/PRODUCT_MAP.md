# PRODUCT MAP

Documento vivo para manter uma fonte única de verdade sobre a evolução do produto, decisões técnicas, branding, domínios, processo de trabalho e próximos ciclos.

Importante:
- Produto atual: `LibGuest`
- Nome anterior/legado: `GuestDesk`
- Domínio principal atual: `libguest.digital`
- Domínio legado/transição: `guestdesk.digital`
- Status de domínio: suporte dual-domain ativo, sem redirect obrigatório nesta fase
- Assinatura institucional atual: temporariamente neutralizada
- Assinatura legada: `GuestDesk by BLID Tecnologia`

## 1. Product identity

### Nome do produto
- Nome principal atual: `LibGuest`
- Nome anterior/legado: `GuestDesk`
- Assinatura institucional/comercial atual: neutralizada temporariamente, com uso preferencial de `LibGuest`
- Assinatura legada: `GuestDesk by BLID Tecnologia`
- Domínio principal atualmente configurado: `libguest.digital`
- Domínio legado/transição: `guestdesk.digital`

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
- `libguest.digital`: domínio principal atual do produto.
- `www.libguest.digital`: tratado como root do produto.
- `{subdomain}.libguest.digital`: resolve hotel quando houver correspondência e é o formato preferencial para links novos.
- `guestdesk.digital`: domínio legado/transição ainda aceito.
- `www.guestdesk.digital`: tratado como root legado do produto.
- `{subdomain}.guestdesk.digital`: continua funcionando durante a transição.
- `/hotel/[slug]`: fallback público por slug.
- `/hotel/[slug]/servicos/[id]`: detalhe de serviço por slug.
- `/servicos/[id]`: detalhe de serviço quando a experiência está sendo servida no subdomínio do hotel.

### Status de naming e domínio
- O produto ativo deve ser tratado como `LibGuest`.
- `GuestDesk` deve ser tratado como naming legado.
- `libguest.digital` passa a ser o domínio principal/preferencial.
- `guestdesk.digital` permanece operacional por compatibilidade e continuidade.
- Nesta fase não existem redirects canônicos obrigatórios entre os dois domínios.

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

### Sprint 27
- Refinamento da visibilidade operacional de tradução no admin.
- Leitura mais clara sobre PT como conteúdo fonte, EN/ES gerados no save e fallback em português.
- Badges, status e microcopy alinhados entre serviços, departamentos e políticas.

### Sprint 28
- Refinamento leve da identidade visual/mídia do hotel no admin e na experiência pública.
- Explicação mais clara sobre logo, preset visual, cor de acento e fallback seguro sem mídia.
- Boas práticas documentadas para revisão visual em celular e desktop.

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

### Registro curto da Sprint 27
- Status: concluída
- Objetivo: melhorar a visibilidade operacional do fluxo de tradução no admin sem alterar a arquitetura principal de tradução
- Arquivos alterados:
  - `components/admin/ui.tsx`
  - `lib/services/translation-admin.ts`
  - `app/admin/servicos/page.tsx`
  - `app/admin/servicos/[id]/page.tsx`
  - `app/admin/departamentos/page.tsx`
  - `app/admin/departamentos/[id]/page.tsx`
  - `app/admin/politicas/page.tsx`
  - `app/admin/politicas/[id]/page.tsx`
  - `docs/PRODUCT_MAP.md`
- Validação realizada:
  - `npm run lint`
  - `npx tsc --noEmit`
  - `npm run build` com falha local recorrente em `spawn EPERM` após compilação
  - busca por `libguest.digital`
  - confirmação de `guestdesk.digital` preservado
- Pendências conhecidas:
  - a arquitetura de tradução continua intencionalmente simples, sem editor manual e sem filas
  - a falha de tradução continua não bloqueante e depende de retradução manual quando necessário
- Próximo passo recomendado: `Sprint 28`

### Registro curto da Sprint 28
- Status: concluída
- Objetivo: melhorar a clareza e a consistência da identidade visual/mídia do hotel sem criar editor visual complexo e sem alterar a arquitetura sensível
- Arquivos alterados:
  - `app/admin/hotel/page.tsx`
  - `components/public/hotel-public-page-content.tsx`
  - `components/public/hotel-service-detail-content.tsx`
  - `docs/guestdesk-new-hotel-playbook.md`
  - `docs/guestdesk-client-handoff.md`
  - `docs/PRODUCT_MAP.md`
- Validação realizada:
  - `npm run lint`
  - `npm run build` com falha local recorrente em `spawn EPERM` após compilação
  - busca por `libguest.digital`
  - confirmação de `guestdesk.digital` preservado
- Pendências conhecidas:
  - a experiência continua usando apenas logo e tema já existentes, sem editor visual mais avançado
  - validação manual em preview continua recomendada para estado com logo, sem logo e revisão mobile
- Próximo passo recomendado: `Sprint 29`

### Registro curto da Sprint 29
- Status: concluÃ­da
- Objetivo: melhorar a clareza operacional da Ã¡rea de usuÃ¡rios e documentar melhor o modelo atual de papÃ©is e proteÃ§Ãµes, sem alterar auth, schema ou RLS
- Arquivos alterados:
  - `app/admin/usuarios/page.tsx`
  - `app/admin/usuarios/[id]/page.tsx`
  - `docs/guestdesk-admin-guide.md`
  - `docs/PRODUCT_MAP.md`
- ValidaÃ§Ã£o realizada:
  - `npm run lint`
  - `npm run build` com falha local recorrente em `spawn EPERM` apÃ³s compilaÃ§Ã£o
  - busca por `libguest.digital`
  - confirmaÃ§Ã£o de `guestdesk.digital` preservado
- PendÃªncias conhecidas:
  - o modelo de permissÃµes continua intencionalmente simples, sem super-admin, multi-hotel ou matriz avanÃ§ada
  - mensagens de acesso negado seguem centralizadas no redirect seguro para `/login`
- PrÃ³ximo passo recomendado: `Sprint 30`

### Registro curto da Sprint 30
- Status: concluída
- Objetivo: padronizar feedback operacional, adicionar logs curtos de servidor e documentar o diagnóstico de falhas importantes sem criar infraestrutura nova
- Arquivos alterados:
  - `app/admin/hotel/actions.ts`
  - `app/admin/hotel/upload-logo-action.ts`
  - `app/admin/servicos/actions.ts`
  - `app/admin/departamentos/actions.ts`
  - `app/admin/politicas/actions.ts`
  - `app/admin/usuarios/actions.ts`
  - `app/admin/usuarios/[id]/actions.ts`
  - `lib/services/translation-admin.ts`
  - `lib/services/translation-service.ts`
  - `docs/guestdesk-admin-guide.md`
  - `docs/guestdesk-post-deploy-validation.md`
  - `docs/PRODUCT_MAP.md`
- Validação realizada:
  - `npm run lint`
  - `npx tsc --noEmit`
  - `npm run build` com falha local recorrente em `spawn EPERM` após compilação
  - busca por `libguest.digital`
  - confirmação de `guestdesk.digital` preservado
- Pendências conhecidas:
  - a observabilidade continua intencionalmente leve, sem dashboard externo, tabela de logs ou ferramenta dedicada
  - ainda existem mensagens antigas fora deste fluxo que podem ser refinadas em sprints futuras
- Próximo passo recomendado: `Sprint 31`

### Registro curto da Sprint 31
- Status: concluÃ­da
- Objetivo: criar comunicados gerais pÃºblicos do hotel com gestÃ£o simples no admin, sem entrar em chat, login de hÃ³spede ou mensagens individuais
- Arquivos alterados:
  - `supabase/migrations/20260426_add_hotel_announcements.sql`
  - `types/database.ts`
  - `lib/services/translation-service.ts`
  - `lib/services/translation-admin.ts`
  - `lib/public-hotel-data.ts`
  - `lib/public-copy.ts`
  - `app/page.tsx`
  - `app/hotel/[slug]/page.tsx`
  - `app/admin/layout.tsx`
  - `components/admin/nav-links.tsx`
  - `components/public/hotel-public-page-content.tsx`
  - `app/admin/comunicados/actions.ts`
  - `app/admin/comunicados/page.tsx`
  - `app/admin/comunicados/[id]/actions.ts`
  - `app/admin/comunicados/[id]/page.tsx`
  - `docs/PRODUCT_MAP.md`
- Migration criada:
  - `hotel_announcements`
  - `hotel_announcement_translations`
- DecisÃµes importantes:
  - PT continua como conteÃºdo fonte/canÃ´nico
  - EN/ES sÃ£o gerados no save e continuam nÃ£o bloqueantes
  - comunicados pÃºblicos sÃ£o sempre filtrados por `hotel_id`, `is_active`, `starts_at` e `ends_at`
  - nÃ£o hÃ¡ mensagem individual, chat, push, login de hÃ³spede ou dados pessoais de hÃ³spedes
- ValidaÃ§Ã£o realizada:
  - `npm run lint`
  - `npx tsc --noEmit`
  - `npm run build` com falha local recorrente em `spawn EPERM` apÃ³s compilaÃ§Ã£o
  - busca por `libguest.digital`
  - confirmaÃ§Ã£o de `guestdesk.digital` preservado
- PendÃªncias conhecidas:
  - nÃ£o existe editor manual de traduÃ§Ã£o para comunicados
  - nÃ£o existe confirmaÃ§Ã£o de leitura individual
  - custom domains, host e analytics pÃºblico continuam fora do escopo desta sprint
- PrÃ³ximo passo recomendado: `Sprint 32`

### Registro curto da Sprint 31.1
- Status: concluÃ­da
- Objetivo: criar um mÃ³dulo separado de banners promocionais do hotel com imagem, CTA, traduÃ§Ã£o no save e carrossel pÃºblico limitado a 3 itens
- Arquivos alterados:
  - `supabase/migrations/20260426_add_hotel_promotional_banners.sql`
  - `types/database.ts`
  - `lib/services/translation-service.ts`
  - `lib/services/translation-admin.ts`
  - `lib/public-hotel-data.ts`
  - `app/page.tsx`
  - `app/hotel/[slug]/page.tsx`
  - `app/admin/layout.tsx`
  - `components/admin/nav-links.tsx`
  - `components/public/hotel-public-page-content.tsx`
  - `components/public/promotional-banner-carousel.tsx`
  - `app/admin/banners/actions.ts`
  - `app/admin/banners/page.tsx`
  - `app/admin/banners/[id]/actions.ts`
  - `app/admin/banners/[id]/page.tsx`
  - `app/admin/banners/upload-image-action.ts`
  - `docs/PRODUCT_MAP.md`
- Migration criada:
  - `hotel_promotional_banners`
  - `hotel_promotional_banner_translations`
- DecisÃµes importantes:
  - bucket reutilizado: `hotel-assets`
  - path de upload: `promotional-banners/{hotel_id}/{banner_id}.{ext}`
  - sem crop automÃ¡tico real nesta sprint; orientaÃ§Ã£o e object-cover foram adotados
  - carrossel pÃºblico sem biblioteca externa e sem autoplay agressivo
  - a experiÃªncia pÃºblica limita a exibiÃ§Ã£o a no mÃ¡ximo 3 banners elegÃ­veis
- ValidaÃ§Ã£o realizada:
  - `npm run lint`
  - `npx tsc --noEmit`
  - `npm run build` com falha local recorrente em `spawn EPERM` apÃ³s compilaÃ§Ã£o
  - busca por `libguest.digital`
  - confirmaÃ§Ã£o de `guestdesk.digital` preservado
- PendÃªncias conhecidas:
  - nÃ£o existe crop/conversÃ£o automÃ¡tica de imagem
  - nÃ£o existe autoplay ou animaÃ§Ã£o mais elaborada no carrossel
  - custom domains, host e dados de hÃ³spedes seguem fora do escopo
- PrÃ³ximo passo recomendado: `Sprint 32`

### Registro curto da Sprint 32
- Status: concluída
- Objetivo: criar QR dinâmico por apartamento com `service_action_type` explícito, contexto mínimo de quarto e redirecionamento server-side do cardápio Thex
- Arquivos alterados:
  - `package.json`
  - `package-lock.json`
  - `supabase/migrations/20260427_add_service_action_type_to_hotel_sections.sql`
  - `supabase/migrations/20260427_add_hotel_room_links.sql`
  - `types/database.ts`
  - `lib/service-action-types.ts`
  - `lib/service-destinations.ts`
  - `lib/room-links.ts`
  - `lib/room-context.ts`
  - `lib/public-copy.ts`
  - `app/r/[roomToken]/route.ts`
  - `app/qr-invalido/page.tsx`
  - `app/admin/layout.tsx`
  - `components/admin/nav-links.tsx`
  - `components/admin/room-qr-card.tsx`
  - `app/admin/apartamentos/page.tsx`
  - `app/admin/apartamentos/actions.ts`
  - `app/admin/servicos/page.tsx`
  - `app/admin/servicos/actions.ts`
  - `app/admin/servicos/[id]/page.tsx`
  - `app/admin/servicos/[id]/actions.ts`
  - `components/public/hotel-public-page-content.tsx`
  - `components/public/hotel-service-detail-content.tsx`
  - `app/servicos/[id]/page.tsx`
  - `app/hotel/[slug]/servicos/[id]/page.tsx`
  - `docs/guestdesk-admin-guide.md`
  - `docs/PRODUCT_MAP.md`
- Migrations criadas:
  - `add_service_action_type_to_hotel_sections`
  - `add_hotel_room_links`
- Decisões importantes:
  - `service_action_type` passa a ser a decisão funcional oficial do serviço
  - serviços existentes permanecem compatíveis com default `standard`
  - o QR do apartamento aponta para o LibGuest em `/r/[roomToken]`
  - o navegador salva apenas `roomToken`, `roomNumber` e `hotelId` quando necessário
  - o `restaurant_menu_url` do apartamento é resolvido no servidor e não fica salvo no navegador
  - não há dados pessoais de hóspedes, pedido, pagamento, login, chat, push, WhatsApp ou PMS
- Validação realizada:
  - `npm run lint`
  - `npx tsc --noEmit`
  - `npm run build` com falha local recorrente em `spawn EPERM` após compilação
  - busca por `libguest.digital`
  - confirmação de `guestdesk.digital` preservado
- Pendências conhecidas:
  - importação em lote de apartamentos continua fora do escopo desta sprint
  - o fluxo de QR foi entregue com preview, cópia de link e download simples, sem dashboard pesado de quartos
  - a operação do cardápio por apartamento depende de `restaurant_menu_url` configurado corretamente em cada quarto
- Próximo passo recomendado: `Sprint 33`

### Registro curto da Sprint 33
- Status: concluída
- Objetivo: habilitar suporte dual-domain com `libguest.digital` como domínio principal/preferencial e `guestdesk.digital` como legado/transição sem redirects obrigatórios
- Arquivos alterados:
  - `lib/product-domain.ts`
  - `lib/domain-context.ts`
  - `lib/hotel-subdomain.ts`
  - `lib/room-links.ts`
  - `app/layout.tsx`
  - `app/page.tsx`
  - `app/admin/hotel/page.tsx`
  - `components/admin/hotel-subdomain-field.tsx`
  - `docs/guestdesk-custom-domain-foundation.md`
  - `docs/guestdesk-overview.md`
  - `docs/PRODUCT_MAP.md`
- Decisões importantes:
  - `PRIMARY_PRODUCT_ROOT_DOMAIN` passa a ser `libguest.digital`
  - `guestdesk.digital` continua aceito como domínio legado/transição
  - requests recebidos em ambos os domínios continuam funcionando
  - novos links e previews gerados pelo sistema passam a preferir `libguest.digital`
  - QRs antigos em `guestdesk.digital/r/[roomToken]` continuam válidos
  - fallback por slug continua preservado
  - não existem redirects canônicos obrigatórios nesta fase
- Validação realizada:
  - `npm run lint`
  - `npx tsc --noEmit`
  - `npm run build`
  - busca por `guestdesk.digital`
  - busca por `libguest.digital`
- Pendências conhecidas:
  - a infraestrutura de DNS/Vercel precisa permanecer com os dois domínios ativos durante a transição
  - redirects/canonical host management seguem para fase posterior
  - custom domains por cliente continuam fora do escopo
- Próximo passo recomendado: `Sprint 34`

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

 - maior clareza futura de estados de acesso negado sem alterar a lÃ³gica central de auth

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
- concluída: refinamento do fluxo de tradução e visibilidade operacional

### Sprint 28
- concluída: melhorias leves de mídia/identidade visual do hotel, se seguras

### Sprint 29
- expansão controlada de permissões por papel, se houver necessidade real

 - concluÃ­da: hardening leve de UX e documentaÃ§Ã£o das permissÃµes atuais, sem ampliar a matriz de papÃ©is

### Sprint 30
- camada leve de qualidade/observabilidade para erros e eventos importantes

 - concluída: padronização leve de feedback operacional, logs curtos de servidor e documentação de diagnóstico

### Sprint 31
- concluÃ­da: comunicados gerais pÃºblicos do hotel com CRUD admin simples, traduÃ§Ã£o no save e fallback em PT

### Sprint 32
- concluída: QR dinâmico por apartamento com `service_action_type` explícito e redirecionamento server-side do cardápio por quarto

### Sprint 33
- concluída: suporte dual-domain com `libguest.digital` como principal e `guestdesk.digital` como legado/transição, sem redirect obrigatório

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
