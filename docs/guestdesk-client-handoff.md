# LibGuest: handoff de cliente

## Objetivo
Orientar a entrega, revisão e validação inicial de um ambiente LibGuest para um hotel/cliente sem depender de alinhamento informal.

Importante:
- produto atual: `LibGuest`
- domínio operacional atual: `guestdesk.digital`
- subdomínio do hotel, quando existir, funciona dentro do domínio operacional atual
- custom domains ainda não estão ativos

## Quando usar este documento
Use este handoff depois que:
- o hotel já foi configurado
- o admin já está acessível
- a página pública já está publicada
- o ambiente já passou pela validação técnica inicial

## Checklist do operador/desenvolvedor

### Acesso e operação
- confirmar login no admin
- confirmar que o perfil correto está vinculado ao `hotel_id`
- confirmar que o hotel abre normalmente em `/admin/hotel`
- confirmar que saves básicos funcionam sem erro visível

### Endereço público
- confirmar `slug` como fallback público seguro
- confirmar subdomínio público quando configurado
- confirmar que `guestdesk.digital` continua sendo o domínio operacional atual
- registrar para o cliente qual é o endereço preferencial e qual é o fallback por slug

### Conteúdo mínimo
- revisar nome, cidade, contatos e links principais
- revisar serviços ativos
- revisar departamentos e canais de contato
- revisar políticas publicadas
- revisar se o tema visual está coerente com a identidade do hotel

### Experiência pública
- validar rota pública por slug
- validar subdomínio quando configurado
- validar botões principais como WhatsApp, site e reservas
- validar leitura em mobile
- validar idioma padrão em português
- validar fallback de idioma quando EN/ES não estiverem completos

### Fechamento técnico
- confirmar que não há erro crítico bloqueando a operação
- confirmar que analytics básicos estão aptos a registrar interações
- registrar pendências abertas antes da entrega

## Checklist do cliente/hotel

### Conteúdo
- revisar nome do hotel, cidade e descrição
- revisar horários, contatos e WhatsApp
- revisar links de site, reservas e canais oficiais
- revisar serviços visíveis ao hóspede
- revisar departamentos, canais e horários
- revisar políticas e orientações

### Aparência pública
- revisar logo
- revisar preset visual
- revisar cor de destaque, se usada
- revisar leitura geral da página pública no celular

### Endereço e navegação
- confirmar qual é o endereço público principal
- confirmar que o endereço está fácil de comunicar internamente
- confirmar que a rota por slug continua disponível como fallback

### Idiomas
- revisar se português está correto
- revisar se inglês e espanhol estão aceitáveis quando já houver tradução salva
- sinalizar qualquer trecho que precise ajuste manual de conteúdo base em português

## Validação pública antes de considerar pronto
- abrir a página pública no celular
- testar links principais
- revisar serviços, departamentos e políticas
- testar troca de idioma
- validar aparência geral do hotel

## Pós-entrega imediato
- acompanhar os primeiros ajustes enviados pelo cliente
- revisar analytics básicos após os primeiros acessos
- corrigir contatos, links ou textos que mudarem logo após a entrada em operação

## Responsabilidade de cada lado

### Operador/desenvolvedor
- acesso admin
- configuração inicial do ambiente
- validação técnica
- revisão de slug, subdomínio e experiência pública
- correção de erro técnico ou regressão de entrega

### Cliente/hotel
- aprovação de textos, horários, contatos e links
- aprovação do visual público
- revisão de serviços realmente disponíveis
- revisão de políticas operacionais
- validação final do que será mostrado ao hóspede

## Documentos de apoio
- configuração inicial: `guestdesk-new-hotel-playbook.md`
- operação diária do admin: `guestdesk-admin-guide.md`
- validação pós-deploy: `guestdesk-post-deploy-validation.md`
- checklist técnico de publicação: `guestdesk-deploy-checklist.md`
