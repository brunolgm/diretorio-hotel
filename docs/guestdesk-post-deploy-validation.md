# LibGuest: validação pós-deploy

## Objetivo
Conferir se o ambiente publicado está tecnicamente estável e pronto para a etapa de revisão/entrega do cliente.

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

## Observação
- o nome atual do produto deve aparecer como `LibGuest`
- `guestdesk.digital` continua como domínio operacional atual
