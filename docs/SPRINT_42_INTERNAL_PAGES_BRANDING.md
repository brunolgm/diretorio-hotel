# Sprint 42 — Identidade visual das páginas internas por preset

## Status

Implementação concluída localmente na branch `sprint-42-internal-pages-branding`, sem alteração de schema, banco ou dados de hotel.

## Diagnóstico e arquitetura

As rotas por slug (`/hotel/[slug]/explorar/[area]`) e por subdomínio (`/explorar/[area]`) já convergiam em `HotelPublicAreaContent`. O preset chega por `pageData.hotel.theme_preset` e é normalizado por `resolveHotelTheme`.

A Sprint 42 preservou essa arquitetura. Dados, loaders, traduções, busca, filtros, destinos, analytics e builders de rota continuam compartilhados. A camada Mercure é ativada somente quando o preset resolvido é `mercure`, sem condição por nome, slug, domínio ou ID.

## Componentes

Criado:

- `MercureAreaHero`: hero interno compacto com imagem pública existente ou fallback já aprovado, overlay, floral oficial, voltar ao início, seletor compartilhado, assinatura compacta, ícone, título e subtítulo.

Reutilizados:

- `MercureBrandSignature`, agora com variante visual `compact`;
- monograma e wordmark oficiais já existentes;
- floral Mercure já existente;
- `LanguageSwitcher`;
- `NovotelServiceExplorer`, que permanece como implementação funcional compartilhada da busca, filtro e cards editoriais;
- `MercureBottomDock`;
- `PublicAnalytics`, loaders, rotas, destinos e cópias PT/EN/ES.

Nenhuma das seis páginas foi copiada ou recriada.

## Cobertura Mercure

As seis áreas compartilhadas receberam continuidade visual:

- Serviços do Hotel;
- Informações;
- Turismo;
- Comunicados;
- Contato Online;
- Cardápio.

Foram cobertos hero, assinatura, floral, fundo rosa-marfinado, superfícies, cards, botões, links externos, estados vazios, footer e dock. Busca e filtro usam o explorer compartilhado e recebem estilos Mercure por seletores isolados em `data-hotel-theme="mercure"`.

O ambiente local possui as seis áreas Mercure vazias. Por isso, a evidência Mercure usa o estado vazio real; não foram criados nem persistidos dados fictícios. O fluxo com conteúdo, busca, filtro, categorias e CTA foi exercitado com os registros reais Novotel e Grand Mercure que usam o mesmo explorer.

## Responsividade e idiomas

A matriz Mercure percorreu:

- 320 × 800;
- 375 × 812;
- 390 × 844;
- 430 × 932;
- 768 × 1024;
- 800 × 1280;
- 1024 × 600;
- 1024 × 1366;
- 1280 × 800;
- 1440 × 1000.

Também foram percorridas as seis áreas em PT, EN e ES. Não houve overflow horizontal, corte de texto, erro de console ou falha de rede na passada válida.

O dock Mercure reutilizado permaneceu fixo e visível até 1024 px, com reserva inferior e safe area; em 1280 e 1440 px ficou oculto. A rolagem foi conferida no início, meio e final, e o footer permaneceu acessível acima do dock.

## Regressões

Serviços Novotel e Grand Mercure foram conferidos em 390 × 844, 800 × 1280 e 1440 × 1000. Hero, marca, explorer, cards e dock permaneceram com as identidades anteriores. As regras novas dependem simultaneamente de `.mercure-internal-page` e `data-hotel-theme="mercure"`, portanto não atingem presets neutros ou outras marcas.

## Acessibilidade e performance

- controles principais preservam foco visível e touch target;
- ícones decorativos do hero usam `aria-hidden`;
- floral e camadas decorativas usam `aria-hidden` e `pointer-events: none`;
- imagens reutilizam `next/image`, sem Base64 ou nova dependência;
- reduced motion é aplicado à área interna Mercure;
- links, analytics e destinos não foram alterados.

## Loading, erro e pendências

Não existem hoje componentes públicos dedicados e compartilhados de loading/erro por preset nas rotas auditadas. O App Router mantém o comportamento público comum. Criar um fluxo Mercure isolado seria uma arquitetura paralela, portanto ficou registrado para sprint futura.

Pendências:

- propagar dinamicamente PT/EN/ES para `<html lang>`;
- validar visualmente Serviços Mercure com conteúdo quando o hotel publicar registros reais;
- considerar identidade por preset também no detalhe de serviço em uma sprint específica, fora das seis áreas desta entrega;
- evoluir loading/erro públicos somente quando houver uma camada compartilhada segura.

## Evidências e validação

Evidências temporárias locais, não adicionadas ao Git:

- Serviços Mercure em 390 × 844, 800 × 1280 e 1440 × 1000;
- Informações Mercure em 390 × 844;
- Serviços Novotel em 390 × 844, 800 × 1280 e 1440 × 1000;
- Serviços Grand Mercure nos mesmos três viewports;
- relatório automatizado de 34 casos.

Validação técnica:

- `npm run lint`;
- `npx tsc --noEmit`;
- `npm run build`;
- `git diff --check`.
