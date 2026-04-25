# LibGuest: workflow de branch, preview e main

## Objetivo
Definir um fluxo simples e seguro para evoluir o LibGuest sem comprometer a estabilidade de `main`.

## Regra principal
- `main` deve permanecer estável
- toda sprint ou hotfix relevante deve ser validada primeiro em branch de preview

## Fluxo recomendado
1. criar branch da sprint ou hotfix
2. implementar mudanças incrementais
3. validar localmente
4. publicar preview
5. validar preview
6. registrar decisões relevantes em `docs/PRODUCT_MAP.md`
7. só depois considerar merge para `main`

## Boas práticas
- evitar refatorações amplas sem necessidade
- listar arquivos antes de editar
- separar sprint de produto e hotfix de regressão
- preservar fallback e compatibilidade já validados

## Naming e domínio
- produto atual: `LibGuest`
- domínio operacional atual: `guestdesk.digital`
- o domínio não deve ser trocado em branch operacional sem decisão explícita
