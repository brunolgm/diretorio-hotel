# Guest Experience Premium — Serviços V4

## Checkpoint e decisões de 26/11/2026

Branch `feat/guest-experience-premium-services`, base `a1b146f`, árvore inicialmente limpa.
Referência `origin/main` local: `c2abc7b`. Não houve fetch/push ou integração automática.
Worktrees paralelos identificados: SmartMenu (`745d7d0`), traduções (`bbf2abb`), RC
(`db2810c`), laboratório comercial (`52db1ef`), impressão e KDS. Nenhum arquivo desses
worktrees foi modificado. As implementações internas do SmartMenu e ordering permanecem intactas.

O briefing aprova agrupamento por intenção, linhas compactas, detalhe em sheet/modal,
Room Service unificado, busca/filtros e iconografia universal. A implementação é local.

## Implementação

Serviços V4 usa o cadastro existente e uma projeção compartilhada, sem seleção por slug.
Grupos vazios desaparecem; categorias desconhecidas e conteúdo novo permanecem visíveis.
Oito entradas são o resultado da fixture Bugan, nunca um limite imposto aos demais hotéis.
Presets, fontes e variáveis de marca existentes continuam sendo a fonte de aparência.
Hotéis sem apresentação V4 mantêm sua listagem anterior.

A busca cobre título, categoria, conteúdo e metadados localizados, ignora acentos e oferece
limpeza. O contador aparece durante pesquisa/filtro, com singular/plural PT/EN/ES.
Filtros horizontais aparecem a partir de oito entradas e duas categorias. Informação
curta permanece diretamente na linha, sem chevron. Descrições maiores e condições usam
detalhe. Ações externas e experiências dedicadas mantêm seus destinos; guias publicados
sempre conservam página própria, mesmo com descrição curta.

`GuestServiceExplorer` reutiliza Dialog/Base UI: sheet mobile, modal desktop, foco
contido/restaurado, Escape, retorno do navegador, rolagem interna e safe area. O tema
é propagado ao portal. A listagem permanece montada e preserva busca, filtro e rolagem.
Atendimento pode mostrar um CTA único para o canal já cadastrado. Não há pedido fictício.
O contrato atual não tem fotos próprias de cada serviço: guias e mídia editorial continuam
em suas páginas dedicadas, sem imagens inventadas ou associação por suposição.

A navegação desktop interna apresenta hotel, páginas e reserva quando cadastrada;
o seletor de idioma permanece no cabeçalho. A faixa fotográfica reaproveita a imagem
hero já cadastrada, quando disponível, apenas no desktop. O dock Bugan não possuía
ocultação responsiva no componente, causa da aparição em desktop; agora desaparece
a partir de 1025px. Os docks internos V4 preservam Início / Serviços / Informações /
Contato. Serviços usa grid, Room Service cloche e piscina ondas. A Home foi preservada,
com ajustes somente nos ícones desses atalhos.

## Room Service e plano editorial

O snapshot público histórico autorizado tem 13 registros. Um acesso nativo pode ser
derivado do grafo F&B sem constituir outro cadastro. A fixture acrescenta um 14º acesso
**sintético** para testar deduplicação. O inventário produtivo atual de 14 acessos citado
no pedido não foi lido nem alterado nesta execução; sua composição exata permanece pendente.

Com destino nativo elegível, o catálogo reúne referências associadas ao outlet ou nomes
explícitos de Room Service em uma entrada, chamando `roomServiceAccess`. Consulta pública,
pedido autorizado e contexto de apartamento seguem os contratos existentes. Sem destino
nativo elegível, links externos/QR do hotel são preservados. Goomer não é excluído da fonte.
Restaurante Filipe mantém seu vínculo F&B próprio. Restaurante sem vínculo verificável
não é ocultado por inferência quando há grafo F&B.

Nesta base o resolvedor retorna `/explorar/cardapio#outlet-*`; na branch SmartMenu ele
usa `buildRoomServiceHref` e rota própria. A nova camada consome o resolvedor sem hardcode
dessa rota, e o teste compara seu resultado. Na integração, revisar catálogo, navegação
e rotas compartilhadas. Nenhum contrato de ordering, KDS, bridge, impressão, Goomer,
TheX, analytics, entitlements, permissões, turismo ou Voos foi alterado.

O manifesto `docs/bootstrap/guest-service-editorial-plan-20261126.json` contém IDs,
valores esperados e destinos propostos. O gerador `scripts/guest-service-editorial-plan.mjs`
é determinístico e não usa cliente de banco. Executar com:

```powershell
node --import ./scripts/bootstrap-runtime.mjs --experimental-strip-types scripts/guest-service-editorial-plan.mjs
```

A projeção é idempotente. Antes de persistir classificação, confrontar o inventário atual,
vínculos, timestamps e ambiguidades. Não há executor de escrita produtiva nesta entrega.

| Conteúdo histórico | Apresentação |
| --- | --- |
| Conheça o hotel; Acomodações | Editorial existente na Home; conteúdo completo também em Informações |
| Wi-Fi; Segurança | Informações, essenciais e canais existentes |
| Restaurante Filipe | Gastronomia pelo vínculo F&B; fallback editorial sem grafo |
| Room Service | Uma entrada nativa elegível; fonte e Goomer preservados |
| Lavanderia; Menu de travesseiros | Conforto e conveniência |
| Piscina; Academia; Sauna; Spa dos Pés | Lazer e bem-estar |
| Estacionamento | Mobilidade |

A inferência usa vínculos, ações, ícones e termos conhecidos PT/EN/ES, nunca slug.
Metadados explícitos do Admin têm prioridade. Textos/categorias desconhecidos continuam
acessíveis. O teste dos cinco hotéis usa identidades distintas e 40 entradas adicionais
sintéticas no Grand Mercure, sem alegar reproduzir seu catálogo produtivo.

## Admin e schema

`GuestServiceFields` integra os formulários existentes. Nome, descrição, categoria, ícone,
ordem, visibilidade, CTA e URL são reaproveitados. Detalhes avançados permitem área,
agrupamento, interação e resumo/horário/local/condições PT/EN/ES. O resumo fica na linha;
a descrição completa permanece no detalhe. A prévia reage às opções avançadas e usa o
componente público real, sem canais operacionais. Campos opcionais usam fallback por
campo via `translatedText`; os novos textos são editoriais manuais. O fluxo automático
existente continua responsável por título, descrição, categoria e CTA.

Migration aditiva `20261126031405_guest_service_presentation.sql`: coluna JSONB opcional
em `hotel_sections`, objeto até 20 KB. Não modifica RLS, grants, roles, triggers ou dados.
O parser aceita somente campos enumerados e textos limitados. Metadados não fornecem
autorização, URL operacional ou tenant. O loader público e as traduções já preservam
campos por spread de `select('*')`, sem outra consulta ou tradução durante a leitura.

A migration passou no Postgres local `supabase_db_libguest-45b-lab`, em transação,
com JSON válido e rejeição de array/payload excessivo. Houve ROLLBACK integral: não
ficou aplicada nem no laboratório. **Antes de publicar os formulários, disponibilizar
a coluna pela migration no processo autorizado.** Nenhuma migration foi aplicada em produção.

## Validação e evidências

- TypeScript, build Next.js e lint direcionado aprovados, sem erros/warnings de lint.
- 12 testes direcionados: catálogo, cinco tenants/idiomas, isolamento, alto volume,
  Goomer, ação QR, guia dedicado, metadados, idioma e essenciais.
- 30 cenários browser: cinco hotéis × três idiomas × 390/1440, com busca, limpeza,
  filtros, vazio, detalhe, Escape/retorno, foco, overflow e dock desktop.
- Capturas adicionais de Informações e configuração Admin com prévia reativa.
- Cookie HttpOnly sintético preservado: não representa autorização por QR real.
- SQL e limites da migration validados no laboratório, com rollback.
- `git diff --check` aprovado. Não foram repetidas as suites históricas completas.

Capturas reais dos componentes em `out/guest-experience-premium-services/`, fora do commit:
`services-4-pt-390.png`, `services-4-pt-1440.png`, `detail-4-pt-390.png`,
`filter-4-pt-390.png`, `information-mobile.png`, `admin-service-configuration.png`,
`services-0-pt-390.png` (Grand com volume), demais hotéis/idiomas e `browser-report.json`.
As imagens foram inspecionadas: grupos compactos, ações sem botões redundantes, detalhe
acima do dock e dock ausente no desktop. O mockup final de Serviços não foi anexado nem
localizado nas referências, portanto não se afirma comparação pixel a pixel.

## Arquivos, integração e limites

Criados: bibliotecas `guest-service-presentation` e `guest-service-catalog`, explorador/CSS,
campos Admin, migration, gerador/plano editorial, fixtures e testes direcionados.
Editados: `hotel-public-area-content`, `public-area-hero`, `public-bottom-dock`,
`public-experience-mobile-tasks`, `public-experience-overview`, `service-icon`,
`app/globals.css`, páginas/actions de Serviços Admin, `types/database.ts` e PRODUCT_MAP.
Reaproveitados: Dialog/Base UI, ServiceIcon/Lucide, campos Admin, seletor de idioma,
componentes de marca, guias, rotas públicas e resolvedor de Room Service.

Riscos e pendências: conferir classificação com conteúdo produtivo atual; integrar
SmartMenu sem sobrescrever seus arquivos; aplicar migration antes dos formulários;
homologar contextos reais e Admin autenticado; comparar o mockup aprovado quando disponível.
Não houve pedidos, impressão, mutação produtiva, push, merge ou deploy. O commit local
desta branch é a referência de entrega (`git log -1`); não há SHA circular neste documento.
