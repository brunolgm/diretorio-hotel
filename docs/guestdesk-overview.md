# GuestDesk: visão geral do produto

## O que é
GuestDesk é uma plataforma de diretório digital para hotelaria com duas frentes principais:

1. Painel administrativo
2. Página pública do hotel

O objetivo é centralizar informações úteis do hotel em uma experiência mais organizada, elegante e simples de operar.

## O que o produto entrega hoje
Hoje o GuestDesk permite:

1. Configurar dados principais do hotel
2. Publicar serviços e seções do diretório
3. Publicar departamentos e contatos
4. Publicar políticas e orientações
5. Exibir a experiência pública por hotel usando slug
6. Traduzir conteúdo salvo em português para inglês e espanhol no momento do save

## Estrutura principal do produto
### Painel administrativo
Área protegida para operação do hotel.

Principais módulos:

1. Dashboard
2. Informações do hotel
3. Serviços
4. Departamentos
5. Políticas

### Página pública
Área voltada para o hóspede.

Principais blocos:

1. Hero do hotel
2. Informações rápidas
3. Serviços e informações
4. Departamentos e contatos
5. Políticas
6. Links úteis

## Idiomas
Idioma fonte:

1. Português

Idiomas gerados automaticamente:

1. Inglês
2. Espanhol

Importante:

1. A tradução acontece no save
2. A página pública não traduz em tempo real
3. Quando EN ou ES não existem, a página usa fallback para PT

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

## Fluxo operacional resumido
1. O operador entra no painel
2. Atualiza o conteúdo do hotel em português
3. O sistema salva o conteúdo principal
4. O sistema tenta gerar EN e ES automaticamente
5. A página pública passa a exibir as traduções salvas quando `?lang=en` ou `?lang=es`

## O que não faz parte do escopo atual
1. Multi-tenant SaaS completo
2. Edição manual de tradução
3. Filas de tradução
4. Workflow editorial avançado
5. Permissões complexas por múltiplos papéis

## Uso recomendado desta documentação
Use os arquivos de `docs/` assim:

1. Para deploy: `guestdesk-deploy-checklist.md`
2. Para ambiente: `guestdesk-environment-variables.md`
3. Para subir um novo hotel: `guestdesk-new-hotel-playbook.md`
4. Para operação do painel: `guestdesk-admin-guide.md`
5. Para validar entrega: `guestdesk-post-deploy-validation.md`
6. Para fluxo de branches: `guestdesk-branch-workflow.md`
