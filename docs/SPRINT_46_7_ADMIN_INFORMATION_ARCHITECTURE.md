# Sprint 46.7 — Admin Information Architecture Foundation

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

1. **Principal:** Dashboard, Unidades, Usuários e Configurações.
2. **Experiência do hóspede:** Experiência Pública, Banners, Serviços, Departamentos, Cardápio (F&B), Turismo, Comunicados, Informações e Políticas.
3. **Após divisor:** Idiomas e Logs de Acesso.

`lib/admin-navigation.ts` é a fonte central de grupos, labels, rotas, ícones, `moduleKey`, role mínima, disponibilidade e badge. O filtro continua usando somente `hasMinimumRole`; não há entitlement dinâmico.

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
