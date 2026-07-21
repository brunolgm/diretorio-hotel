# LibGuest: design system institucional e por bandeira

## Objetivo

Definir a fundação visual reutilizável e expansível do LibGuest sem duplicar páginas, alterar hotéis existentes ou liberar presets ainda não homologados no painel.

## Arquitetura

```text
LibGuest Base
├── LibGuest Signature (`libguest-signature`)
├── preset Novotel (`novotel`)
├── preset Grand Mercure (`grand-mercure`)
├── preset Mercure (`mercure`)
└── custom (reservado)
```

A resolução de hotel, conteúdo, idioma, analytics, roomToken, links e ações continua compartilhada. Um preset fornece somente tokens visuais consumidos pelos componentes públicos comuns.

## Fonte de verdade

- `lib/hotel-theme.ts`: catálogos, tipos, tokens, contraste e resolução
- `app/globals.css`: classes semânticas públicas baseadas em CSS variables
- `components/public/**`: consumo compartilhado dos tokens
- `hotels.theme_preset`: identificador visual atualmente salvo como texto opcional
- `hotels.theme_primary_color`: override opcional e seguro do acento

Não existe coluna `brand` no modelo atual. Bandeira e preset não devem ser inferidos por nome, slug ou subdomínio.

## Presets legados operacionais

Continuam disponíveis no seletor do admin e aceitos pela sanitização:

- `midnight-slate`
- `ivory-noir`
- `deep-ocean`
- `graphite-gold`
- `forest-ember`

Esses identificadores permanecem canônicos; não precisam de alias. Valor ausente ou desconhecido continua usando `midnight-slate` como fallback seguro.

## Presets oficiais da fundação

| Identificador | Direção | Status na Sprint 36 | Fallback legado de referência |
| --- | --- | --- | --- |
| `libguest-signature` | institucional, hotéis independentes e outros segmentos | foundation-only | `midnight-slate` |
| `novotel` | Novotel | foundation-only | `deep-ocean` |
| `grand-mercure` | Grand Mercure | foundation-only | `graphite-gold` |
| `mercure` | Mercure | foundation-only; direção visual ainda requer consolidação | `ivory-noir` |

Os quatro identificadores são reconhecidos diretamente pela camada pública e pelo resolvedor, inclusive em preview e testes sem gravação no banco. Eles não integram `HOTEL_THEME_PRESETS`, não aparecem no admin e são rejeitados por `sanitizeHotelThemePreset`. Portanto, não podem ser ativados por edição comum nesta sprint.

`custom` está reservado no desenho de produto para uma evolução futura. Não integra o catálogo executável, não possui tokens operacionais e não pode ser resolvido como preset nesta sprint.

## LibGuest Signature

`libguest-signature` é a identidade institucional neutra e proprietária do produto. A direção foundation combina azul-marinho profundo, turquesa/verde tecnológico, superfícies e cards escuros premium, alto contraste, ícones lineares e navegação clara. Os tokens também cobrem tipografia, botões, banners, ajuda e assinatura LibGuest dentro do mesmo sistema usado pelas bandeiras.

Comercialmente, será o tema padrão para hotéis independentes, outros segmentos e clientes sem bandeira homologada. Isso não muda o fallback técnico atual: valores ausentes ou desconhecidos continuam resolvendo para `midnight-slate` até que o provisionamento futuro associe explicitamente o preset correto.

## Regra futura de provisionamento

- bandeira homologada usa seu preset próprio
- hotéis independentes, outros segmentos e clientes sem bandeira homologada usam `libguest-signature`
- `custom` depende de implementação e homologação futuras
- a associação automática só será introduzida com o futuro painel interno de provisionamento
- até lá, nenhum hotel atual é migrado ou associado automaticamente

## Tokens

Tokens centrais obrigatórios:

- `background`, `surface`, `surfaceMuted`
- `primary`, `primaryContrast`, `secondary`
- `text`, `textMuted`, `border`, `accent`
- `danger`, `success`
- `cardRadius`, `cardShadow`
- `heroOverlay`, `navigation`, `iconStyle`

Tokens auxiliares cobrem família tipográfica, hero, cabeçalho, ícones, botões, banners, ajuda, estado ativo e assinatura LibGuest.

Os tokens são convertidos em CSS variables `--hotel-*`. O contraste do acento continua calculado no resolver, inclusive quando há override de `theme_primary_color`.

## Compatibilidade e ativação

- nenhum hotel é associado automaticamente a uma bandeira
- nenhum dado é atualizado pela aplicação desta fundação
- o seletor do admin continua mostrando somente presets legados
- Novotel Salvador mantém o preset já salvo e, portanto, sua identidade antiga
- o fallback comercial futuro para clientes sem bandeira é `libguest-signature`, enquanto o fallback técnico legado permanece `midnight-slate`
- ativar um preset oficial exige implementação visual, homologação e alteração de dado deliberada fora deste código
- não criar aliases por slug, nome do hotel ou subdomínio

## Componentes compartilhados

Os tokens já alcançam shell, hero, cards, superfícies, ícones, CTAs, banners, seletor de idioma, ajuda, assinatura e detalhe de serviço.

Não existe navegação inferior pública dedicada na Sprint 36. O token `navigation` está pronto para essa composição futura sem criar um componente vazio ou mudar a jornada atual. O WhatsApp flutuante continua funcional e usa o acento seguro atual.

## Acessibilidade

- contraste do acento é calculado entre texto claro e escuro
- foco e navegação por teclado permanecem nos controles existentes
- nenhum conteúdo depende de imagem para ser compreendido
- a tipografia continua usando fallback de sistema até aprovação de fontes por bandeira
- mobile-first, slug fallback e dual-domain permanecem inalterados

## Sequência prevista

### Sprint 37 — Novotel Salvador

- aplicar fielmente o mockup aprovado
- homologar hero com imagem, azul Novotel, cards, banner turístico, ajuda e navegação inferior
- validar detalhe de serviço, responsividade, contraste e QRs existentes
- somente depois considerar ativação deliberada do preset `novotel`

### Sprint 38 — Grand Mercure e Mercure

- aplicar o mockup premium do Grand Mercure com marfim, champagne/dourado e carvão
- consolidar a direção visual Mercure antes da ativação
- homologar ambos separadamente sem compartilhar dados ou lógica por hotel

## Fora do escopo desta fundação

- mockups finais
- editor visual no admin
- painel interno de provisionamento
- implementação do preset `custom`
- mudança automática de `theme_preset`
- coluna `brand` ou migration
- fontes externas ainda não aprovadas
- IA Concierge
- deploy ou alteração de dados
