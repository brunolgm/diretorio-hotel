# GuestDesk: validação pós-deploy

## Objetivo
Garantir que o deploy realmente terminou bem.

## Validação mínima obrigatória
1. Abrir home
2. Abrir login
3. Fazer login com usuário admin
4. Abrir dashboard admin
5. Abrir página pública do hotel

## Validação do admin
1. Abrir módulo de hotel
2. Abrir módulo de serviços
3. Abrir módulo de departamentos
4. Abrir módulo de políticas
5. Confirmar que listas carregam sem erro

## Validação de save
Fazer pelo menos um teste real:

1. criar ou editar um serviço
2. criar ou editar um departamento
3. criar ou editar uma política

Confirmar:

1. PT salva corretamente
2. toast de sucesso aparece
3. warning aparece só quando tradução falha
4. status de tradução atualiza

## Validação pública
Para um hotel real de teste:

1. abrir `?lang=pt`
2. abrir `?lang=en`
3. abrir `?lang=es`

Confirmar:

1. página carrega
2. layout continua íntegro
3. fallback para PT funciona
4. WhatsApp funciona
5. links oficiais funcionam

## Validação visual
1. testar desktop
2. testar mobile
3. validar se botão flutuante não cobre assinatura
4. validar se brand signature está correta
5. validar se login está com branding correto

## Se algo falhar
1. identificar se o problema é de env
2. identificar se o problema é de banco
3. identificar se o problema é só visual
4. registrar o cenário
5. corrigir na branch antes de considerar produção

## Resultado de um deploy aprovado
1. admin funcionando
2. público funcionando
3. saves funcionando
4. tradução funcionando ou falhando sem bloquear PT
5. branding e apresentação corretos
