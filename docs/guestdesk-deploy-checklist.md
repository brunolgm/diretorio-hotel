# GuestDesk: checklist de deploy

## Objetivo
Este checklist serve para reduzir erro operacional no momento de publicar preview ou produção.

## Antes do deploy
1. Confirmar branch correta
2. Confirmar se o escopo já foi validado localmente
3. Rodar `npm run lint`
4. Rodar `npm run build`
5. Verificar se não existem mudanças locais não intencionais
6. Confirmar se variáveis de ambiente necessárias existem no destino

## Se houver mudança de banco
1. Confirmar se há migration nova em `supabase/migrations/`
2. Aplicar a migration no ambiente correto
3. Validar se as novas tabelas/colunas ficaram disponíveis
4. Confirmar se o `types/database.ts` está compatível com a estrutura esperada

## Se houver mudança de tradução
1. Confirmar se a chave do Google Translation existe
2. Validar se o save continua funcionando mesmo quando tradução falha
3. Confirmar se EN e ES estão sendo gravados nas tabelas de tradução

## Checklist de preview
1. Fazer deploy da branch de trabalho
2. Abrir a URL de preview
3. Testar login
4. Testar dashboard admin
5. Testar hotel público
6. Testar save de serviço
7. Testar save de departamento
8. Testar save de política
9. Testar `?lang=pt`
10. Testar `?lang=en`
11. Testar `?lang=es`

## Checklist de produção
1. Confirmar que a preview da branch foi validada
2. Confirmar que a branch final já foi revisada
3. Confirmar que não há mudanças experimentais misturadas
4. Confirmar variáveis de ambiente em produção
5. Confirmar migrations aplicadas
6. Fazer deploy
7. Rodar checklist pós-deploy

## O que nunca esquecer
1. Não publicar direto sem preview quando houver mudança visual ou de banco
2. Não depender de memória para env vars
3. Não considerar deploy concluído sem validação da página pública
4. Não assumir que tradução está funcionando sem testar save real

## Saída mínima esperada de um deploy saudável
1. Build sem erro
2. Login funcionando
3. Painel admin carregando
4. Página pública carregando
5. Save em PT funcionando
6. Tradução EN/ES funcionando ou, no pior caso, falhando sem bloquear publicação em PT
