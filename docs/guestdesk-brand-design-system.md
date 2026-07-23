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
| `novotel` | Novotel | experiência pública implementada; ativação por hotel ainda manual | `deep-ocean` |
| `grand-mercure` | Grand Mercure | experience-implemented | `graphite-gold` |
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
- ao salvar outros dados do hotel, a action preserva um preset oficial já gravado; o cliente não consegue escolhê-lo ou substituí-lo pelo formulário comum
- Novotel Salvador mantém o preset já salvo e, portanto, sua identidade antiga
- o fallback comercial futuro para clientes sem bandeira é `libguest-signature`, enquanto o fallback técnico legado permanece `midnight-slate`
- ativar um preset oficial exige implementação visual, homologação e alteração de dado deliberada fora deste código
- não criar aliases por slug, nome do hotel ou subdomínio

## Componentes compartilhados

Os tokens já alcançam shell, hero, cards, superfícies, ícones, CTAs, banners, seletor de idioma, ajuda, assinatura e detalhe de serviço.

A Sprint 37 separa a composição da home `novotel` em `NovotelPublicHome`, preservando os loaders, os dados e as regras compartilhadas. A home contém somente hero, seis cards editoriais, banner, ajuda, assinatura e navegação inferior mobile. Os seis cards são sempre Informações, Contato Online, Cardápio, Turismo, Comunicados e Serviços do Hotel; destinos sem conteúdo abrem uma área com estado vazio elegante.

As rotas `/explorar/[area]` e `/hotel/[slug]/explorar/[area]` são genéricas e reutilizam o mesmo loader público. Informações operacionais, políticas, contatos, links institucionais, departamentos, comunicados e serviços completos ficam nessas áreas, não na home Novotel. A apresentação consulta `theme.preset`; a resolução nunca depende de nome, slug ou subdomínio.

A navegação inferior Novotel tem exatamente Início, Serviços, Cardápio, Informações e Contato. Não há item Conta. A barra é mobile-only, fica ancorada ao rodapé, tem altura-base previsível de 60 px, usa `safe-area-inset-bottom`, z-index controlado e reserva estrutural de `7.5rem + safe area` após o conteúdo. Os demais presets conservam a jornada anterior.

## Acessibilidade

- contraste do acento é calculado entre texto claro e escuro
- foco e navegação por teclado permanecem nos controles existentes
- nenhum conteúdo depende de imagem para ser compreendido
- a tipografia continua usando fallback de sistema até aprovação de fontes por bandeira
- mobile-first, slug fallback e dual-domain permanecem inalterados

## Sequência prevista

### Sprint 37 — Novotel Salvador

- composição refinada por comparação direta com `docs/references/novotel-salvador-mockup.png` e `docs/references/novotel-salvador-hero-reference.webp`; a revisão visual final em dispositivos reais permanece obrigatória
- hero funciona integralmente com o fallback de gradientes e overlays Novotel, sem depender de imagem
- `hotels.hero_image_url` é a única fonte de imagem do hero; banners não são consumidos, removidos nem reutilizados pelo hero
- `NovotelHeroBackdrop` centraliza imagem e overlay luminoso para home, seis áreas internas e cabeçalho de detalhe; o gradiente concentra contraste atrás do conteúdo sem apagar piscina, fachada, céu ou mar
- `NovotelAreaHero` reutiliza essa composição com retorno, idioma, ícone, título e descrição; sem imagem, mantém o fallback azul
- `NovotelBrandSignature` prioriza um `logo_url` completo sem duplicar texto; quando não há logo, apresenta símbolo institucional, N, NOVOTEL e o subtítulo visual em escala segura
- `getHotelPublicDisplayName` centraliza overrides institucionais sem usar slug e entrega o mesmo nome em PT, EN e ES
- o override Novotel Salvador fica isolado da composição visual; o componente não contém condição por hotel
- a migration de `hero_image_url`, o preset `novotel` e a imagem do hero já estão ativos no ambiente de homologação
- o admin aceita URL HTTP(S), upload JPEG/PNG/WEBP e remoção; o storage usa somente `hotel-assets/{hotelId}/hero.{ext}` após resolver o hotel autenticado no servidor
- a ordem é hero, seis cards fixos, banner, ajuda, assinatura e navegação inferior mobile
- café da manhã, Wi-Fi, check-in, check-out, políticas, contatos, departamentos, links institucionais, comunicados e serviços completos permanecem disponíveis nas áreas públicas próprias
- o banner com imagem usa composição editorial com contraste localizado à esquerda e zona inferior segura; sem registro ativo, a home mantém um fallback azul neutro e sem promoção fictícia
- a área Serviços Novotel mantém todo o conteúdo, Room Service, Thex e destinos existentes, adicionando busca local, filtro por categoria, grade responsiva e CTAs alinhados no rodapé dos cards sem repetir rótulos visuais
- o mockup orientou ordem, primeira dobra, proporção do hero, grade 2x3, densidade, espaçamento, banner e navegação; comparação pixel a pixel não foi declarada
- o preset já está ativo no ambiente de homologação; nenhuma alteração de dados foi feita nesta revisão

#### Estado visual do ambiente de homologação

- `hotels.hero_image_url` existe e está preenchido para o Novotel Salvador
- `hotels.theme_preset = 'novotel'`
- a imagem limpa do hero está ativa na home e é reutilizada por `NovotelAreaHero`
- `hotels.name = 'Novotel Salvador'`; o complemento institucional é resolvido pelo catálogo de identidade em `lib/hotel-public-identity.ts`, sem migration ou alteração de dados

#### Diagnóstico do banner real

O estado de publicação dos banners é operacional e pode mudar sem alteração de código. No smoke test final desta revisão, o loader público entregou um banner elegível com imagem; portanto, a composição real foi exibida. O fallback continua reservado ao caso em que nenhum registro cumpra simultaneamente:

- `is_active = true`
- `starts_at` nulo ou anterior/igual ao momento atual
- `ends_at` nulo ou posterior/igual ao momento atual
- título e imagem preenchidos; descrição e CTA configurados para atingir a composição final aprovada

Não registrar neste documento uma contagem permanente de banners ativos. A elegibilidade deve ser confirmada no momento da homologação, sem expor conteúdo interno ou alterar dados automaticamente.

Um banner elegível exibe indicador de posição; com mais de um, o carrossel também apresenta controles e indicadores navegáveis. Nenhum banner foi ativado ou editado nesta revisão.

#### SQL controlado para imagem de banner existente — não executado

O painel de banners continua sendo o fluxo recomendado. Se houver necessidade operacional de atualização manual, preencher `target_banner_id` e `target_image_url` com valores aprovados, executar primeiro em preview e guardar o valor anterior para reversão:

```sql
begin;

do $$
declare
  target_hotel_id uuid;
  target_banner_id uuid := null; -- informar manualmente
  target_image_url text := null; -- informar manualmente
  affected_rows integer;
begin
  if target_banner_id is null or target_image_url is null then
    raise exception 'Informe banner e URL aprovados antes de executar.';
  end if;

  select id into strict target_hotel_id
  from public.hotels
  where slug = 'novotelrv'
    and subdomain = 'novotelsalvador';

  update public.hotel_promotional_banners
  set image_url = target_image_url,
      updated_at = now()
  where id = target_banner_id
    and hotel_id = target_hotel_id;

  get diagnostics affected_rows = row_count;

  if affected_rows <> 1 then
    raise exception 'Atualização cancelada: era esperado exatamente um banner, mas % linha(s) foram alteradas.', affected_rows;
  end if;
end $$;

commit;
```

Para reverter, repetir o bloco com o mesmo `target_banner_id` e a URL anterior registrada. O SQL não cria banner, não altera traduções e não interfere no hero.

#### SQL manual de ativação — referência histórica, já aplicada no ambiente de homologação

```sql
begin;

do $$
declare
  affected_rows integer;
begin
  update public.hotels
  set
    theme_preset = 'novotel',
    updated_at = now()
  where slug = 'novotelrv'
    and subdomain = 'novotelsalvador'
    and theme_preset = 'deep-ocean';

  get diagnostics affected_rows = row_count;

  if affected_rows <> 1 then
    raise exception 'Ativação cancelada: era esperado exatamente um hotel, mas % linha(s) foram alteradas.', affected_rows;
  end if;
end $$;

commit;
```

#### SQL manual de reversão — referência operacional, não executada nesta revisão

```sql
begin;

do $$
declare
  affected_rows integer;
begin
  update public.hotels
  set
    theme_preset = 'deep-ocean',
    updated_at = now()
  where slug = 'novotelrv'
    and subdomain = 'novotelsalvador'
    and theme_preset = 'novotel';

  get diagnostics affected_rows = row_count;

  if affected_rows <> 1 then
    raise exception 'Reversão cancelada: era esperado exatamente um hotel, mas % linha(s) foram alteradas.', affected_rows;
  end if;
end $$;

commit;
```

### Sprint 38 — Grand Mercure e Mercure

- aplicar o mockup premium do Grand Mercure com marfim, champagne/dourado e carvão
- consolidar a direção visual Mercure antes da ativação
- homologar ambos separadamente sem compartilhar dados ou lógica por hotel

## Fora do escopo desta fundação

- editor visual no admin
- painel interno de provisionamento
- implementação do preset `custom`
- mudança automática de `theme_preset`
- coluna `brand` ou nova migration de branding
- fontes externas ainda não aprovadas
- IA Concierge
- deploy ou alteração de dados
