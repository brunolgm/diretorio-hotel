# LibGuest: checklist de deploy

## Antes do deploy

1. confirmar branch, commit candidato e escopo da entrega
2. revisar o diff e garantir que não há `.env`, credenciais, dumps ou arquivos de diagnóstico
3. executar `npm run lint`, `npx tsc --noEmit`, `npm run build` e `git diff --check`
4. revisar migrations somente quando fizerem parte explícita do escopo
5. confirmar que slug fallback, dual-domain e QRs existentes não foram alterados
6. confirmar plano de rollback e responsável pela validação

## Preview

1. validar login e estados de acesso indisponível/negado
2. abrir dashboard e módulos do hotel autenticado
3. testar criar, editar, ativar, desativar, excluir e retraduzir conforme o escopo
4. confirmar que feedbacks são claros e não exibem mensagens técnicas
5. validar rota pública por slug
6. validar subdomínio em `libguest.digital` e compatibilidade em `guestdesk.digital`
7. validar PT/EN/ES e fallback em português
8. testar links principais, analytics e ao menos um QR existente quando aplicável

## Matriz multi-hotel

- executar a validação para cada um dos quatro hotéis oficiais com seu próprio usuário
- confirmar nome, slug e subdomínio esperados antes de qualquer operação administrativa
- comparar listas administrativas para detectar mistura de conteúdo
- não alterar dados apenas para completar a validação; registrar ausência como pendência operacional

## Produção

1. garantir que o preview e a matriz multi-hotel foram aprovados
2. publicar somente a versão revisada
3. executar o checklist pós-deploy imediatamente
4. interromper a homologação e iniciar rollback se houver mistura de dados, falha de autenticação ou quebra de slug/QR

## Domínios

- principal: `libguest.digital`
- legado/transição: `guestdesk.digital`
- não mudar domínio, DNS ou redirects em deploy de rotina sem decisão específica
