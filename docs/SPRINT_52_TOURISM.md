# Sprint 52 — Turismo: contrato técnico canônico

## Estado e escopo da 52.1

Fundação local de domínio/banco/autorização, a partir de `sprint-52-tourism`, HEAD
`5b42ec1fdd31337efc367df7ea18420da314a10a`. Migration:
`20260910043520_52_1_tourism_foundation.sql`. Este documento complementa o
[PRODUCT_MAP](PRODUCT_MAP.md), sem substituir registros históricos da experiência pública.

A migration ainda não foi aplicada ao Supabase remoto. `content.tourism` permanece
`coming_soon`, opt-in, fora do baseline e sem provisionamento para qualquer hotel.
Os testes habilitam o módulo apenas em hotéis sintéticos dentro de uma transação local
revertida. Disponibilidade e habilitação real dependem da entrega coordenada de Admin,
experiência pública, guards e testes nas próximas etapas.

## Catálogo global

`lib/tourism/catalog.ts` é a referência de labels PT/EN/ES e chaves estáveis.
São três tipos e quinze pares. Não há categorias livres nem CRUD de categorias.

| Tipo | Categorias |
|---|---|
| PLACE | sights, beaches_and_nature, culture_and_history, neighborhoods_and_regions, shopping |
| EXPERIENCE | tours, local_culture, nature_and_adventure, nightlife, wellness |
| GASTRONOMY | restaurants, bars, cafes_and_bakeries, local_cuisine, markets_and_fairs |

O CHECK SQL valida o par exato. Teste de paridade impede divergência entre TS e SQL.
Labels traduzidos nunca determinam classificação, ownership ou identidade analítica.

## Persistência

`public.hotel_tourism_items` é o único domínio, sem ligação com Serviços.

| Campo | Contrato |
|---|---|
| id | UUID próprio, PK, gen_random_uuid(), imutável |
| hotel_id | UUID obrigatório, FK hotels com ON DELETE CASCADE, imutável |
| slug | text obrigatório, 1–100, `^[a-z0-9]+(-[a-z0-9]+)*$`, único por hotel e imutável |
| name | text PT obrigatório, 1–160 |
| type / category_key | text obrigatório, catálogo fechado e CHECK do par |
| short_description | text PT obrigatório, 1–500 |
| full_description | text opcional, até 10.000 |
| main_image_path | text opcional, até 512, ownership exato no caminho |
| address | text opcional, até 500 |
| map_url / official_website_url | text opcional, até 2.048, HTTP/HTTPS absoluto |
| phone / whatsapp_number | text opcional, `^\+[1-9][0-9]{1,14}$` |
| opening_hours | text PT opcional, até 1.000 |
| price_info | text PT opcional, até 300; sem cálculo monetário |
| duration_info | text PT opcional, até 200; permite intervalos e aproximações |
| recommended_by_hotel / featured | boolean obrigatório, false por padrão |
| sort_order | integer obrigatório, default 0, >=0 |
| is_published | boolean obrigatório, false por padrão |
| created_at / updated_at | timestamptz obrigatório, default now(), controle pelo banco |

Opcionais ausentes são NULL. RPC normaliza espaços externos e vazio para NULL;
constraints rejeitam texto vazio/não aparado persistido diretamente. Obrigatórios
continuam obrigatórios em itens não publicados. Texto é simples: caracteres de controle
indevidos e delimitadores `<`/`>` são rejeitados; não há renderização HTML.

URLs rejeitam credenciais, controles e esquemas alternativos. O SQL aplica uma gramática
conservadora de host/URL; `lib/tourism/validation.ts` oferece validação com URL parser para
as futuras operações server-side. Não há fetch dessas URLs. Host internacional pode
precisar de normalização para punycode na futura interface; não há integração de rede aqui.

Índices: PK id, UNIQUE(hotel_id,slug), (hotel_id,sort_order,id) administrativo e o mesmo
índice parcial WHERE is_published. Não há índices isolados de flags/tipo/categoria.

## Traduções e concorrência

`public.hotel_tourism_item_translations` segue o padrão existente: **id UUID próprio**,
PK com gen_random_uuid(), item_id FK com ON DELETE CASCADE e UNIQUE(item_id,language).
Idiomas apenas en/es. item_id, language, id e created_at são imutáveis.

Campos opcionais traduzidos e limites: name 240, short_description 750,
full_description 15.000, opening_hours 1.500, price_info 450, duration_info 300.
Pelo menos um deve ser não nulo. created_at/updated_at são timestamptz obrigatórios.
Não se traduzem tipo, categoria, slug, endereço, contatos ou URLs.

A edição PT invalida somente os campos alterados de EN/ES na mesma transação. Se uma
tradução ficar inteiramente vazia, ela é removida antes de violar o CHECK. Os demais
campos permanecem. Uma falha futura do provedor não desfaz o PT já salvo.

A RPC de tradução trava o hotel e o pai, compara a revisão exata e retorna false sem
gravar/auditar quando o resultado estiver obsoleto. Não há coluna extra de versão.
updated_at usa clock_timestamp e avanço mínimo de um microssegundo sobre a revisão
anterior, inclusive dentro de uma mesma transação. Reordenação/flags também avançam a
revisão: conservadoramente, uma tradução em voo pode precisar ser repetida.

O futuro consumidor deve preservar o timestamp retornado como string integral; não
reduzi-lo a milissegundos com Date antes de enviá-lo de volta. Fallback público será PT
por campo. Google Translation e a UI de idiomas não foram integrados nesta etapa.

## Autorização, grants e RPCs

RLS ativa em ambas as tabelas. Público exige item publicado, hotel publicamente ativo,
core.directory e content.tourism. Tradução exige explicitamente esses critérios no pai
e content.languages; não se apoia apenas na visibilidade administrativa do pai.

Leitura administrativa: visualizador ou superior, perfil ativo, próprio hotel não
arquivado e entitlement de Turismo. Identidade global não concede edição hoteleira.
Páginas públicas futuras devem usar cliente anônimo e resolver hotel + slug do item:
a RLS permite conteúdo publicado, mas não conhece o subdomínio da requisição.

anon/authenticated têm somente SELECT nas tabelas, condicionado à RLS. authenticated
recebe EXECUTE apenas nas quatro RPCs públicas abaixo. DML direto, grants por coluna
de escrita e defaults de execução PUBLIC são explicitamente revogados. service_role
não recebe acesso de Turismo nesta etapa: os fluxos implementados usam sessão do operador.

| RPC | Contrato |
|---|---|
| save_current_hotel_tourism_item(item_id, changes, expected_updated_at?) | item_id NULL cria; UUID atualiza por patch fechado. Revisão obrigatória em atualização. Também publica/despublica. Retorna uma linha do item. |
| reorder_current_hotel_tourism_items(item_ids) | Conjunto completo do hotel, array unidimensional sem nulos/duplicados/IDs estrangeiros. Retorna catálogo ordenado. Array vazio aceito somente para catálogo vazio. |
| delete_current_hotel_tourism_item(item_id, expected_updated_at) | Hard delete com revisão obrigatória; retorna id excluído e caminho proprietário para cleanup futuro. |
| save_current_hotel_tourism_translation(item_id, language, expected_updated_at, changes) | Patch fechado dos seis campos traduzíveis; exige languages; true se salvo, false se revisão obsoleta. |

As quatro RPCs são SECURITY DEFINER, search_path vazio e relações qualificadas.
Funções auxiliares estão em tourism_private, sem USAGE/EXECUTE para papéis da aplicação.
Toda mutação resolve auth.uid(), perfil ativo, papel operador ou superior e hotel não
arquivado; valida entitlement. Não aceita hotel_id/ator/slug/timestamps no patch.
Imagem e sort_order também não são editáveis pelo patch genérico.

Um lock de linha no hotel serializa todas as mutações do catálogo, inclusive inserção
no catálogo vazio. Edição/exclusão verificam expected_updated_at e falham com 40001
em conflito. IDs fora do hotel retornam P0002 sem expor conteúdo estrangeiro.

## Slug, ordem, publicação e auditoria

Slug é gerado no banco pelo nome PT com NFD, remoção de acentos, caixa baixa e hífens.
Fallback `item`. Primeira tentativa usa a base; colisões usam UUID do item e contador,
com nove tentativas no máximo e UNIQUE(hotel_id,slug). Não é global e não muda com nome.

Criação insere no final, sob lock; reorder atribui posições 0..N-1. Ordem de consumo:
sort_order ASC, id ASC. Múltiplos destaques/recomendações são permitidos e não reordenam
nem publicam itens. Despublicação é reversível e preserva conteúdo/traduções/imagem.

Todas as mutações registram admin_audit_log na mesma transação. Falha na auditoria
reverte a operação inteira. entity_type: hotel_tourism_item. Ações: tourism.created,
tourism.updated, tourism.published, tourism.unpublished, tourism.reordered,
tourism.deleted. Tradução usa tourism.updated com language, sem conteúdo.

Metadata é construída no banco, sem parâmetro livre: type, category_key, featured,
recommended_by_hotel, is_published, item_count ou language. Não inclui contatos,
descrições, URLs, dados de hóspede ou payload do tradutor. Audit log histórico permanece
após exclusão. Não foi criado evento de imagem.

Hard delete exige ação explícita do futuro Admin; a confirmação pertence à 52.2.
Não há deleted_at, archive, lixeira ou restauração via auditoria.

## Imagem e integrações futuras

Somente a coluna e sua constraint existem. Caminho:
`<hotel_id>/tourism/<item_id>/<uuid>.<jpg|jpeg|png|webp>` no bucket existente hotel-assets.
Uma imagem; futuro upload validará bytes/MIME, até 2 MiB, 6000x4000 e 24 milhões de pixels.
Nenhum upload, bucket, objeto, policy Storage ou RPC de associação foi criado.

No futuro: upload novo sem sobrescrita; associar sob controle de revisão; remover novo
upload se associação falhar; remover anterior após commit bem-sucedido; cleanup após
delete, idempotente e com retry operacional. Banco e Storage não compartilham transação.
Bucket público não garante segredo de URL de imagem após despublicação.

UUID permanente e chaves canônicas permitem analytics futuros por item/tipo/categoria.
Não há eventos ou PII novos. O contrato futuro de eventos deverá preservar identidade
histórica/classificação sem FK destrutiva para o item.

## Limites de escopo e continuidade

Não há Admin, UI pública, Home, grid, docks, public-routes, mudanças de layout, eventos
analíticos ou alteração da Central de Voos. O legado continua intacto: sem alteração de
hotel_sections, filtro textual, backfill, migração ou FK com Serviços. Migração será
explícita por hotel, sem inferência por palavras-chave.

Futuras rotas: /hotel/[hotelSlug]/explorar/turismo e /[itemSlug] abaixo dessa listagem;
subdomínio usa /explorar/turismo e /explorar/turismo/[itemSlug]. Corte do legado será
coordenado, sem união automática. Home futura exige módulo habilitado e >=1 publicado.

Fora do MVP: avaliações, distância/coordenadas, reserva, comissão, parceiro, voucher,
pagamento, afiliado, IA e galeria múltipla. Não há categoria editável por hotel/global.

## Verificação reproduzível

`npm run test:security` cobre catálogo, limites, normalização, URLs/contatos, superfície
RPC, paridade SQL e regressão de escopo. `npm run lint`, `npm run build` e
`git diff --check` completam a verificação da aplicação.

`supabase/tests/52_1_tourism_local_lab.ps1` tem destino fixo no Docker local
supabase_db_libguest-45b-lab. Executa BEGIN + migration + matriz + ROLLBACK. Não recebe
URL remota, não registra migration e não deixa fixtures. O laboratório precisa conter
os contratos anteriores reais (auth, hotéis, entitlements, helpers e auditoria).

Matriz comportamental: constraints/limites, UUIDs, pares, slugs entre hotéis, imutabilidade,
flags/ordem, traduções/invalidacão/revisão/cascata, público/idiomas/entitlements/lifecycle,
visualizador/operador/global/inativo, DML negado, conjunto completo no reorder e rollback
de criação/edição/exclusão quando a auditoria falha. Testes com múltiplas conexões
simultâneas não estão incluídos; a serialização usa locks nativos e o mesmo caminho em
todas as RPCs. A matriz não substitui validação futura no ambiente de destino aprovado.

Cobertura dos requisitos numerados: 1–5 catálogo/paridade + pares SQL; 6–12 validação
TS e constraints SQL; 13–25 matriz de identidade/flags/traduções; 26–40 RLS, grants,
papéis e patches; 41–47 RPCs e falha induzida de auditoria; 48–55 teste de escopo,
catálogo de módulos inalterado e ausência de provisionamento na migration.

Resultado local da implementação: 293 testes de segurança aprovados; lint sem erros
(quatro avisos preexistentes de `<img>` em arquivos fora do escopo); build aprovado;
matriz SQL rollback-only aprovada; diff-check sem erros de whitespace. Nenhum banco
remoto foi alterado; nenhuma migration foi aplicada permanentemente ao laboratório.
