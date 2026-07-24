# Sprint 41 — Homologação visual pública

## Escopo e método

A homologação foi executada na branch `sprint-41-visual-homologation` com Chrome headless em viewport real, rolagem normal e emulação touch até 1024 px. O runner bloqueou `/api/analytics` para não persistir page views durante a matriz.

Foram percorridos 156 casos:

- dez viewports nas homes Novotel, Grand Mercure e Mercure;
- seis áreas internas das três marcas em mobile, tablet, tablet paisagem e desktop;
- home e Serviços em PT, EN e ES;
- home dos cinco presets neutros e de LibGuest Signature por preview local seguro.

Viewports: `320 × 800`, `375 × 812`, `390 × 844`, `430 × 932`, `768 × 1024`, `800 × 1280`, `1024 × 600`, `1024 × 1366`, `1280 × 800` e `1440 × 1000`.

Evidências temporárias, não adicionadas ao Git:

- `sprint41-novotel-768-before.png`;
- `novotel-home-768x1024-pt.png`;
- `novotel-home-1024x600-pt.png`;
- `grand-mercure-servicos-768x1024-pt.png`;
- `mercure-servicos-390x844-pt.png`;
- `mercure-home-1024x1366-pt.png`;
- `audit-results.json`.

## Diagnóstico da implementação

| Responsabilidade | Implementação |
|---|---|
| Home neutra e Signature | `components/public/hotel-public-page-content.tsx` |
| Home Novotel | `components/public/novotel/novotel-public-home.tsx` |
| Home Grand Mercure | `components/public/grand-mercure/grand-mercure-public-home.tsx` |
| Home Mercure | `components/public/mercure/mercure-public-home.tsx` |
| Áreas internas compartilhadas | `components/public/hotel-public-area-content.tsx` |
| Detalhe de serviço | `components/public/hotel-service-detail-content.tsx` |
| Serviços Novotel e Grand Mercure | `components/public/novotel/novotel-service-explorer.tsx` |
| Docks de marca | `novotel-mobile-navigation.tsx`, `grand-mercure-mobile-navigation.tsx` e `mercure-bottom-dock.tsx` |
| Preset e tokens | `lib/hotel-theme.ts` |
| Preview seguro | `lib/public-theme-preview.ts`, restrito a desenvolvimento e à home por slug |

O preset chega às páginas internas por `pageData.hotel.theme_preset` e é resolvido exclusivamente por `resolveHotelTheme`. Não há decisão visual por nome, slug ou domínio.

Estados auditados:

- conteúdo: Serviços das três marcas e demais áreas Novotel com registros;
- vazio: áreas Grand Mercure, áreas Mercure e Comunicados Novotel;
- fallback de banner e mídia;
- loading e erro: não existem estados públicos dedicados por preset; permanecem os estados compartilhados do App Router;
- página inexistente: comportamento compartilhado, sem identidade específica por preset.

Dados observados no ambiente local:

- Novotel: Serviços, Informações, Turismo, Contato e Cardápio com conteúdo; Comunicados vazio;
- Grand Mercure: Serviços com conteúdo; demais áreas vazias;
- Mercure: seis áreas vazias;
- presets neutros: home homologada por preview; áreas internas bloqueadas por ausência de hotel neutro conhecido e porque o preview atual não é propagado às rotas internas.

## Matriz de homologação

| Preset | Página | Mobile | Tablet | Desktop | Status | Destino |
|---|---|---|---|---|---|---|
| novotel | Home | aprovado | corrigido | aprovado | corrigido na Sprint 41 | Grid de duas colunas entre 768 e 1024 px; três colunas a partir de 1280 px |
| novotel | Serviços | aprovado | corrigido | aprovado | corrigido na Sprint 41 | Dock mantido até 1024 px; busca, filtro e cards aprovados |
| novotel | Informações | aprovado | corrigido | aprovado | corrigido na Sprint 41 | Dock tablet e conteúdo final validados |
| novotel | Turismo | aprovado | corrigido | aprovado | corrigido na Sprint 41 | Dock tablet e CTAs validados |
| novotel | Comunicados | aprovado | corrigido | aprovado | corrigido na Sprint 41 | Estado vazio e dock validados |
| novotel | Contato Online | aprovado | corrigido | aprovado | corrigido na Sprint 41 | Links externos, WhatsApp e dock validados |
| novotel | Cardápio | aprovado | corrigido | aprovado | corrigido na Sprint 41 | Conteúdo e dock validados |
| grand-mercure | Home | aprovado | corrigido | aprovado | corrigido na Sprint 41 | Dock e região de rolagem mantidos até 1024 px |
| grand-mercure | Serviços | aprovado | corrigido | aprovado | corrigido na Sprint 41 | Hero, mandala, busca, filtro e card aprovados |
| grand-mercure | Informações | aprovado | corrigido | aprovado | corrigido na Sprint 41 | Estado vazio editorial e dock validados |
| grand-mercure | Turismo | aprovado | corrigido | aprovado | corrigido na Sprint 41 | Estado vazio e rolagem validados |
| grand-mercure | Comunicados | aprovado | corrigido | aprovado | corrigido na Sprint 41 | Estado vazio e rolagem validados |
| grand-mercure | Contato Online | aprovado | corrigido | aprovado | corrigido na Sprint 41 | Estado vazio e rolagem validados |
| grand-mercure | Cardápio | aprovado | corrigido | aprovado | corrigido na Sprint 41 | Estado vazio e rolagem validados |
| mercure | Home | aprovado | corrigido | aprovado | corrigido na Sprint 41 | Dock mantido até 1024 px; visual aprovado preservado |
| mercure | Serviços | estável, porém genérico | estável, porém genérico | estável, porém genérico | pendente Sprint 42 | Criar camada interna Mercure completa |
| mercure | Informações | estável, porém genérico | estável, porém genérico | estável, porém genérico | pendente Sprint 42 | Assinatura, floral, paleta, estado vazio e dock |
| mercure | Turismo | estável, porém genérico | estável, porém genérico | estável, porém genérico | pendente Sprint 42 | Identidade interna Mercure |
| mercure | Comunicados | estável, porém genérico | estável, porém genérico | estável, porém genérico | pendente Sprint 42 | Identidade interna Mercure |
| mercure | Contato Online | estável, porém genérico | estável, porém genérico | estável, porém genérico | pendente Sprint 42 | Identidade interna Mercure |
| mercure | Cardápio | estável, porém genérico | estável, porém genérico | estável, porém genérico | pendente Sprint 42 | Identidade interna Mercure |
| libguest-signature | Home por preview | aprovado | aprovado | aprovado | não aplicável | `foundation-only`; não homologável como preset ativo |
| libguest-signature | Áreas internas | não testado | não testado | não testado | não aplicável | Preview atual não alcança rotas internas |
| midnight-slate | Home por preview | aprovado | aprovado | aprovado | aprovado | Sem regressão |
| midnight-slate | Áreas internas | bloqueado | bloqueado | bloqueado | bloqueado por dados | Sem hotel neutro conhecido e sem preview interno |
| ivory-noir | Home por preview | aprovado | aprovado | aprovado | aprovado | Sem regressão |
| ivory-noir | Áreas internas | bloqueado | bloqueado | bloqueado | bloqueado por dados | Sem hotel neutro conhecido e sem preview interno |
| deep-ocean | Home por preview | aprovado | aprovado | aprovado | aprovado | Sem regressão |
| deep-ocean | Áreas internas | bloqueado | bloqueado | bloqueado | bloqueado por dados | Sem hotel neutro conhecido e sem preview interno |
| graphite-gold | Home por preview | aprovado | aprovado | aprovado | aprovado | Sem regressão |
| graphite-gold | Áreas internas | bloqueado | bloqueado | bloqueado | bloqueado por dados | Sem hotel neutro conhecido e sem preview interno |
| forest-ember | Home por preview | aprovado | aprovado | aprovado | aprovado | Sem regressão |
| forest-ember | Áreas internas | bloqueado | bloqueado | bloqueado | bloqueado por dados | Sem hotel neutro conhecido e sem preview interno |

### Matriz complementar — seletor de idioma

| Preset | Estado auditado | Breakpoints | Severidade | Status |
|---|---|---|---|---|
| mercure | Ativo, inativos, hover, foco, check e clique em PT/EN/ES | 390, 430, 768, 1024 e 1440 px | acessibilidade visual | corrigido na Sprint 41 |
| grand-mercure | Ativo, inativos, hover, foco, check e clique em PT/EN/ES | 390, 430, 768, 1024 e 1440 px | acessibilidade visual | corrigido na Sprint 41 |
| novotel | Ativo, inativos, hover, foco, check e clique em PT/EN/ES | 390, 430, 768, 1024 e 1440 px | acessibilidade visual | aprovado sem alteração |

## Problemas e decisões

| Item | Breakpoint/evidência | Severidade | Arquivo provável | Decisão |
|---|---|---|---|---|
| Cards Novotel com apenas 31 px para texto e quebra visual palavra por palavra | 768 × 1024, `sprint41-novotel-768-before.png` | alta, responsiva | `novotel-public-home.tsx` | Corrigido: duas colunas no tablet e três somente em `xl` |
| Docks ocultos por `md:hidden` | 768, 800 e 1024 px | alta, funcional | três componentes de dock | Corrigido: visíveis até 1024 px e ocultos a partir de 1025 px |
| Padding inferior Novotel e Mercure removido no tablet | 768–1024 px | alta, funcional | homes e área compartilhada | Corrigido junto ao breakpoint do dock |
| Grand Mercure desativava a região protegida do dock em 768 px | 768–1024 px | alta, funcional | `app/globals.css` | Media query movida para 1025 px |
| Áreas Mercure usam hero cinza e estado vazio genérico, sem marca, floral, ameixa ou dock | `mercure-servicos-390x844-pt.png` e seis áreas | estrutural | `hotel-public-area-content.tsx` e futuros componentes Mercure | Pendente Sprint 42; não foi criada implementação parcial |
| `<html lang>` permanece `pt-BR` em páginas EN/ES | PT/EN/ES nas três marcas | média, acessibilidade estrutural | `app/layout.tsx` | Refinamento futuro; exige propagação do idioma ao layout raiz |
| Opções inativas do seletor Mercure e Grand Mercure herdavam texto quase branco sobre menus claros | PT/EN/ES, 390–1440 px | média, acessibilidade visual | `app/globals.css` e componente compartilhado preservado | Corrigido na Sprint 41; Novotel aprovado sem alteração |
| Loading/erro públicos não têm composição própria por preset | todas as marcas | baixa, estrutural | App Router público | Registrar para evolução futura; sem duplicação nesta sprint |

## Regra final do dock

- largura até 1024 px: docks Novotel, Grand Mercure e Mercure Home visíveis e fixos na base da viewport;
- largura a partir de 1025 px: docks ocultos;
- touch target mínimo observado: 48 px de altura no Novotel, 56 px no Mercure e 62 px no Grand Mercure;
- `safe-area-inset-bottom` preservado;
- dock permaneceu na mesma coordenada em início, meio e fim da rolagem;
- banner, ajuda, footer e último conteúdo ficaram acessíveis acima do dock;
- Grand Mercure mantém região de rolagem própria enquanto o dock está ativo;
- páginas internas Mercure ainda não possuem dock e seguem para a Sprint 42;
- temas neutros não possuem dock de marca; a navegação permanece pelos acessos e links compartilhados.

## Idiomas, acessibilidade e estabilidade

- PT, EN e ES: textos, busca, filtro, estados vazios e labels de dock sem overflow ou corte nos casos auditados;
- seletor de idioma, voltar ao início, links externos e WhatsApp permaneceram acessíveis;
- foco visível está definido nos controles principais;
- ícones decorativos auditados usam `aria-hidden`; docks possuem `aria-label`;
- nenhuma imagem decorativa marcada com `aria-hidden` apresentou `alt` indevido;
- zero overflow horizontal, zero imagem quebrada e zero texto com overflow nos 156 casos;
- zero erro de console, hidratação ou network na passada válida, com analytics bloqueado;
- o atributo global de idioma permanece como pendência estrutural;
- reduced motion já é tratado nas composições Mercure e Grand Mercure; não foi introduzida animação automática nova.

## Separação de escopo

### Corrigido na Sprint 41

- grid Novotel no tablet;
- docks de marca até 1024 px;
- reserva inferior correspondente;
- região de rolagem Grand Mercure no tablet;
- contraste dos estados ativo, inativo, hover e foco nos seletores Mercure e Grand Mercure.

### Refinamento futuro

- idioma dinâmico no elemento `<html>`;
- estados públicos dedicados de loading e erro por preset;
- preview seguro também nas rotas internas, se necessário para homologação sem hotel ativo.

### Sprint 42

- camada visual completa das seis páginas internas Mercure;
- hero, assinatura oficial, floral, paleta ameixa, superfícies, estados vazios, Serviços e dock;
- integração sem duplicar loaders, rotas, dados ou regras funcionais.
