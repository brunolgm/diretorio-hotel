# Tradução editorial canônica — Serviços

## Regra de produto

Todo novo campo editorial destinado à experiência PT/EN/ES deve integrar a tradução
automática canônica no salvamento, persistência, invalidação, fallback e revisão manual.
O funcionário preenche português; a revisão de EN/ES é opcional. Não se traduz durante
a digitação, a prévia ou a leitura pública. Exceções técnicas devem ser explícitas antes
da entrega; não se deve transferir ao hotel a obrigação de preencher três idiomas.

## Contrato implementado

O ponto existente `syncSectionTranslations` continua sendo chamado pelas actions de
criação, edição e nova tentativa. Usa o mesmo Google Cloud Translation v2 server-side
de `translation-service.ts`, em um batch por idioma e somente com campos elegíveis.
Não há um segundo provedor, fila, cadastro ou serviço externo de tradução.

| Fonte portuguesa | Persistência EN/ES | Comportamento |
| --- | --- | --- |
| `title`, `content`, `category`, `cta` | Colunas existentes de `hotel_section_translations` | Tradução editorial |
| `guest_presentation.summary.pt` | `hotel_section_translations.guest_fields.summary` por idioma | Tradução editorial |
| `guest_presentation.hours.pt` | `guest_fields.hours` | Traduz palavras e preserva valores |
| `guest_presentation.location.pt` | `guest_fields.location` | Traduz palavras e preserva identificação física |
| `guest_presentation.conditions.pt` | `guest_fields.conditions` | Tradução editorial |
| Área, grupo, interação e ícone | Enumerações/UI existentes | Internacionalização nativa; sem Google |
| URL, ID, token, ordem, visibilidade, códigos e valores | Contratos originais | Não enviados como campos editoriais |

`guest_presentation` permanece como fonte/configuração. Mapas EN/ES anteriores nesse
JSON continuam legíveis como legado e protegidos contra substituição automática.
Novas traduções usam a tabela filha canônica de idiomas, com `guest_fields` por linha.
Não há backfill de textos na migration.

`editorial_state` registra por campo origem (`auto`, `manual`, `legacy`), situação
(`current`, `stale`, `failed`) e revisão. Campos opcionais vazios em PT não contam como
pendência; uma linha EN/ES existente não basta para declarar todo o idioma completo.
Textos legados sem proveniência são preservados e identificados como origem anterior
não registrada; não se alega que receberam revisão humana ou que sua história foi auditada.

## Edição, revisão e concorrência

1. A edição portuguesa verifica a versão do formulário e grava com comparação de
   `updated_at` e tenant. O trigger avança a versão e invalida somente campos alterados.
2. Traduções automáticas ausentes, obsoletas ou com falha são elegíveis. Campos atuais
   não causam novas chamadas. Texto existente sem proveniência é tratado como legado
   protegido, não como autorização para sobrescrever.
3. O resultado é persistido pela RPC `save_current_hotel_service_translation`, que bloqueia
   a fonte e verifica versões da fonte e da tradução na mesma transação. Resposta atrasada
   recebe `false`; não sobrescreve fonte ou revisão mais recente.
4. Fonte alterada não apaga texto manual. Ele fica preservado para revisão; a leitura
   pública usa PT enquanto estiver obsoleto. Salvar revisão vincula os campos ao PT atual.
5. Nova tradução por idioma mantém manuais por padrão. “Retraduzir tudo” usa a confirmação
   existente do Admin para autorizar substituição. Falha do provedor não substitui um manual.
6. Falha de tradução não desfaz o salvamento português. A situação fica pendente/falha e
   a ação “Traduzir pendências” permite recuperação. O timeout de tradução é de dez segundos.

Revisões antigas anteriores ao controle de proveniência não podem ser reconstruídas
retroativamente. A invalidação torna-se verificável a partir das próximas edições.

## Proteção dos textos e do banco

O adapter preserva literais numéricos, preços, ramais, URLs, emails, UUIDs, siglas,
códigos físicos como `Piso L`, termos de identidade/cidade do hotel e nomes em CamelCase
por marcadores restaurados após a resposta. Campos somente numéricos não chamam Google.
Os marcadores esperados precisam retornar; falha mantém PT. Nomes próprios livres não
reconhecidos pelo contexto e escolhas linguísticas continuam sujeitos à qualidade do
Google e à revisão editorial opcional. Não é um reconhecimento universal de entidades.

A migration aditiva `20261126053504_service_editorial_translation_state.sql` requer
`20261126031405_guest_service_presentation.sql`. Adiciona duas colunas JSONB na tabela
filha existente, limites de 20 KB/16 KB, invalidação e persistência com comparação de versões.
Não altera RLS ou grants amplos. Novas colunas não têm grants diretos de escrita para
authenticated; a RPC confere `auth.uid()`, perfil ativo, hotel ativo, papel operador,
módulos de serviços/idiomas, tenant, idioma, allowlist e limites. Funções auxiliares são
revogadas dos papéis de API; RPC não permite anon ou service_role. `search_path` é fixo.
Security definer permite apenas essa gravação editorial transacional limitada, sem
conceder UPDATE de tabela ou poderes operacionais.

Validada apenas em `supabase_db_libguest-45b-lab`. Nenhuma migration foi executada em
produção. A history produtiva não foi consultada nesta etapa. Para publicação futura,
revisar/aplicar as duas migrations na ordem, conferir grants/constraint/RLS, depois publicar
o código e fazer smoke autorizado. Não apagar metadados para recuperar a apresentação.

## Preenchimento retroativo controlado

O botão “Traduzir pendências deste hotel (até 5 serviços)” é uma ação explícita no
cadastro existente. Consulta somente o hotel do operador, identifica campos elegíveis,
processa até cinco serviços e no máximo dez batches por execução. Não roda na abertura
da tela nem no acesso público. Usa a mesma seleção e persistência da gravação individual.
Reexecutar com tudo atual não faz chamadas ao provedor. Campos manuais para revisão não
bloqueiam a seleção dos demais serviços automáticos.

Procedimento futuro autorizado: escolher o hotel, revisar pendências/lista e qualidade
do PT, executar um lote, conferir situações por idioma e repetir enquanto houver campos
automáticos elegíveis. Revisar os manuais separadamente; não usar “Retraduzir tudo” como
backfill silencioso. Em falha do provedor, interromper novas tentativas até recuperação.
O seletor atual lê até 1.000 serviços por hotel; catálogos maiores exigem execução
individual para registros fora dessa janela ou paginação posterior. Não houve lote
em hotéis produtivos. A idempotência foi testada com tenant sintético local.

## Validação e limites da evidência

- 21 testes direcionados: seis cenários do novo fluxo e 15 de catálogo/preservação.
- 23 verificações autenticadas com banco, RLS, Admin e Server Actions reais, em hotel
  sintético, com Google simulado; inclui falha, recuperação, alteração de um campo,
  zero chamadas quando nada muda, concorrência, isolamento e leitura pública PT/EN/ES.
- Google real: dois batches, oito campos por idioma, exclusivamente textos sintéticos;
  valida adapter e conservação de literais. Persistência autenticada foi testada com
  o provedor simulado, não com conteúdo de hotéis reais.
- Densidade: sete de oito serviços no Bugan em 390×900 e 390×844, sem mudança do CSS público.
- TypeScript, lint direcionado e build; suítes operacionais históricas não repetidas.

Capturas autenticadas são feitas após releitura da página canônica para verificar dados
persistidos. O indicador de desenvolvimento do Next é ocultado apenas na captura; erros
de navegador continuam sendo verificados. A ausência de mídia editorial no laboratório usa
o fallback existente. Não houve modificação de Analytics; as visitas de teste foram locais.

O advisor local sinalizou a view pré-existente `public.public_hotels` como security definer.
Esta entrega não cria ou altera views. O achado permanece documentado, sem ampliar o escopo
ou alterar permissões de outros módulos. Os novos contratos passaram nos checks específicos.

Referências de plataforma consultadas: [funções e privilégios Supabase](https://supabase.com/docs/guides/database/functions),
[Cloud Translation](https://docs.cloud.google.com/translate/docs/translate-text).


## Fechamento autorizado de produção — 26/11/2026

A revisão manual agora envia somente os campos cujo texto foi alterado ou cuja
confirmação individual foi marcada. Salvar um resumo EN não converte horário,
localização e demais campos automáticos em manuais. Uma confirmação explícita por
campo permite revisar a fonte alterada sem modificar uma tradução já correta.
A proteção concorrente compara as versões da fonte e da tradução antes da gravação
e novamente no RPC. O caso foi confirmado em sete testes de tradução e nas 23
verificações autenticadas afetadas, repetidas apenas por esta correção real.

A publicação foi expressamente autorizada. O fechamento usa somente as migrations
`20261126031405` e `20261126053504`, nessa ordem, preservando o histórico produtivo
existente, inclusive as migrations paralelas do SmartMenu. Backup lógico privado
inclui roles, schema, dados e histórico, com hashes e instruções de recuperação.
Não há tradução retroativa em massa nem edição de registros reais para teste.
O relatório de publicação registra a aplicação efetiva, o deployment e o smoke.
