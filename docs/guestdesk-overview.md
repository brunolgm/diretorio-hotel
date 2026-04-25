# LibGuest: visão geral do produto

## O que é
LibGuest é uma plataforma de diretório digital para hotelaria com duas frentes principais:

1. painel administrativo
2. experiência pública do hotel

O objetivo é centralizar serviços, contatos, políticas e informações úteis em uma jornada mais clara para o hóspede e mais simples para a operação.

## O que o produto entrega hoje
Hoje o LibGuest permite:

1. configurar dados principais do hotel
2. publicar serviços e seções do diretório
3. publicar departamentos e contatos
4. publicar políticas e orientações
5. exibir a experiência pública por slug e por subdomínio de produto
6. traduzir conteúdo salvo em português para inglês e espanhol no momento do save
7. acompanhar analytics básicos da experiência pública

## Estrutura principal

### Painel administrativo
Área protegida para operação do hotel.

Principais módulos:

1. dashboard
2. informações do hotel
3. serviços
4. departamentos
5. políticas
6. usuários

### Experiência pública
Área voltada ao hóspede.

Principais blocos:

1. hero do hotel
2. informações rápidas
3. serviços e informações
4. departamentos e contatos
5. políticas
6. links úteis

## Idiomas

Idioma fonte:

1. português

Idiomas gerados automaticamente:

1. inglês
2. espanhol

Importante:

1. a tradução acontece no save
2. a página pública não traduz em tempo real
3. quando EN ou ES não existem, a página usa fallback para PT

## Stack atual

### Frontend
1. Next.js
2. App Router
3. Tailwind CSS

### Backend e dados
1. Supabase Auth
2. Supabase Database
3. Supabase Storage

### Tradução
1. Google Cloud Translation

## Domínio e naming
- nome atual do produto: `LibGuest`
- nome legado: `GuestDesk`
- domínio operacional atual: `guestdesk.digital`
- o domínio continua ativo por compatibilidade e continuidade operacional

## Uso recomendado desta documentação
Use os arquivos de `docs/` assim:

1. para deploy: `guestdesk-deploy-checklist.md`
2. para ambiente: `guestdesk-environment-variables.md`
3. para subir um novo hotel: `guestdesk-new-hotel-playbook.md`
4. para operação do painel: `guestdesk-admin-guide.md`
5. para validar entrega: `guestdesk-post-deploy-validation.md`
6. para fluxo de branches: `guestdesk-branch-workflow.md`
7. para visão viva do produto: `PRODUCT_MAP.md`
