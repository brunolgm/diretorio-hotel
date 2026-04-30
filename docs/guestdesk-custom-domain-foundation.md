# LibGuest: foundation para custom domains

## Objetivo deste documento
Registrar, de forma curta e técnica, como a base atual de host/domínio está organizada e onde custom domains poderão entrar no futuro sem confundir esse plano com comportamento já ativo.

Importante:
- produto atual: `LibGuest`
- domínio principal atual: `libguest.digital`
- domínio legado/transição: `guestdesk.digital`
- custom domains ainda **não** estão ativos
- este documento não muda DNS, Vercel, banco ou rotas públicas

## Estado atual

### Root do produto
- `libguest.digital` mostra a landing do produto
- `www.libguest.digital` é tratado como root do produto
- `guestdesk.digital` e `www.guestdesk.digital` continuam aceitos como legado/transição

### Subdomínio de hotel no domínio do produto
- `{subdomain}.libguest.digital` é o identificador público preferencial quando o hotel possui `subdomain`
- `{subdomain}.guestdesk.digital` continua funcionando durante a transição
- a resolução pública tenta encontrar o hotel por `hotels.subdomain`
- se não houver correspondência, a base atual ainda pode cair para `hotels.slug` por compatibilidade controlada

### Fallback por slug
- `/hotel/[slug]` continua obrigatório como fallback público seguro
- `/hotel/[slug]/servicos/[id]` continua sendo fallback seguro para detalhe de serviço
- `/servicos/[id]` funciona no contexto de subdomínio do hotel

### Host externo ou desconhecido
- hosts fora de `libguest.digital` e `guestdesk.digital` hoje são tratados como `other-domain`
- isso **não** ativa custom domain
- isso **não** cria redirect
- isso **não** muda a experiência pública validada

## Foundation técnica atual

### Helpers principais
- `lib/product-domain.ts`
  - domínio principal do produto
  - domínios legados aceitos
  - reconhecimento de root
  - reconhecimento de subdomínio de produto
  - classificação leve de host do produto
- `lib/domain-context.ts`
  - normalização de host recebido
  - separação entre localhost, root do produto, subdomínio de produto e host externo
- `lib/public-routes.ts`
  - compatibilidade entre links por slug e links em contexto de subdomínio

### Decisão importante
A foundation atual foi mantida deliberadamente simples para evitar ativação prematura de custom domains antes de existir:
- associação explícita de host externo a hotel
- verificação operacional de DNS
- estratégia de host canônico por hotel
- redirects seguros validados

## Como custom domains poderão entrar no futuro

### Possível fase 1
- adicionar campo específico para domínio customizado por hotel
- validar formato do host externo
- diferenciar host externo configurado de host externo desconhecido

### Possível fase 2
- validar apontamento DNS
- confirmar posse/configuração operacional do host
- decidir quando o domínio customizado vira host principal

### Possível fase 3
- definir canonical host por hotel
- ativar redirects seguros entre slug, subdomínio de produto e domínio customizado
- registrar status operacional no admin

## Fora do escopo atual
- custom domains ativos
- painel completo de gestão de domínios
- configuração automática de DNS
- alterações de Vercel
- redirects canônicos
- migrações de banco para essa feature

## Regra operacional por enquanto
Enquanto custom domains não existirem de verdade:
- `libguest.digital` é o domínio principal atual
- `www.libguest.digital` continua tratado como root
- `{subdomain}.libguest.digital` continua sendo o caminho preferencial dentro do domínio do produto
- `guestdesk.digital` e `{subdomain}.guestdesk.digital` continuam aceitos como legado/transição
- `/hotel/[slug]` continua sendo fallback público seguro
