# Sprint 46.6 — Homologação local dos temas do admin

Esta homologação deve ser feita somente em um ambiente local ou descartável. Não altere hotéis de produção.

## Preparação

Use quatro hotéis sintéticos já disponíveis no laboratório local ou crie-os pelo fluxo administrativo controlado do próprio laboratório. Para cada hotel, associe um usuário hotel-scoped e confirme o `brand_code` pelo `/platform`, nunca pelo `/admin`.

| Cenário | `brand_code` local | Tema esperado |
| --- | --- | --- |
| LibGuest Default | `NULL` | Navy neutro LibGuest |
| Grand Mercure | `grand-mercure` | Marfim, carvão e dourado contido |
| Mercure | `mercure` | Base clara, aubergine profundo e malva |
| Novotel | `novotel` | Base clara e azul contemporâneo |

O `theme_preset` pode ser variado entre os valores já permitidos. Ele refina apenas a superfície secundária. Sidebar, accent, texto, foco e contraste continuam governados pelo `brand_code`.

## Roteiro visual

1. Entre com o usuário sintético de cada hotel e abra `/admin`.
2. Confirme sidebar, item ativo, marca LibGuest, contexto do hotel e logo/fallback.
3. Percorra Dashboard, Informações do hotel, Apartamentos, Serviços, Departamentos, Políticas, Anúncios, Banners e Usuários.
4. Abra ao menos uma página `[id]`, um estado vazio e um formulário.
5. Em viewport de 390 px, abra o drawer e confirme que tema, item ativo, foco e contexto do hotel são preservados.
6. Confirme que verde, âmbar e vermelho mantêm o mesmo significado em todos os temas.
7. Abra `/platform` separadamente e confirme que sua identidade permanece neutra LibGuest.

## Restrições intencionais

- Não existe override por query string, localStorage ou payload do cliente.
- `theme_primary_color` não altera o tema administrativo.
- Um `brand_code` desconhecido cai defensivamente em LibGuest Default.
- Não há logos de bandeira embutidos; somente `logo_url` do hotel ou o fallback `LG`.
