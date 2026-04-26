# LibGuest: validação pós-deploy

## Objetivo
Conferir se o ambiente publicado está tecnicamente estável e pronto para a etapa de revisão e entrega do cliente.

## Validação técnica rápida
1. abrir landing principal
2. testar login
3. abrir dashboard admin
4. revisar serviços, departamentos e políticas
5. validar rota pública por slug
6. validar subdomínio quando aplicável
7. validar idioma e fallback
8. validar links principais

## Itens sensíveis
- subdomínio do hotel
- slug fallback
- botões de reservas, site e WhatsApp
- fallback para português
- analytics básicos
- branding visível do produto

## Antes de entregar ao cliente
- confirmar que a página pública abre no celular
- confirmar que o endereço preferencial está claro
- confirmar que o fallback por slug foi registrado
- confirmar que conteúdo essencial já está revisado
- encaminhar o ambiente para o checklist de `guestdesk-client-handoff.md`

## Diagnóstico rápido de falhas operacionais

### Se um save falhar no admin
- revisar o toast de erro
- conferir campos obrigatórios, links e status do item
- repetir a operação uma vez para descartar falha transitória

### Se o upload de logo falhar
- revisar formato, tamanho e nome do arquivo
- confirmar se a tela do hotel continua carregando normalmente

### Se a tradução falhar
- lembrar que PT continua publicado
- revisar warnings de retradução
- confirmar em preview se EN ou ES estão usando fallback em português

### Onde olhar primeiro
- tela do admin com toast de erro ou warning
- logs do servidor ou preview com contexto de:
  - módulo
  - ação
  - operação
  - `hotelId`
  - `targetId`, quando houver

## Observação
- o nome atual do produto deve aparecer como `LibGuest`
- `guestdesk.digital` continua como domínio operacional atual
