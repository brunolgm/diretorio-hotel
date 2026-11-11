# Sprint 46.7 — Admin Information Architecture Foundation

Referência visual canônica de Gastronomia Admin UX V1: [Golden Master aprovado](references/admin/fnb-admin-ux-v1-golden-master.png), fornecido por Bruno como “Painel LibGuest_ Gastronomia em Foco.png”. O roxo ilustrativo não é uma nova identidade: permanecem os tokens e os temas existentes de cada hotel.

## Gastronomia Admin UX V1 — apresentação após a Sprint 53

- `/admin/cardapio`: visão geral, métricas derivadas e estabelecimentos.
- `?kind=outlet|menu|item`: listas com filtros GET e páginas de até 24 registros.
- `?kind=category&parent=<menu>`: categorias dentro do cardápio; `?kind=item&parent=<category>` mantém o contexto de itens.
- `&id=<id>` continua abrindo o conteúdo existente; `&new=1` apresenta criação para quem já pode gerenciar. IDs permanecem em URLs e campos ocultos, fora dos rótulos da interface.
- `/admin/pedidos` e `/admin/impressao`: URLs, painéis e lógica operacional preservados; breadcrumbs e navegação contextual compartilhados.

O editor organiza os mesmos campos e server actions em Conteúdo, Preço e disponibilidade, Informações, Imagem, Idiomas e Publicação. O CTA é “Salvar alterações” ou “Criar item/estabelecimento/cardápio/categoria”. A imagem continua sendo uma operação separada, com propriedade, revisão e política de upload existentes. Exclusão definitiva fica nas ações secundárias com confirmação. Reordenação usa o RPC existente e um único snapshot da lista completa, com controles de seta e seletor limitado à página visível.

EN/ES são consultados somente para os registros visíveis ou em edição, com `source_revision`, completude e fallback em PT calculados pela lógica existente. Não há outra implementação de tradução. O preview reutiliza `PublicExperiencePreview` e a rota pública salva do próprio hotel; alterações não salvas e rascunhos não são simulados. Não há mudança do frontend público nem migração V3/V4.

O modo exibido vem da leitura do RPC existente de commissioning. Falta de permissão ou falha de consulta não significa `catalog_only`: a interface informa que o modo não está disponível/consultado. Esta apresentação não ativa pedidos, impressão ou Goomer.

Diferenças funcionais necessárias frente ao quadro conceitual: identidade do hotel estática, sem seletor multi-hotel; controles globais inexistentes não são inventados; cardápios sem imagem própria usam ícone; dados, quantidades e imagens dependem do conteúdo salvo; preview é o frontend público real. Não há tabelas agregadoras, métricas persistidas, migrations, RPCs novos, alteração de RLS/capabilities ou Bridge.

Evidências locais desta entrega ficam em `out/admin-fb-ux-v1/`: matriz browser/SSR, screenshots nos temas existentes e comparação com o Golden Master. A recomendação técnica é separada da homologação visual humana. Nenhuma impressão física faz parte desta validação.

## Objetivo

Reorganizar o `/admin` do hotel em uma arquitetura de informação escalável, sem alterar backend, segurança, regras de negócio ou disponibilidade contratual de módulos. A entrega cria uma camada estática e tipada para orientar navegação e evolução futura.

## Estado anterior

- A navegação era uma lista plana montada dentro de `app/admin/layout.tsx`.
- Rotas funcionais misturavam configuração, conteúdo, operação e usuários sem agrupamento explícito.
- A hierarquia `visualizador → operador → editor → administrador` já controlava a visibilidade de itens sensíveis.
- O tema de Sprint 46.6 já era resolvido no servidor pelo hotel e propagado para sidebar desktop e drawer mobile.
- Não existia um catálogo central de capacidades nem espaços estruturais para experiência pública, idiomas, F&B, turismo ou logs.

## Arquitetura adotada

### Navegação

Atualização aprovada em 06/11/2026 — Gastronomia Admin UX V1:

1. **Visão geral:** Dashboard.
2. **Conteúdo e experiência:** Experiência Pública, Serviços, Departamentos, Gastronomia (F&B), Turismo, Comunicados, Banners e Políticas.
3. **Operação:** Unidades e QR, Central de Voos.
4. **Gestão:** Analytics, Idiomas, Usuários e Informações do hotel.
5. **Sistema:** Configurações e Logs de Acesso.

`lib/admin-navigation.ts` é a fonte central de grupos, labels, rotas, ícones, `moduleKey`, role mínima e disponibilidade. O shell fornece os entitlements resolvidos no servidor e os resultados dos getters de acesso já existentes de Pedidos e Impressão. A navegação não concede permissões. Departamentos mantém rota e visibilidade anteriores. As definições estáticas não são mutadas entre requests/tenants.

Gastronomia é um grupo expansível no mesmo componente de sidebar usado pelo desktop e pelo drawer mobile. Seus subitens são Visão geral, Estabelecimentos, Cardápios, Itens e, somente com acesso autorizado, Pedidos e Impressão. As rotas operacionais mantêm o fluxo restrito de pedidos para hotéis arquivados, sem reabrir navegação editorial.

### Catálogo de módulos

`lib/admin-modules.ts` define chaves estáveis e separa:

- capacidades disponíveis hoje;
- capacidades posicionadas como `coming_soon`;
- grupos de domínio;
- descrição funcional curta.

Além das chaves planejadas para conteúdo, experiência, analytics, integrações e auditoria, foram adicionadas `core.hotel_configuration` e `core.user_management` para evitar associar configurações e usuários a uma capacidade semanticamente incorreta.

O catálogo não concede acesso, não consulta banco e não representa contrato comercial. `platform_status` permanece lifecycle do hotel e é independente de `availability` do módulo.

## Rotas

### Preservadas e funcionais

- `/admin`
- `/admin/hotel`
- `/admin/apartamentos`
- `/admin/servicos`
- `/admin/departamentos`
- `/admin/politicas`
- `/admin/comunicados`
- `/admin/banners`
- `/admin/usuarios`

### Novas com conteúdo real existente

- `/admin/experiencia`: implementação visual baseada no golden master Grand Mercure, com métricas compactas, composição da home, banner elegível, preview público sandboxed e dicas. Somente “Visão Geral” está funcional; as demais abas são explicitamente futuras.
- `/admin/configuracoes`: hub de links para informações gerais, identidade visual e publicação já existentes. Integrações são apenas informativas.
- `/admin/idiomas`: status agregado de conteúdos fonte PT e registros EN/ES existentes, com explicação do fallback atual.

### Novas e somente estruturais

- `/admin/cardapio`
- `/admin/turismo`
- `/admin/logs`

Essas páginas não consultam dados nem simulam operações. Logs exige a role atual `administrador`, mas não lê `admin_audit_log`.

## Autorização e isolamento

- O layout e todas as páginas continuam usando `requireAdminAccess` e contexto `profile.hotel_id`.
- Usuários e Logs aparecem apenas para administrador.
- Informações, Apartamentos e Configurações aparecem a partir de editor, preservando os guards atuais das áreas de edição.
- A introdução de `moduleKey` não altera role, RLS, lifecycle ou acesso a dados.
- `/platform` não importa catálogo, navegação ou tema do admin do hotel.

## Tema e responsividade

A sidebar agrupada reutiliza os tokens de Sprint 46.6. O drawer recebe os mesmos grupos e os mesmos tokens resolvidos no servidor. Os novos hubs usam os componentes genéricos do admin e, portanto, herdam Grand Mercure, Mercure, Novotel e LibGuest Default sem lógica adicional de marca.

O golden master oficial é `docs/references/admin/grand-mercure-admin-mockup.png`. Foram reproduzidos a sidebar de 256 px, cabeçalho editorial, cinco métricas, tabs sublinhadas, grid 30/43/27, preview mobile e bloco de dicas. Os três quadros explicativos inferiores da imagem são material de apresentação e permanecem fora da aplicação.

## Impacto no código

- O layout deixa de conhecer itens individuais e recebe grupos filtrados da configuração central.
- Sidebar e drawer passam a renderizar grupos e badges.
- Nenhuma action, API, RPC, migration, policy, schema ou regra de lifecycle foi alterada.
- O formulário do hotel ganhou somente a âncora visual `#marca` para o atalho de identidade visual.

## Riscos e limites

- `moduleKey` ainda não é entitlement: transformá-lo em autorização sem desenho de banco e segurança seria escalada de privilégio por configuração de UI.
- Contagens de Idiomas representam registros de tradução existentes, não qualidade linguística nem completude campo a campo.
- Contagens da Experiência Pública refletem registros ativos/habilitados, não uma pré-visualização renderizada.
- TheX e Opera são apenas referências de roadmap; nenhuma integração foi detectada ou criada por esta entrega.
- A sidebar ficou mais extensa; o container com rolagem e o drawer evitam overflow, mas a homologação visual deve cobrir nomes longos e 390 px.

## Próximas etapas

1. Validar a IA com perfis reais de cada role e cada tema.
2. Definir contrato de entitlement separado de lifecycle antes de habilitar módulos por hotel.
3. Evoluir Aparência, Conteúdo, Navegação, SEO e Pré-visualização com escopo e segurança próprios.
4. Definir contratos reais para F&B, Turismo, Analytics avançado, integrações e Logs.
5. Só então avaliar administração de módulos pela plataforma e impacto comercial.

## Critérios de aceite

- Três grupos e nomenclatura definidos aparecem em desktop e mobile.
- Rotas existentes continuam disponíveis e com os mesmos guards.
- Páginas futuras são identificadas como “Em breve” e não possuem operações falsas.
- Hubs reais usam somente dados/contratos atuais e contexto hotel-scoped.
- Temas 46.6 permanecem ativos; `/platform` permanece isolado.
- Não existe migration 46.7 nem alteração de backend ou segurança.
- Security tests, TypeScript, build e `git diff --check` passam.

## Homologação visual final

Evidências geradas contra a fixture local `Hotel Active 46C`, ativa e com `brand_code=grand-mercure`:

- `docs/references/admin/sprint-46-7-homologation/experience-grand-mercure-1536x1024.png`
- `docs/references/admin/sprint-46-7-homologation/experience-grand-mercure-1440x900.png`
- `docs/references/admin/sprint-46-7-homologation/experience-grand-mercure-390x932.png`
- `docs/references/admin/sprint-46-7-homologation/experience-grand-mercure-430x932.png`
- `docs/references/admin/sprint-46-7-homologation/experience-grand-mercure-430x932-drawer.png`

Comparação com o golden master:

- sidebar com 256 px, carvão do tema, branding forte, navegação compacta, item ativo dourado e rodapé fixo;
- scrollbar visualmente oculta e navegação ainda rolável em alturas reduzidas;
- tipografia sans-serif isolada no `/admin`;
- cabeçalho, contexto do hotel, data real, cinco métricas e tabs sublinhadas reproduzidos;
- grid desktop 30/43/27 com Composição da Home, Banner Principal e preview público real;
- quatro blocos iniciais na composição, sem drag-and-drop falso, e demais blocos declarados como mapeados;
- mobile empilha cabeçalho, métricas e conteúdo na ordem aprovada;
- diagnóstico automatizado confirmou `scrollWidth === innerWidth` em 1536, 1440, 390, 430 e drawer.

Diferenças intencionais por honestidade funcional:

- a fixture não possui `logo_url`; a sidebar usa fallback tipográfico, sem inventar logo;
- a fixture não possui banner elegível, traduções EN/ES nem áreas publicadas; métricas, badges e Banner Principal exibem os estados reais `0`, `1 idioma` e `Sem conteúdo`;
- ator da última atualização não é mostrado porque não existe fonte confiável no contrato atual;
- o preview renderiza a rota pública real por slug e mostra o conteúdo efetivamente disponível;
- os três quadros explicativos inferiores do mockup permanecem fora da aplicação.

## 2026-11-10 — Impressão Premium V4 universal

Evolução aprovada dentro de `/admin/impressao`, reutilizando o AdminShell e os
tokens do hotel autenticado. Não cria outro painel, seletor de tenant ou identidade
de marca. Grand Mercure, os dois Novotel, Mercure, Bugan e futuros hotéis usam
os mesmos componentes. Nomes/temas dos hotéis são dados do shell, nunca regras
operacionais de impressão.

As cinco áreas principais são Visão geral, Implantação, Impressoras, Roteamento
e Fila. Permissões continuam disponíveis por ação contextual e para manutenção
posterior, com os mesmos grants e matriz de autorização. A mudança de seis tabs
da apresentação Premium V3 para cinco áreas é intencional; não remove o editor
de permissões. A Implantação contém o assistente de seis etapas, trilho desktop,
seletor mobile, foco visível, barra inferior com espaço reservado/safe-area e
retorno ao fluxo normal durante a redução do viewport com edição ativa.

Configuração, submissão técnica ao Spooler, confirmação humana de papel,
conclusão administrativa, impressão operacional, ordering e acesso do hóspede
permanecem estados separados. O histórico anterior não valida um job posterior
pendente. A conclusão exige ação explícita no contexto e revisão atuais.

Escopo técnico, migration aditiva, testes, evidências e gates restantes estão no
adendo canônico de 10/11/2026 em [Sprint 53](SPRINT_53_FNB.md). O candidato é local;
não houve ativação de módulos, alteração de navegação fora da Impressão ou deploy.
