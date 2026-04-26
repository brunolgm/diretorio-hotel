# LibGuest: checklist de deploy

## Antes do deploy
1. confirmar branch correta
2. confirmar escopo da entrega
3. rodar validações locais possíveis
4. revisar variáveis de ambiente
5. confirmar migrations necessárias

## Preview
1. publicar preview
2. validar login
3. validar admin principal
4. validar rota pública por slug
5. validar subdomínio quando aplicável
6. validar idiomas
7. validar links principais

## Produção
1. garantir que preview foi aprovado
2. aplicar migrations na ordem correta
3. publicar versão final
4. rodar checklist pós-deploy

## Handoff
- este checklist cobre publicação técnica
- a entrega ao cliente deve seguir `guestdesk-client-handoff.md`
- a validação pós-publicação deve seguir `guestdesk-post-deploy-validation.md`

## Observações
- produto atual: `LibGuest`
- domínio operacional atual: `guestdesk.digital`
- não mudar domínio em deploy de rotina sem decisão específica
