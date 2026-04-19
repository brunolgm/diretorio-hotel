# GuestDesk: workflow de branch, preview e main

## Objetivo
Definir um fluxo simples para não misturar experimentos com a branch estável.

## Regra principal
`main` deve permanecer estável.

## Fluxo recomendado
1. criar branch para o sprint ou tema
2. desenvolver nessa branch
3. validar em preview
4. corrigir o que aparecer no preview
5. só depois considerar merge para `main`

## Convenção prática
Exemplos:

1. `sprint-3-translation-ops`
2. `sprint-4-brand-finish`
3. `hotfix-login-copy`

## O que deve ir para preview
1. mudanças visuais
2. mudanças de banco
3. mudanças de tradução
4. mudanças de deploy
5. qualquer mudança com risco de apresentação ou operação

## O que validar no preview
1. login
2. admin
3. página pública
4. save real
5. tradução
6. mobile
7. branding e copy

## Quando considerar pronto para main
1. build passou
2. lint passou
3. preview aprovado
4. checklist pós-deploy validado
5. escopo do sprint está fechado

## O que evitar
1. commit direto em `main`
2. misturar muitos temas na mesma branch
3. abrir sprint novo antes de estabilizar o anterior
4. publicar sem validar preview

## Fluxo curto ideal
1. abrir branch
2. implementar
3. validar local
4. publicar preview
5. revisar
6. ajustar
7. aprovar
8. mergear

## Observação prática
Quando houver mudança sensível:

1. banco
2. tradução
3. branding público
4. deploy

sempre tratar preview como etapa obrigatória, não opcional.
