# LIBGUEST V4 — Guest Experience Premium — Admin e tradução automática — RC definitiva

## Fechamento definitivo — Admin e tradução automática — 26/11/2026

A RC visual `f58e9574a6c0739767453b463e54496b43850b11` foi preservada. A branch
continua `feat/guest-experience-premium-services-rc`; o checkout estava limpo no início.
A main local permanece em `96ad808628e8e06f9cd7968dde6741f6cbd50eda`, sem checkout,
merge, push ou alterações. Os demais worktrees, inclusive o SmartMenu paralelo, não
foram modificados. Não houve novo fetch ou alegação de sincronização remota nesta etapa.

O funcionário agora pode preencher somente PT. O Google canônico traduz título,
descrição, categoria editorial, CTA, resumo, horário, localização e condições no save.
Somente campos alterados/pendentes elegíveis geram requisições. Texto manual ou legado
é preservado; mudança da fonte sinaliza revisão e usa fallback PT até validação.
A persistência compara versões da fonte e da tradução em uma transação, descartando
respostas atrasadas. Falha do provedor mantém o cadastro em PT e permite nova tentativa.

O formulário foi organizado em informações básicas, apresentação com prévia real,
ações avançadas recolhidas e idiomas com resumo PT/EN/ES, revisão opcional e estados
por campo. Retradução que pode substituir manual exige confirmação. Opções por QR
só aparecem para módulo habilitado ou configuração legada existente. Guias mantêm
seu editor e contrato, em acesso avançado recolhido.

Uma ação explícita prepara o preenchimento retroativo de até cinco serviços do hotel
por execução, sem chamadas para campos atuais ou substituição silenciosa de manuais.
Não foi executada em produção. Detalhes e limite da janela de seleção de 1.000 registros
estão em [Tradução editorial canônica](SERVICE_EDITORIAL_TRANSLATIONS.md).

Migration nova: `20261126053504_service_editorial_translation_state.sql`, dependente
da migration de apresentação já existente. Adiciona `guest_fields` e `editorial_state`
na tabela de traduções existente, invalidação e RPC com allowlist, tenant, papel,
entitlements e comparação de versões. Não altera RLS/grants amplos, nem cria infraestrutura
paralela de tradução. Validada somente no Supabase local. Para completar o laboratório
foram carregados contratos existentes de guias e apresentação, sem alterar esses arquivos.
Ambas as migrations novas desta RC continuam pendentes de aplicação produtiva autorizada.

Validação: 21 testes direcionados de serviços; checks de compatibilidade dos helpers
compartilhados de tradução; 23 verificações autenticadas locais com Google simulado;
Google real em dois batches de oito campos com texto sintético, sem banco real de hotéis.
A persistência e os fluxos de revisão/falha foram validados com o provedor simulado.
A densidade permanece 7/8 em 390×900 e 390×844. TypeScript, lint e build compõem o gate.
Nenhum CSS, cabeçalho, sheet, dock ou agrupamento público homologado foi redesenhado.
A única mudança pública é o consumo de tradução atual e o fallback correto.

Os detalhes dos testes, proveniência, revisão, fallback, limitação de nomes próprios
livres e achado pré-existente do advisor local constam na documentação de tradução.
GO para RC definitiva local. Publicação continua NO-GO até revisão do pacote,
aplicação autorizada das migrations e autorização de publicação. Não houve dados
produtivos, lote produtivo, pedido, impressão, ativação V4, deploy, push ou merge.
O SHA final completo estará no relatório e manifesto do ZIP após o commit local.

As seções abaixo preservam a recuperação e as evidências da RC visual de origem;
a decisão de tradução manual dos metadados foi substituída pelo contrato acima.

## Refinamento visual final — 26/11/2026

Evolução local sobre `e047cf75cd4f2ab54c879407ac38ffe724a995b4`, na mesma branch RC.
A medição automatizada da primeira dobra mostra **7 de 8 serviços completos** no
Bugan em **390 × 900** e **390 × 844**, acima do dock e sem cortar textos essenciais.
Na fixture final, cinco linhas têm 64–65 px; Piscina e Sauna crescem para cerca de
80–81 px, e Estacionamento para 100 px, mantendo o conteúdo inline integral.
O oitavo serviço permanece na rolagem. A meta não foi obtida com alturas fixas,
fontes menores ou limite de itens. Títulos usam 16 px; resumos, 14 px.

Cabeçalho, busca e intervalos foram compactados. Filtros ficam disponíveis acima
de 12 serviços e mais de um grupo; a busca continua disponível nos catálogos pequenos.
Os agrupamentos ganharam hierarquia e marcação com a cor semântica do hotel.
Horário/localização substituem resumos redundantes na linha mobile quando cadastrados;
o texto completo continua no detalhe. A lista não aplica line-clamp.

Room Service conserva uma única entrada principal com o destino canônico existente.
O botão secundário de informação abre o texto editorial complementar completo em
sheet/modal, sem um bloco vertical adicional e sem botão aninhado dentro do link.
O sheet tem indicador de gaveta, tipografia do tema inclusive no portal, metadados
destacados, orientações em parágrafos e condições em seção própria quando cadastradas.
As informações do ramal permanecem exatamente no texto autorizado; não foi criado
um canal ou atendimento fictício.

O desktop reutiliza o componente extraído do cabeçalho da Home, preservando seu
markup e apresentação na Home. Logo, idioma, reserva configurada e navegação dos
módulos disponíveis aparecem no interior; a página ativa é identificada. A fixture
antiga também omitia reserva por ter `booking_url=null`; a nova usa URL de teste
explicitamente identificada, sem navegar nela. A fotografia usa o asset existente.

Informações agrupa Wi-Fi, café e horários em uma superfície, mantém check-in/out
lado a lado e preserva instruções completas, conteúdo suplementar, guias, apartamento
e políticas quando presentes. Na captura, a rede vem do conteúdo histórico autorizado;
horários de café e check-in/out são configuração local representativa, não comprovação
do cadastro produtivo. Não foram feitas alterações produtivas.

Grand Mercure conserva todos os 37 registros de origem no catálogo: 31 em Serviços,
cinco em Informações e um em Gastronomia, sem impor oito serviços. Foram harmonizados os grupos de
estadia/apartamento, lazer e transporte/estacionamento, mantendo serviços do bairro
e configurações explícitas. Fidelidade permanece em Conforto; informação institucional
identificada permanece em Hotel; chamada social vai para Contato; estacionamento
legado em Estrutura passa a Mobilidade na projeção. Nenhum registro foi reescrito.
Novotel Salvador e o preset atual do Leme permanecem preservados em prévias locais;
os hotéis em V3 não foram ativados em V4.

Validações desta etapa: TypeScript, lint direcionado, build e 28 testes direcionados;
30 cenários browser (cinco identidades × três idiomas × duas larguras), mais medição
de dobra, conteúdo complementar, metadados do sheet, Informações e prévia Admin.
As sete verificações autenticadas anteriores continuam como evidência técnica da RC
de origem e não foram executadas novamente. A galeria distingue essa captura histórica
do Admin autenticado da prévia visual atual. Não houve nova migration ou mudança de
permissões, entitlements, SmartMenu, Ordering, KDS, Bridge, impressão ou provedores.

As imagens de primeira dobra mantêm a viewport real. As imagens de listagem completa
expandem somente a região de captura e colocam o dock no fim para documentar todo
o conteúdo rolável; não são usadas para medir densidade. Títulos/categorias de Grand
e Novotel vêm da reconciliação autorizada; descrições continuam sintéticas e identificadas.
O SHA completo final é registrado no relatório de entrega e no `release-report.json`
do ZIP após a criação do commit, evitando referência circular no próprio commit.

## Estado e recuperação — 26/11/2026

Branch final: `feat/guest-experience-premium-services-rc`, baseada em `origin/main`
`f6f593a`, confirmado por fetch HTTPS. A autenticação SSH falhou; nenhuma configuração
SSH foi alterada. A main local (`96ad808`) não foi modificada.

A branch original `feat/guest-experience-premium-services` preserva o checkpoint
`b148a49`, contendo as 26 alterações recuperadas sobre `a1b146f`. O checkpoint foi
transferido por cherry-pick para a RC (`a135454`), sem conflitos e sem levar alterações
operacionais antigas de impressão para a base nova. Não houve reset, stash, git clean,
rebase ou merge na main. O SHA final é o commit de fechamento desta branch (`git log -1`).

O `.next` corrompido foi comprovado como diretório gerado, ignorado e sem arquivos
rastreados ou links; somente esses artefatos foram removidos e regenerados. A segunda
retomada encontrou BUILD_ID e manifests íntegros. Não havia processo residual de build
identificado neste checkout. Worktrees de SmartMenu, traduções, RC, laboratório
comercial, impressão e KDS permaneceram separados e não foram editados.

## Apresentação e preservação de conteúdo

As nove decisões aprovadas estão aplicadas à apresentação V4: arquitetura da informação,
grupos por intenção, linhas compactas, Room Service unificado por experiência, detalhe
em sheet/modal, busca/filtros adaptáveis, iconografia, Admin e contratos universais.
Não existe limite de oito serviços para outros hotéis. Categorias desconhecidas ficam
visíveis e grupos vazios não são renderizados. Sem serviços, a página usa o estado
editorial vazio existente, sem pesquisa ou filtros inúteis.

Busca por título, categoria, conteúdo, resumo e metadados localizados, sem acentos;
limpeza, resultados singulares/plurais PT/EN/ES e filtros acima de doze entradas e
mais de um grupo. Textos completos ficam acessíveis no detalhe ou em informação
complementar junto ao acesso dedicado. Horário/localização cadastrados aparecem nas linhas.
Não são inventados horários, canais, fotos ou condições ausentes.

Dialog/Base UI existente fornece foco contido/restaurado, Escape, retorno do navegador,
rolagem interna, safe area, sheet mobile e modal desktop. A lista permanece montada,
preservando busca, filtro e rolagem. Guias publicados, TV/canais legados e ações por
apartamento conservam página dedicada. Não há solicitações digitais fictícias.

A causa do dock Bugan no desktop era a ausência de ocultação responsiva no componente.
Ele agora desaparece a partir de 1025px. O dock interno V4 preserva Início / Serviços /
Informações / Contato. Navegação superior, idioma e reserva cadastrada permanecem no
desktop. Foto discreta usa a mídia hero publicada do próprio hotel ou a imagem existente;
não há hero fotográfico mobile. Home, temas e fontes foram preservados, com ajustes
pontuais de ícones: Serviços grid, Room Service cloche, piscina ondas. Foi corrigido o
contraste do seletor de idioma em cabeçalhos internos claros e o espaço para nomes longos.

O risco de perda em Gastronomia foi corrigido com um slot opcional no shell F&B.
Conteúdos editoriais gastronômicos agora aparecem mesmo sem vínculo com um outlet;
a existência do grafo não implica equivalência editorial. O slot não altera catálogo,
carrinho, checkout ou ordering. A informação complementar não é descartada por ter
nome semelhante a um estabelecimento.

## Room Service e compatibilidade SmartMenu

O destino nativo continua vindo exclusivamente de `roomServiceAccess`, que já usa
`buildRoomServiceHref` na base atual. Não foi criado um resolvedor operacional concorrente.
O classificador de identidade reconhece vínculo F&B ou URL canônica do próprio tenant;
nomes parecidos não bastam para deduplicar ou trocar um provedor.

Referências ao mesmo destino/contrato são reunidas, com IDs de origem e conteúdo
complementar preservados. Goomer, Thex e URLs distintas permanecem alternativas legítimas,
inclusive quando há um vínculo F&B. Ações por apartamento não são consumidas por um
acesso nativo. Links de outro hotel, querystrings operacionais e destinos com diferenças
reais não são tratados como a mesma experiência. Áreas explícitas do Admin são respeitadas;
o acesso nativo principal pode continuar em Serviços sem duplicar a fonte editorial.

Idioma e consulta pública versus pedido autorizado seguem o resolvedor existente.
O teste com contexto sintético muda somente o CTA, mantendo a mesma rota canônica,
sem tokens produtivos. SmartMenu, ordering, modificadores, combos, pedidos, KDS, bridge,
spooler e impressão permanecem iguais à base `f6f593a`. A única extensão compartilhada
no shell gastronômico é o slot editorial opcional. Nenhuma operação comercial foi executada.

## Reconciliação editorial somente leitura

`docs/bootstrap/guest-service-editorial-reconciliation-20261126.json` é o inventário
atual reduzido: IDs, títulos, categorias, ações, hostnames, comprimentos/fingerprints e
destinos propostos. Não contém textos completos, querystrings, credenciais ou tokens.
`guest-service-editorial-plan-20261126.json` permanece como referência histórica,
não como inventário produtivo atual. O gerador com `--current` usa o contrato compartilhado
e produz a correspondência determinística; não possui cliente de banco nem executor de UPDATE.

| Hotel | Serviços ativos / total | Políticas | Departamentos | Turismo | Guias publicados / total | Configuração atual |
| --- | --- | --- | --- | --- | --- | --- |
| Bugan Recife | 13 / 18 | 2 | 3 | 7 | 0 / 4 | V4 |
| Grand Mercure Copacabana | 37 / 38 | 5 | 3 | 23 | 0 / 1 | V3 |
| Novotel Leme | 0 / 0 | 0 | 0 | 0 | 0 / 0 | V3 |
| Novotel Salvador | 14 / 15 | 3 | 1 | 0 | 0 / 0 | V3 |
| Mercure Rio Boutique | 0 / 0 | 0 | 0 | 0 | 0 / 0 | V3 |

Esses números são dos cadastros consultados, não um inventário de todos os módulos
possíveis. Nenhum hotel foi ativado em V4 e nenhum módulo produtivo foi habilitado.
As prévias V4 dos quatro hotéis hoje em V3 são locais e estão identificadas nas imagens.
Grand Mercure mantém títulos e categorias de hospedagem, TV, cofre, telefonia, serviços
do bairro, transporte e gastronomia; seus 23 itens de Turismo permanecem no domínio
existente. Nenhum desses conteúdos foi excluído ou regravado.

No Bugan há um Room Service ativo (`2b3b486b-3883-4d87-8406-73b1b7d4d954`) e um
registro anterior desativado (`d3401adb-0545-47e1-b7a3-78ce36a57501`). O outlet nativo
`3010fb52-8cde-40d2-b620-9b9796f068f0` está publicado e não possui service_links.
Os 13 serviços ativos, somados ao acesso nativo derivado quando elegível, explicam o
mecanismo capaz de gerar 14 acessos. A tela histórica não foi reproduzida em produção;
a fixture sintética não é usada como prova de inventário.

A classificação Bugan resulta em Room Service, Lavanderia e Travesseiros em Conforto;
Piscina, Academia, Sauna e Spa dos Pés em Lazer/bem-estar; Estacionamento em Mobilidade.
Conheça o hotel/Acomodações continuam no editorial e em Informações; Wi-Fi e Segurança
em Informações; Filipe em Gastronomia. Os IDs/fontes e deep links são mantidos.

A revisão automática rejeitou uma consulta inicial ampla, sem filtro em todas as tabelas,
por risco de exportação excessiva. A alternativa aprovada foi leitura filtrada dos cinco
hotéis e de metadados necessários à correspondência. A comparação dos textos completos
produtivos não foi realizada. Não houve tentativa de contornar a rejeição ou escrita produtiva.

## Admin, traduções e migration

O cadastro existente continua sendo a fonte única: título, descrição, categoria, ícone,
ordem, visibilidade, CTA e URL são reaproveitados. O painel avançado acrescenta área,
agrupamento, interação e resumo/horário/local/condições PT/EN/ES. Não cria um cadastro
paralelo, autorização operacional ou configuração nova de destaque na Home.

A prévia acompanha alterações do formulário e reutiliza o componente público e o
contrato puro de interação. Destinos internos são fornecidos pelo builder canônico no
servidor, preservando a fronteira server/client. Guias e experiências dedicadas não
viram sheets; links mostram o destino sem sair da prévia e sem acionar operações.
Atendimento usa somente o canal existente. A prévia não simula autorização de pedido.

Na RC visual anterior, os novos metadados tinham revisão manual e fallback por campo.
Essa limitação foi resolvida no fechamento definitivo: os oito campos agora usam o
Google canônico no salvamento, com persistência por idioma, proveniência e revisão.
O contrato atual e a compatibilidade com mapas legados estão documentados em
[SERVICE_EDITORIAL_TRANSLATIONS.md](SERVICE_EDITORIAL_TRANSLATIONS.md).

Migration `20261126031405_guest_service_presentation.sql`: coluna JSONB nullable no
cadastro existente, objeto até 20.000 bytes, constraint protegida para reexecução.
Parsers limitam os campos/valores e as actions validam o limite conjunto antes de gravar.
Registros antigos continuam válidos com NULL. Não há backfill, remoção ou mudança de RLS.

A validação autenticada identificou que os grants existentes são por coluna. A migration
foi corrigida para conceder apenas INSERT/UPDATE da nova coluna a authenticated; não
concede UPDATE de tabela ou alteração de hotel_id. RLS e as três políticas existentes
continuam limitando papel e hotel. Sem esse grant específico, as actions falhavam.

A migration revisada foi aplicada apenas no laboratório `libguest-45b-lab` para o teste
real e reexecutada com sucesso. Limites de JSON válido, array inválido e excesso de tamanho
foram testados em transação revertida. RLS, isolamento, login e gravação real foram
verificados. Nenhuma migration foi aplicada ou registrada em produção; a leitura
produtiva confirmou ausência da coluna e dessa versão na migration history.

Ordem futura: revisar/aplicar a migration pelo fluxo autorizado, verificar coluna,
constraint e grants específicos, publicar o código e realizar smoke sem pedidos.
Em resposta ambígua, conferir schema/history antes de repetir. Para recuperação,
manter a coluna e o conteúdo; reverter a apresentação/código compatível, sem apagar
metadados ou executar DROP COLUMN. A inferência legada mantém leitura sem backfill.

## Validação final e galeria

TypeScript, lint direcionado, build completo e integridade dos manifests compõem o gate.
28 testes direcionados cobrem catálogo/isolamento, destinos, idiomas, guias, limites,
alternativas, áreas explícitas e contexto sintético. A matriz browser tem 30 cenários
(cinco identidades × três idiomas × 390/1440), mais os checks de contraste do idioma,
conteúdo suplementar no shell, seis modos da prévia e guia dedicado.

Sete verificações autenticadas passaram no Supabase local e no Admin real: login por
senha, prévia reativa, gravação pela Server Action, tradução manual preservada,
escrita estrangeira bloqueada e metadados estrangeiros intactos, além da preservação
de RLS/políticas na migration. Usuários e hotéis sintéticos foram removidos; o servidor
local foi encerrado. Tradução externa ficou desabilitada, e requisições não locais foram
bloqueadas. Não houve pedido, impressão ou pareamento. Guias publicados continuam
cobertos pelo renderer/contrato; esse tenant de homologação não publicou guia.

[Abrir a galeria visual selecionada](../out/guest-experience-premium-services/gallery.html).

A galeria abaixo usa componentes reais; não são novos mockups. Arquivos em `out/`
permanecem fora do commit. B = conteúdo histórico autorizado do Bugan com grafo,
identidades, contexto e configuração sintéticos. M = títulos/categorias de metadados
atuais, com descrições sintéticas e preview V4 explicitamente identificado. A = Admin
real autenticado, exclusivamente com tenant e dados sintéticos locais.

| Captura | Origem | Arquivo |
| --- | --- | --- |
| Bugan Serviços mobile | B | [390 px](../out/guest-experience-premium-services/services-4-pt-390.png) |
| Bugan Serviços desktop | B | [1440 px](../out/guest-experience-premium-services/services-4-pt-1440.png) |
| Bugan Bottom Sheet | B | [Detalhe](../out/guest-experience-premium-services/detail-4-pt-390.png) |
| Bugan Informações | B | [Informações](../out/guest-experience-premium-services/information-mobile.png) |
| Bugan busca | B | [Busca](../out/guest-experience-premium-services/filter-4-pt-390.png) |
| Bugan Serviços 390 × 844 | B | [Primeira dobra](../out/guest-experience-premium-services/services-4-pt-390-844.png) |
| Bugan Serviços completos | B | [Rolagem completa](../out/guest-experience-premium-services/services-complete-mobile.png) |
| Sheet com horário e localização | B | [Academia](../out/guest-experience-premium-services/detail-hours-location-mobile.png) |
| Informações completas | B | [Rolagem completa](../out/guest-experience-premium-services/information-complete-mobile.png) |
| Grand Mercure listagem completa | M | [Rolagem completa](../out/guest-experience-premium-services/grand-services-complete-mobile.png) |
| Grand Mercure filtro Mobilidade | M | [Filtro](../out/guest-experience-premium-services/grand-filter-mobile.png) |
| Novotel Salvador listagem completa | M | [Tema preservado](../out/guest-experience-premium-services/novotel-services-complete-mobile.png) |
| Admin prévia visual atual | B | [Prévia local](../out/guest-experience-premium-services/admin-service-configuration.png) |
| Grand Mercure — maior volume | M | [37 registros classificados](../out/guest-experience-premium-services/metadata-0-mobile.png) |
| Novotel Leme — cadastro vazio preservado | M | [Leme](../out/guest-experience-premium-services/metadata-1-mobile.png) |
| Novotel Salvador | M | [Salvador](../out/guest-experience-premium-services/metadata-2-mobile.png) |
| Mercure Boutique — cadastro vazio preservado | M | [Mercure](../out/guest-experience-premium-services/metadata-3-mobile.png) |
| Admin configuração/prévia | A | [Admin autenticado](../out/guest-experience-premium-services/admin-authenticated.png) |

O último mockup de Serviços não estava disponível nas referências. A revisão seguiu
as especificações textuais aprovadas e a identidade existente, sem alegar comparação
pixel a pixel. As capturas foram inspecionadas quanto a densidade, alinhamento, foco,
clareza dos agrupamentos, contraste e ausência do dock no desktop.

## Entrega e decisão

GO para RC local e homologação visual. NO-GO para publicação nesta execução: migration
produtiva e publicação dependem de autorização posterior; antes disso, revisar o plano
editorial e a galeria. Permanecem a comparação direta com o mockup indisponível e a
comparação integral dos textos produtivos. Contexto de apartamento foi sintético;
nenhum token produtivo foi utilizado e não se declara homologação operacional de pedidos.

Arquivos adicionais ao checkpoint: reconciliação atual dos cinco hotéis e teste de
Admin autenticado. Foram revisados catálogo, contrato de apresentação, explorador/CSS,
Admin/actions, shell gastronômico, fixtures/testes, migration e documentação.
Não houve push, merge na main, deploy ou escrita em conteúdo real. SmartMenu e demais
fluxos protegidos permanecem sem diferenças em relação à base remota incorporada.


## Fechamento de publicação autorizado — 26/11/2026

As decisões anteriores de não publicar descrevem o estado histórico da RC.
Bruno autorizou a integração, as duas migrations e a publicação definitiva.
A integração preserva os commits atuais do SmartMenu, incluindo tradução comercial,
descrições, categorias e horários. Nenhum contrato operacional foi refeito.

Conferência editorial final: a prévia compacta não corta listas de acomodações na
primeira vírgula; travesseiros e Spa dos Pés exibem orientação neutra e conservam
todas as categorias no detalhe. Horários e localização continuam no conteúdo real.
Estacionamento usa ícone universal; Spa dos Pés em Saúde aparece em bem-estar,
respeitando qualquer agrupamento explícito. Fidelidade continua em conveniência.
Informações usa busca contextual, evita duplicar instruções de Wi-Fi idênticas e
mantém itens com links ou metadados adicionais. O campo de busca tem um único
controle próprio de limpar. Não houve alteração em massa dos cadastros.

Densidade revalidada: 7/8 em 390×900 e 390×844. Verificações dirigidas finais:
16 cenários de catálogo, sete de tradução, 23 autenticados afetados, TypeScript,
lint direcionado e build sobre a integração vigente. Sem repetir as suítes históricas.
O relatório de publicação registra SHA, deployment, backup, migrations, preservação
dos cinco hotéis e evidências reais. O backup privado nunca acompanha a galeria.
