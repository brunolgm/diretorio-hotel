# Sprint 50 — Experiência Pública / Composição

## Estado encontrado

`/admin/experiencia` já reunia métricas de preparação, um resumo visual hardcoded e o preview público real, mas as abas de aparência, conteúdo e navegação eram placeholders. Não existia persistência de ordem ou visibilidade.

A home pública possuía duas arquiteturas de apresentação. O tema LibGuest default renderizava hero, banners, anúncios, informações rápidas, serviços, departamentos, políticas e links úteis. Grand Mercure, Mercure e Novotel usavam uma composição editorial mais compacta: hero, grade de acessos, banner e atendimento. Tema, conteúdo, lifecycle, entitlements e analytics já tinham contratos independentes.

## Filosofia e catálogo

Composição controla somente ordem e visibilidade. Ela não altera conteúdo, identidade visual, publicação ou direito de uso de módulos. O catálogo TypeScript único `EXPERIENCE_BLOCK_CATALOG` possui oito chaves fechadas:

1. `hero` — obrigatório, identidade principal;
2. `banners` — exige `content.banners`;
3. `announcements` — exige `content.announcements`;
4. `quick_info` — informações e acessos rápidos;
5. `services` — exige `content.services`;
6. `departments` — exige `content.departments`;
7. `policies` — exige `content.policies`;
8. `contact` — atendimento e links úteis.

Footer LibGuest, seletor de idioma, analytics e navegação móvel são estruturais e ficam fora da composição. Não existem variants nesta sprint: os temas atuais não apresentam uma necessidade uniforme que justifique esse contrato. HTML, CSS, JavaScript e labels livres não são persistidos.

Todos os temas percorrem o layout normalizado pelo mesmo compositor. Nos temas editoriais de bandeira, cada conteúdo canônico mantém sua apresentação visual própria e pertence a uma das oito chaves. No tema default, os oito blocos continuam materializados diretamente na home.

O compositor não fornece apresentação visual. Grand Mercure, Mercure e Novotel preservam seus Heroes, grids de atalhos, Destaques e faixas de suporte próprios. Dentro dos grids, os acessos disponíveis são filtrados por conteúdo, entitlement e visibilidade e seguem a ordem lógica do layout; `fb.menu` e `content.tourism` não produzem atalhos enquanto indisponíveis.

As grades temáticas são calculadas somente depois dessa filtragem. No desktop, 1 card fica centralizado e limitado em largura; 2 e 3 cards formam uma linha; 4 formam 2×2; 5 formam 3+2 com a segunda linha centralizada; 6 formam 3×2. Não são criados fillers ou células invisíveis. No mobile, Grand Mercure preserva até três colunas e Mercure/Novotel preservam duas, centralizando a última linha ímpar sem reservar conteúdo inexistente.

`grand-mercure` permanece uma única identidade reutilizável. Cor, tipografia, ornamentos, estrutura e componentes gerais são compartilhados por qualquer hotel da bandeira. A extensão editorial carioca não é um bloco canônico nem conteúdo promocional: no Grand Mercure Rio de Janeiro Copacabana ela é renderizada depois do compositor e antes da faixa estrutural de suporte e do footer/dock. Assim, ocultar ou reordenar `banners` não afeta a extensão e nenhum segundo tema ou preset específico do Rio é necessário.

A propriedade é reconhecida pelo `slug` canônico `grandmercureriocopacabana`. Não existe UUID estável versionado para ela; entre os campos disponíveis, o slug é a identidade única usada pelo roteamento público. O nome exibido não participa da decisão, o subdomínio permanece um alias de acesso e o `brand_code` continua responsável apenas pela seleção normal do tema Grand Mercure.

Os atalhos de Cardápio e Turismo não são renderizados na home nem no dock enquanto `fb.menu` e `content.tourism` permanecerem indisponíveis. As páginas legadas não são promovidas como módulos funcionais e nenhum novo contrato operacional foi criado.

## Persistência e defaults

`hotel_experience_layout` usa uma linha por bloco:

- PK `(hotel_id, block_key)`;
- posição única por hotel, deferrable para reorder atômico;
- CHECK exato das oito chaves;
- hero sempre habilitado;
- `updated_by` e `updated_at` para rastreabilidade.

A migration semeia oito linhas para todo hotel existente. O default do tema LibGuest reproduz a ordem anterior. Hotéis Mercure, Novotel e Grand Mercure recebem a ordem editorial anterior como baseline, e o compositor intercala os demais blocos renderizáveis exatamente nas posições persistidas. Nenhum conteúdo é reescrito.

Se linhas estiverem ausentes, RPCs e TypeScript completam o catálogo com defaults seguros. Blocos opcionais sem conteúdo são omitidos na home default, evitando estados vazios desnecessários.

## Entitlement e onboarding

`experience.navigation` passa de `coming_soon` para `available` e integra o baseline, que passa de 11 para 12 módulos. A decisão evita criar hotéis incapazes de administrar a composição estrutural da própria experiência.

Hotéis existentes recebem o entitlement habilitado. A RPC `create_platform_hotel_onboarding(...)` é evoluída explicitamente: insere as 12 chaves, incluindo `experience.navigation`, e envia `baseline_modules = 12` naturalmente ao writer de `hotel.created`. O writer global permanece somente validador/registrador e não transforma metadata. Um inicializador `AFTER INSERT`, idempotente por `ON CONFLICT`, mantém as oito linhas e o entitlement como proteção para inserts de hotel fora do onboarding; ele não mascara um baseline menor na RPC. As outras sete capacidades futuras permanecem `coming_soon`.

## RPCs e autorização

- `get_current_hotel_experience_layout()` — visualizador ou superior, hotel resolvido por `auth.uid()`;
- `update_current_hotel_experience_block(block_key, enabled)` — editor ou administrador;
- `reorder_current_hotel_experience_blocks(text[])` — editor ou administrador, conjunto exato sem duplicatas;
- `get_public_hotel_experience_layout(hotel_id)` — projeção pública estreita, somente para hotel publicamente ativo.

As quatro RPCs expõem a ordem como `block_position`; a coluna física permanece `hotel_experience_layout.position`. As mutations não recebem `hotel_id`, exigem `experience.navigation`, validam o entitlement do bloco e bloqueiam a desativação do hero. A reordenação usa constraint única deferrable e uma única transação.

## Audit

As mutations chamam o writer hotel-scoped existente na mesma transação:

- `experience.block_enabled`;
- `experience.block_disabled`;
- `experience.layout_updated`.

Metadata é rasa e limitada a `block_key` ou à ordem canônica como string. Nenhum conteúdo completo é copiado para o audit.

O writer hotel-scoped pré-50 não possuía allowlist de actions; ele já validava ator/hotel, metadata rasa e grants. A migration valida esse estado conhecido antes de criar as mutations e não recria nem amplia as permissões do writer. A matriz comportamental comprova que as três novas actions são registradas pelo caminho controlado.

## Admin, preview e mobile

`/admin/experiencia` possui três tabs funcionais: Composição, Aparência e Pré-visualização. Aparência encaminha aos controles existentes do hotel; não cria tema livre.

A composição usa botões acessíveis de subir/descer, adequados a 390 px e 430 px, e toggle mostrar/ocultar. Visualizadores recebem leitura; editores e administradores alteram. Módulos indisponíveis aparecem bloqueados. Após salvar, a composição serializada muda a chave do iframe e recarrega o preview real sandboxed.

## Renderização pública e segurança

O layout é resolvido uma vez junto aos dados públicos. A tabela não possui policy nem grants para browser; anon acessa somente a RPC pública estreita. A renderização combina:

`layout AND entitlement AND conteúdo aplicável AND lifecycle público`.

O layout nunca abre conteúdo bloqueado por RLS/entitlement. A ausência de layout usa fallback canônico. Analytics mantém exatamente os sete eventos da Sprint 49; não existe `layout_view`.

## Readiness e performance

Composição não cria blocker ou warning na Sprint 50. O fallback torna a ausência de linhas não bloqueante. São apenas oito linhas por hotel, resolvidas em uma RPC e sem N+1.

## Testes e homologação

Foram preparados testes de catálogo/RLS e matriz comportamental com `BEGIN/ROLLBACK`, cobrindo roles, isolamento, entitlement, hero, chave desconhecida, duplicatas, reorder atômico, defaults, inicializador de novos hotéis, projeção pública e audit. A matriz também executa a RPC real de onboarding com identidades Auth sintéticas e comprova hotel draft, exatamente 12 entitlements, oito linhas de layout, administrador inicial e um único `hotel.created` sem PII.

Na homologação local devem ser confirmados especialmente: preflight pós-Sprint 49, constraint deferrable, execução aninhada do audit writer, trigger do onboarding, grants das quatro RPCs e ordem visual nos quatro temas.

## Roadmap

Variants, navegação avançada, composição de páginas internas, templates, SEO, conteúdo por idioma, drag-and-drop e personalização por grupo permanecem fora do escopo. Qualquer evolução deve continuar usando catálogo fechado e não introduzir HTML/CSS/JS arbitrário.
