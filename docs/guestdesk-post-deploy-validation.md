# LibGuest: validação pós-deploy

## Objetivo

Confirmar estabilidade, isolamento multi-hotel e compatibilidade pública depois da publicação.

## Validação técnica rápida

1. abrir landing e testar login
2. validar loading, erro recuperável, acesso negado e recurso não encontrado
3. abrir dashboard e conferir a checklist operacional sem assumir publicação completa
4. revisar todos os módulos administrativos do hotel autenticado
5. validar criar/editar/status/excluir/retraduzir quando a entrega tiver alterado essas operações
6. validar slug, subdomínio principal e domínio legado
7. validar PT/EN/ES e fallback em português
8. testar contatos, reservas, site e analytics básicos
9. testar QR e cardápio por apartamento sem regenerar roomToken
10. validar nome institucional, hero configurado e fallback sem imagem somente no hotel autenticado
11. no preset Novotel, abrir as seis áreas via slug e subdomínio e confirmar os estados vazios sem perda da navegação inferior
12. em 320, 390 e 430 px, rolar até o último card e confirmar que banner, ajuda, CTAs e conteúdo final permanecem acima da navegação fixa

## Validação dos quatro hotéis

Repetir com um usuário próprio de cada hotel:

| Hotel | Slug | Subdomínio |
| --- | --- | --- |
| Novotel Salvador Rio Vermelho | `novotelrv` | `novotelsalvador` |
| Grand Mercure Rio de Janeiro Copacabana | `grandmercureriocopacabana` | `grandmercurecopacabana` |
| Novotel Rio de Janeiro Leme | `novotelrioleme` | `novotelleme` |
| Mercure Rio Boutique Copacabana | `mercurerioboutiquecopacabana` | `mercurerioboutique` |

Em cada execução, confirmar que dashboard, listas, páginas por ID, analytics e uploads mostram apenas o hotel esperado. Não usar IDs copiados de outro hotel em operação destrutiva; tentativas controladas devem ocorrer apenas em preview e retornar estado neutro.

## Critérios de interrupção

- conteúdo de outro hotel visível ou mutável
- slug ou subdomínio resolvendo o hotel errado
- QR existente deixando de funcionar sem rotação intencional
- erro técnico ou detalhe do banco exposto ao usuário
- ação informando sucesso sem a alteração correspondente

## Diagnóstico seguro

- registrar módulo, ação e momento da falha
- usar os logs curtos do servidor, que podem conter hotel e alvo para correlação
- nunca registrar senha, token, secret, arquivo completo, URL privada ou payload integral
- preservar a mensagem genérica na interface e investigar detalhes somente nos logs autorizados

## Antes do handoff

- confirmar experiência em celular e desktop
- registrar endereço principal e fallback por slug
- separar pendências técnicas de pendências de conteúdo
- encaminhar a validação para `guestdesk-client-handoff.md`
