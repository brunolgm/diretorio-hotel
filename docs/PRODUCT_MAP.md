# PRODUCT MAP

## Central de Voos V4 premium — 29/10/2026

Base `a9118fb`. Apresentação compartilhada opt-in V4: identidade compacta,
número em destaque, programação/live distintos, horários separados, terminal,
portão e timestamps de consulta/fonte. Navegação desktop própria e dock mobile;
frame de teclado ignora foco que já mudou. Homes e opções desabilitadas preservadas.

Catálogo exato com 14 referências, sem fuzzy/codeshare guessing. TAM só deriva
candidato comercial LA com origem BR confirmada no catálogo, data/rota completas
e contexto contemporâneo suportado. JJ não é reescrito. LAT e SKY genérico
permanecem ambíguos; JetSMART segue a unificação comercial JA datada e documentada.
Dados manuais v1 ficam intactos; só a consulta é normalizada. País/timezone vêm da
leitura server-side dos aeroportos já autorizados, sem inferência geográfica.

Provider, API de status, orçamento/renovação, leases, cache, rate limits e RLS
permanecem nos contratos da 51.1. Sem migration ou nova consulta externa para
homologação: replays reais AD4277 e LA3565, separados de fixtures sintéticas.
Mockup em docs/references é referência visual, nunca foto oficial publicada.
Detalhes, fontes e comandos em `docs/CENTRAL_DE_VOOS_E_PMS.md`.

## Hotfix público V4 e formulário de Voos (29/10/2026)

Base técnica: main `a98c75b`. Bugan já estava `active` por ativação canônica
externa a este hotfix; preservar esse estado. Nenhuma alteração de lifecycle,
administradores, apresentação revisão 3, conteúdo, mídia, módulos ou aeroportos.

As entradas públicas por subdomínio e `/hotel/[slug]` carregavam corretamente a
apresentação, mas omitiam sua propagação ao renderer compartilhado. `/preview`
propagava o contrato completo. Corrigida a passagem de dados nas duas entradas;
sem alteração de RLS, Storage, cache, loaders ou seleção de tenant. A Home pública
passa a usar a composição V4 e os benefícios/cards publicados já homologados.
Testes executam os adapters reais com loaders sintéticos, além da matriz visual;
smoke anônimo compara as duas entradas reais antes/depois da publicação.

Na Central de Voos V4 faltava `data-public-internal-body` no conteúdo. A grade
mobile limitava a altura, mas não criava a região rolável esperada, ocultando o
fim do formulário. O conteúdo recebe o marcador compartilhado; a altura reage
ao `visualViewport` e reposiciona o input focado quando o teclado reduz a área
visível. Dock e safe area são preservados. Regressão do formulário cobre sete
viewports, seis presets (incluindo Default), PT/EN/ES, validação, salvar, editar,
remover, erro de armazenamento e respostas verificadas/indisponíveis simuladas.
Teclado foi simulado por redução de `visualViewport`, sem alegar teste físico.

Referência Azul: o alias ICAO `AZU` é normalizado para IATA `AD` somente na
consulta e no fallback oficial, preservando zeros e o objeto manual v1. Prefixos
conflitantes ou ICAO desconhecido não são convertidos por suposição. Não se trata
de substituição de codeshare. `budget_unavailable` usa indisponibilidade, sem
afirmar esgotamento da quota ou inventar dados operacionais.

Diagnóstico real AirLabs: variáveis server-side presentes em produção; isso não
comprova autenticação válida no provedor. O orçamento interno encontrado terminou
em 07/10/2026, com 17/900 reservados históricos. O POST de diagnóstico da ocorrência
AD4277, 29/10/2026, REC–CGH, 16:40 America/Recife retornou HTTP 503
`budget_unavailable` antes de consultar a AirLabs. Requisições reais ao provedor:
zero. Sem match, status ou comparação operacional confirmados. Não renovar período,
resetar consumo, elevar teto ou contornar quota. Interface e integração real têm
classificações separadas; mocks não homologam o provedor. Ver contrato operacional
em `docs/airlabs-distributed-coordinator.md`.

Sem migration, mudança de plano, scraping da Aena, polling ou alteração de dados
editoriais/governança. As sondagens do endpoint passam pelos registros operacionais
normais de rate limit/cache antes do bloqueio de orçamento, sem reserva de crédito.
Os scripts de browser usam contextos isolados; os testes de formulário em produção
interceptam o endpoint de status, sem gastar crédito nem persistir dados no servidor.

## Fechamento Public Experience V4 Universal — Bugan (29/10/2026)

Checkpoint de entrada: main `390d1c2`, árvore limpa; apresentação Bugan revisão 3,
lifecycle `suspended`, dois administradores ativos. A reconciliação turística anterior
foi confirmada por releitura: sete itens publicados distintos, 14 traduções completas,
duas descrições EN/ES da Praça e dois títulos EN do Restaurante Filipe corrigidos;
quatro destinos editoriais persistidos. Não repetir bootstrap nem reconciliação.

Refinamentos compartilhados: Informações e Home usam `getPublicEssentials`, que obtém
instruções Wi-Fi do serviço próprio, publicado e já traduzido. Sem senha fixa inventada
ou outra fonte. Grupos reconhecidos de dias do café são apresentados em PT/EN/ES,
mantendo os horários cadastrados; formato desconhecido permanece literal. Check-in/out
permanecem dados do hotel. Nenhuma consulta de tradução/provedor ocorre durante leitura.

Somente hotéis com composição V4 recebem o cabeçalho interno compacto compartilhado,
com logo/nome, Voltar, idioma e tokens da marca. Serviços reutilizam o explorador
existente, com busca e categorias reais; textos longos ficam em disclosure nativo
acessível, sem resumir/cortar dados nem alterar ordem ou destinos. Detalhe mantém
conteúdo completo, regra de elegibilidade e retorno ao catálogo com idioma. Textos
técnicos de identidade não aparecem na interface pública. Sem novos pedidos ou F&B.

Estilos internos são escopados por `data-public-internal-v4`. No mobile com dock
compartilhado, navegação tem faixa própria e o conteúdo rola acima dela; safe area,
foco visível e acesso ao último CTA são verificados. As Homes aprovadas, fotos,
focais, quatro ilustrações, benefícios e configuração da apresentação não são editados.
Turismo continua no domínio único, sem opção vazia e sem entrar no dock. Nenhum
hotel é selecionado/migrado automaticamente para V4.

Correção editorial mínima preparada: categoria EN `Gym`, categoria ES `Gimnasio`
no serviço Academia e CTA ES `Reservar` em Acomodações. Manifesto auditável em
`docs/bootstrap/bugan-v4-closure-editorial-20261029.json`; executor único
`scripts/finalize-bugan-public-copy.ps1`, com senha oculta e autenticação normal.
Usa módulos via RPC canônica, RLS, comparação integral de fonte/tradução, CAS por
`updated_at` e releitura; é idempotente e preserva PT. Sem service role, Google,
Storage, bootstrap, compensação destrutiva ou alteração de administradores.
Execução real desses três campos ainda depende da confirmação autenticada.

Readiness lido: zero blockers; `visual.hero` aprovado; somente `content.banners`
e `rooms.qr` como recomendações/pendências reais. Não criar banner ou UH fictícios.
O readiness de idiomas não comprova completude editorial; a auditoria verifica
campos obrigatórios em cada registro EN/ES, com fallback legítimo por campo.

Voos: REC/SBRF preservado, flags operacionais desabilitadas, preview somente leitura
nas três abas, sem consulta, pedido, alerta ou analytics. A fonte oficial
[Aena — informações de voos REC](https://www.aenabrasil.com.br/pt/aeroportos/aeroporto-internacional-do-recife-guararapes-gilberto-freyre/Informacoes-de-voo.html)
foi verificada. Links no catálogo global ainda estão ausentes: não existe fluxo
canônico de edição desses campos para aeroporto existente; o helper é insert-only.
Registrar por futura manutenção global auditada, sem UPDATE manual/service role,
hardcode no renderer ou habilitação operacional. O estado vazio permanece honesto.

Links oficiais cadastrados de hotel, reservas e cardápio foram verificados por GET;
nenhuma reserva/pedido foi efetuada. Telefones públicos internacionais usam `tel:`,
sem inferência de WhatsApp; ramal *1 permanece informativo. As quatro seleções de
Turismo preservam contexto, nomes próprios, idioma e retorno.

Evidências: fixtures de conteúdo público seguro (alvo editorial aprovado), não uma
sessão simulada de produção; matriz automatizada com seis propriedades, PT/EN/ES,
360/375/390/430/tablet/1440/1536, jornadas de essenciais, serviço, gastronomia,
Turismo, três abas de Voos, contato e retorno. Contraste dos textos essenciais,
disclosures por teclado, foco, dock/CTA e overflow entram no gate. Autorização real
permanece no servidor: os testes de preview/entitlements e smoke anônimo são
separados dos testes de renderização. Não alegar autenticação real por query string.

Gates do fechamento: 12/12 direcionados (modelo V4 e correção editorial), 464/464
security (incluindo rotas, preview, entitlements e idiomas), TypeScript/build OK,
lint zero erros/quatro warnings históricos e `git diff --check` OK. Matriz interna
126/126 e preservação visual da Home 152/152, zero APIs nas fixtures. Auditoria por
campo: 58 pares EN/ES sem campos obrigatórios ausentes (26 serviços, seis departamentos,
quatro políticas, 14 Turismo, oito mídias). Os três ajustes são de qualidade editorial,
não ausência de registros. Execução autenticada desses campos ainda aguarda retorno.

Go-Live: executar somente após gates, deploy READY, smoke e confirmação dos três
campos editoriais. Procedimento canônico e pendências em
`docs/SPRINT_48_ACTIVATION_READINESS.md`. Nenhuma ativação autorizada nesta sprint.
Sprint 53 F&B, TheX, OPERA/OHIP e IA continuam no roadmap, fora deste fechamento.

## V4 interna e destinos editoriais de Turismo — 29/10/2026

[IMPLEMENTADO E CONFIRMADO NO CÓDIGO] O domínio único da Sprint 52 continua sendo
a fonte de Turismo. Os cards ilustrativos da Home não eram itens nem coleções:
todos abriam o catálogo geral. A apresentação existente passa a aceitar, por card,
`destination` opcional: item por slug ou coleção por chave e lista de slugs. A
introdução da coleção usa PT/EN/ES e seu título reutiliza o título do card.
Não há outro banco de Turismo, itinerário reservável ou conteúdo no TSX.
Configurações antigas sem destino mantêm o contrato anterior. Destinos novos só
aparecem quando resolvem conteúdo publicado do próprio hotel; ausência não promete
um item inexistente. Remover a associação pelo mesmo Admin reverte a apresentação
sem apagar itens. A RPC, revisão/PT409, RLS, auditoria e grants permanecem intactos.

Catálogo e detalhe reutilizam as rotas públicas e privadas existentes. `collection`,
`type`, `category` e idioma são filtros de apresentação, nunca hotel-alvo ou bypass.
As opções refletem somente o conteúdo publicado da seleção. O catálogo geral segue
acessível por “Ver todas as atrações”; detalhe preserva seleção e idioma no retorno.
Sem imagem licenciada não há imagem/placeholder artificial no catálogo. “Ver detalhes”
só é oferecido quando há informação além do resumo; descrição idêntica não é repetida.

[PARCIALMENTE APLICADO — AUDITORIA CONFIRMADA, RETOMADA AUTENTICADA PENDENTE] Manifesto revisável
`docs/bootstrap/bugan-tourism-v4-20261029.json`: cinco lugares, traduções autorais
EN/ES, enriquecimento da Praça e preservação do nome Restaurante Filipe em Serviço
e mídia EN. O executor `scripts/apply-bugan-tourism-v4.ps1` usa login normal com senha
oculta, RLS, bootstrap/RPCs canônicas e revisão da apresentação. Antes de escrever,
confere módulos via `get_current_hotel_modules()`, suspensão e snapshots aprovados;
conflito com edição humana gera interrupção. Não usa service role, Google, Storage,
onboarding ou escrita manual em hotéis/profiles. O bootstrap
original passa a detectar a edição intencional da Praça, preservando o enriquecimento.

A execução real criou cinco itens publicados e suas dez traduções EN/ES. Praça e
Shopping conservaram seus IDs. O enriquecimento PT da Praça foi confirmado, com
resumo preservado; a RPC invalidou somente `full_description` EN/ES. O executor
interpretava incorretamente essa invalidação seletiva como PT409 local. O mock
anterior apagava as linhas inteiras e não reproduzia o contrato real; foi corrigido.
O estado auditado tem sete itens, 14 traduções, duas descrições pendentes, apresentação
na revisão 2 e títulos EN do Restaurante Filipe ainda pendentes (serviço e mídia).

`scripts/resume-bugan-tourism-v4.ps1` usa o modo explícito `--resume` e o checkpoint
revisável `docs/bootstrap/bugan-tourism-v4-resume-20261029.json`. Confere os sete itens
e as 14 traduções antes de escrever; não chama bootstrap nem regrava PT, Shopping
ou as dez traduções novas. Conclui somente as duas descrições EN/ES da Praça, os dois
títulos EN e os quatro destinos, mantendo imagens, benefícios e focais. A apresentação
exige revisão 2/configuração anterior exata, ou revisão 3/configuração final exata
para idempotência. Divergências interrompem; respostas ambíguas exigem releitura e
nunca provocam exclusão/compensação. O relatório diferencia validação local de erro
da operação, sem registrar credenciais. Senha exclusivamente no prompt oculto local.

A RPC de tradução mantém o contrato existente: revisão do item fonte, sem CAS próprio
da tradução. A retomada minimiza os patches e revalida o checkpoint antes das escritas;
não adiciona garantia atômica que esse contrato não oferece. Nenhuma RPC, migration,
RLS ou grant foi alterado. Publicação do executor não significa reconciliação dos dados:
o resultado real e a homologação autenticada dos quatro destinos permanecem pendentes.

Gates da preparação da retomada: 15/15 direcionados, 460/460 security, TypeScript e
build OK, lint sem erros (quatro warnings históricos), `git diff --check` OK e 54
cenários locais V4/Turismo em PT/EN/ES, 390/430/1440, cobrindo Bugan, Grand Mercure,
Novotel Leme, Novotel Salvador, Mercure e Default. Fixtures isoladas, zero chamadas
de API; esses gates não substituem a releitura pós-execução nem a homologação real.

| Card ilustrativo preservado | Destino canônico preparado |
| --- | --- |
| Praia de Boa Viagem | Novo item `praia-de-boa-viagem`, distinto da Praça |
| Centro Histórico | Coleção `recife-antigo`: Marco Zero, Rua do Bom Jesus, Paço do Frevo |
| Passeios Culturais | Coleção `visitas-culturais`: Paço do Frevo e Embaixada dos Bonecos Gigantes; visita independente, sem reserva |
| Cultura Local | Coleção `cultura-local`: Paço do Frevo, Embaixada dos Bonecos Gigantes e Rua do Bom Jesus |

Praça de Boa Viagem e Shopping Recife conservam IDs e dados aprovados. A Praça
recebe contexto, endereço e fonte oficial, sem substituir seu resumo ou inventar
distâncias. Shopping não é reescrito. Novos preços, horários, duração, mapa e fotos
permanecem ausentes quando não confirmados. As quatro ilustrações aprovadas não são
classificadas como fotografias oficiais e seus paths/focais permanecem intactos.

Fontes: [roteiro municipal de um dia](https://visit.recife.pe.gov.br/roteiros/roteiro-teste-1-dia/),
[roteiro municipal de três dias](https://visit.recife.pe.gov.br/roteiros/roteiro-teste-3-dias/),
[Marco Zero](https://visit.recife.pe.gov.br/lugar/marco-zero/),
[Paço do Frevo](https://pacodofrevo.org.br/visite/),
[Embaixada dos Bonecos Gigantes](https://visit.recife.pe.gov.br/lugar/embaixada-dos-bonecos-gigantes/)
e [Praça de Boa Viagem](https://visit.recife.pe.gov.br/lugar/praca-de-boa-viagem/).
Textos são paráfrases; as páginas são referência, sem agenda, preços ou disponibilidade prometidos.

Páginas internas usam acabamento compartilhado e tokens de cada marca. O seletor
V4 controla o acabamento compacto; Homes e demais hotéis não são migrados. O texto
técnico de 60 caracteres saiu da interface; a regra permanece no domínio. Fallback
considera somente campos presentes na fonte, usa PT para tradução vazia e no preview
do Serviço considera somente aquele item, preservando avisos legítimos. Contato
reutiliza números internacionais explícitos do cadastro em links `tel:`, sem inferir
WhatsApp. Preview permanece somente leitura, sem analytics/provedores/roomToken.

[PENDENTE — CATÁLOGO GLOBAL] Existe [página oficial da Aena para REC](https://www.aenabrasil.com.br/pt/aeroportos/aeroporto-internacional-do-recife-guararapes-gilberto-freyre/Informacoes-de-voo.html),
sem token na URL. Não existe manutenção canônica de links de aeroporto já cadastrado;
o helper atual é insert-only. Não houve UPDATE direto ou fallback REC no TSX. O módulo
informa que o canal ainda não foi configurado e mantém desabilitadas operações reais
no preview. Cadastro global auditável é uma pendência específica; não habilitar
transfer/despertar ou alterar REC para simular conclusão.

[IMPLEMENTADO PARCIALMENTE] Até confirmação do executor, os novos registros e quatro
associações são plano validado, não conteúdo aplicado em produção. Homologação humana
das páginas internas e readiness pós-pré-cadastro permanecem pendentes. Bugan segue
`suspended`; os dois administradores, entitlements, fotos reais e demais hotéis
devem permanecer preservados. As cinco marcas/Default entram na regressão compartilhada.

[APROVADO] Gates locais: 455/455 security, dez testes novos direcionados (incluindo
executor sem rede, idempotência, conflito manual e falsa confirmação), TypeScript,
build e diff check OK; lint zero erros/quatro warnings históricos. SQL local com
rollback valida JSON legado/novo, RPC autenticada, PT409 e reversão da configuração.
Browser: 54 cenários internos nos seis presets, PT/EN/ES, 390/430/1440 pixels, quatro
destinos coerentes e links telefônicos; mais 152 cenários de preservação das Homes
V4/V3. Zero chamadas de API nas fixtures. Isso não confirma aplicação do manifesto
nem homologação humana em produção.

## Hotfix V4 — navegação privada de homologação — 29/10/2026

[IMPLEMENTADO E CONFIRMADO NO CÓDIGO] `/explorar/...` já possui rotas canônicas:
o problema da homologação era a saída da Home `/preview` para loaders públicos.
Esses loaders resolvem apenas hotéis elegíveis em `public_hotels`: em hotel suspenso,
catálogo/Voos/Contato chegam ao `notFound`, enquanto detalhe de serviço apresenta
“Experiência indisponível”. Não eram caminhos inventados pela V4; V3 utiliza os
mesmos construtores. O serviço informado `c0d9e423-fd45-4e35-a9c5-8dfa5ac01234`
foi confirmado habilitado e pertencente ao Bugan, sem alteração do seu conteúdo.

O preview passa a manter Home, idiomas, áreas, serviços e Turismo em `/preview`.
Cada destino privado executa o mesmo guard no servidor: sessão real, administrador
ativo do próprio hotel, lifecycle diferente de archived, `core.directory` e
`experience.preview`. Editor/operador/visualizador não recebem acesso. O alvo vem
exclusivamente do profile; a URL não recebe hotel ID ou slug. O escopo de links
em `DomainContext` é somente apresentação, nunca autorização ou bypass de lifecycle.
Rotas públicas, resolução por slug/subdomínio e alias histórico permanecem intactos.

Renderers públicos são reutilizados, sem cópias de páginas por bandeira. Serviços
continuam limitados a `enabled`; Turismo a itens publicados e entitlement ativo.
Links editoriais de serviços são reconstruídos por associação publicada ao hotel,
preservando idioma, contexto privado e fallback por slug. Links externos oficiais
de reservas, acomodações e contato são preservados; não há operação externa automática.

Voos no preview usa as tabelas/configuração existentes pelo cliente autenticado e
RLS, exige `travel.flights` e aeroportos ativos. Não monta `GuestFlightManager` nem
ações operacionais; “Meu voo” explica o estado somente leitura. Não resolve UH,
roomToken ou cardápio contextual e não aciona Google, provedores ou analytics.
Nenhuma migration, mudança de grants/RLS ou alteração operacional é necessária.

| Acesso | Destino privado canônico | Público do Bugan suspenso |
| --- | --- | --- |
| Serviços | `/preview/explorar/servicos` | Bloqueado pelo lifecycle |
| Gastronomia / Restaurante Filipe | `/preview/servicos/c0d9e423-fd45-4e35-a9c5-8dfa5ac01234` | Experiência indisponível |
| Central de Voos | `/preview/explorar/voos` | Bloqueado pelo lifecycle |
| Fale com o hotel | `/preview/explorar/contato` | Bloqueado pelo lifecycle |
| Conheça o hotel | `/preview/servicos/820f3174-a704-44a0-a181-7de5f6415952` | Bloqueado pelo lifecycle |
| Turismo / quatro cards | `/preview/explorar/turismo` | Bloqueado pelo lifecycle |
| Detalhe de Turismo | `/preview/explorar/turismo/{slug-do-item}` | Bloqueado pelo lifecycle |
| Acomodações / Reservar | HTTPS oficial já configurado, preservado | Destino externo existente |

PT/EN/ES usam os mesmos caminhos com `lang`. Hotéis ativos continuam usando as
rotas públicas anteriores conforme publicação e entitlement. O Bugan permanece
`suspended`, com V4 selecionada na revisão 2 e os dois administradores preservados.
[IMPLEMENTADO, MAS NÃO VALIDADO] A nova navegação ainda exige homologação visual
humana autenticada em produção após a publicação deste hotfix; testes sintéticos
não equivalem a essa aprovação nem à validação de disponibilidade de terceiros.

[APROVADO] Gates do hotfix: 445/445 security, incluindo execução da rota privada
real com SDK/sessões sintéticos (anônimo, visualizador, editor, inativo, archived,
administrador suspended/active, entitlements, conteúdo publicado e isolamento).
Browser: 54 cenários de navegação nos seis presets, PT/EN/ES, 390/430/1440 pixels,
todos os acessos/editoriais/Turismo do Bugan e zero chamadas de API; mais 152
cenários de preservação visual V4/fallback V3. Testes de URLs estão separados da
comparação visual histórica. TypeScript, build e diff check OK; lint zero erros e
quatro warnings históricos. Smoke anterior à publicação: Serviços e Contato dos
quatro hotéis ativos retornam 200 (8/8), confirmando a diferença de lifecycle.

## Public Experience V4 Universal — 29/10/2026

[IMPLEMENTADO E CONFIRMADO NO CÓDIGO] Evolução compartilhada e opt-in da V3 premium.
A decisão anterior mantinha seis acessos e apresentação editorial; a V4 prioriza
informações essenciais e tarefas no mobile para reduzir navegação durante a estadia.
Não depende de PMS, autenticação pessoal, reserva ou identificação por apartamento.
QR/roomToken continuam apenas no contrato técnico existente.

O editor existente em `/admin/hotel/apresentacao` permite selecionar a composição
mobile V3 ou V4. `hotel_public_presentation.configuration.experienceVersion` é
opcional: ausente significa V3. A gravação utiliza a mesma RPC autenticada,
autorização, auditoria e controle de revisão/PT409. Retornar a V3 é uma alteração
reversível pelo mesmo editor. A migration amplia somente o validador JSON existente;
não altera hotéis, módulos, dados operacionais ou configurações automaticamente.

A Home V4 usa SSID/senha existentes, instruções do serviço Wi-Fi, horários completos
do café e check-in/out do hotel. Não replica dados em novos campos. Oculta valores
ausentes e ações sem destino disponível. Serviços, Gastronomia, Central de Voos e
Contato reutilizam as rotas, idiomas e dados já filtrados por tenant/entitlement.
Não há chamadas de tradução, voos ou IA na composição. Gastronomia mantém o destino
editorial real ou o cardápio existente; não implementa pedidos TheX.

O componente mobile é compartilhado por Grand Mercure, Novotel Leme, Novotel
Salvador, Mercure, Bugan e Default, com cores do respectivo preset. Nenhum outro
hotel recebe V4 automaticamente. No desktop a V3 permanece como referência:
header, hero, seis cards, editoriais, benefícios e Turismo são preservados.
No piloto Bugan permanecem fotos reais, quatro ilustrações aprovadas, focais,
traduções e conteúdo operacional. Não há fork funcional de Gastronomia ou Turismo.

[APROVADO] Piloto Bugan Recife no tenant existente
`5eb7d695-ccf7-4594-b9df-fc46aaa25695`, mantendo `suspended`. A seleção efetiva V4
exige sessão normal do administrador e salvamento canônico após publicação; não
se utiliza SQL direto, impersonação ou service role para essa escolha. `/preview`
continua autenticado, sem analytics/provedores e sem liberar o hotel publicamente.
Homologação visual humana em produção permanece distinta dos testes de fixtures.

Regressões reproduzíveis: `tests/security/public-experience-v4.test.ts`, matriz SQL
`supabase/tests/public_experience_v4_behavioral_matrix.sql` com rollback local e
`tests/browser/public-experience-v4.mjs` com fixtures isoladas, PT/EN/ES, seis
propriedades, mobile/tablet/desktop, fallback V3 e comparação visual com `0c0bda2`.
Capturas e relatórios locais ficam em `out/v4-universal/`, fora do commit.
Os registros históricos abaixo permanecem como evidência dos seus checkpoints.

[APROVADO] Gates locais deste checkpoint: 8/8 testes direcionados, 436/436 security,
matriz SQL com rollback, TypeScript, build e diff check OK. Lint: zero erros e
quatro warnings históricos. Browser: 152 cenários de composição/fallback, além de
estados sem módulos/dados e seleção no editor; zero chamadas de API. Viewports:
360×800, 375×812, 390×844, 430×932, 1024×768, 1440×900 e 1536×864, em PT/EN/ES.
Comparação exige conteúdo, destinos, tipografia e geometria idênticos; a imagem
tolera somente ruído esparso de rasterização do Edge. Novotel Leme usa seu preset
público atual `deep-ocean`; Novotel Salvador usa `novotel`. Isso confirma regressão
de renderers com fixtures, sem equivaler à homologação humana dos hotéis reais.

[EM ANÁLISE] F&B, TheX, OPERA/OHIP/PMS, IA, busca no diretório e implantação V4
nos demais hotéis. Não fazem parte desta entrega nem são pré-requisitos da V4.

## Bootstrap compartilhado do pré-cadastro Bugan — 28/10/2026

[IMPLEMENTADO E CONFIRMADO NO CÓDIGO] Novo contrato autenticado para configuração
inicial de hotel existente: apply_current_hotel_bootstrap. Administrador ativo do
próprio tenant, alvo explícito validado no banco, somente draft/suspended, row lock,
idempotência por namespace/chave e snapshot de fonte. Reexecução preserva IDs; edição
humana, registro preexistente sem vínculo ao seed ou manifesto divergente gera PT409.
Não altera lifecycle, entitlements, profiles, contas, roomToken ou outros hotéis.
Turismo e mídia reutilizam suas RPCs atuais; domínios editoriais reutilizam campos/
constraints do Admin. Campos canônicos do hotel só preenchem lacunas.

[IMPLEMENTADO E CONFIRMADO NO CÓDIGO] Slug pode ser alterado durante preparação pelo
administrador do hotel em /admin/hotel/slug ou pela RPC canônica. Validação/unicidade,
expected slug, audit e alias privado protegem o ID e os endereços antigos. Alias não
expõe hotel suspenso e é reservado contra atribuição a outro tenant. Subdomain/QR não
mudam. Resolução pública continua passando por public_hotels e lifecycle/entitlement.

[IMPLEMENTADO E CONFIRMADO NO CÓDIGO] Editorial V3 ganhou EN/ES no mesmo tradutor
server-side existente. Fonte PT/revision verificada na persistência, RLS, invalidação
de derivados quando o texto PT muda e fallback por campo. O Admin traduz ao salvar;
bootstrap preserva tradução existente e reporta parcialidade. Sem Google na leitura.
Logger compartilhado foi extraído sem mudar sua interface e sem dependência circular.

[IMPLEMENTADO E CONFIRMADO NO CÓDIGO] Preview /preview requer sessão editor/admin do
próprio hotel e entitlements core.directory/experience.preview. Nenhum alvo vem da
URL; usa RLS e o renderer público compartilhado, só conteúdo elegível, sem analytics,
roomToken, provider ou abertura pública de hotel suspenso. A aba de preview usa essa
rota em preparação. Revisão visual/golden master continua sendo humana.

[APROVADO] Manifesto revisado docs/bootstrap/bugan-recife-20261028.json: 13 serviços,
três departamentos, duas políticas, dois itens Turismo, configuração de Voos/REC,
quatro slots e logo oficial. Quatro WebP reais e logo PNG conferidos no diretório
preparado, com hashes fixados; não inclui golden master ou SVG. Horários e SSID já
salvos são preservados; café do restaurante remete à fonte canônica de Quick Info.
Não inclui WhatsApp, senha Wi-Fi fixa, preços voláteis, promoções, música conflitante,
IA, comunicados ou UHs inventadas. Campos institucionais sem coluna própria ficam
em conteúdo editorial editável. Fontes/focais iniciais e limites em HOTEL_BOOTSTRAP.md.

[IMPLEMENTADO PARCIALMENTE] O executor PowerShell/Node está preparado: plano sem rede,
login normal com senha oculta em stdin, sessão só em memória e logout scope local.
A credencial operacional local já configurada é usada somente server-side para
Storage e catálogo global conforme grants existentes; não substitui a autenticação
do administrador e não cria contas. Não há magic link, JWT forjado ou impersonação.
REC usa dado oficial DECEA/IATA; helper de catálogo é insert-only e recusa drift.
Nenhum tempo de transfer, antecedência, margem ou link de voo é inventado.

[APROVADO] Gates do checkpoint: 424/424 security, 44/44 direcionados, TypeScript,
build e diff check OK; lint zero erros/quatro warnings históricos. Seis matrizes SQL
do bootstrap (incluindo manifesto completo nas cinco marcas), nove regressões de
governança/onboarding/Turismo/Voos e uma regressão de mídia, todas locais com rollback.
Teste do executor usa stdin privado, SDK isolado e rede bloqueada; fixtures próprias,
sem depender de out/ nem usar senha real. Não equivale a seed/homologação em produção.
[IMPLEMENTADO E CONFIRMADO EM PRODUÇÃO] Código funcional d876de3110207c88418039e5e6183c16cec2e714
publicado em main. Migration 20261028105402 aplicada via CLI ao projeto confirmado
diretorio-hotel/micuekfznunwwofxnovw; 44 migrations, dry-run sem pendências. Vercel
READY/production: dpl_AowLP3mCsyxAjZForfpCuFc6karL, mesmo projeto/equipe/SHA e aliases
libguest.digital/www/wildcards. Nenhum DNS alterado. Smoke HTTP 10/10, com /preview e
/admin/hotel/slug protegidos; três operações negaram anon via REST/401 e o slug
suspenso permaneceu oculto. Não foi feita automação de navegador ou login impersonado.

[IMPLEMENTADO E CONFIRMADO EM PRODUÇÃO] REC/SBRF registrado pelo helper operacional
insert-only do catálogo existente: ID 5f63c039-2243-4634-85f3-b2691b210f20, nome oficial,
America/Recife, ARP -8.126389/-34.922778, ativo, links de partidas/chegadas vazios.
Vínculo ao Bugan depende da execução autenticada do seed; não foi presumido.
Hashes de todos os hotéis, profiles, entitlements, layouts e aeroportos anteriores
(excluindo o novo REC) idênticos antes/depois. Karoline e o segundo administrador
continuam ativos; zero registros de bootstrap/alias/tradução de mídia no remoto.
Os serviços, Turismo e mídia do Bugan ainda estão vazios: preparação não é carga real.

[IMPLEMENTADO PARCIALMENTE] Readiness anterior ao seed foi calculado pela função
canônica calculate_hotel_readiness em leitura operacional: seis checks bloqueantes
passam; nove recomendações pendentes (contato, logo, hero legado, serviços,
departamentos, políticas, banners, QR e traduções). Esse resultado não comprova os
critérios funcionais/visuais de ativação; hotel permanece suspended. O check de hero
ainda usa hero_image_url legado; o slot V3 deve ser verificado separadamente, sem
alterar critérios para facilitar a aprovação. Readiness posterior será registrado
pelo executor após os dois lotes e as traduções.
[NÃO CONFIRMADO] Seed real, EN/ES efetivamente gerados, mídia em Storage, readiness
pós-seed e homologação visual ainda aguardam execução autenticada. O próximo bloqueio
humano legítimo é a senha do novo administrador, digitada exclusivamente no prompt
local oculto do executor. Não solicitar preenchimento manual de conteúdo. Tenant
permanece suspended com os dois administradores ativos e módulos já aprovados.
Detalhes, comando único, retomada e fontes: [HOTEL_BOOTSTRAP.md](HOTEL_BOOTSTRAP.md).

## Platform — administrador adicional em hotel existente (28/10/2026)

[IMPLEMENTADO E CONFIRMADO NO CÓDIGO] A Platform antes só criava administrador no
onboarding de hotel novo; o cadastro adicional exigia login do próprio hotel. Agora
`/platform/hoteis/[id]` oferece **Acessos administrativos → Adicionar administrador**.
Nome, e-mail e senha inicial digitada localmente; papel fixo Administrador, ativo=true.
Mesma política de senha do cadastro atual (trim, mínimo 6), sem senha em estado React,
URL, logs ou audit. Nenhuma conta/senha real é criada pelos testes/publicação.

`addPlatformHotelAdminAction` valida a sessão e o formulário. A RPC autenticada
`check_platform_hotel_admin_creation` verifica hotel e conflitos antes do Auth Admin
server-only criar uma identidade nova, marcada em app_metadata por operação/hotel/
executor. `add_platform_hotel_admin` repete a autorização no banco, trava autorização,
hotel, identidade e profile, aceita suspended e rejeita archived. Rejeita origem
incompatível, Platform user e profile já vinculado; não transfere nem substitui conta.
O vínculo continua sendo profiles.hotel_id: um hotel por usuário, sem memberships
adicionais. Profile vazio de hook pode ser completado com proveniência válida.

Migration `20261028100544_platform_existing_hotel_admin.sql`: RPCs para authenticated
com validação Platform Admin ativa; helper interno revogado para aplicação; SECURITY
DEFINER/search_path vazio. RLS, grants de tabelas e migrations históricas preservados.
Writer controlado estendido apenas para `hotel.admin_added`; profile e audit atômicos.
Audit registra executor, hotel, novo user UUID, papel, atividade, resultado, request_id
e timestamp. Nome/e-mail ficam fora conforme política anterior da Sprint 47.

[IMPLEMENTADO PARCIALMENTE] Identidade Auth/profile preexistente exige revisão; não
há vínculo automático, convite/recovery completo ou reenvio nesta V1. Auth e DB não
têm transação conjunta. Falha após possível criação Auth, inclusive timeout, retorna
referência de reconciliação e nunca apaga Auth automaticamente. Mesmo erro SQL
inequívoco não prova ausência de associação concorrente. Pode restar identidade sem
acesso ao hotel, marcada para revisão; não se anuncia sucesso falso. Antes de repetir,
conferir Auth/proveniência, profile e audit. Resposta perdida pode ter confirmado o
vínculo; retry falha com conflito. Reconciliação exige fluxo/RPC canônica e sessão
real compatível, não autoriza DML manual nem impersonação.

[APROVADO] 24/24 direcionados e matriz SQL local com rollback: autorização real por
papéis PostgreSQL, anon/sem identidade/comum/admin hotel/Platform inativo/ativo,
hotel suspended/active/archived/ausente, conflitos, proveniência falsa, hook vazio,
retry, falha de auditoria e preservação de hotéis/módulos/administradores. Concorrência
simultânea e resposta perdida cobertas com dependências isoladas; não equivalem a
carga no Auth remoto. Regressão SQL pública nas cinco marcas Grand Mercure/Novotel/
Mercure/Bugan/Default passou. Artefatos regeneráveis em out/, ignorados pelo Git.

Bugan preservado: ID 5eb7d695-ccf7-4594-b9df-fc46aaa25695, suspended, brand bugan,
Turismo/Voos habilitados, Karoline ativa. Nome/slug/subdomain ainda Bugan/bugan/bugan.
A decisão atual é evoluir este tenant; os checkpoints antigos abaixo são históricos.
Conteúdo, mídia e readiness aguardam terminar a correção e o cadastro humano do
segundo administrador. As branches históricas permanecem intactas.

[IMPLEMENTADO E CONFIRMADO EM PRODUÇÃO] Commit funcional
`1dd3e570c9a15b7a5a83910fa598b233c92624ba` publicado em main por SSH sem force.
Migration aplicada via CLI linked ao projeto diretorio-hotel/micuekfznunwwofxnovw;
dry-run posterior sem pendências. Fingerprints das três funções iguais ao laboratório.
Deployment `dpl_5KjBFwk7nv1KynERDsAagThjQYrp`, READY/production, mesmo projeto/equipe,
SHA e aliases libguest.digital/www/wildcards confirmados. Nenhum DNS alterado.

[APROVADO] Gates finais: 409/409 security, 24/24 direcionados, TypeScript/build OK,
lint zero erros e quatro warnings históricos; arquivos novos sem warnings; diff check
OK. SQL local: 15 matrizes públicas, uma Bugan e uma nova de administrador, todas com
rollback. Revisão React: action autenticada, mínimo de dados serializados, senha sem
estado React, labels explícitos, feedback acessível e botão bloqueado durante envio.
Smoke HTTP read-only: 10/10 verificações (landing/login, proteção de Platform/lista de
hotel sem sessão, quatro hotéis ativos, Bugan/Default suspensos). Duas RPCs negaram
anon via REST com 401. Não houve browser automation, criação de conta ou uso de senha
real. Artefatos ignorados: out/platform-admin-*. Os hashes de hotéis, profiles e
entitlements permaneceram idênticos; Auth permaneceu com 15 usuários e o novo e-mail
ausente. Nenhuma branch histórica movida.

[NÃO CONFIRMADO] Formulário autenticado e cadastro real em produção aguardam interação
humana. Abra o detalhe do tenant na Platform, Acessos administrativos → Adicionar
administrador, preencha nome Bugan Recife, e-mail libguestbugan@yahoo.com e senha
inicial exclusivamente local. Papel Administrador e ativo=true são fixos. Preservar
Karoline e manter suspended. Após confirmação humana, conferir Auth/profile/vínculo,
audit e preservação do tenant por leitura; só depois retomar conteúdo/mídia/readiness.

## Prompt 2 — publicação técnica concluída; onboarding aguardando administrador (28/10/2026)

[IMPLEMENTADO E CONFIRMADO EM PRODUÇÃO] Main publicada por SSH, sem force, no
checkpoint funcional `0952b4cdb6bb468483ec010bc3ee7389e6bd8e7f`. O usuário carregou
a chave existente no ssh-agent. Foi necessário selecionar explicitamente o OpenSSH
do Windows no GIT_SSH_COMMAND da execução; nenhum remote, chave ou histórico foi
reescrito. Fetch confirmou origin/main anterior em 5b42ec1; push e ls-remote
confirmaram o novo SHA. As branches históricas e a integração permanecem intactas.

Deployment automático validado: `dpl_4ni3MAzbnsYdnsk8ouh4mNERhC8n`, READY,
target production, projeto `diretorio-hotel`, ID
`prj_EJ9BEIP0qvROaycswNZqp4bZGo0R`, mesma equipe e Git source main/0952b4c.
URL técnica: `diretorio-hotel-8cf05pxig-brunolgms-projects.vercel.app`.
Aliases confirmados: libguest.digital, www.libguest.digital, *.libguest.digital,
domínios legados e aliases Vercel existentes. Nenhuma alteração DNS/projeto/equipe.
Esta atualização documental não altera o código funcional desse checkpoint.

[IMPLEMENTADO E CONFIRMADO EM PRODUÇÃO] As três migrations aplicadas na primeira
execução continuam sendo o contrato publicado: marca Bugan, Turismo available
opt-in e mídia V3. Nenhum tenant, entitlement ou conteúdo de cliente foi criado.
Os detalhes e fingerprints da aplicação remota estão no registro histórico abaixo.

### Smoke público e seus limites

[APROVADO] 43 verificações read-only em browser real após o deploy: landing,
login, proteção da Platform sem sessão, QR inválido, Homes de cinco tenants em
1440×900/390×844 sem overflow, slug fallback, EN/ES, áreas Serviços e Turismo/legado,
detalhe de serviço publicado do Novotel Salvador e três rotas de Voos habilitadas.
Zero pageerrors. Capturas/relatórios regeneráveis em `out/bugan-publication/`, fora do Git.
O harness bloqueou requisições de escrita e APIs de provedores; não enviou formulários,
mensagens, eventos analytics ou pedidos, e não consultou status real de voos.

| Tenant existente | Tema efetivo preservado | Resultado |
| --- | --- | --- |
| Grand Mercure Copacabana | grand-mercure | Home/slug/idiomas/áreas/Voos HTTP 200 |
| Novotel Salvador | novotel | Home/slug/idiomas/áreas/detalhe/Voos HTTP 200 |
| Mercure Rio Boutique | mercure | Home/slug/idiomas/áreas/Voos HTTP 200 |
| Novotel Leme | deep-ocean legado configurado | Home/slug/idiomas/áreas HTTP 200 |
| Bugan antigo, slug bugan | deep-ocean, sem marca | fallback existente preservado |

Não se confundiu brand_code com theme_preset: Novotel Leme já possuía deep-ocean
no banco e manteve essa apresentação. Não foi redesenhado silenciosamente.
A RPC pública de Voos retornou dois aeroportos e um card para Grand Mercure;
Novotel Salvador e Mercure têm entitlement, mas não retornam configuração/card
público. Essas ausências existentes não foram preenchidas por suposição.

[NÃO CONFIRMADO] Smoke autenticado de Admin/Platform, QR válido com contexto de
quarto, analytics efetivamente recebido e status via provedor não integram essa
verificação read-only. Nenhuma homologação do novo tenant Bugan Recife foi alegada.
Os gates técnicos anteriores continuam válidos: 398/398 security, 127/127
direcionados, 16 SQL locais, TypeScript/build/diff OK, lint zero erros/quatro warnings
históricos. Nesta retomada não houve alteração de aplicação, migration ou testes.

### Ponto exato de parada

[IMPLEMENTADO PARCIALMENTE] Publicação técnica encerrada; ativação operacional
parada na etapa 13, antes de invocar o onboarding. O usuário declarou que não há
administrador aprovado e proibiu inventar usuário, reutilizar conta ou enviar convite.
O validador exige admin_full_name/admin_email; a RPC exige p_admin_user_id existente
e compatível no Auth. O readiness também trata admin.active como blocker.
Não existe caminho canônico para criar o draft sem esses dados. Nenhum INSERT manual
ou enfraquecimento de validação/RLS/readiness foi feito.

Alvo permanece não criado: Bugan Recife, marca bugan, slug bugan-recife,
subdomain buganrecife. Não há tenant ID, lifecycle, conteúdo persistido, mídia em
Storage, Turismo/Voos configurados, usuários, quartos/QR ou readiness executado para
esse alvo. O Bugan antigo foi preservado. O hostname alvo está coberto pelo wildcard,
mas ainda não constitui uma experiência ativada/homologada.

Próxima ação humana necessária: aprovar nome e e-mail do administrador inicial e
liberar o onboarding/convite em etapa posterior. Somente então criar draft pelo fluxo
oficial, persistir o conteúdo/mídia já preparados, configurar opcionais com dados
válidos e executar preview, readiness e eventual ativação. Sem inventário real de UHs,
nenhum quarto será criado. REC continua ausente do catálogo atual; sem parâmetros
inventados. A chave SSH não é mais bloqueio.

## Histórico — primeira execução do Prompt 2 (28/10/2026)

[IMPLEMENTADO PARCIALMENTE] Publicação canônica: migrations remotas aplicadas;
main integrada localmente; push bloqueado por autenticação. Nenhum tenant Bugan Recife
foi criado, configurado ou ativado. Nenhum convite foi enviado. O usuário confirmou
que ainda não existe nome/e-mail aprovado e proibiu inventar ou reutilizar contas.

### Git e publicação

Checkpoint inicial confirmado: `integration/bugan-s52-public-v3`, `a192cd6`, limpo.
O SSH reconhece a chave existente, mas não conclui autenticação; `ssh-agent` está
Disabled/Stopped e o Windows negou permissão para habilitá-lo nesta execução.
Fetch HTTPS do mesmo repositório funcionou, sem alterar o remote salvo, e reconfirmou
`origin/main` em `5b42ec1fdd31337efc367df7ea18420da314a10a`. Isso não comprovava
credencial de escrita: o push HTTPS não interativo falhou ao obter autenticação.
Nenhum token, passphrase ou conteúdo de chave privada foi exposto ou gravado.

[IMPLEMENTADO E CONFIRMADO NO CÓDIGO] Merge não destrutivo em main: `cef70f1`.
Correção test-only `b7a4564`: o gate antigo de hash dependia dos bytes do working tree
antes do checkout. Com core.autocrlf=true ele falhava após trocar de branch. Agora
compara os blobs HEAD com os commits originais `3e2be2b` e `f7e7aed`, verifica SHA-256
e confere a cópia de trabalho admitindo somente conversão CRLF→LF. A fundação possui
SHA-256 canônico `be1e6c4a81a9ef2830b54e6ee6c8ccd0d017dc6412db8b406255718cdbfeccd6`,
comprovadamente igual em f7e7aed, 6551abd, efa4d88, a192cd6 e no merge. Nenhuma
migration histórica ou regra de autorização foi modificada para fazer o teste passar.

[APROVADO] Gates repetidos em main: security 398/398, TypeScript OK, lint 0 erros /
4 warnings históricos, build OK, diff --check OK. As 16 execuções SQL locais também
foram reconfirmadas antes da publicação. As branches históricas e a integração
permanecem nos seus commits originais. Commits POC de IA não foram integrados.

### Supabase remoto

[IMPLEMENTADO E CONFIRMADO EM PRODUÇÃO] Projeto `diretorio-hotel`, ref
`micuekfznunwwofxnovw`, URL `https://micuekfznunwwofxnovw.supabase.co`, consistente
com o linkage CLI e a configuração da aplicação. Inventário remoto: 39 migrations
antes; 42 depois. O dry-run listou somente as três abaixo e a execução oficial
`supabase db push --linked --yes` aplicou exatamente essas versões, sem seed/roles:

- `20261027215620_bugan_canonical_brand.sql`;
- `20261028012744_52_2_tourism_governance_available.sql`;
- `20261028034907_public_experience_media_v3.sql`.

Dry-run posterior: `upToDate:true`, nenhuma pendência. Os quatro corpos de funções
afetadas coincidiam com as versões locais anteriores, sem drift inexplicado nesses
contratos. ACLs/SECURITY DEFINER/search_path foram conferidos. A tabela de mídia tem
RLS, zero linhas e nenhum INSERT/UPDATE/DELETE para authenticated; anon não executa
sua RPC. As migrations não provisionaram entitlements ou dados de cliente.

Preservação antes/depois, inclusive fingerprints completos idênticos:

| Objeto | Linhas | Fingerprint MD5 antes = depois |
| --- | ---: | --- |
| hotéis | 6 | `8eff6c792cb8cc6138021679167a6899` |
| entitlements | 75 | `fb9925875059ed39e8cdb3abd369db99` |
| layouts | 48 | `357d24af5bb609b30974a6ae930d59ff` |
| Turismo | 0 | vazio |

Existe tenant anterior chamado `Bugan`, slug/subdomain `bugan`, ativo e sem marca.
Ele foi preservado e não foi confundido com o novo alvo `bugan-recife`/`buganrecife`.
Nenhuma conta desse tenant foi reutilizada. REC não existe no catálogo remoto atual;
Central de Voos do novo hotel continua sem configuração, sem aeroporto/parâmetros inventados.

### Vercel e limites da homologação

[APROVADO] Projeto reconfirmado: `diretorio-hotel`,
`prj_EJ9BEIP0qvROaycswNZqp4bZGo0R`, equipe existente. A produção encontrada antes
da tentativa de publicação estava READY em `dpl_4nZbNw6EU72wxxLrT7ct3ZVSsbcZ`, commit
`5b42ec1`, branch main. O fluxo canônico é publicação Git; nenhum projeto/equipe/DNS
foi criado ou trocado. Como o push não concluiu, nenhum novo deploy foi solicitado.
Smoke pós-deploy, preview autenticado do novo tenant, homologação pública V3 e
readiness do Bugan Recife ainda NÃO foram executados; não se presume aprovação.

### Preparação independente do tenant

[APROVADO] Fontes consultadas em 28/10/2026:
[página oficial Atlantica](https://www.letsatlantica.com.br/hotel/bugan-hotel-recife-by-atlantica),
[diretório operacional](https://www.descubraobugan.com/) e fotografias fornecidas.
A ação oficial Reservar aponta para `https://atlantica.letsbook.com.br/reserva/busca?hotel=22`,
sem datas/token de sessão persistidos. Nenhum conteúdo foi cadastrado no banco.

As quatro fotos reais foram otimizadas localmente com Sharp já instalado, sem
upscale nem alteração de cenas. Originais preservados em docs/references; derivados
em `out/bugan-activation/media/`, ignorados pelo Git e ainda NÃO enviados ao Storage:

| Slot | Arquivo WebP | Dimensões | Bytes |
| --- | --- | --- | ---: |
| hero | hero-piscina-real.webp | 1800×1000 | 350372 |
| about | fachada-bugan-real.webp | 655×505 | 33356 |
| restaurant | restaurante-filipe-real.webp | 1400×933 | 132944 |
| accommodation | acomodacao-bugan-real.webp | 750×964 | 49706 |

[APROVADO] Logo real localizado no link de imagem da página oficial:
`https://letsimage.s3.amazonaws.com/editor/atlantica/imgs/1788505754743-bugan-by-atlantica.svg`.
Foi preparado PNG proporcional 600×180, 10340 bytes, para upload pelo fluxo seguro;
o SVG original não será enviado como imagem permitida. Não foi redesenhado logo.
Fontes licenciadas Wask New/Astonia continuam pendentes. Golden master não foi
convertido em fotografia nem enviado a Storage público.

[PLANEJADO] Após onboarding: persistir dados/serviços/departamentos/políticas e
slots via fluxos canônicos; Turismo com Praça de Boa Viagem e Shopping Recife;
idiomas pelo fluxo oficial; Voos somente com catálogo/configuração válidos; avaliar
readiness sem enfraquecê-lo. Não foram importados preços de diárias, promoções,
horário conflitante de música, preço de estacionamento, WhatsApp sem confirmação
ou números de apartamentos. Nenhum Google Translation real foi acionado nesta rodada.

### Bloqueios e retomada

Bloqueio imediato: push Git sem autenticação de escrita. Solicitado ao usuário,
uma única vez, habilitar o ssh-agent e carregar a chave existente em PowerShell
administrativo, digitando passphrase somente no terminal local. Nenhum segredo no chat.

Bloqueio posterior confirmado no validador real e na RPC canônica: criar draft exige
nome/e-mail aprovados e um usuário Auth compatível. Sem isso, o validador retorna
`Informe o nome do administrador inicial.` A RPC rejeita ausência do administrador
antes de inserir o hotel. Não houve INSERT manual, bypass ou convite fictício.
A retomada no onboarding depende desses dados humanos e de autorização de convite.


## Reconciliação Sprint 52 + Bugan e Public Experience V3 (28/10/2026)

### Decisão vigente e Git

[IMPLEMENTADO E CONFIRMADO NO CÓDIGO] A linha local `integration/bugan-s52-public-v3`
nasceu da Sprint 52 final `efa4d886b52483d6333297dcfe38430c516a7623` e recebeu
`feat/bugan-recife-ux-v2` em merge não destrutivo `6b51038` (dois pais).
Bugan permanece em `6a117d7542b884315a6cef57281b0b1b70bc4cdd`; ancestor comum
`6551abdff53a7629ee6f9c0621b1b6b27bf51163`. As duas branches originais não foram movidas.
O único conflito textual foi a declaração test-only de `registerHooks`: assinaturas
idênticas foram consolidadas sem ampliar o contrato. O auto-merge do compositor foi
revisado: o encaminhamento de `tourismHomeAvailable` para Bugan foi acrescentado,
preservando as Homes das outras marcas. Nenhuma migration histórica foi reescrita.

[APROVADO] A composição Home do golden master V3 substitui a grade compacta inicial
V2 para Bugan. UX V1 continua [DESCARTADO]. A seção V2 abaixo é registro histórico;
suas afirmações de Turismo `coming_soon`, testes antigos vermelhos e reconciliação
futura foram superadas pelo fechamento da Sprint 52 e por esta reconciliação local.
Bugan é cliente canônico permanente: toda sprint compartilhada deve testar
Grand Mercure, Novotel, Mercure, Bugan e Default, respeitando entitlement/configuração.

### Arquitetura de mídia e editorial

[IMPLEMENTADO E CONFIRMADO NO CÓDIGO] Reutilizados `hotel-assets`,
`validateImageUpload`, políticas de hero e geração UUID de paths no servidor.
O contrato antigo `hotels.hero_image_url` não comportava imagem mobile, focal points
ou os três placements editoriais; banners/Services não oferecem essas semânticas.
A extensão mínima é uma tabela genérica `hotel_public_experience_media`, quatro
slots (`hero`, `about`, `restaurant`, `accommodation`), sem dados ou nomes de tenant.
Migration nova: `20261028034907_public_experience_media_v3.sql`.

Cada slot contém desktop/mobile opcionais, focal X/Y normalizado 0–100 em ambos,
alt, título, descrição, CTA HTTPS opcional, publicação e revisão inteira.
Uma imagem serve desktop/mobile; a variante mobile tem prioridade no mobile.
Sem foto, o hero mantém fallback temático; o URL legado continua como compatibilidade.
As outras marcas recebem a infraestrutura, preservando a apresentação atual.
O preset/overlay é resolvido pelo tema Bugan, não por campos CSS escolhidos pelo hotel.

A edição fica em `/admin/hotel`, no mesmo nível editor/administrador já exigido pela
rota, com entitlement `experience.appearance`. Preview, clique na fotografia na
proporção original e sliders acessíveis permitem escolher focal points sem CSS.
Os textos novos são fonte PT, também usados como fallback em EN/ES; não foi criado
tradutor nem alterado o contrato dos cinco editoriais anteriores de `/admin/idiomas`.
Traduções próprias desses novos slots são evolução futura, não fluxo homologado aqui.

RLS separa publicação pública de leitura administrativa; a RPC
`update_current_hotel_experience_media(p_slot text, p_expected_revision integer,
p_values jsonb)` deriva hotel/permissão da sessão, exige editor ativo e entitlement,
serializa por hotel e rejeita revisão desatualizada com PT409. Campos desconhecidos,
hotel_id e paths de outro hotel/slot são rejeitados. Retorna revisão e os dois paths
anteriores. SECURITY DEFINER possui search_path vazio, execução pública revogada e
auditoria na transação. Não há DML de tabela nem Storage write concedido ao browser.

Uploads usam `upsert:false`, MIME+assinatura JPEG/PNG/WebP, 2 MiB agregados por envio, máximo 8192 por
eixo e 40 milhões de pixels. Paths: `<hotel>/hero/<slot>/<uuid>.<ext>`, gerados no servidor.
O limite agregado respeita as Server Actions existentes de 3 MiB, com margem para multipart/textos; não houve aumento global do limite. Fotos originais maiores precisam ser otimizadas antes do upload no Prompt 2. Uploads são validados antes da primeira escrita. Cleanup somente depois da associação
confirmada; compensação do upload novo somente após erro SQL definitivo. Respostas
ambíguas preservam todos os arquivos. Paths anteriores vêm da RPC; ownership é
revalidado e retry limitado a dois. Falha de cleanup é informada para reconciliação.
Não há delete definitivo dos slots: remover foto/despublicar preserva o editorial.
Rollback comportamental futuro pode despublicar os slots, sem apagar tabela/dados.

### Público, navegação e domínios compartilhados

[IMPLEMENTADO E CONFIRMADO NO CÓDIGO] Só Bugan recebe a Home V3: foto dominante,
header desktop/drawer mobile acessível, headline editorial, 2–6 acessos dinâmicos,
três editoriais opcionais e amenidades obtidas de Services publicados/configurados.
Nenhuma afirmação sobre piscina, academia/localização ou catálogo de Recife está fixa
na apresentação. Reserva existe somente com booking_url HTTPS configurado; nenhum
link vazio `#`. Menu gastronômico usa placement publicado ou serviço de cardápio real.
A Home V3 usa navegação no header/drawer; os docks internos anteriores permanecem.
Turismo e Voos nunca entram no dock.

Explore utiliza `loadPublicTourism`, os mesmos itens publicados, ordenação e fallback
PT/EN/ES por campo da Sprint 52. Sem entitlement/conteúdo, não há acesso/preview.
Não há loader, catálogo, regra de tenant ou módulo duplicado para Bugan. O catálogo
continua com 20 módulos, baseline de 12; Turismo e Voos são opcionais. Services legados
não foram migrados, apagados ou refiltrados destrutivamente. QR/roomToken não mudou:
a Home recebe somente o contexto seguro já resolvido pelas rotas canônicas.

### Referências e validação visual

[APROVADO] As cinco referências físicas fornecidas estão em
`docs/references/bugan/public-v3/`; não são assets servidos pelo Next em produção.
Fotos reais: rooftop, fachada, Restaurante Filipe e acomodação. O golden master é
referência de composição, nunca imagem de fundo. A persistência de fotos do tenant
real será pelo fluxo normal no Prompt 2; não foi criado tenant nem seed de negócio.

[IMPLEMENTADO PARCIALMENTE] Fidelidade estrutural confirmada em capturas locais
1440×900, 1536×864, 390×844 e 430×932: hero, navegação, acessos, editorial e mobile.
A foto real possui enquadramento/luz diferentes da prancha; não foi sintetizado céu,
piscina ou skyline. Logo oficial/licenciado e fontes Wask New/Astonia ainda não estão
persistidos: slot funcional com fallback textual e Georgia/system, sem redesenhar logo.
Textos definitivos, benefícios e catálogo turístico real pertencem ao Prompt 2.
As capturas usam fixtures explicitamente sintéticas, não comprovam ativação de hotel.

### Gates reproduzíveis e limites

[APROVADO] Direcionados 127/127; Security 398/398; TypeScript OK; lint 0 erros / 4 warnings históricos; build OK; diff --check OK. Security inclui oito testes da ação real de mídia com validação,
ordem upload→RPC→cleanup, PT409, revisão stale, MIME inválido, resposta ambígua e retry.
A comparação integral antiga do renderer foi substituída por preservação do helper
legado, testes de rotas reais e renderização do legado sob os cinco temas; a alteração
permitida é de apresentação. Turismo final foi mantido como `available`, fora do baseline.
O gate SQL cumulativo de aeroportos compara conjunto ativo, em vez de presumir que
só três aeroportos de fixture existam. Snapshots/migrations históricas ficam intactos.

`node tests/bugan-runtime.mjs`: 60 combinações viewport/idioma/2–6 acessos, cinco temas,
catálogo/detalhe Turismo, legado, Voos, contexto de quarto sintético, drawer com foco/
Escape/restauração, preview focal e módulos ON/OFF. Playwright é devDependency fixa,
sem instalação temporária pessoal. A rota dev-only é removida no finally. Evidências e
logs regeneráveis ficam em `out/public-v3/` (ignorado), fora do commit de aplicação.

`powershell -NoProfile -File supabase/tests/public_experience_local_lab.ps1`: 15
execuções SQL locais com rollback (mídia + nove gates cumulativos + Turismo em cinco
marcas), sem resíduos; matriz Bugan adicional confirma ACL, onboarding e isolamento.
O runner exige baseline descartável pré-Turismo/Sprint 51 e aceita `-Container` local.
Não é bootstrap remoto. Nova ação usa clientes simulados nos testes; não se alega
homologação autenticada ponta a ponta do novo formulário com Storage real de produção.

### Inventário de arquivos da reconciliação

Delta contra a Sprint 52 final `efa4d88` (inclui a incorporação da branch Bugan).
As evidências V2 incorporadas são históricas; os arquivos V3 em `docs/references` são referências, não assets públicos.

```text
A	app/admin/hotel/experience-media-actions.ts
A	components/admin/experience-media-editor.tsx
A	components/public/bugan.css
A	components/public/public-area-hero.tsx
A	components/public/public-bottom-dock.tsx
A	components/public/public-experience-menu.tsx
A	components/public/public-experience-overview.tsx
A	docs/evidence/bugan/admin-390.png
A	docs/evidence/bugan/admin-desktop.png
A	docs/evidence/bugan/admin-drawer-390.png
A	docs/evidence/bugan/public-390.png
A	docs/evidence/bugan/public-430.png
A	docs/evidence/bugan/public-desktop.png
A	docs/evidence/bugan/runtime.json
A	docs/references/bugan/public-v3/acomodacao-bugan-real.png
A	docs/references/bugan/public-v3/fachada-bugan-real.png
A	docs/references/bugan/public-v3/golden-master-public-v3.png
A	docs/references/bugan/public-v3/hero-piscina-real.png
A	docs/references/bugan/public-v3/restaurante-filipe-real.png
A	lib/public-experience-media.ts
A	lib/public-experience-overview.ts
A	supabase/migrations/20261027215620_bugan_canonical_brand.sql
A	supabase/migrations/20261028034907_public_experience_media_v3.sql
A	supabase/tests/bugan_behavioral_matrix.sql
A	supabase/tests/bugan_local_lab.ps1
A	supabase/tests/bugan_tourism_local_lab.ps1
A	supabase/tests/public_experience_local_lab.ps1
A	supabase/tests/public_experience_media_behavioral_matrix.sql
A	tests/bugan-runtime.mjs
A	tests/fixtures/bugan-visual-page.tsx
A	tests/security/bugan.test.ts
A	tests/security/public-experience-media.test.ts
A	tests/security/public-experience-media-actions.test.ts
M	app/admin/experiencia/page.tsx
M	app/admin/hotel/page.tsx
M	app/globals.css
M	app/hotel/[slug]/page.tsx
M	app/page.tsx
M	components/admin/experience/experience-metrics.tsx
M	components/public/hotel-public-area-content.tsx
M	components/public/hotel-public-flight-center.tsx
M	components/public/hotel-public-page-content.tsx
M	components/public/hotel-service-detail-content.tsx
M	components/public/language-switcher.tsx
M	docs/PRODUCT_MAP.md
M	docs/SPRINT_52_TOURISM.md
M	lib/admin-theme.ts
M	lib/hotel-subdomain.ts
M	lib/hotel-theme.ts
M	lib/platform-governance.ts
M	lib/public-copy.ts
M	lib/public-hotel-data.ts
M	package.json
M	package-lock.json
M	supabase/tests/51_flight_center_configuration_behavioral_matrix.sql
M	tests/security/admin-theme.test.ts
M	tests/security/node-module-hooks.d.ts
M	tests/security/tourism-home.test.ts
M	tests/security/tourism-legacy-transition.test.ts
M	types/database.ts
```

### Publicação e próxima etapa

[NÃO CONFIRMADO] Fetch origin falhou com `Permission denied (publickey)`.
`main` e a referência cacheada `origin/main` permaneceram em `5b42ec1`; não foi
inventado estado remoto atual. A reconciliação é local; não houve push/main/deploy.
Nenhuma escrita Supabase remota, tenant, administrador, quarto, conteúdo, entitlement
ou imagem de negócio foi criada. Google real não foi utilizado.

[APROVADO] Inspeção read-only Vercel identificou `diretorio-hotel`, projeto
`prj_EJ9BEIP0qvROaycswNZqp4bZGo0R`. `libguest.digital`, `www.libguest.digital` e
`*.libguest.digital` estão associados e verificados. Configuração DNS consultada para
raiz, www e `buganrecife.libguest.digital`: `misconfigured:false`, sem conflitos.
Nenhum DNS foi alterado. O wildcard cobre o hostname alvo; o tenant só será resolvido
após criação autorizada com subdomain `buganrecife` e slug `bugan-recife` no Prompt 2.
Projeto/migrations/drift Supabase remoto não foram inspecionados nesta rodada local;
a aplicação remota continua condicionada aos gates Git e à conferência explícita.

[PLANEJADO] **LibGuest Public Experience V3** para Grand Mercure, Novotel e Mercure,
usando a mesma infraestrutura e preservando a identidade própria. Não redesenhados aqui.
Para Prompt 2: autenticar/reconfirmar Git remoto e main; conferir projeto e drift
Supabase; aplicar somente migrations revisadas pendentes; publicar pelo fluxo oficial;
criar tenant draft/admin autorizado; subir logo/fontes licenciados e fotos por Storage;
revisar textos/CTAs/amenidades/idiomas; configurar opcionais autorizados; preparar
quartos/QR; executar readiness e homologação autenticada antes da ativação.

Contrato técnico da Sprint 52 — Turismo: [SPRINT_52_TOURISM.md](SPRINT_52_TOURISM.md).
A Sprint 52 final está em `efa4d88`. Turismo está `available`, opt-in, fora do baseline de 12 módulos, com Admin, imagens, idiomas e catálogo público compartilhado.

## Histórico: Bugan Recife — decisão canônica e entrega local UX V2 (27/10/2026)

### Decisão e continuidade

[APROVADO] Antes desta entrega o Bugan possuía apenas mockups externos V1/V2.
Bugan Recife passa a ser cliente canônico permanente do LibGuest, com marca `bugan`
e UX V2 definitiva. A entrada do cliente Atlântica exige identidade própria e evolução
pelo produto compartilhado. Marca e propriedade não se confundem: `bugan` é a marca;
Bugan Recife, Recife, PE é a propriedade. Não foi necessária variante de propriedade.

[DESCARTADO] UX V1, páginas paralelas, forks de negócio e ativação automática de opcionais.

> Toda funcionalidade compartilhada nova ou alterada no LibGuest deve ser validada para o Bugan Recife, salvo quando explicitamente desabilitada por entitlement. Implementações futuras não devem exigir cópia ou fork específico para o Bugan.

A matriz permanente é **Grand Mercure, Novotel, Mercure, Bugan e Default/fallback**,
inclusive para Turismo, Central de Voos, IA/Router, analytics, serviços, departamentos,
políticas, comunicados, banners, QR/apartamentos, idiomas, navegação e Admin.

### Git e relação com a Sprint 52

[APROVADO] Base técnica excepcional autorizada: `sprint-52-tourism`, commit
`6551abdff53a7629ee6f9c0621b1b6b27bf51163`, árvore inicialmente limpa.
Branch criada: `feat/bugan-recife-ux-v2`. A `main` não foi alterada e a Sprint 52
permanece aberta e intacta. Cinco commits preservados: 3e2be2b, f7e7aed, ec282c1,
0b3e36d e 6551abd. Novos commits de Turismo após esse checkpoint não entram
automaticamente na branch Bugan. Antes da integração final em main é obrigatória
reconciliação explícita da Sprint 52 final com Bugan UX V2 final, preservando ambas
as linhas e repetindo a matriz multi-hotel. Não integrar Bugan na Sprint 52 agora.

[NÃO CONFIRMADO] Estado remoto atual: fetch falhou por autenticação SSH (publickey);
não houve tentativa de reparo. Referências locais main e origin/main apontavam para
`5b42ec1fdd31337efc367df7ea18420da314a10a`, sem divergência conhecida. A base estava
cinco commits adiante de main e um adiante da referência local origin/sprint-52-tourism.
Não houve push, merge, rebase, cherry-pick, deploy, convite, cadastro ou escrita remota.

### Mapa técnico e estado herdado

[IMPLEMENTADO E CONFIRMADO NO CÓDIGO] Pontos de extensão inspecionados:

- Marca/tema público e governança de aparência: `lib/hotel-theme.ts`; labels,
  catálogo de marcas, diretório e governança: `lib/platform-governance.ts`.
  Onboarding: `lib/platform-onboarding.ts` e formulário em `app/platform/hoteis/novo/`.
- Admin: `lib/admin-theme.ts`, `app/admin/layout.tsx`, sidebar, nav-links e mobile-menu.
  Resolução server-side por `profile.hotel_id`; plataforma global fora do provider.
  Estados de carregamento, erro, vazio e acesso negado mantêm componentes compartilhados.
- Público: `lib/public-hotel-data.ts` carrega conteúdo e traduções;
  `lib/experience-layout.ts`/`experience-layout-queries.ts` normalizam composição;
  `components/public/hotel-public-page-content.tsx` seleciona apresentação.
  Áreas internas, detalhes e voos usam o mesmo domínio. Banners ativos/período/limite
  continuam filtrados no loader atual e apresentados pelo carrossel sem autoplay.
- Banco: migrations 20260724 (marca), 202608140002 (governança), 202608170001
  (onboarding), 202608170002 (readiness), 202608180001 (composição/onboarding atual),
  migrations 51 de voos/AirLabs e as três migrations atuais de Turismo.
  Nenhuma migration histórica foi editada.
- Lifecycle: Auth com compensação de falha, slug/subdomínio únicos, administrador inicial,
  criação draft-only, auditoria atômica, readiness, ativação/suspensão/arquivamento
  e resolução pública permanecem nos contratos existentes.
- Domínios: libguest.digital e www são raízes; subdomínios resolvem hotel e
  `/hotel/[slug]` é fallback. guestdesk.digital continua legado dual-domain.
  URLs, QR `/r/[roomToken]` e preview usam os contratos existentes; DNS/Vercel intactos.

[IMPLEMENTADO E CONFIRMADO NO CÓDIGO] Baseline de **12** módulos: core.directory,
content.services, content.departments, content.policies, content.announcements,
content.banners, rooms.qr, content.languages, experience.appearance,
experience.navigation, experience.preview e analytics.basic. Catálogo total: **20** chaves.

[IMPLEMENTADO E CONFIRMADO NO CÓDIGO] Central de Voos é opcional disponível
(`travel.flights`): configuração, Meu voo/Partidas/Chegadas, planejamento e status
verificado quando existe fonte. Preserva estado não verificado, ações condicionais,
isolamento e ausência de itinerário em analytics. Não usa roomToken como identidade.
Nenhum aeroporto, ação ou entitlement foi habilitado para Bugan.

[IMPLEMENTADO PARCIALMENTE] Turismo possui domínio, banco/RLS/RPCs, auditoria,
Admin, revisão concorrente, imagem principal e traduções PT/EN/ES. Catálogo segue
coming_soon, fora do baseline. A rota pública existente ainda apresenta estado vazio;
não há catálogo turístico público completo ou conteúdo real de Recife. Não foi alterada
a maturidade/disponibilidade da Sprint 52 nem simplificado seu código.

[PLANEJADO] experience.seo, fb.menu, analytics.advanced, integrations.thex,
integrations.opera e audit.access_logs continuam coming_soon no catálogo atual.
Rotas de compatibilidade/menu por apartamento e fundação de analytics Pro não
significam disponibilidade comercial desses entitlements.

[EM ANÁLISE] Integração futura de IA/Router: sem entitlement canônico de concierge
nesta base. [DESCARTADO] Integrar POCs ou exibir widget nesta etapa.
Nenhum agent/provider/ID/variável ou `.env.local` foi alterado.

### POCs de IA — inspeção somente de Git

Todos localizados; nenhum ancestral de 6551abd, nenhum integrado nesta entrega.
Referências remotas abaixo são as armazenadas localmente, sem confirmação do servidor.

| Commit | Branches locais que contêm | Referência remota local |
|---|---|---|
| db07d966 | poc/libguest-ai-analytics-persistence; poc/libguest-ai-housekeeping-singular-hotfix; poc/libguest-ai-router-negation-hardening | origin/poc/libguest-ai-housekeeping-singular-hotfix |
| eec759e | poc/libguest-ai-housekeeping-singular-hotfix; poc/libguest-ai-router-negation-hardening | origin/poc/libguest-ai-housekeeping-singular-hotfix |
| c297eca | poc/libguest-ai-housekeeping-singular-hotfix | origin/poc/libguest-ai-housekeeping-singular-hotfix |

Não houve checkout, alteração ou integração dessas branches/commits.

### Implementação e apresentação

[IMPLEMENTADO E CONFIRMADO NO CÓDIGO] Marca aceita em tipos, validadores, labels,
onboarding, diretório e governança. Tema público usa #AD6433, #B58150, #2D2926,
#D6D2C4 e neutros quentes, preservando cores semânticas. Admin usa carvão/areia,
label BUGAN, navegação, permissões, shell e drawer existentes.

`PublicExperienceOverview` recebe o mesmo payload do compositor, sem fetches ou
regras de negócio por tenant. Inclui os oito blocos atuais, ordem persistida,
hero obrigatório pelo contrato, seis acessos possíveis a destinos canônicos,
contagem real de comunicados, PT/EN/ES, banners reais e voos condicionais.
Novos blocos compartilhados devem entrar no catálogo/compositor e na matriz,
sem implementação separada de negócio para Bugan.

Defaults aplicam-se **somente a novos inserts Bugan**: hero, quick_info,
announcements, services, contact, departments, policies, banners. A grade usa a
ordem persistida; reorder segue autorizado/auditado pelas RPCs atuais. Nenhum
layout existente foi sobrescrito. Voos aparece antes dos banners, ou depois dos
cards quando não há banners, sem item adicional no dock. Wi-Fi/café/check-out
reutilizam campos reais já públicos; ausências e senha Wi-Fi não aparecem na faixa.

Chip recebe exclusivamente activeRoomContext validado pelo fluxo compartilhado.
Nenhum quarto entra em links previsíveis. Dock tem até quatro itens canônicos,
ícone/rótulo, foco, estado ativo, safe area e reserva de espaço. Detalhes de serviço
mostram somente destinos garantidos por seu payload (Início/Serviços).
Áreas internas e Central de Voos usam hero/dock genéricos por tokens.

Admin Experiência Pública reutiliza loaders: falha permanece erro, sem virar zero.
Indicadores apontam apenas para destinos permitidos pelo catálogo/role/entitlements;
status diferencia lifecycle ativo de diretório desabilitado. Atenção necessária
apresenta checks reais de readiness, sem motor novo. Não existe workflow intermediário
fictício de rascunho/publicação; permanece publicação por lifecycle e entitlement.

[IMPLEMENTADO PARCIALMENTE] Acabamento de identidade: manual/mockups V2 inspecionados.
O kit contém apenas bugan-logo-referencia.png/bugan-monograma-referencia.png extraídos
do manual; não foram promovidos a assets oficiais nem copiados para public.
Não há arquivos originais autorizados de logo/monograma/texturas ou fontes
Wask New/Astonia fornecidas/licenciadas. Fallback textual e fonte de sistema legível.
Campo de logo mantém proporção, respiro e mínimo digital de 23 px.
Nenhum logo redesenhado/vetorizado/filtrado/inventado; nenhuma fonte baixada.

### Arquivos e migration

Criados:

- `lib/public-experience-overview.ts`: modelo de apresentação de blocos compartilhados.
- `components/public/public-experience-overview.tsx`, `public-area-hero.tsx`,
  `public-bottom-dock.tsx`, `bugan.css`: apresentação por tokens.
- `supabase/migrations/20261027215620_bugan_canonical_brand.sql`: constraint,
  allowlists de create_platform_hotel_onboarding/update_platform_hotel_brand,
  default de tema no onboarding e defaults insert-only de initialize_hotel_experience_layout.
  Sem backfill, grants, políticas ou ativação.
- `supabase/tests/bugan_behavioral_matrix.sql`, `bugan_local_lab.ps1`,
  `bugan_tourism_local_lab.ps1`: fixtures/rollback, incluindo Turismo nas cinco marcas.
- `tests/security/bugan.test.ts`: marca, onboarding, isolamento, composição/gates,
  paridade dos corpos das RPCs; `tests/security/node-module-hooks.d.ts`: tipagem
  limitada aos testes para API Node 22.15+ já usada na base, ausente no @types/node 20.
  Sem alteração de runtime ou dependências.
- `tests/fixtures/bugan-visual-page.tsx`, `tests/bugan-runtime.mjs`: harness sintético
  local. Runner cria/remove rota dev-only temporária e bloqueia APIs/rede externa.
  A rota temporária foi removida e não integra o build final.
- `docs/evidence/bugan/`: seis PNGs e runtime.json. **Fixtures sintéticas, não cadastro
  do cliente.** Banner com imagem usa asset existente de teste, não mídia aprovada do Bugan.

Modificados: lib/hotel-theme.ts, lib/admin-theme.ts, lib/platform-governance.ts,
lib/public-copy.ts; compositor público, áreas/voos/detalhes, language-switcher;
app/globals.css; app/admin/experiencia/page.tsx e experience-metrics.tsx;
tests/security/admin-theme.test.ts e este PRODUCT_MAP. Nenhum asset de produção novo.

Rollback lógico: primeiro reclassificar de forma autorizada eventuais tenants Bugan
para NULL/outra marca e tema legado; depois restaurar constraint e três corpos de
função anteriores (46c/50). Nunca excluir tenant/dados como rollback. ACLs,
search_path, autorizações, auditoria e draft-only preservados por CREATE OR REPLACE.

### Evidências, regressões e limites

[IMPLEMENTADO E CONFIRMADO NO CÓDIGO] Matriz de marcas, onboarding e isolamento
de tokens. SQL local: migration aplicada duas vezes, snapshots de hotéis/layout/
entitlements intactos, ACLs/RLS/auditoria, draft-only, opcionais desligados e
cross-tenant negado. DDL e fixtures revertidos.

[IMPLEMENTADO E CONFIRMADO NO CÓDIGO] Edge local: 72 combinações
(320/360/390/430 × PT/EN/ES × 1–6 cards), sem overflow; cinco temas renderizados;
voos ligados/desligados por payload; banners com/sem imagem; contexto sintético;
áreas de informações/Turismo; dock sem cobrir rodapé; drawer com foco contido,
restaurado e Escape. Zero pageerrors. Capturas públicas 390×844, 430×932 e 1440×900;
Admin 390×844, 1440×900 e drawer 390×844.

Scripts existentes de composição/RLS 50, readiness 48 e matrizes 51 de home de voos,
Central de Voos e entitlement passaram localmente. A matriz SQL de Turismo 52 foi
executada sem reescrever seus contratos nas cinco marcas e passou.
Scripts históricos 47 e 46.8 falharam **antes de aplicar a migration Bugan** por
expectativas antigas (baseline 11, catálogo 19), incompatíveis com Sprints 50/51.
Preservados como histórico; não reportados como aprovados. Testes atuais verificam 12/20.

Validação final local: `npm run test:security` **328/328**, `npx tsc --noEmit`
aprovado, `npm run build` aprovado, `npm run lint` sem erros e com quatro avisos
preexistentes de img (hotel Admin, dois diretórios Platform e Home default),
`git diff --check` aprovado. Nenhum aviso novo de lint. O runner visual foi também
executado iniciando/encerrando seu próprio servidor e removendo a fixture e sua
referência gerada no cache de tipos do Next. O primeiro build após remover a rota
temporária encontrou essa referência de cache; após limpeza pontual do arquivo
gerado, o build final passou sem rota de QA. Não houve alteração do tsconfig para
ocultar erros. Os erros preexistentes de registerHooks foram resolvidos pela
declaração limitada aos testes citada acima.

[NÃO CONFIRMADO] Homologação real por slug, host/subdomínio/DNS, QR real e Admin
autenticado do futuro tenant; disponibilidade remota dos identificadores;
assets oficiais; provedor de voos real; conteúdo PT/EN/ES do cliente.
Harness valida apresentação nos dois modos de geração de links, não provisiona
hotel nem substitui testes reais de resolução/auth.

QA visual reproduzível: Playwright/Edge disponíveis, BUGAN_PLAYWRIGHT_MODULE se
instalado fora do repo; `node tests/bugan-runtime.mjs`. SQL: executar os runners
`supabase/tests/bugan*_local_lab.ps1` apenas no container descartável
`supabase_db_libguest-45b-lab`, nunca em produção.

### Dados pendentes e sequência de ativação

[PLANEJADO] Cadastro remoto e ativação são etapa posterior. Slug preferencial
bugan-recife e subdomínio bugan-recife são sintaticamente válidos. Sugestão
compartilhada de subdomínio: buganrecife (remove hífens), preservada para todos.
[NÃO CONFIRMADO] Conflitos/reserva serão verificados pelo onboarding real,
sem consultar produção nesta etapa.

Manifesto de dados necessários, sem inventar valores operacionais:

- Nome institucional/público, endereço completo, cidade/UF, telefone, WhatsApp,
  e-mail e site oficial.
- Check-in, check-out, café da manhã, Wi-Fi (rede, senha e política de divulgação).
- Contatos por departamento, serviços, políticas, comunicados iniciais,
  banners/imagens autorizados, logo/monograma originais e eventual licença/arquivo de fontes.
- Quartos/apartamentos, tokens/QR, links Thex quando aplicáveis.
- Aeroportos, parâmetros de voo e configurações/contatos de transfer, despertar,
  Breakfast Box, com ações reais aprovadas.
- Usuários administrativos/perfis, idiomas, conteúdo traduzido PT/EN/ES e turístico.
- IA somente quando futuramente aprovada por contrato e entitlement canônico.

Próximos passos: (1) reconciliar/aprovar código e migration no ambiente de destino;
(2) criar pelo onboarding tenant Bugan em draft e administrador autorizado;
(3) preencher/revisar dados e mídia reais; (4) configurar somente opcionais disponíveis
e contratados; (5) executar readiness e resolver bloqueios/avisos aplicáveis;
(6) homologar slug, subdomínio, QR, idiomas, acessibilidade, Admin e matriz multi-hotel
com conteúdo real; (7) ativar pelo lifecycle autorizado. Publicação resulta do
lifecycle ativo + core.directory e demais gates; não há workflow separado fictício.

Documento vivo para manter uma fonte única de verdade sobre a evolução do produto, decisões técnicas, branding, domínios, processo de trabalho e próximos ciclos.

Importante:
- Produto atual: `LibGuest`
- Nome anterior/legado: `GuestDesk`
- Domínio principal atual: `libguest.digital`
- Domínio legado/transição: `guestdesk.digital`
- Status de domínio: suporte dual-domain ativo, sem redirect obrigatório nesta fase
- Assinatura institucional atual: temporariamente neutralizada
- Assinatura legada: `GuestDesk by BLID Tecnologia`

## 1. Product identity

### Nome do produto
- Nome principal atual: `LibGuest`
- Nome anterior/legado: `GuestDesk`
- Assinatura institucional/comercial atual: neutralizada temporariamente, com uso preferencial de `LibGuest`
- Assinatura legada: `GuestDesk by BLID Tecnologia`
- Domínio principal atualmente configurado: `libguest.digital`
- Domínio legado/transição: `guestdesk.digital`

### O que o produto é
- Plataforma de diretório digital para hotelaria com painel administrativo e experiência pública para hóspedes.
- Produto orientado a operação hoteleira, apresentação digital e clareza da jornada do hóspede.

### O que o produto entrega hoje
- Painel administrativo protegido por autenticação.
- Gestão de dados principais do hotel.
- Gestão de serviços, departamentos e políticas.
- Página pública do hotel.
- Tradução salva em PT -> EN/ES no momento do save.
- Analytics básicos da experiência pública.
- Resolução pública por slug e por subdomínio de produto.
- Theming controlado do hotel na experiência pública.

### Público principal
- Decisores de hotel.
- Equipes operacionais.
- Times de recepção, atendimento e gestão.
- Uso comercial para demo, portfólio e apresentação.

## 2. Current architecture

### Stack principal
- Next.js com App Router.
- Tailwind CSS.
- Supabase Auth.
- Supabase Database.
- Supabase Storage.
- Google Cloud Translation para save-time translation.

### Estrutura funcional
- `app/admin/*`: painel administrativo.
- `app/hotel/[slug]/*`: fallback público por slug.
- `app/page.tsx`: landing do produto ou raiz pública do hotel quando resolvido por subdomínio de produto.
- `app/servicos/[id]/page.tsx`: detalhe interno de serviço na experiência por subdomínio.

### Blocos importantes da arquitetura
- `lib/domain-context.ts`: leitura e classificação de host/domínio.
- `lib/public-hotel-data.ts`: loaders compartilhados da experiência pública.
- `lib/public-routes.ts`: geração de links públicos com compatibilidade entre slug e subdomínio.
- `lib/service-destinations.ts`: lógica de CTA/destino de serviços.
- `lib/services/translation-service.ts`: integração server-only com tradução.
- `lib/hotel-theme.ts`: presets visuais e override seguro de acento.
- `lib/hotel-subdomain.ts`: validação e normalização de subdomínio do hotel.

### Arquitetura pública atual
- Root domain do produto mostra landing.
- Subdomínio de produto pode resolver um hotel.
- Slug continua sendo fallback público seguro.
- Detalhe interno de serviço funciona tanto em slug quanto em subdomínio.

## 3. Current domains and host behavior

### Estado atual
- `libguest.digital`: domínio principal atual do produto.
- `www.libguest.digital`: tratado como root do produto.
- `{subdomain}.libguest.digital`: resolve hotel quando houver correspondência e é o formato preferencial para links novos.
- `guestdesk.digital`: domínio legado/transição ainda aceito.
- `www.guestdesk.digital`: tratado como root legado do produto.
- `{subdomain}.guestdesk.digital`: continua funcionando durante a transição.
- `/hotel/[slug]`: fallback público por slug.
- `/hotel/[slug]/servicos/[id]`: detalhe de serviço por slug.
- `/servicos/[id]`: detalhe de serviço quando a experiência está sendo servida no subdomínio do hotel.

### Status de naming e domínio
- O produto ativo deve ser tratado como `LibGuest`.
- `GuestDesk` deve ser tratado como naming legado.
- `libguest.digital` passa a ser o domínio principal/preferencial.
- `guestdesk.digital` permanece operacional por compatibilidade e continuidade.
- Nesta fase não existem redirects canônicos obrigatórios entre os dois domínios.

### Regra atual de resolução
1. Se o host for root do produto, mostrar landing.
2. Se o host for subdomínio candidato do produto:
   - tentar resolver por `hotels.subdomain`
   - se não encontrar, tentar fallback por `hotels.slug`
3. Se não houver match, retornar `404` no contexto de subdomínio.
4. As rotas por slug continuam válidas e independentes do subdomínio.

### Limites atuais
- Ainda não existe custom domain por cliente.
- Ainda não existe painel de gestão de domínios.
- Ainda não existe canonical host management completo.
- A foundation para custom domains agora está documentada, mas segue deliberadamente inativa.

## 4. Working process with ChatGPT, Codex, and Cursor

### Papel de cada ferramenta
- ChatGPT:
  - estratégia de produto
  - definição de sprint
  - priorização
  - arquitetura de alto nível
  - copy e direcionamento comercial
- Codex:
  - implementação
  - hotfixes
  - documentação
  - validação local
  - ajustes incrementais orientados a segurança
- Cursor:
  - apoio visual
  - direção de UI refinada
  - comparação de densidade/ritmo/layout
  - ajuda em iterações de interface

### Forma de trabalho recomendada
1. Definir objetivo e restrições da sprint.
2. Fazer análise de arquivos exatos antes de editar.
3. Implementar em branch de preview.
4. Validar em preview/Vercel.
5. Só depois considerar merge para `main`.

### Regras que têm funcionado bem
- mudanças incrementais
- evitar refatorações amplas
- preservar comportamento estável validado
- separar sprint de produto, hotfix de regressão e sprint de documentação
- usar documentação curta e operacional

## 5. Closed sprints summary

### Sprint 1
- Hardening inicial.
- Escopo seguro de ações por `id` + `hotel_id`.
- Helper mínimo de admin/auth.
- Primeiros utilitários leves de parsing/normalização.

### Sprint 2
- Landing inicial do produto.
- Login com visual mais premium.
- Active state no admin.
- Primeira camada de polish visual.

### Sprint 2.1
- Consolidação visual/admin.
- Pequenos componentes reutilizáveis de UI admin.
- Mais consistência de superfícies, listas e empty states.

### Sprint 3
- Visibilidade de status de tradução no admin.
- Retranslate manual.
- Melhor feedback não bloqueante de falha de tradução.

### Sprint 4
- Acabamento comercial.
- Naming e branding mais consistentes.
- Assinatura legada `GuestDesk by BLID Tecnologia`.

### Sprint 5
- Documentação operacional em `docs/`.
- Deploy, ambiente, onboarding, admin guide e workflow.

### Sprint 6
- Busca/filtro no admin para serviços, departamentos e políticas.
- Melhorias de usabilidade diária do painel.

### Sprint 7
- Base comercial em `docs/commercial/`.

### Sprint 8
- Robustez técnica.
- Validação e redução de falhas previsíveis.
- Hardening de envs e fluxos críticos.

### Sprint 9
- Base de analytics da experiência pública.
- Eventos importantes salvos em banco.

### Sprint 9.1
- Analytics visíveis no admin dashboard.
- Filtro de período e leitura gerencial leve.

### Sprint 9.x refinements
- Sessão, deduplicação e cooldown mais inteligentes para analytics.

### Sprint 10
- Onboarding/admin guidance in-product.
- Help text e empty states mais claros.

### Sprint 11
- Expansão do kit comercial com materiais mais reutilizáveis.

### Sprint 12
- Evolução leve de leitura analítica para gestão.

### Sprint 13
- Refinamento premium de UI.

### Sprint 13.1
- Theming seguro por hotel com presets premium + override controlado.

### Sprint 14
- Usuários e permissões básicas por papel.
- Área de usuários no admin.

### Sprint 14.1
- Guided service creation.
- Ícones e categorias guiadas.

### Sprint 15
- Smart service destinations.
- Páginas internas de detalhe de serviço.

### Sprint 15.1
- Reconstrução visual da página `/admin/servicos`.

### Sprint 16
- Cobertura de tradução pública mais completa.
- Melhor coerência de fallback PT/EN/ES.

### Sprint 17
- Fundação de landing/domain presence para `guestdesk.digital`.

### Sprint 18
- Fundação técnica para host/subdomain behavior.

### Sprint 19
- Refinamento comercial e narrativo da landing.

### Sprint 20
- Resolução real de hotel por subdomínio do produto.
- Root domain preservado.
- Fallback por slug preservado.

### Sprint 21
- Campo dedicado de subdomínio por hotel.
- Admin management de subdomínio.
- Resolução pública agora prefere `subdomain` e cai para `slug`.

### Sprint 21.0.1
- Rebranding controlado para `LibGuest`.
- Atualização de naming visível em landing, login, admin, metadata e elementos institucionais.
- `guestdesk.digital` preservado como domínio operacional atual por compatibilidade.

### Sprint 21.1
- Polish do admin de subdomínio.
- Feedback visual consistente para estado vazio, válido, inválido e reservado.
- Prévia mais clara da URL pública principal em `https://{subdomain}.guestdesk.digital`.
- Reforço operacional de que `guestdesk.digital` segue como domínio atual e a rota por slug continua como fallback seguro.

### Sprint 21.2
- Hardening operacional leve do fluxo de subdomínio.
- Correção da decisão de navegação pública para preferir o subdomínio dedicado do hotel quando configurado.
- Validação revisada para casos comuns de erro de entrada, sem alterar a arquitetura principal.

### Sprint 22
- Canonical host strategy leve sem redirects agressivos.
- Regras de root domain, `www` e subdomínio candidato centralizadas em helpers reutilizáveis.
- Comportamento público preservado: landing no root, hotel no subdomínio e fallback por slug obrigatório.

### Sprint 23
- Leitura de analytics orientada à gestão no dashboard admin.
- Microcopy mais clara para interpretar visualizações, interações e interesse por idioma/departamento.
- Estados vazios mais úteis e leitura executiva sem transformar a área em dashboard pesado.

### Sprint 24
- Refinamento do onboarding de hotel novo em `/admin/hotel`.
- Clareza maior sobre identidade do hotel, slug como fallback, subdomínio preferencial e tema visual público.
- Checklist operacional leve para preparar a validação da experiência pública.

### Sprint 25
- Foundation leve para custom domains sem ativação.
- Classificação de host do produto centralizada para reduzir risco futuro.
- Documentação técnica curta criada para separar estado atual de preparação futura.

### Sprint 26
- Cobertura documental mais madura para handoff de cliente.
- Checklist central de entrega criado para separar validação técnica, revisão do cliente e acompanhamento inicial.
- Documentação operacional conectada entre onboarding, deploy, pós-deploy e operação diária.

### Sprint 27
- Refinamento da visibilidade operacional de tradução no admin.
- Leitura mais clara sobre PT como conteúdo fonte, EN/ES gerados no save e fallback em português.
- Badges, status e microcopy alinhados entre serviços, departamentos e políticas.

### Sprint 28
- Refinamento leve da identidade visual/mídia do hotel no admin e na experiência pública.
- Explicação mais clara sobre logo, preset visual, cor de acento e fallback seguro sem mídia.
- Boas práticas documentadas para revisão visual em celular e desktop.

## 6. Closed hotfixes summary

### Hotfixes recorrentes já tratados
- Correções de texto corrompido/UTF-8 em páginas públicas e admin.
- Correção de nested button no mobile menu do admin.
- Correções de hidratação e props server/client em navegação.
- Ajustes em `next/image` quando um uso específico causava regressão.
- Correções em overlays/modais presos no fluxo de usuários/admin.
- Correções de responsividade e overflow em cards e listas.
- Fixes incrementais em analytics reading e deduplicação.
- Hotfix pré-Sprint-21 para resiliência visual dos cards de serviço público no mobile.

### Observação
- O histórico detalhado de cada hotfix pode ser expandido neste arquivo quando necessário, mas a intenção é manter o mapa operacional e enxuto.

## 7. Important technical decisions

### Decisões já tomadas
- Português é a língua canônica.
- Tradução acontece no save, não no page visit.
- EN/ES vivem em translation tables, não nas tabelas principais.
- Fallback para PT é obrigatório quando tradução estiver ausente.
- O produto não usa framework pesado de validação neste momento.
- O produto evita refatorações amplas sem necessidade real.
- UI pública e admin seguem evolução incremental, não redesign amplo.
- Theming público é controlado por presets, não por editor visual livre.
- Slug permanece como fallback seguro.
- Subdomínio agora é identificador público preferencial quando configurado.

### Decisões deliberadamente adiadas
- custom domains por cliente
- editor manual de traduções
- filas/workers de tradução
- permission matrix complexa
- multi-tenant completo por host/custom domain
- dashboard analítico pesado

## 8. Supabase/security status

### Status geral
- Auth com Supabase.
- Profiles vinculados a `hotel_id`.
- Proteção admin/roles já existente.
- Save actions críticas endurecidas com scoping por `id` + `hotel_id`.

### Banco atual
- tabelas principais de hotel, seções, departamentos e políticas
- translation tables para seções, departamentos e políticas
- eventos de analytics públicos
- perfis com papel e status ativo
- campos de tema do hotel
- campo dedicado de subdomínio do hotel

### Pontos de segurança já cobertos
- API keys de tradução mantidas server-only.
- Tradução não bloqueia publicação em PT.
- Políticas de leitura de analytics por hotel já adicionadas.
- Validação de subdomínio e restrição de nomes reservados.

### Pontos a observar
- revisar periodicamente políticas RLS
- revisar uso de `service_role`
- acompanhar warnings de `img`
- manter validação mínima consistente nas actions

## 9. Branding/naming status

### Naming ativo
- Produto: `LibGuest`
- Assinatura institucional atual: neutralizada temporariamente
- Naming legado: `GuestDesk`
- Assinatura legada: `GuestDesk by BLID Tecnologia`

### Regras atuais
- `LibGuest` deve ser tratado como nome principal do produto.
- `GuestDesk` deve ser tratado como nome anterior/legado.
- `guestdesk.digital` continua válido operacionalmente até decisão futura sobre domínio/rebranding.
- O produto deve aparecer prioritariamente apenas como `LibGuest` até decisão futura sobre assinatura institucional.
- `GuestDesk by BLID Tecnologia` deve ser tratado como branding legado.

### Sprint 21.3
- Neutralização da assinatura institucional visível ligada a `BLID Tecnologia`.
- `LibGuest` passa a ser a marca principal nas superfícies visíveis e materiais comerciais atuais.
- `BLID Tecnologia` permanece apenas em contexto legado, histórico ou interno bem explicado.

### Estado atual de branding
- landing já orientada a produto comercial
- interface principal já exibe `LibGuest` como nome ativo do produto
- domínio atual ainda reflete o naming anterior
- branding está em fase de transição controlada de `GuestDesk` para `LibGuest`

### Registro curto da Sprint 21.0.1
- Status: concluída
- Objetivo: atualizar o naming visível do produto para `LibGuest` sem alterar domínio, rotas ou comportamento validado
- Arquivos alterados:
  - `app/layout.tsx`
  - `app/page.tsx`
  - `app/login/page.tsx`
  - `app/admin/layout.tsx`
  - `app/admin/page.tsx`
  - `app/admin/servicos/page.tsx`
  - `app/admin/servicos/[id]/page.tsx`
  - `app/admin/usuarios/page.tsx`
  - `app/admin/hotel/page.tsx`
  - `components/admin/mobile-menu.tsx`
  - `components/public/hotel-public-page-content.tsx`
  - `components/public/hotel-service-detail-content.tsx`
  - `lib/hotel-theme.ts`
  - `docs/PRODUCT_MAP.md`
- Validação realizada:
  - `npm run lint`
  - `npm run build` com falha local recorrente em `spawn EPERM` após compilação
- Pendências conhecidas:
  - base documental/comercial legada ainda contém várias referências históricas a `GuestDesk`
  - domínio operacional continua em `guestdesk.digital`
- Próximo passo recomendado: `Sprint 21.1`

### Registro curto da Sprint 21.1
- Status: concluída
- Objetivo: melhorar clareza operacional, ajuda contextual e validação visual do campo de subdomínio em `/admin/hotel` sem alterar a arquitetura principal de host/subdomínio
- Arquivos alterados:
  - `app/admin/hotel/page.tsx`
  - `components/admin/hotel-subdomain-field.tsx`
  - `lib/hotel-subdomain.ts`
  - `lib/domain-context.ts`
  - `lib/product-domain.ts`
  - `docs/PRODUCT_MAP.md`
- Validação realizada:
  - `npm run lint`
  - `npm run build` com falha local recorrente em `spawn EPERM` após compilação
- Pendências conhecidas:
  - ainda não existe canonical host management completo
  - custom domains por cliente seguem fora do escopo
- Próximo passo recomendado: `Sprint 21.2`

### Registro curto da Sprint 21.2
- Status: concluída
- Objetivo: validar operacionalmente a base de subdomínio e corrigir pequenos edge cases antes da Sprint 22 de canonical host strategy
- Arquivos alterados:
  - `app/admin/hotel/actions.ts`
  - `components/admin/hotel-subdomain-field.tsx`
  - `components/public/hotel-public-page-content.tsx`
  - `components/public/hotel-service-detail-content.tsx`
  - `lib/hotel-subdomain.ts`
  - `lib/public-routes.ts`
  - `docs/PRODUCT_MAP.md`
- Validação realizada:
  - `npm run lint`
  - `npm run build` com falha local recorrente em `spawn EPERM` após compilação
  - busca por `libguest.digital` sem ocorrência encontrada
  - confirmação de `guestdesk.digital` preservado nos pontos esperados
  - revisão orientada por helper para casos de entrada: vazio, válido, reservado, maiúsculas, espaços, acentos, caracteres especiais e hífen nas pontas
- Pendências conhecidas:
  - canonical host strategy segue fora do escopo desta sprint
  - validação manual em preview ainda é recomendada para confirmar host real `{subdomain}.guestdesk.digital`
  - há textos mojibake remanescentes em áreas antigas do projeto fora do fluxo de subdomínio
- Próximo passo recomendado: `Sprint 22`

### Registro curto da Sprint 21.3
- Status: concluída
- Objetivo: neutralizar a assinatura institucional ativa ligada a `BLID Tecnologia`, mantendo `LibGuest` como marca principal sem alterar comportamento funcional
- Arquivos alterados:
  - `app/admin/layout.tsx`
  - `app/login/page.tsx`
  - `app/page.tsx`
  - `components/admin/mobile-menu.tsx`
  - `components/public/hotel-public-page-content.tsx`
  - `docs/commercial/guestdesk-commercial-faq.md`
  - `docs/commercial/guestdesk-commercial-outline.md`
  - `docs/commercial/guestdesk-demo-script.md`
  - `docs/commercial/guestdesk-executive-onepager.md`
  - `docs/commercial/guestdesk-outreach-templates.md`
  - `docs/commercial/guestdesk-positioning.md`
  - `docs/commercial/guestdesk-product-description.md`
  - `docs/commercial/guestdesk-proposal-blocks.md`
  - `docs/commercial/guestdesk-screenshot-plan.md`
  - `docs/commercial/guestdesk-value-proposition-variants.md`
  - `docs/PRODUCT_MAP.md`
- Validação realizada:
  - `npm run lint`
  - `npm run build` com falha local recorrente em `spawn EPERM` após compilação
- Pendências conhecidas:
  - definição futura da assinatura institucional/empresa ainda está em aberto
  - `BLID Tecnologia` permanece apenas como referência legada/interna documentada
- Próximo passo recomendado: `Sprint 22`

### Registro curto da Sprint 22
- Status: concluída
- Objetivo: organizar a estratégia de host/canonical com helpers leves e seguros, sem alterar o domínio operacional e sem ativar redirects agressivos
- Arquivos alterados:
  - `lib/product-domain.ts`
  - `lib/domain-context.ts`
  - `lib/public-routes.ts`
  - `app/page.tsx`
  - `app/servicos/[id]/page.tsx`
  - `docs/PRODUCT_MAP.md`
- Validação realizada:
  - `npm run lint`
  - `npm run build` com falha local recorrente em `spawn EPERM` após compilação
  - busca por `libguest.digital`
  - confirmação de `guestdesk.digital` preservado
- Pendências conhecidas:
  - redirects canônicos continuam deliberadamente desativados
  - custom domains seguem fora do escopo
  - validação manual em preview ainda é recomendada para `guestdesk.digital`, `www.guestdesk.digital`, `{subdomain}.guestdesk.digital` e rotas por slug
- Próximo passo recomendado: `Sprint 23`

### Registro curto da Sprint 23
- Status: concluída
- Objetivo: melhorar a leitura gerencial dos analytics no admin com blocos mais claros, explicações operacionais e estados vazios mais úteis, sem alterar a base técnica sensível
- Arquivos alterados:
  - `app/admin/page.tsx`
  - `docs/PRODUCT_MAP.md`
- Validação realizada:
  - `npm run lint`
  - `npm run build` com falha local recorrente em `spawn EPERM` após compilação
  - busca por `libguest.digital`
  - confirmação de `guestdesk.digital` preservado
- Pendências conhecidas:
  - analytics continuam leves e executivos, sem detalhamento por serviço porque esse evento ainda não existe na base atual
  - validação manual do dashboard com período e dados reais ainda é recomendada em preview
- Próximo passo recomendado: `Sprint 24`

### Registro curto da Sprint 24
- Status: concluída
- Objetivo: melhorar a clareza do onboarding/configuração inicial de um hotel no admin, especialmente sobre identidade, slug, subdomínio, domínio operacional e tema visual
- Arquivos alterados:
  - `app/admin/hotel/page.tsx`
  - `components/admin/hotel-subdomain-field.tsx`
  - `docs/guestdesk-new-hotel-playbook.md`
  - `docs/PRODUCT_MAP.md`
- Validação realizada:
  - `npm run lint`
  - `npm run build` com falha local recorrente em `spawn EPERM` após compilação
  - busca por `libguest.digital`
  - confirmação de `guestdesk.digital` preservado
- Pendências conhecidas:
  - ainda não existe wizard estruturado de múltiplas etapas para onboarding, por decisão de escopo
  - validação manual em preview continua recomendada para `/admin/hotel`, subdomínio, tema e rota pública por slug
- Próximo passo recomendado: `Sprint 25`

### Registro curto da Sprint 25
- Status: concluída
- Objetivo: preparar a base técnica e documental para custom domains no futuro sem ativar custom domains agora e sem alterar o comportamento público já validado
- Arquivos alterados:
  - `lib/product-domain.ts`
  - `lib/domain-context.ts`
  - `docs/guestdesk-custom-domain-foundation.md`
  - `docs/guestdesk-overview.md`
  - `docs/PRODUCT_MAP.md`
- Decisões importantes:
  - `guestdesk.digital` continua sendo o domínio operacional atual
  - `www.guestdesk.digital` continua tratado como root do produto
  - hosts externos continuam classificados como desconhecidos/não suportados, sem ativação de custom domain
  - nenhuma estratégia de redirect foi ativada nesta sprint
- Validação realizada:
  - `npm run lint`
  - `npm run build` com falha local recorrente em `spawn EPERM` após compilação
  - busca por `libguest.digital`
  - confirmação de `guestdesk.digital` preservado
- Pendências conhecidas:
  - custom domains seguem inativos
  - ainda não existe associação explícita de host externo a hotel
  - canonical redirects seguem fora do escopo
- Próximo passo recomendado: `Sprint 26`

### Registro curto da Sprint 26
- Status: concluída
- Objetivo: melhorar a documentação operacional e o material de handoff para entrega, revisão e validação de um cliente/hotel sem alterar comportamento do produto
- Arquivos alterados:
  - `docs/README.md`
  - `docs/guestdesk-client-handoff.md`
  - `docs/guestdesk-new-hotel-playbook.md`
  - `docs/guestdesk-post-deploy-validation.md`
  - `docs/guestdesk-admin-guide.md`
  - `docs/guestdesk-deploy-checklist.md`
  - `docs/PRODUCT_MAP.md`
- Validação realizada:
  - revisão dos arquivos alterados
  - confirmação de que nenhuma migration foi criada
  - confirmação de que nenhum arquivo sensível de host/domínio foi alterado
  - busca por `libguest.digital`
  - confirmação de `guestdesk.digital` preservado
- Pendências conhecidas:
  - o handoff continua assistido e ainda não existe fluxo automatizado de aprovação do cliente
  - custom domains seguem inativos e fora da entrega operacional atual
- Próximo passo recomendado: `Sprint 27`

### Registro curto da Sprint 27
- Status: concluída
- Objetivo: melhorar a visibilidade operacional do fluxo de tradução no admin sem alterar a arquitetura principal de tradução
- Arquivos alterados:
  - `components/admin/ui.tsx`
  - `lib/services/translation-admin.ts`
  - `app/admin/servicos/page.tsx`
  - `app/admin/servicos/[id]/page.tsx`
  - `app/admin/departamentos/page.tsx`
  - `app/admin/departamentos/[id]/page.tsx`
  - `app/admin/politicas/page.tsx`
  - `app/admin/politicas/[id]/page.tsx`
  - `docs/PRODUCT_MAP.md`
- Validação realizada:
  - `npm run lint`
  - `npx tsc --noEmit`
  - `npm run build` com falha local recorrente em `spawn EPERM` após compilação
  - busca por `libguest.digital`
  - confirmação de `guestdesk.digital` preservado
- Pendências conhecidas:
  - a arquitetura de tradução continua intencionalmente simples, sem editor manual e sem filas
  - a falha de tradução continua não bloqueante e depende de retradução manual quando necessário
- Próximo passo recomendado: `Sprint 28`

### Registro curto da Sprint 28
- Status: concluída
- Objetivo: melhorar a clareza e a consistência da identidade visual/mídia do hotel sem criar editor visual complexo e sem alterar a arquitetura sensível
- Arquivos alterados:
  - `app/admin/hotel/page.tsx`
  - `components/public/hotel-public-page-content.tsx`
  - `components/public/hotel-service-detail-content.tsx`
  - `docs/guestdesk-new-hotel-playbook.md`
  - `docs/guestdesk-client-handoff.md`
  - `docs/PRODUCT_MAP.md`
- Validação realizada:
  - `npm run lint`
  - `npm run build` com falha local recorrente em `spawn EPERM` após compilação
  - busca por `libguest.digital`
  - confirmação de `guestdesk.digital` preservado
- Pendências conhecidas:
  - a experiência continua usando apenas logo e tema já existentes, sem editor visual mais avançado
  - validação manual em preview continua recomendada para estado com logo, sem logo e revisão mobile
- Próximo passo recomendado: `Sprint 29`

### Registro curto da Sprint 29
- Status: concluÃ­da
- Objetivo: melhorar a clareza operacional da Ã¡rea de usuÃ¡rios e documentar melhor o modelo atual de papÃ©is e proteÃ§Ãµes, sem alterar auth, schema ou RLS
- Arquivos alterados:
  - `app/admin/usuarios/page.tsx`
  - `app/admin/usuarios/[id]/page.tsx`
  - `docs/guestdesk-admin-guide.md`
  - `docs/PRODUCT_MAP.md`
- ValidaÃ§Ã£o realizada:
  - `npm run lint`
  - `npm run build` com falha local recorrente em `spawn EPERM` apÃ³s compilaÃ§Ã£o
  - busca por `libguest.digital`
  - confirmaÃ§Ã£o de `guestdesk.digital` preservado
- PendÃªncias conhecidas:
  - o modelo de permissÃµes continua intencionalmente simples, sem super-admin, multi-hotel ou matriz avanÃ§ada
  - mensagens de acesso negado seguem centralizadas no redirect seguro para `/login`
- PrÃ³ximo passo recomendado: `Sprint 30`

### Registro curto da Sprint 30
- Status: concluída
- Objetivo: padronizar feedback operacional, adicionar logs curtos de servidor e documentar o diagnóstico de falhas importantes sem criar infraestrutura nova
- Arquivos alterados:
  - `app/admin/hotel/actions.ts`
  - `app/admin/hotel/upload-logo-action.ts`
  - `app/admin/servicos/actions.ts`
  - `app/admin/departamentos/actions.ts`
  - `app/admin/politicas/actions.ts`
  - `app/admin/usuarios/actions.ts`
  - `app/admin/usuarios/[id]/actions.ts`
  - `lib/services/translation-admin.ts`
  - `lib/services/translation-service.ts`
  - `docs/guestdesk-admin-guide.md`
  - `docs/guestdesk-post-deploy-validation.md`
  - `docs/PRODUCT_MAP.md`
- Validação realizada:
  - `npm run lint`
  - `npx tsc --noEmit`
  - `npm run build` com falha local recorrente em `spawn EPERM` após compilação
  - busca por `libguest.digital`
  - confirmação de `guestdesk.digital` preservado
- Pendências conhecidas:
  - a observabilidade continua intencionalmente leve, sem dashboard externo, tabela de logs ou ferramenta dedicada
  - ainda existem mensagens antigas fora deste fluxo que podem ser refinadas em sprints futuras
- Próximo passo recomendado: `Sprint 31`

### Registro curto da Sprint 31
- Status: concluÃ­da
- Objetivo: criar comunicados gerais pÃºblicos do hotel com gestÃ£o simples no admin, sem entrar em chat, login de hÃ³spede ou mensagens individuais
- Arquivos alterados:
  - `supabase/migrations/20260426_add_hotel_announcements.sql`
  - `types/database.ts`
  - `lib/services/translation-service.ts`
  - `lib/services/translation-admin.ts`
  - `lib/public-hotel-data.ts`
  - `lib/public-copy.ts`
  - `app/page.tsx`
  - `app/hotel/[slug]/page.tsx`
  - `app/admin/layout.tsx`
  - `components/admin/nav-links.tsx`
  - `components/public/hotel-public-page-content.tsx`
  - `app/admin/comunicados/actions.ts`
  - `app/admin/comunicados/page.tsx`
  - `app/admin/comunicados/[id]/actions.ts`
  - `app/admin/comunicados/[id]/page.tsx`
  - `docs/PRODUCT_MAP.md`
- Migration criada:
  - `hotel_announcements`
  - `hotel_announcement_translations`
- DecisÃµes importantes:
  - PT continua como conteÃºdo fonte/canÃ´nico
  - EN/ES sÃ£o gerados no save e continuam nÃ£o bloqueantes
  - comunicados pÃºblicos sÃ£o sempre filtrados por `hotel_id`, `is_active`, `starts_at` e `ends_at`
  - nÃ£o hÃ¡ mensagem individual, chat, push, login de hÃ³spede ou dados pessoais de hÃ³spedes
- ValidaÃ§Ã£o realizada:
  - `npm run lint`
  - `npx tsc --noEmit`
  - `npm run build` com falha local recorrente em `spawn EPERM` apÃ³s compilaÃ§Ã£o
  - busca por `libguest.digital`
  - confirmaÃ§Ã£o de `guestdesk.digital` preservado
- PendÃªncias conhecidas:
  - nÃ£o existe editor manual de traduÃ§Ã£o para comunicados
  - nÃ£o existe confirmaÃ§Ã£o de leitura individual
  - custom domains, host e analytics pÃºblico continuam fora do escopo desta sprint
- PrÃ³ximo passo recomendado: `Sprint 32`

### Registro curto da Sprint 31.1
- Status: concluÃ­da
- Objetivo: criar um mÃ³dulo separado de banners promocionais do hotel com imagem, CTA, traduÃ§Ã£o no save e carrossel pÃºblico limitado a 3 itens
- Arquivos alterados:
  - `supabase/migrations/20260426_add_hotel_promotional_banners.sql`
  - `types/database.ts`
  - `lib/services/translation-service.ts`
  - `lib/services/translation-admin.ts`
  - `lib/public-hotel-data.ts`
  - `app/page.tsx`
  - `app/hotel/[slug]/page.tsx`
  - `app/admin/layout.tsx`
  - `components/admin/nav-links.tsx`
  - `components/public/hotel-public-page-content.tsx`
  - `components/public/promotional-banner-carousel.tsx`
  - `app/admin/banners/actions.ts`
  - `app/admin/banners/page.tsx`
  - `app/admin/banners/[id]/actions.ts`
  - `app/admin/banners/[id]/page.tsx`
  - `app/admin/banners/upload-image-action.ts`
  - `docs/PRODUCT_MAP.md`
- Migration criada:
  - `hotel_promotional_banners`
  - `hotel_promotional_banner_translations`
- DecisÃµes importantes:
  - bucket reutilizado: `hotel-assets`
  - path de upload: `promotional-banners/{hotel_id}/{banner_id}.{ext}`
  - sem crop automÃ¡tico real nesta sprint; orientaÃ§Ã£o e object-cover foram adotados
  - carrossel pÃºblico sem biblioteca externa e sem autoplay agressivo
  - a experiÃªncia pÃºblica limita a exibiÃ§Ã£o a no mÃ¡ximo 3 banners elegÃ­veis
- ValidaÃ§Ã£o realizada:
  - `npm run lint`
  - `npx tsc --noEmit`
  - `npm run build` com falha local recorrente em `spawn EPERM` apÃ³s compilaÃ§Ã£o
  - busca por `libguest.digital`
  - confirmaÃ§Ã£o de `guestdesk.digital` preservado
- PendÃªncias conhecidas:
  - nÃ£o existe crop/conversÃ£o automÃ¡tica de imagem
  - nÃ£o existe autoplay ou animaÃ§Ã£o mais elaborada no carrossel
  - custom domains, host e dados de hÃ³spedes seguem fora do escopo
- PrÃ³ximo passo recomendado: `Sprint 32`

### Registro curto da Sprint 32
- Status: concluída
- Objetivo: criar QR dinâmico por apartamento com `service_action_type` explícito, contexto mínimo de quarto e redirecionamento server-side do cardápio Thex
- Arquivos alterados:
  - `package.json`
  - `package-lock.json`
  - `supabase/migrations/20260427_add_service_action_type_to_hotel_sections.sql`
  - `supabase/migrations/20260427_add_hotel_room_links.sql`
  - `types/database.ts`
  - `lib/service-action-types.ts`
  - `lib/service-destinations.ts`
  - `lib/room-links.ts`
  - `lib/room-context.ts`
  - `lib/public-copy.ts`
  - `app/r/[roomToken]/route.ts`
  - `app/qr-invalido/page.tsx`
  - `app/admin/layout.tsx`
  - `components/admin/nav-links.tsx`
  - `components/admin/room-qr-card.tsx`
  - `app/admin/apartamentos/page.tsx`
  - `app/admin/apartamentos/actions.ts`
  - `app/admin/servicos/page.tsx`
  - `app/admin/servicos/actions.ts`
  - `app/admin/servicos/[id]/page.tsx`
  - `app/admin/servicos/[id]/actions.ts`
  - `components/public/hotel-public-page-content.tsx`
  - `components/public/hotel-service-detail-content.tsx`
  - `app/servicos/[id]/page.tsx`
  - `app/hotel/[slug]/servicos/[id]/page.tsx`
  - `docs/guestdesk-admin-guide.md`
  - `docs/PRODUCT_MAP.md`
- Migrations criadas:
  - `add_service_action_type_to_hotel_sections`
  - `add_hotel_room_links`
- Decisões importantes:
  - `service_action_type` passa a ser a decisão funcional oficial do serviço
  - serviços existentes permanecem compatíveis com default `standard`
  - o QR do apartamento aponta para o LibGuest em `/r/[roomToken]`
  - o navegador salva apenas `roomToken`, `roomNumber` e `hotelId` quando necessário
  - o `restaurant_menu_url` do apartamento é resolvido no servidor e não fica salvo no navegador
  - não há dados pessoais de hóspedes, pedido, pagamento, login, chat, push, WhatsApp ou PMS
- Validação realizada:
  - `npm run lint`
  - `npx tsc --noEmit`
  - `npm run build` com falha local recorrente em `spawn EPERM` após compilação
  - busca por `libguest.digital`
  - confirmação de `guestdesk.digital` preservado
- Pendências conhecidas:
  - importação em lote de apartamentos continua fora do escopo desta sprint
  - o fluxo de QR foi entregue com preview, cópia de link e download simples, sem dashboard pesado de quartos
  - a operação do cardápio por apartamento depende de `restaurant_menu_url` configurado corretamente em cada quarto
- Próximo passo recomendado: `Sprint 33`

### Registro curto da Sprint 33
- Status: concluída
- Objetivo: habilitar suporte dual-domain com `libguest.digital` como domínio principal/preferencial e `guestdesk.digital` como legado/transição sem redirects obrigatórios
- Arquivos alterados:
  - `lib/product-domain.ts`
  - `lib/domain-context.ts`
  - `lib/hotel-subdomain.ts`
  - `lib/room-links.ts`
  - `app/layout.tsx`
  - `app/page.tsx`
  - `app/admin/hotel/page.tsx`
  - `components/admin/hotel-subdomain-field.tsx`
  - `docs/guestdesk-custom-domain-foundation.md`
  - `docs/guestdesk-overview.md`
  - `docs/PRODUCT_MAP.md`
- Decisões importantes:
  - `PRIMARY_PRODUCT_ROOT_DOMAIN` passa a ser `libguest.digital`
  - `guestdesk.digital` continua aceito como domínio legado/transição
  - requests recebidos em ambos os domínios continuam funcionando
  - novos links e previews gerados pelo sistema passam a preferir `libguest.digital`
  - QRs antigos em `guestdesk.digital/r/[roomToken]` continuam válidos
  - fallback por slug continua preservado
  - não existem redirects canônicos obrigatórios nesta fase
- Validação realizada:
  - `npm run lint`
  - `npx tsc --noEmit`
  - `npm run build`
  - busca por `guestdesk.digital`
  - busca por `libguest.digital`
- Pendências conhecidas:
  - a infraestrutura de DNS/Vercel precisa permanecer com os dois domínios ativos durante a transição
  - redirects/canonical host management seguem para fase posterior
  - custom domains por cliente continuam fora do escopo
- Próximo passo recomendado: `Sprint 34`

### Registro curto da Sprint 34
- Status: implementacao concluida localmente; validacao tecnica final registrada abaixo
- Objetivo: endurecer o isolamento e a segurança operacional entre hotéis nas rotas administrativas, ações de servidor, conteúdo público, QR por apartamento e analytics, sem ampliar a matriz de papéis e sem abrir refatoração arquitetural ampla.
- Restrições:
  - preservar fallback público por slug
  - preservar suporte dual-domain
  - não criar super-admin ou acesso multi-hotel nesta sprint
  - não alterar a identidade visual pública
  - manter compatibilidade com QRs existentes

#### Inventario tecnico auditado
- Contexto administrativo: `app/admin/layout.tsx`, `lib/auth.ts`, `lib/queries.ts` e `proxy.ts`.
- Dashboard e analytics administrativo: `app/admin/page.tsx`, `lib/queries.ts` e `app/api/analytics/route.ts`.
- Hotel e uploads: `app/admin/hotel/page.tsx`, `app/admin/hotel/actions.ts` e `app/admin/hotel/upload-logo-action.ts`.
- Usuarios: lista, criacao, status, pagina e edicao em `app/admin/usuarios/**`; os usos do client com service role foram revisados com validacao previa de perfil por `id + hotel_id`.
- Servicos, departamentos, politicas, comunicados e banners: paginas de lista, paginas `[id]`, server actions, retraducao e tabelas filhas de traducao em `app/admin/**` e `lib/services/translation-admin.ts`.
- Apartamentos, QRs e links: `app/admin/apartamentos/**`, `app/r/[roomToken]/route.ts`, `lib/room-links.ts` e `lib/room-context.ts`.
- Loaders publicos e dual-domain: `app/page.tsx`, `app/hotel/[slug]/**`, `app/servicos/[id]/page.tsx`, `lib/public-hotel-data.ts`, `lib/domain-context.ts`, `lib/public-routes.ts` e `lib/product-domain.ts`.
- Upload de banners: `app/admin/banners/upload-image-action.ts` e remocao de imagem em `app/admin/banners/[id]/actions.ts`, incluindo pasta de storage prefixada pelo hotel.

#### Riscos encontrados e decisoes
- Updates por ID ja possuiam filtro `hotel_id`, mas nao confirmavam linha afetada. Um ID de outro hotel podia produzir falso sucesso.
- Nas cinco telas editaveis com traducao, o falso sucesso era mais grave: o fluxo seguia para o upsert da traducao usando o ID recebido, apesar de o registro pai nao ter sido atualizado.
- O endpoint publico de analytics confiava na combinacao `hotelId`, `hotelSlug` e `departmentId` enviada pelo cliente, permitindo contaminar metricas de outro hotel.
- Perfil inativo, sem hotel ou invalido podia entrar em ciclo entre `/admin` e `/login`, pois a sessao continuava ativa no proxy.
- Paginas administrativas `[id]` estavam escopadas por hotel, mas transformavam ausencia em excecao; foi adotado estado 404 neutro.
- O cookie de contexto do apartamento nao e usado como autorizacao isolada: operacoes sensiveis de cardapio revalidam `hotel_id + room_token + is_active` no servidor. Esse desenho foi preservado.
- O fallback por slug, o suporte aos dois dominios, os QRs existentes, a identidade visual e a matriz simples de papeis foram preservados.
- As politicas RLS existentes ja cobrem os recursos adicionados pelas migrations recentes; nenhuma migration foi criada.

#### Correcoes e arquivos alterados
- `lib/auth.ts`: sessao/perfil invalido segue para estado neutro sem loop; papel insuficiente recebe acesso negado sem detalhes; perfil administrativo passa a carregar `hotel_id` nao nulo.
- `app/acesso-indisponivel/page.tsx` e `app/admin/acesso-negado/page.tsx`: estados seguros para usuario sem hotel, hotel invalido e permissao insuficiente, com saida explicita da sessao na server action apropriada.
- `lib/queries.ts` e `app/admin/page.tsx`: hotel atual e confirmado a partir do perfil autenticado; analytics administrativo resolve seu proprio hotel em vez de aceitar ID do chamador.
- `app/api/analytics/route.ts`: valida `id + slug` do hotel e `departmentId + hotel_id` antes do insert.
- `app/admin/{servicos,departamentos,politicas,comunicados,banners}/[id]/actions.ts`: update exige retorno do pai escopado antes de sincronizar traducoes e nao mostra erro do banco.
- `app/admin/{servicos,departamentos,politicas,comunicados,banners}/actions.ts`: delete e toggle confirmam uma linha afetada dentro do hotel.
- `app/admin/apartamentos/actions.ts`: edit, status e rotacao de roomToken confirmam `id + hotel_id` e linha afetada.
- `app/admin/{usuarios,servicos,departamentos,politicas,comunicados,banners}/[id]/page.tsx`: recurso ausente ou de outro hotel responde com 404 neutro.
- `app/admin/hotel/actions.ts`, `app/admin/hotel/upload-logo-action.ts`, `app/admin/banners/upload-image-action.ts`, `app/admin/banners/[id]/actions.ts` e `app/admin/usuarios/**/actions.ts`: segunda passagem passou a confirmar tambem a linha afetada nos updates auxiliares previamente escopados.
- `docs/PRODUCT_MAP.md`: inventario, decisoes, validacoes, pendencias e status desta sprint.

#### Validacoes da Sprint 34
- Inventario por busca de todas as chamadas Supabase (`select`, `insert`, `update`, `delete`, `upsert` e storage) em `app`, `lib` e `components`.
- Revisao das migrations RLS de analytics, comunicados, banners, traducoes, storage e room links.
- Confirmacao dos loaders publicos: servico por ID sempre combinado com o hotel resolvido por slug/subdominio e `enabled = true`.
- Confirmacao de roomToken: token ativo resolve o hotel; contexto de cardapio exige novamente token ativo pertencente ao hotel exibido.
- Segunda passagem: paginas `[id]` usam `maybeSingle`; erro real de consulta gera falha operacional generica e somente ausencia de linha gera 404.
- `npm run lint`: sem erros; dois warnings preexistentes de `<img>`.
- `npx tsc --noEmit`: aprovado.
- `npm run build`: aprovado com compilacao e geracao das rotas de producao.

#### Pendencias e riscos remanescentes
- O endpoint publico de analytics continua propositalmente anonimo e sujeito a ruido/bots; agora protege consistencia entre hotel, slug e departamento, mas rate limiting fica para infraestrutura/fase futura.
- O cookie de contexto de quarto e opaco apenas por entropia do roomToken, nao por assinatura; a revalidacao server-side protege os destinos sensiveis. Assinatura pode ser avaliada futuramente sem invalidar QRs.
- Warnings preexistentes de `<img>` permanecem fora do escopo para nao alterar comportamento visual.
- Validacao multi-hotel com dados reais deve ocorrer em preview controlado, sem usar credenciais ou dados reais no repositorio.

### Registro curto da Sprint 35

- Status: implementação e validação técnica local concluídas.
- Objetivo: consolidar readiness operacional e comercial sem alterar arquitetura, autenticação, temas, dados ou compatibilidade pública.

#### Diagnóstico e decisões

- As listas administrativas já possuíam estados vazios e feedback de operações; a lacuna principal era a ausência de estados globais de loading, erro recuperável e 404 no segmento admin.
- O dashboard declarava a experiência como operacional e online sem confirmar conteúdo mínimo. O estado foi substituído por uma checklist derivada do hotel autenticado e de registros ativos escopados por `hotel_id`.
- A checklist considera somente quatro itens essenciais verificáveis: informações básicas, serviço ativo, departamento ativo e política ativa. Comunicados, banners e apartamentos permanecem opcionais conforme a operação do hotel.
- A falha de autenticação não repassa mais a mensagem bruta do Supabase para a interface.
- Logs informativos de início de operações no Storage foram removidos; falhas usam o logger operacional curto sem registrar path, perfil, usuário, payload ou mensagem interna do provedor.
- Os dois usos de `<img>` foram mantidos: um cobre logo configurável no admin e outro mídia pública dinâmica. Migrá-los para `next/image` exigiria decisões sobre origem, dimensões e comportamento visual fora desta sprint.
- Slug fallback, dual-domain, roomToken, QRs existentes e isolamento da Sprint 34 foram preservados.

#### Arquivos alterados

- Estados e feedback: `app/admin/loading.tsx`, `app/admin/error.tsx`, `app/admin/not-found.tsx`, `app/login/page.tsx` e `app/admin/usuarios/page.tsx`.
- Dashboard e consultas: `app/admin/page.tsx` e `lib/queries.ts`.
- Observabilidade de Storage: `app/admin/banners/upload-image-action.ts` e `app/admin/banners/[id]/actions.ts`.
- Operação e homologação: `docs/guestdesk-new-hotel-playbook.md`, `docs/guestdesk-deploy-checklist.md`, `docs/guestdesk-post-deploy-validation.md`, `docs/guestdesk-admin-guide.md` e `docs/PRODUCT_MAP.md`.

#### Validações da Sprint 35

- Revisão do diff, escopo multi-hotel e ausência de alterações em migrations, RLS, `.env`, temas e rotas públicas.
- `npm run lint`: aprovado sem erros; permanecem os dois warnings conhecidos de `<img>`.
- `npx tsc --noEmit`: aprovado.
- `npm run build`: aprovado, incluindo geração das rotas públicas por slug, serviço e roomToken.
- `git diff --check`: aprovado.

#### Pendências e riscos remanescentes

- A homologação dos quatro hotéis depende de preview e credenciais operacionais autorizadas; não é executada por validação local.
- Analytics público continua sujeito a ruído automatizado, conforme registrado na Sprint 34.
- A checklist do dashboard confirma presença de configuração mínima, não qualidade editorial, disponibilidade externa de links ou aprovação do hotel.
- Custom domains, rate limiting, edição manual de traduções, temas por bandeira, IA Concierge e modelo de usuário multi-hotel continuam fora do escopo da v1 atual.

### Registro curto da Sprint 36

- Status: fundação implementada localmente; ativação dos presets oficiais permanece bloqueada no admin.
- Objetivo: criar design system e arquitetura de tema institucional e presets por bandeira sem aplicar os mockups finais, alterar dados ou duplicar a experiência pública.

#### Arquitetura e decisões

- `theme_preset` continua sendo o campo visual existente; não foi criada coluna `brand` nem migration.
- `libguest-signature`, `novotel`, `grand-mercure` e `mercure` são identificadores estáveis da fundação oficial.
- `libguest-signature` é o tema institucional padrão para hotéis independentes, outros segmentos e clientes sem bandeira homologada.
- `custom` está reservado para evolução futura, sem implementação operacional nesta sprint.
- A associação futura seguirá a regra: bandeira homologada usa preset próprio; os demais usam `libguest-signature`, somente quando existir o painel interno de provisionamento.
- Os cinco presets legados permanecem canônicos e são os únicos exibidos e aceitos pelo admin.
- A camada pública reconhece os presets oficiais, mas nenhum hotel foi associado ou atualizado automaticamente.
- Tokens semânticos centralizam fundos, superfícies, cores, contraste, tipografia, bordas, raios, sombras, hero, cabeçalho, ícones, botões, banners, ajuda, navegação, estados ativos e assinatura.
- Componentes funcionais, loaders, slug fallback, dual-domain, analytics e roomToken continuam compartilhados.
- Não existe navegação inferior pública dedicada nesta sprint; o token foi preparado sem criar UI ou alterar a jornada atual.
- Mercure possui fundação técnica, mas a direção visual final permanece pendente de consolidação.

#### Arquivos alterados

- Tema e tokens: `lib/hotel-theme.ts` e `app/globals.css`.
- Componentes públicos compartilhados: `components/public/hotel-public-page-content.tsx`, `components/public/hotel-service-detail-content.tsx`, `components/public/promotional-banner-carousel.tsx` e `components/public/language-switcher.tsx`.
- Documentação: `docs/guestdesk-brand-design-system.md`, `docs/guestdesk-new-hotel-playbook.md`, `docs/README.md` e `docs/PRODUCT_MAP.md`.

#### Compatibilidade

- Novotel Salvador continua visualmente associado ao preset já salvo; nenhuma troca automática foi introduzida.
- Valores ausentes ou desconhecidos continuam usando `midnight-slate`.
- Nenhum registro atual recebe `libguest-signature` automaticamente; o fallback comercial futuro não substitui o fallback técnico legado.
- `theme_primary_color` continua afetando apenas o acento seguro com contraste calculado.
- O admin não foi redesenhado e não oferece os presets oficiais antes da homologação.

#### Validações da Sprint 36

- `npm run lint`: aprovado sem erros; permanecem os dois warnings conhecidos de `<img>`.
- `npx tsc --noEmit`: aprovado.
- `npm run build`: aprovado com as 18 rotas esperadas, incluindo slug, detalhe de serviço e roomToken.
- `git diff --check`: aprovado.
- Revisão do diff confirmou ausência de mudanças em admin, dados, migrations, Supabase, slugs e subdomínios.

#### Próximos passos

- Sprint 37: aplicação e homologação do mockup Novotel Salvador.
- Sprint 38: aplicação Grand Mercure e consolidação/aplicação Mercure.
- Permanecem fora do escopo: IA Concierge, editor visual, preset `custom`, painel interno de provisionamento, alteração automática de dados e lógica por hotel.

### Registro curto da Sprint 37

- Status: experiência Novotel ativa e refinada localmente; a homologação visual final em dispositivos reais permanece pendente e esta revisão não alterou dados.
- Referências visuais obrigatórias: `docs/references/novotel-salvador-mockup.png` e `docs/references/novotel-salvador-hero-reference.webp`.
- `HotelPublicPageContent` delega somente o preset `novotel` a `NovotelPublicHome`; nenhum componente usa nome, slug ou subdomínio para decidir apresentação.
- A home Novotel contém somente hero, seis cards fixos, banner, ajuda, assinatura e navegação inferior mobile.
- Os seis cards sempre existem: Informações, Contato Online, Cardápio, Turismo, Comunicados e Serviços do Hotel. Áreas sem conteúdo exibem estado vazio.
- Conteúdo operacional foi movido para as rotas genéricas `/explorar/[area]` e `/hotel/[slug]/explorar/[area]`, preservando loaders, traduções e isolamento por hotel.
- O hero consulta exclusivamente `hotels.hero_image_url`; sem imagem, o gradiente azul Novotel é um estado completo. Banner não é fonte do hero.
- `NovotelHeroBackdrop` aplica a mesma imagem e overlay luminoso localizado na home, nas seis páginas internas e nos detalhes Novotel, com fallback azul quando a imagem não existe.
- `NovotelBrandSignature` usa um logo completo configurado sem duplicação; na ausência atual de `logo_url`, entrega o fallback completo com símbolo, N, NOVOTEL e subtítulo institucional.
- `getHotelPublicDisplayName` separa a assinatura visual do nome operacional por configuração central, sem slug, migration ou condição específica dentro do componente.
- A migration de `hero_image_url`, o preset `novotel` e a imagem do hero já estão ativos no ambiente de homologação.
- O admin prepara URL, upload e remoção do hero com hotel autenticado resolvido no servidor, confirmação da linha atualizada e caminhos restritos a `hotel-assets/{hotelId}/hero.{jpg|png|webp}`.
- A edição comum do hotel preserva no servidor um preset oficial já salvo, evitando que o seletor legado limpe acidentalmente a ativação manual; presets oficiais continuam indisponíveis para escolha no admin.
- Sem banner ativo, o componente mostra fallback azul neutro, sem promoção fictícia ou mensagem técnica.
- O estado de publicação dos banners é dinâmico. No smoke test final, o loader entregou um banner elegível com imagem; quando não houver registro elegível, o fallback neutro permanece ativo sem inventar promoção.
- Serviços ganhou busca local, filtro por categoria, grade de até três colunas e CTAs alinhados no rodapé dos cards, sem alterar conteúdo ou destinos.
- A navegação tem exatamente Início, Serviços, Cardápio, Informações e Contato; não exibe Conta, fica ancorada ao rodapé com altura-base de 60 px, respeita safe area e reserva `7.5rem + safe area` após o conteúdo.
- Página de detalhe, PT/EN/ES, slug fallback, dual-domain, analytics, links Thex, QR e roomToken continuam no fluxo compartilhado.
- O diagnóstico do banner e as referências operacionais permanecem documentados; nenhum SQL foi executado nesta revisão.

#### Arquivos da reestruturação

- Componentes Novotel: `components/public/novotel/novotel-public-home.tsx`, `components/public/novotel/novotel-area-hero.tsx`, `components/public/novotel/novotel-hero-backdrop.tsx`, `components/public/novotel/novotel-brand-signature.tsx`, `components/public/novotel/novotel-mobile-navigation.tsx` e `components/public/novotel/novotel-service-explorer.tsx`.
- Áreas públicas: `components/public/hotel-public-area-content.tsx`, `app/explorar/[area]/page.tsx`, `app/hotel/[slug]/explorar/[area]/page.tsx`, `lib/public-routes.ts` e `lib/public-hotel-areas.ts`.
- Hero/admin: `app/admin/hotel/page.tsx`, `app/admin/hotel/actions.ts`, `app/admin/hotel/upload-hero-image-action.ts`, `lib/hotel-hero-storage.ts`, `lib/hotel-public-identity.ts`, `types/database.ts` e `supabase/migrations/20260721_add_hotel_hero_image_url.sql`.
- Integração visual: `components/public/hotel-public-page-content.tsx`, `components/public/hotel-service-detail-content.tsx`, `components/public/promotional-banner-carousel.tsx`, `components/public/language-switcher.tsx`, `lib/hotel-theme.ts`, `lib/public-copy.ts` e `app/globals.css`.
- Operação: `docs/guestdesk-brand-design-system.md`, `docs/guestdesk-new-hotel-playbook.md`, `docs/guestdesk-post-deploy-validation.md` e `docs/PRODUCT_MAP.md`.

#### Validação e pendências

- `npm run lint`: aprovado sem erros; permanecem somente os dois warnings legados de `<img>`.
- `npx tsc --noEmit`: aprovado.
- `npm run build`: aprovado; as rotas genéricas `/explorar/[area]` e `/hotel/[slug]/explorar/[area]` aparecem no build.
- `git diff --check`: aprovado.
- Smoke test local: home e as seis áreas Novotel responderam HTTP 200 usando o loader real configurado.
- Hero com imagem foi conferido no ambiente atual; o fallback sem imagem permanece coberto pelo componente sem depender de banner.
- Comparação direta das referências conferiu ordem, primeira dobra, proporções, grade 2x3, densidade, luminosidade do hero, presença da marca, banner, ajuda e navegação. A conferência final do render em 320, 390, 430 px, iPhone 14 Pro Max e desktop permanece no checklist manual.

### Registro curto das Sprints 38, 39 e 40

- Sprints 38 e 39: encerradas com a experiência Grand Mercure isolada no preset `grand-mercure`, incluindo os refinamentos finais de assinatura, fundo e faixa editorial, sem alteração de banco.
- Sprint 40: aberta nesta branch para implementar a identidade pública Mercure Rio Boutique Copacabana conforme `docs/references/mercure-rio-boutique-copacabana-mockup.png`.
- `HotelPublicPageContent` delega a composição somente quando `resolveHotelTheme(...).preset === 'mercure'`; não há decisão por slug, nome, subdomínio ou hotel fixo.
- A home Mercure preserva os loaders e dados compartilhados e mantém a ordem: hero, seis acessos, banner dinâmico/fallback, ajuda, assinatura e navegação inferior mobile.
- Dados administrativos continuam sendo a primeira fonte para logo, hero e banners. Na ausência atual de logo e mídia configurados, a experiência usa assinatura tipográfica temporária e fallbacks fotográficos próprios em `public/brand/mercure/`.
- Textos PT/EN/ES foram adicionados ao mecanismo existente em `lib/public-copy.ts`; rotas, destinos, analytics, QR, roomToken, Thex e WhatsApp permanecem compartilhados.
- Componentes principais: `components/public/mercure/mercure-public-home.tsx`, `mercure-brand-signature.tsx`, `mercure-promotional-banner.tsx` e `mercure-bottom-dock.tsx`.
- Integração visual: `components/public/hotel-public-page-content.tsx`, `lib/public-copy.ts`, `app/globals.css` e ativos em `public/brand/mercure/`.
- Isolamento visual usa `.mercure-public-home[data-hotel-theme="mercure"]`; Novotel, Grand Mercure, LibGuest Signature, presets legados e páginas internas não recebem essas regras.
- Nenhum schema, migration, RLS, SQL, registro de hotel, loader, admin ou integração foi alterado na Sprint 40.
- Status: implementação visual local concluída e validada nesta branch; ativação do preset e substituição da assinatura tipográfica por logo oficial dependem de provisionamento e ativos homologados.

### Governança de bandeiras e presets

- `hotels.brand_code` representa a identidade permanente da bandeira; `hotels.theme_preset` representa somente a apresentação visual selecionada.
- O painel administrativo do hotel pode escolher apenas os cinco temas neutros e o preset correspondente ao `brand_code`, sem editar a bandeira.
- A definição de `brand_code` pertence ao futuro painel interno LibGuest e ao fluxo de onboarding multi-hotel, não ao administrador comum do hotel.
- Hotéis sem bandeira estruturada recebem apenas temas neutros. Como transição, um preset oficial de marca já persistido pode preservar temporariamente a mesma marca até o provisionamento de `brand_code`.
- Não existe inferência por nome, slug ou domínio. A ativação inicial deve identificar o hotel por ID imutável, passar por revisão da plataforma e registrar auditoria.
- Mercure Rio Boutique Copacabana, Novotel Salvador Rio Vermelho e Grand Mercure Rio de Janeiro Copacabana precisarão receber, respectivamente, `mercure`, `novotel` e `grand-mercure` após a aplicação controlada da migration.

### Registro curto da Sprint 41

- Status: homologação visual, funcional e responsiva concluída localmente com matriz em `docs/SPRINT_41_VISUAL_HOMOLOGATION.md`.
- A home Novotel passou a usar duas colunas no tablet e três colunas somente a partir de 1280 px, eliminando a quebra palavra por palavra.
- Os docks Novotel, Grand Mercure e Mercure Home permanecem fixos e visíveis até 1024 px, com safe area e reserva inferior; a partir de 1025 px ficam ocultos.
- A região de rolagem protegida do Grand Mercure segue ativa enquanto o dock estiver visível.
- Os seletores de idioma Mercure e Grand Mercure receberam contraste explícito para estados ativo, inativo, hover e foco; Novotel foi preservado.
- As seis páginas internas Mercure continuam funcionais, porém genéricas, e foram encaminhadas integralmente para a Sprint 42.
- A Sprint 41 não reconstruiu páginas internas, não alterou loaders, dados, rotas, analytics, Supabase ou isolamento multi-hotel.

### Registro curto da Sprint 42

- Status: identidade visual das seis páginas internas Mercure implementada e homologada localmente.
- `HotelPublicAreaContent` continua como arquitetura única para Serviços, Informações, Turismo, Comunicados, Contato Online e Cardápio; a variante visual depende exclusivamente do preset resolvido `mercure`.
- O hero interno reutiliza a imagem pública existente, o floral aprovado, a assinatura oficial em variante compacta, o seletor compartilhado e as cópias PT/EN/ES existentes.
- Busca, filtros, cards, destinos, analytics e loaders não foram duplicados. O explorer compartilhado ganhou somente apresentação Mercure isolada por `data-hotel-theme`.
- O dock Mercure permanece visível até 1024 px e oculto a partir de 1025 px, com safe area e reserva inferior.
- A matriz percorreu Serviços Mercure nos dez viewports obrigatórios, as seis áreas em PT/EN/ES e regressões de Serviços Novotel/Grand Mercure em mobile, tablet e desktop.
- O ambiente Mercure estava vazio; nenhum conteúdo fictício foi persistido. Loading/erro públicos por preset, `<html lang>` dinâmico e detalhe de serviço branded permanecem como evoluções futuras.
- Arquitetura, cobertura, evidências e pendências estão em `docs/SPRINT_42_INTERNAL_PAGES_BRANDING.md`.
- Não houve alteração de schema, migration, RLS, configuração Supabase ou dados de hotel.

### Registro curto da Sprint 43

- Status: auditoria estática completa do painel administrativo dos hotéis, documentada em `docs/SPRINT_43_ADMIN_AUDIT.md`, sem alteração funcional, SQL, migration, RLS ou dados.
- O painel do hotel já possui dashboard, hotel/identidade, serviços, departamentos, políticas, comunicados, banners, apartamentos/QR, analytics, usuários, quatro papéis e tradução PT/EN/ES; esses módulos devem ser preservados e refinados, não reconstruídos.
- O contexto atual é single-hotel por `profiles.hotel_id`. Não existem `allowed_hotels`, contexto ativo ou troca de hotel; essa evolução foi reservada ao onboarding multi-hotel da Sprint 47.
- Leituras e mutações auditadas aplicam escopo por hotel no servidor. A Sprint 45 deve alinhar a hierarquia de papéis às RLS versionadas, revisar a ingestão pública de analytics e criar governança/auditoria persistente.
- A Sprint 44 ficou limitada a correções comprovadas: textos corrompidos, acessibilidade, confirmações/pending, contrato de clique de banner, completude de tradução, responsividade das telas densas, ciclo de mídia e paginação/queries.
- O futuro painel interno LibGuest permanece separado e foi mantido na Sprint 46 para provisionamento, `brand_code`, módulos, usuários globais, planos e governança de plataforma.
- Custom domain, biblioteca geral de mídia, edição manual de tradução e permissões por módulo continuam condicionados a lacuna/demanda comprovada.

### Registro curto da Sprint 44

- Status: saneamento e refinamento do painel administrativo existente concluídos localmente, sem reconstrução arquitetural.
- Foram corrigidos os textos corrompidos auditados, a incompatibilidade de `banner_click`, confirmações destrutivas, pending de formulários, erros inline, labels, breadcrumbs e os pontos de densidade mobile em Hotel e Apartamentos/QR.
- O clique do banner Mercure reutiliza o evento oficial equivalente `website_click`; nenhum schema, banco ou evento duplicado foi criado.
- Paginação permaneceu adiada por falta de evidência de volume real. Segurança/RLS, ingestão de analytics, atomicidade de usuários, lifecycle de mídia e auditoria persistente seguem separados para a Sprint 45.
- A decisão permanece evoluir o painel operacional atual, preservando multi-hotel, páginas públicas, presets, QR/Thex, server actions e dados, em vez de reconstruí-lo.
- Detalhes e matriz de entrega: `docs/SPRINT_44_ADMIN_REFINEMENT.md`.

### Abertura da Sprint 45

- Status: primeira etapa aberta em modo de auditoria, sem mudança funcional, SQL, migration, RLS, Auth, Storage ou dados.
- Os riscos altos confirmados são a divergência entre papéis das server actions e RLS recentes, o insert público direto de analytics sem rate limit e a ausência de uma baseline versionada completa para tabelas centrais/traduções.
- Auth + profiles, concorrência do último administrador, validação/lifecycle de uploads, auditoria persistente e mínimo privilégio de QR/notas exigem hardening coordenado.
- A execução foi separada em 45A (código e testes sem banco), 45B (baseline, migrations/RLS/RPC e audit log) e 45C (rate limiting, monitoramento, reconciliação e retenção). Nenhuma fase de implementação foi iniciada automaticamente.
- Diagnóstico, matriz RLS/actions, riscos e testes necessários: `docs/SPRINT_45_SECURITY_GOVERNANCE_AUDIT.md`.

### Conclusão da Sprint 45A

- Status: hardening de código e primeira base automatizada de testes de segurança concluídos localmente, sem SQL, migration, RLS, policy, schema, dados ou infraestrutura externa.
- Analytics passou a ter body limitado, schema fechado, allowlist única, metadata mínima e hotel resolvido server-side por slug; o browser não envia mais `hotelId`.
- Uploads de logo, hero e banner aplicam validação server-side por assinatura binária, estrutura de cabeçalho, formato, dimensões e consistência de MIME; aceitam somente JPEG/PNG/WebP, geram paths aleatórios por hotel/categoria e compensam falhas de persistência sem apagar o objeto anterior antes do sucesso. Não há decodificação integral da imagem.
- A orquestração Auth/profile verifica compensações, as actions sensíveis validam UUIDs e escopo, e `roomToken` é rejeitado antes da consulta quando o formato é inválido.
- Testes sintéticos cobrem analytics, uploads, compensação de usuários, autorização por papel e hotel A × hotel B, sem acessar produção ou usar segredos reais.
- Permanecem para 45B a baseline/migrations de RLS, o fechamento do insert direto de analytics, RPC do último administrador, audit log e policies de Storage; para 45C ficam rate limit distribuído, monitoramento, retenção, reconciliação e alertas.
- Como hardening futuro de baixo risco, permanece validar a origem e o hostname esperados da public URL antes de extrair paths usados em remoções no Storage.
- Detalhes, limites e cobertura: `docs/SPRINT_45A_SECURITY_HARDENING.md`.

### Preparação da Sprint 45B

- Status: linha de base, migrations e integrações de RLS e governança preparadas localmente para revisão; nenhum SQL, nenhuma migration, nenhuma policy e nenhum dado foram aplicados.
- A linha de base proposta alinha os quatro papéis existentes ao hotel do perfil, expõe hotéis pela view explícita `public_hotels` para `anon` e `authenticated`, mantém o conteúdo genuinamente público nos dois contextos e reserva a atualização de `hotels` às actions server-side.
- A API de analytics usa inserção server-side. A gestão de papel e status passa por RPC transacional com lock por hotel e proteção concorrente do último administrador.
- O audit log é append-only para os papéis da aplicação: `service_role` apenas executa a função validada `SECURITY DEFINER`, sem INSERT ou SELECT direto; administradores leem somente o próprio hotel.
- Mídia administrativa é mutada exclusivamente pelas server actions validadas. Room links exigem editor+, não possuem DELETE administrativo e são resolvidos publicamente apenas no servidor.
- As migrations possuem preflight para abortar diante de objetos e policies remotos inesperados. Exportar policies, grants, flags de RLS, funções e triggers do preview continua obrigatório antes de qualquer aplicação.
- Testes estáticos e um verificador SQL de catálogo foram adicionados; testes comportamentais entre hotéis A e B dependem de um clone descartável com linha de base e dados sintéticos revisados.
- Detalhes, ordem, rollback lógico e riscos: `docs/SPRINT_45B_RLS_GOVERNANCE.md`.

## 10. Known pending items

### Produto e arquitetura
- custom domains por cliente
- canonical host e redirects estratégicos
- gestão completa de domínios no admin

### Tradução
- tradução de mais superfícies públicas auxiliares quando necessário
- eventual UI manual de edição de tradução
- controle mais refinado de status por campo

### Admin
- refinamentos adicionais de usabilidade em módulos específicos
- melhoria contínua de densidade/ritmo de páginas sensíveis
- onboarding de hotel novo ainda pode evoluir no futuro sem virar wizard pesado

 - maior clareza futura de estados de acesso negado sem alterar a lÃ³gica central de auth

### Analytics
- leitura mais executiva sem virar dashboard pesado
- possíveis resumos por hotel/período mais sofisticados

### Robustez
- investigar a causa raiz do `spawn EPERM` no build local
- revisar warnings pendentes de `img`
- limpeza de imports não usados em arquivos remanescentes

## 11. Roadmap from Sprint 21.1 to Sprint 38

### Sprint 21.1
- concluída: polish do admin de subdomínio com feedback visual e ajuda operacional refinada

### Sprint 21.2
- concluída: validação operacional e hardening leve do fluxo de subdomínio

### Sprint 22
- concluída: canonical host strategy leve com helpers centralizados e sem redirects agressivos

### Sprint 23
- concluída: melhoria de analytics orientada à leitura por gestão com blocos mais claros de interpretação e uso

### Sprint 24
- concluída: refinamento do onboarding de hotel novo com subdomínio, slug fallback e tema visual

### Sprint 25
- concluída: preparo de foundation para custom domains sem ativação completa

### Sprint 26
- concluída: maior cobertura operacional/documental para handoff de cliente

### Sprint 27
- concluída: refinamento do fluxo de tradução e visibilidade operacional

### Sprint 28
- concluída: melhorias leves de mídia/identidade visual do hotel, se seguras

### Sprint 29
- expansão controlada de permissões por papel, se houver necessidade real

 - concluÃ­da: hardening leve de UX e documentaÃ§Ã£o das permissÃµes atuais, sem ampliar a matriz de papÃ©is

### Sprint 30
- camada leve de qualidade/observabilidade para erros e eventos importantes

 - concluída: padronização leve de feedback operacional, logs curtos de servidor e documentação de diagnóstico

### Sprint 31
- concluÃ­da: comunicados gerais pÃºblicos do hotel com CRUD admin simples, traduÃ§Ã£o no save e fallback em PT

### Sprint 32
- concluída: QR dinâmico por apartamento com `service_action_type` explícito e redirecionamento server-side do cardápio por quarto

### Sprint 33
- concluída: suporte dual-domain com `libguest.digital` como principal e `guestdesk.digital` como legado/transição, sem redirect obrigatório

### Sprint 34
- concluída: hardening avançado de operação multi-hotel sem abrir refactor amplo

### Sprint 35
- concluída localmente: estados administrativos seguros, checklist operacional real, observabilidade curta e documentação de homologação dos quatro hotéis

### Sprint 36
- concluída localmente: fundação de tokens, tema institucional LibGuest Signature e presets oficiais por bandeira, sem ativação de hotel ou mockup final

### Sprint 37
- implementada localmente: composição visual Novotel pronta para revisão manual, sem ativação ou alteração de dados

### Sprint 38
- concluída: aplicação da experiência Grand Mercure

### Sprint 39
- concluída: refinamentos finais da experiência Grand Mercure

### Sprint 40
- implementação visual local concluída para revisão: identidade pública Mercure Rio Boutique Copacabana, sem ativação ou alteração de dados

### Nota de roadmap
- Este roadmap é direcional e pode ser repriorizado.
- Nenhuma sprint futura deve remover fallback por slug sem uma transição explícita e validada.

## 12. Standard branch/deploy workflow

### Fluxo recomendado
1. `main` permanece estável.
2. Cada sprint trabalha em branch dedicada.
3. Implementação e validação ocorrem primeiro em preview.
4. Hotfixes pequenos continuam preferindo mudanças locais e seguras.
5. Só depois de validado em preview considerar merge para `main`.

### Convenção prática
- branch por sprint ou hotfix
- validação local
- validação em preview
- revisão final
- merge

### Checklist curto por entrega
- confirmar escopo e restrições
- listar arquivos a alterar antes de editar
- implementar incrementalmente
- validar `lint`, `tsc` e `build` quando possível
- registrar decisões relevantes em docs

## Como atualizar este arquivo

Atualizar após:
- fechamento de sprint
- hotfix importante
- mudança de domínio/host behavior
- mudança de branding/naming
- decisão arquitetural relevante
- alteração de fluxo operacional

Regra de manutenção:
- preferir atualização curta e objetiva
- preservar histórico resumido
- evitar transformar este arquivo em changelog detalhado de código

## Regra fixa de manutenção desta documentação

Este arquivo deve ser atualizado depois de toda sprint, hotfix ou decisão relevante de produto sempre que a mudança afetar pelo menos um destes pontos:

- estado atual do produto
- status de sprint
- roadmap
- branding/naming
- domínios e comportamento de host
- Supabase/segurança
- arquitetura
- workflow operacional
- pendências conhecidas

Mudanças pequenas e estritamente de implementação não precisam atualizar este documento quando:

- não alteram o estado do produto
- não geram decisão importante
- não criam observação operacional relevante
- não mudam prioridades, comportamento público ou arquitetura

Em toda atualização futura deste arquivo, incluir quando aplicável:

- nome da sprint ou hotfix
- status
- arquivos alterados, quando for relevante para contexto
- decisões importantes
- resultado de validação
- pendências conhecidas
- próximo passo recomendado

### Central de Voos — logos oficiais locais (29/10/2026)

Meu voo usa os assets locais LATAM, Azul e GOL associados pelo catálogo canônico
airline-identity.ts após a resolução existente. Arquivos originais oficiais,
cores/proporções preservadas, fallback de avião em ausência/ambiguidade/erro e
slot fixo de 56×56 px. Nenhuma alteração em identidade aeronáutica, AirLabs, v1,
cache/quota, lifecycle, entitlements ou dados do hotel. Partidas/Chegadas não
recebem logos decorativos. Procedência, hashes, dimensões, limites e comandos de
regressão estão na seção de logomarcas de CENTRAL_DE_VOOS_E_PMS.md.

### Idiomas públicos — popup compartilhado fora do header (30/10/2026)

LanguageSwitcher utiliza o portal/posicionador acessível Base UI existente para
exibir PT/EN/ES sem recorte pelo overflow do hero, mantendo o escopo do tema e
a navegação nativa. Correção na origem para Home e internas, sem fork de hotel,
novo pacote, mudança de layout, integração ou dados. Diagnóstico, estratégia e
regressões constam da seção de seletor em CENTRAL_DE_VOOS_E_PMS.md.

### V4 — comunicações, voo contextual e Guias do Quarto (30/10/2026)

[IMPLEMENTADO E CONFIRMADO NO CÓDIGO] Evolução incremental da composição V4.
A decisão anterior (essenciais, ações e editoriais) permanece; a nova decisão
acrescenta conteúdo opcional por prioridade e utilidade, sem migrar os demais
hotéis automaticamente para V4 ou mudar o catálogo de módulos. Bugan é piloto;
Grand Mercure, Novotel Leme/Salvador, Mercure e Default usam contratos compartilhados.

**Comunicações.** Reutiliza `hotel_announcements`, `hotel_promotional_banners`,
traduções, Admin, datas e RLS existentes. Alerta ganha atenção antes do hero;
manutenção/informativo ficam em Atualizações; promoção/banner em Destaques e
ofertas. Sem autoplay, placeholder ou deduplicação por texto semelhante (não há
vínculo canônico entre essas entidades). O layout continua respeitado. Falha de
leitura de comunicações/traduções é explícita, não uma lista vazia silenciosa.
Sem conteúdo elegível, os novos blocos não aparecem. Nas Homes legadas com
header/hero inseparáveis, a atenção precede o hero composto, preservando-o.

**Voo na Home.** Componente cliente usa exclusivamente o armazenamento local v1
existente, por hotel/origem. SSR não mostra registro; após hidratação, há resumo
manual e CTA para Meu voo quando válido. Salvar/editar/remover, eventos de retorno
e timer de expiração atualizam o resumo. Mantém 12 horas após a partida informada,
sem outro schema, PMS, roomToken, identidade pessoal ou sincronização entre
dispositivos. Não chama AirLabs nem apresenta status inferido. Preview autenticado
não lê o voo pessoal desse navegador. Ver CENTRAL_DE_VOOS_E_PMS.md.

**Guias como extensão de Serviços.** O texto plano de `hotel_sections` não comporta
passos, fotos, aplicabilidade e canais pesquisáveis sem perder a estrutura.
`hotel_service_guides` é filho 1:1 do Serviço, com FK/cascade, rascunho e snapshot
publicado separados, revisão otimista PT409, chave idempotente de importação e
histórico dos paths de mídia. Não é um catálogo concorrente nem um novo módulo.
Usa `content.services` e `content.languages`; não provisiona entitlement/baseline.
O Admin existente recebe editor de passos PT/EN/ES, escopo por categoria de
acomodação confirmada e CSV com prévia, normalização numérica, duplicidades,
qualidade SD/HD/não informada e tipo canal/aplicativo/revisão. Nenhuma tradução
automática é disparada por leitura ou pela preparação desses guias.

Somente operador ativo do próprio hotel, com módulos válidos e hotel não arquivado,
pode ler/alterar rascunhos pelas RPCs autenticadas. Publicar exige revisão explícita,
conteúdo trilíngue, aplicabilidade confirmada, passos válidos, nenhuma linha de
canal em revisão e Serviço nativo habilitado. Salvar rascunho não muda o snapshot
público. A projeção anônima exige hotel ativo + core.directory + services + languages
e devolve somente publicação de Serviço habilitado. Home recebe apenas resumo;
passos/catálogo são carregados no detalhe canônico do Serviço. Preview usa sessão
normal, tenant derivado do profile e snapshot publicado; nenhum draft é público.

Storage permanece sem escrita de browser. Upload privado no servidor valida
sessão/RPC antes de usar o cliente de Storage: JPEG/PNG/WebP, até 2 MB, dimensões
6000×4000 e 24 milhões de pixels, assinatura/MIME existentes, UUID novo e upsert
false. Paths: `<hotel>/room-guides/<service>/<uuid>.<ext>`. Associação ocorre pela
RPC autenticada. Falha SQL definitiva compensa somente upload novo; resposta
ambígua conserva arquivo. Atualizar não apaga mídia anterior, evitando corrida
com versão publicada; os paths ficam retidos (até 512) para cleanup após exclusão
confirmada do Serviço. Falha de cleanup gera aviso, sem alegar rollback do banco.
PDF não é aceito nesse upload; manual complementar é URL HTTPS aprovada opcional.

Migration incremental: `20261030045619_service_room_guides.sql`. Não altera
migrations antigas, hotéis, módulos, lifecycle, Auth ou voos. SECURITY DEFINER
tem search_path vazio e grants explícitos; clientes não têm escrita direta na
tabela. Rollback comportamental por migration futura pode revogar a exposição
das RPCs, preservando os dados. Editor não oferece publicação para ações F&B.

**Fontes do piloto e limite operacional.** PDF real de duas páginas em
`docs/references/bugan/public-v3/63e392_c3239d83658747758d22a813ea1e5847.pdf`,
SHA-256 `5d6535e3cce4d5b26e293dcac214bb0ecb7fc16f029ba49082d0033f003c6766`.
As duas fotos reais dos controles foram extraídas e otimizadas em `tv-manual/`;
nada foi sintetizado. As páginas legadas guia-tv, guia-quarto e guia-alexa foram
inventariadas; URLs, data e hashes constam no manifesto de preparação.
222 números únicos foram encontrados, incluindo 18/501 Globo e 39/539 SporTV;
HD só quando explícito. Netflix 680 é aplicativo; demais linhas ficam em revisão.
Isso é inventário histórico, não homologação da grade atual. Não se presume SD,
gênero, HDMI único ou Alexa em todos os quartos. Comandos de voz não são traduzidos
como capacidades inexistentes. Mockup é referência de hierarquia, não de dados.

`scripts/prepare-bugan-room-guides.ps1` prepara quatro novos Serviços **desabilitados**,
rascunhos TV/chuveiro/ar-condicionado/assistente de voz e duas imagens. Usa senha
somente no prompt oculto local, login normal, `get_current_hotel_modules()` com
is_enabled=true, preflight dos dois administradores/lifecycle active e RPCs privadas.
Não altera os 13 Serviços operacionais existentes. Retomada é idempotente, sem
sobrescrever divergências ou compensações destrutivas. Antes de publicar, o hotel
precisa confirmar grade, equipamentos/HDMI, categorias de acomodação, direitos de
uso e instruções/traduções técnicas. Nenhuma ativação, suspensão ou configuração
de IA faz parte desta entrega.

**Evidência e classificação.** Suíte de segurança: 501/501; matriz SQL real local
em transação com rollback (roles/tenant/módulos/lifecycle/revisão/mídia/auditoria);
browser isolado: 291 cenários de comunicações/voo e 148 de guias, seis identidades,
PT/EN/ES e oito viewports. Capturas/relatórios ficam em `out/tourism-v4/` e gates em
`out/v4-communications-guides/`, sem credenciais e fora do commit. Fixtures não
comprovam sessão administrativa de produção nem revisão operacional da grade.
A publicação técnica e o resultado real do executor devem ser confirmados na
entrega; até essa releitura, conteúdo operacional dos guias é [NÃO CONFIRMADO].

A inspeção dos advisors antes/depois preservou os achados históricos (view pública
SECURITY DEFINER e proteção de senhas vazadas, fora do escopo). Os únicos avisos
novos são a exposição intencional das cinco RPCs de guias aos papéis declarados;
foram revisados com as negativas reais da matriz SQL. Não representam grant de
escrita em tabela/Storage nem dispensa dos gates de tenant, role e módulo.

O smoke público também cobre seleção explícita da aba Meu voo e a regra de
especificidade do wrapper no desktop: o resumo deve permanecer visível mesmo
com os essenciais/tarefas mobile ocultos. Português usa a URL canônica sem lang.

No candidato local ainda não publicado, CTAs preservam o contrato HTTP/HTTPS
já permitido pelo Admin; mídia exige HTTPS.
URLs com credenciais ou protocolos executáveis são rejeitadas na apresentação.

O candidato local, ainda não publicado, contém ajuste de gap/padding do header para
conter Reservar no viewport de 768 px; hero, desktop aprovado e mobile permanecem.


#### Reconciliação cirúrgica V4 — candidata para homologação (30/10/2026)

Esta reconciliação sucede o checkpoint pendente de 7794fb0 na mesma branch
`feat/v4-communications-flight-room-guides`. Main e produção permanecem em
`4bff5e33fcdd78af19421c54ae7ebecbf66d98d2`; não houve merge, push ou deploy
nesta rodada. O diff local é a candidata; não está disponível na produção.

**Referências conferidas.** Home: `mockup_do_hotel_bugan_recife.png`.
Prancha complementar localizada em Documents/LibGuest Bugan Recife/Showcase UX_UI
do Bugan Recife.png, confirmada byte a byte com o caminho canônico informado posteriormente:
`docs/references/bugan/public-v4/prancha-paginas-internas-v4.png`.
SHA-256: c2d55fd752d5ac48f972f8de91abd225d3c78ed74a4b5cb0e4e01684af9bc370.
A prancha orienta hierarquia, não inventário ou instruções operacionais.

| Decisão | Implementação desta candidata |
| --- | --- |
| Home aprovada | Header, fotos/focais, seis acessos desktop, essenciais/quatro ações mobile, três editoriais, quatro benefícios e Turismo preservados. Nenhuma migração automática de outras Homes para V4. |
| Voo salvo | Resumo discreto dentro do acesso existente; segunda linha mobile. Sem faixa independente, mudança do storage v1, consulta AirLabs na Home ou status live inventado. Sem voo válido, mantém o acesso original. |
| Avisos | Alerta/manutenção elegível em faixa fina abaixo do header; details nativo permite ler integralmente corpo e vigência, por teclado e toque. Hero não recebe deslocamento duplicado do header. |
| Promoções | Somente banners elegíveis em “Promoções e novidades”, após editoriais/benefícios. Comunicados promocionais não viram banners automaticamente. |
| Informativos | Somente informativo em “Atualizações do hotel”. Sem conteúdo elegível, seção, título e espaço não são renderizados. |
| Tablet | Gap/padding dos acessos corrigem a causa do overflow em 768 px, sem overflow-x hidden global. |
| Guias | Navegação interna, foto real ao lado do passo, canais em tabela pesquisável e aplicativos separados. Layout limitado às informações existentes. |
| Admin | Edição real PT/EN/ES, passos e sua ordem, imagens, número/nome/categoria/qualidade dos canais, revisão/status/publicação e links de prévia privada. Persistência continua pelas actions/RPCs existentes. |

**Prévia privada de rascunhos.** `/preview/guias/<service-id>?lang=pt|en|es`
exige sessão real de administrador ativo do próprio hotel, autorização no servidor,
modules experience.preview/core.directory/content.services/content.languages e
RPC existente `get_current_hotel_service_guide`. Tenant vem da sessão; compara-se
novamente a propriedade do registro. Leitura apenas, com RLS; nenhum service role,
impersonação, novo grant, migration ou alteração estrutural de autorização.
Troca de idioma mantém a rota privada. Aviso explícito identifica conteúdo não publicado.
Anônimo vai ao login; acesso público ao Serviço desabilitado conserva a resposta
canônica “Experiência indisponível” (HTTP 200), sem conteúdo do rascunho.

**Dados reais preservados, por releitura.** Quatro Serviços/Guias desabilitados,
sem versão publicada; TV revisão 6, demais revisão 1. PT fonte e EN/ES preenchidos,
mas traduções técnicas, instruções e aplicabilidade ainda exigem revisão operacional.
222 registros únicos: 221 em revisão e Netflix 680 como aplicativo; 94 com HD explícito,
128 sem formato presumido. Duas fotos reais do manual permanecem armazenadas, sem
reenvio. Nenhum bootstrap repetido. Os 13 Serviços originais, dois administradores,
conteúdo operacional, aeroportos, módulos e lifecycle active foram preservados.
Comparação antes/depois dos hashes de 20 conjuntos de dados, guias e apresentação
não encontrou mudanças, incluindo os demais hotéis abrangidos pelo snapshot.

**Limites em relação à prancha.** Não foram copiados números ilustrativos de canais,
HDMI, temperaturas, fotos sintéticas ou equipamentos não comprovados. Sem foto aprovada
de ar-condicionado/chuveiro/Alexa, usa-se o conteúdo existente sem placeholder fictício.
Manual complementar só aparece quando existe URL aprovada. Restaurante Filipe e Home
não receberam novo redesenho. Grade, equipamentos, categorias de acomodação e direitos
de uso permanecem sujeitos à homologação do hotel.

**Gates e evidências.** Segurança 505/505; TypeScript OK; lint 0 erros e quatro warnings
históricos; build OK; git diff --check OK. Matriz SQL/RLS local passou em transação
com rollback (tenant/roles/módulos/lifecycle/revisão/mídia/auditoria). Browser: 327 cenários
de comunicações/voo, 148 de guias/Admin e 61 da matriz A–F, incluindo PT/EN/ES e as
larguras 360/375/390/430/768/1024/1440/1536. Seis identidades: Bugan, Grand Mercure,
Novotel Leme, Novotel Salvador, Mercure e Default. Nenhum overflow do documento.
Smoke do build SSR local com dados públicos reais: 42 cenários; escrita/API/provedor
interceptados, somente leitura pública e localStorage de teste. Capturas/relatórios:
`out/tourism-v4/reconciliation-*`, `out/v4-reconciliation-server/` e
`out/v4-communications-guides/reconciliation-*` (artefatos locais fora do commit).
As fixtures positivas do preview e negativas de autorização não equivalem a uma
homologação com sessão real do administrador em produção. Não foram consumidos
Google ou AirLabs, nem alterados lifecycle, Storage, entitlements ou dados reais.

**Classificação.** Candidata técnica para homologação visual; não é GO de publicação
operacional nem aprovação humana final. Próximo checkpoint: revisar Home A–E e os
quatro guias privados em PT/EN/ES, com login normal no ambiente da candidata.
Sem promover esta branch, o /preview de produção continua com o código anterior.
Manter guias e grade não publicados até aprovação operacional e visual expressa.

**Conferência da referência canônica informada posteriormente.**
A prancha em public-v4 tem o mesmo SHA-256 da imagem já inspecionada; a cópia
redundante criada em public-v3 foi retirada da candidata. Nenhum componente da Home
foi alterado nessa conferência. A matriz de guias foi novamente executada: 148 PASS,
zero API calls. Capturas adicionais: `out/tourism-v4/room-channels-390.png`,
`room-channels-1440.png`, `room-guide-admin-desktop.png` e
`room-guide-admin-channel-edit.png`. São componentes reais renderizados com fixtures
isoladas; a gravação simulada do Admin não equivale a escrita no banco do piloto.

Gastronomia foi capturada por leitura SSR local com dados públicos reais em
`out/v4-reconciliation-server/restaurant-390.png` e `restaurant-1440.png`, sem
overflow. Divergência explícita: a interna atual de Restaurante Filipe apresenta
título e conteúdo do Serviço; ainda não reproduz o hero fotográfico, galeria ou
abas Sobre/Menu/Horários/Galeria da prancha. Não foram criadas abas sem contratos
de conteúdo nem reaproveitadas fotografias ilustrativas. O Admin conserva sua
navegação/listagens canônicas; não recebeu a reformulação visual do exemplo da
prancha. Esses exemplos não devem ser reportados como paridade visual concluída.

#### Fechamento definitivo da evolução V4 — escopo de integração técnica

O pedido de fechamento autoriza suceder o hold do checkpoint 7794fb0 e integrar
esta candidata à linha canônica após todos os gates. Não inicia nova sprint,
não publica conteúdo operacional, não altera IA, PMS, roomToken, lifecycle,
quota/cache AirLabs ou outros hotéis. Main remota conferida em 4bff5e3, sem
novos commits da Sprint 53; as diferenças concorrentes são merges da própria
linhagem já incorporada. Preservar histórico com merge normal, sem rebase/reset
ou force push. O resultado efetivo de commit/deployment/smoke consta na entrega.

**Matriz de comparação visual e funcional antes da integração.** As referências
A (Home) e B (prancha public-v4) foram abertas e comparadas às capturas reais.
As capturas anteriores de 04:13 e 07:43–07:44 foram identificadas como evidência
do diff local sobre 7794fb0; as novas execuções regeneram as capturas. O manifesto
local registra timestamp, hash e origem da evidência, distinguindo fixtures de
leitura SSR com dados reais. A referência não é o conteúdo operacional.

| Área / referência | Implementação e comportamento | Divergência / prioridade / decisão |
| --- | --- | --- |
| Home A | Hero/focais/fotos reais, header, seis acessos desktop, essenciais/quatro ações mobile, editoriais, benefícios e Turismo preservados | Sem novo redesign. Preservação obrigatória. |
| Avisos B | Faixa fina abaixo do header, expansão completa por details/teclado, vigência e link canônico | Alertas críticos ordenados antes de manutenção; demais avisos continuam acessíveis. Ajuste funcional concluído. |
| Promoções B | Somente banners elegíveis; título Promoções e novidades | Conteúdo ilustrativo da prancha não foi importado. Sem banner, nenhuma seção/controle/espaço reservado. |
| Informativos B | Somente categoria informativo em Atualizações do hotel | Sem comunicado, seção ausente. Falhas de leitura/tradução continuam erros explícitos no loader canônico. |
| Voo A/B | Número/rota/salvo dentro do acesso existente; storage v1, isolamento/expiração e atualização por eventos | Faixa independente removida. Separador de texto com codificação inválida corrigido. Sem AirLabs na Home ou status inventado. |
| TV/tutorial B | Navegação interna, passos ordenados, foco ao avançar e duas imagens reais disponíveis | Sem HDMI presumido ou controles artificiais. Revisão operacional pendente, somente prévia privada. |
| Canais B | Busca por nome/número/categoria, formato explícito, tabela responsiva e aplicativos separados | 222 registros históricos continuam rascunho; não substituir por números/categorias ilustrativos. |
| Admin B | Módulos e actions/RPCs canônicos; edição de passos, imagens, ordem, PT/EN/ES, canais, revisão e publicação controlada | Reutiliza composição administrativa existente; sem segundo Admin. Capturas de simulação explicitamente identificadas. |
| Guias internos B | Leitura orientada à tarefa e prévia privada nos três idiomas | Sem hero fotográfico obrigatório ou fotos inventadas para equipamentos sem mídia aprovada. |
| Gastronomia B | Restaurante Filipe continua como detalhe do Serviço atual | PLANEJADO: hero, galeria e abas premium na Sprint 53 F&B, reutilizando Gastronomia/Room Service/cardápios. Não declarar paridade visual integral. |

**Admin e persistência.** Banners e Comunicados conservam título, texto, mídia/link,
categoria, vigência/status e idiomas nos cadastros existentes. Idiomas seguem o
módulo canônico, sem tradução Google na leitura. Guias usam revisão otimista,
actions/RPCs reais, uploads server-only e confirmação explícita de revisão para
publicação; o título/status do Serviço permanece no formulário nativo. Formato,
tipo, categoria e número dos canais são enviados no JSON real. A importação tem
validação e prévia antes de aplicar, sem publicar. A prova browser usa action
simulada e confere o payload; a matriz SQL real local comprova persistência,
autorização e revisão em transação com rollback, sem editar o piloto.

**Prévia dinâmica.** /preview mostra conteúdo real elegível do hotel autenticado;
/preview/guias/<id> lê o próprio rascunho somente para administrador ativo e com
módulos obrigatórios. Não aceita escolha de tenant pelo navegador e não usa URL
pública de bypass. Os cenários A–F são simulações exclusivamente no harness local,
identificadas nos relatórios; o editor de fixture identifica visualmente simulação
sem gravação. Não há query pública que injete banners, avisos ou rascunhos no
/preview real. Prévia de voo salvo na Home é coberta na origem pública de teste,
sem ler dados locais do hóspede na sessão administrativa privada.

**Escopo técnico e gates.** Segurança 507/507; guias/Admin 148; comunicações/voo
327; matriz A–F 61. TypeScript e build OK; lint zero erros e quatro warnings
históricos; diff --check OK. SQL/RLS local passou com rollback. Testes abrangem
anon, papel sem permissão, inativo/arquivado, tenant diferente, módulo desabilitado,
revision, imagens, publicação e preservação do publicado ao salvar rascunho.
Matriz ampliada: 126 jornadas aprovadas. Smoke SSR final: 50/50, incluindo oito
negativas reais dos rascunhos, com zero chamadas reais ao provedor. O proxy local
preserva redirects HTTP, sem absorver o 307 para /login. Smoke de produção deve
ser confirmado após READY antes de declarar a publicação confirmada. Sem nova migration, dependência ou grant.

**Regressão por identidade.** Bugan, Grand Mercure Copacabana, Novotel Leme,
Novotel Salvador, Mercure Rio Boutique e Default exercitam os componentes
compartilhados em fixtures PT/EN/ES. Smoke com leituras públicas reais verifica os
cinco hotéis reais; Default permanece fixture, sem inventar tenant. V4 não é
selecionada automaticamente nos demais hotéis. O preview positivo com login humano
e revisão editorial/operacional não é substituído por mocks ou deploy READY.

**Preservação e pendências.** Releitura confirmou 17 Serviços, sendo os 13 originais
ativos e os quatro guias desabilitados, sem versões publicadas. Revisões 6/1/1/1;
13 passos PT/EN/ES preenchidos, sem aceite editorial automático. 221 canais em
review e Netflix como application; zero publicação da grade. Duas fotos do manual,
dois administradores ativos, lifecycle active, mídias, traduções operacionais,
aeroportos e módulos preservados. Nenhum bootstrap, reupload ou escrita real no
piloto nesta integração. Aprovação humana de TV/grade/equipamentos/traduções e
aplicabilidade continua obrigatória antes de habilitar/publicar os Serviços.
LibGuest TV é projeto futuro em análise, fora deste escopo.

[IMPLEMENTADO E CONFIRMADO NO CÓDIGO] Home dinâmica, voo salvo no acesso,
preview privado, gestão e apresentação dos guias. [IMPLEMENTADO, MAS NÃO VALIDADO]
homologação visual humana final e conteúdo operacional dos quatro guias.
[PLANEJADO] Gastronomia premium na Sprint 53 F&B. Publicação técnica do código
não altera estes estados nem equivale a GO operacional dos guias.

#### Hotfix premium — retirada auditada dos testes (30/10/2026)

Checkpoint ce41cfa, Bugan active. Auditoria identificou exatamente um banner TESTE
e quatro comunicados TESTE MANUTENÇÃO/2/3/4, ativos, sem vigência. IDs e snapshots
em docs/bootstrap/bugan-test-communications-20261030.json. Nenhum DELETE permitido.
O executor scripts/retire-bugan-test-communications.ps1 usa senha somente no prompt
oculto e sessão normal; valida todos os registros antes da primeira escrita,
interrompe em divergências, confere RLS/revisão/readback e auditoria, sem retries.
A retirada real permanece NÃO CONFIRMADA até execução pelo administrador.

Admin e endpoint autenticado compartilham setCommunicationStatus: getUser, profile
ativo, tenant da sessão, role, lifecycle não arquivado, entitlement com is_enabled
true via get_current_hotel_modules, mutação normal/RLS e CAS de updated_at.
O endpoint permite somente desativação, exige administrador e rejeita hotel_id,
ativação, origem externa e campos extras. Audit writer canônico roda no servidor
após autorização e mutação; seu privilégio não autoriza escrita editorial.
Falha de auditoria/resposta ambígua não é declarada sucesso e não gera compensação
destrutiva. Sem migration, grant ou bypass de RLS. Mocks, plano e 512 testes de
segurança aprovados; TypeScript/build OK; lint quatro warnings históricos.
Diagnóstico AD2891 e limite de evidência documentados em CENTRAL_DE_VOOS_E_PMS.md.

#### Hotfix premium — composição compartilhada e interiores (30/10/2026)

Home preserva hero, focais, acessos, três editoriais, benefícios, Turismo e dock.
Avisos usam uma única faixa de 56 px com prioridade canônica, detalhe e acesso
aos demais; banners proporcionais com imagem autorizada ou card tipográfico;
informativos têm resumo limitado sem repetir o corpo completo. Seções sem
conteúdo elegível não existem no layout. Voo salvo continua no acesso existente,
com identificação e indicador discreto, storage v1 e zero consulta na Home.

Interiores V4 compartilham fotografia editorial, âncoras condicionais, benefícios,
estadia, políticas e acomodação cadastrada. Serviços preservam os fluxos atuais;
o detalhe reutiliza mídia publicada somente quando seu CTA canônico associa
explicitamente o próprio Serviço habilitado do mesmo hotel, com entitlement de
aparência. Não há associação por nome, mídia de outro tenant ou foto inventada.
Comunicações têm categorias reais, ícones semânticos, vigência e leitura integral.
V3 mantém sua composição; outros hotéis não são migrados automaticamente.
Restaurante Filipe reutiliza sua mídia publicada; hero/menu/galeria e domínio
gastronômico completo permanecem no roadmap Sprint 53 F&B, sem alegar paridade.

Referências comparadas: docs/references/bugan/public-v3/mockup_do_hotel_bugan_recife.png
e docs/references/bugan/public-v4/prancha-paginas-internas-v4.png. Evidências antes
em out/v4-premium-hotfix/before; depois isolado em out/tourism-v4/premium-* e
SSR com leituras públicas reais em out/v4-reconciliation-server. Capturas de
produção após READY ficam em out/v4-communications-production. Artefatos out
são locais/ignorados. Fixtures são cenários identificados, sem novos dados reais.

Gates do candidato: security 519/519; matriz A–L 168; comunicações 327; composição
61; jornadas 126; guias/Admin 148; voos 148; duas matrizes SQL/RLS locais com
rollback; TypeScript/build OK; lint zero erros e quatro warnings históricos;
diff --check OK; SSR real 74/74, zero chamadas AirLabs. PT/EN/ES e seis identidades
incluem Bugan, Grand Mercure, dois Novotel, Mercure e Default. Default é fixture;
smoke real dos outros cinco não substitui homologação humana de seus painéis.

Releitura de 20 conjuntos protegidos, apresentação e guias manteve os hashes
antes/depois iguais: hotéis, administradores, mídias, módulos, aeroportos,
Turismo, traduções operacionais e demais contratos preservados. Quatro guias
continuam desabilitados, sem publicação; 13 passos PT/EN/ES preenchidos,
221 canais em revisão e Netflix como aplicativo, duas fotos reais preservadas.
Preview positivo é coberto por harness e SQL local; login humano de cada guia
e aceite operacional permanecem pendentes. Nenhuma migration/grant/RLS alterada.

Prioridade zero ainda depende do comando autenticado já disponibilizado: a última
leitura registra um banner e quatro comunicados de teste ativos e zero auditorias
de desativação. A publicação técnica não comprova sua retirada. Não há filtro
textual para escondê-los, DELETE, service role para mutação editorial, nova
publicação de fixtures ou autorização para habilitar guias. GO técnico deve ser
separado de aceite integral de conteúdo e homologação visual humana.

#### Pós-execução autenticada — testes retirados (30/10/2026)

A pendência de prioridade zero acima foi encerrada por execução local do
administrador e releitura independente somente leitura. Os cinco registros do
manifesto permanecem no banco com is_active=false; demais campos preservados,
exceto updated_at. Uma auditoria por registro confirma a desativação pelo
administrador Bugan entre 17:51:51 e 17:51:59 UTC, sem exclusões. A projeção
anônima canônica retorna zero banners/comunicados ativos e zero guias publicados.

Browser público pós-retirada: 30/30, PT/EN/ES, nove viewports e página de
comunicados; nenhum TESTE, faixa, seção opcional ou espaço reservado ausente;
hero/editoriais/Turismo preservados, sem overflow e zero chamadas de voo.
Capturas e relatório em out/v4-premium-hotfix/post-retirement. Os 20 conjuntos
protegidos, apresentação e guias mantiveram hashes iguais ao checkpoint anterior.
Bugan active, dois administradores ativos, 13 Serviços originais habilitados;
quatro guias desabilitados sem versão publicada, 222 registros sem publicação
(221 em revisão e um aplicativo). Nenhum bootstrap, reupload ou nova escrita
operacional nesta verificação.

Implementação de aplicação já publicada em db53863, deployment
dpl_G335k4CRw9GBxuooTkBaRMPGSYxF READY, com smoke público 74/74 e gates do
candidato preservados. Esta atualização é somente documental. GO técnico e
retirada de testes confirmados; homologação visual humana final e revisão
operacional de guias/equipamentos/grade permanecem necessárias. Gastronomia
premium completa permanece Sprint 53 F&B. Não há autorização de publicar guias.

#### TV e Canais — tutorial e catálogo separados (30/10/2026)

Hotfix compartilhado do RoomGuideContent, sem novo módulo, cadastro, migration ou
alteração de Auth/RLS/RPC. Como usar, Lista de canais e Precisa de ajuda são abas
acessíveis com um único painel preenchido; os painéis inativos ficam vazios.
Tutorial mantém uma etapa, fotos reais, progresso, Anterior/Próximo e acesso ao
catálogo na última etapa. Setas/Home/End navegam nas abas, com foco visível.

Busca normalizada por nome, número e categoria percorre todo o catálogo elegível
antes da paginação de 12 canais. Filtros não inferem SD a partir de formato
ausente. Aplicativos respeitam busca e formato e aparecem separados, sem exibir
o número interno como canal linear. Status de revisão aparece somente na prévia
privada; a leitura pública continua dependendo exclusivamente da versão publicada
e dos gates anteriores. Estado local de aba/etapa/busca/formato/página usa apenas
preferências de interface em sessionStorage por pathname, com fallback em memória;
não armazena conteúdo, sessão Auth, status editorial ou autorização. Idioma segue
a rota canônica e a seleção permanece ao trocar idioma na mesma rota.

As cinco instruções e duas imagens foram conferidas contra o PDF original
63e392_c3239d83658747758d22a813ea1e5847.pdf, SHA-256
5d6535e3cce4d5b26e293dcac214bb0ecb7fc16f029ba49082d0033f003c6766.
Não há uma entrada HDMI universal homologada. Nenhuma instrução, tradução ou
imagem persistida foi substituída. Sobreposições de botões foram omitidas: o
contrato atual não vincula coordenadas verificadas a uma versão imutável da foto
quando o Admin troca a imagem. Não se desenha destaque presumido ou controle
sintético. Revisão operacional dos equipamentos continua obrigatória.

Gates: 525 testes de segurança, 44 cenários browser de TV e 148 de guias/Admin,
PT/EN/ES, oito viewports e seis identidades; TypeScript/build OK, lint zero erros
e quatro warnings históricos. SQL/RLS local passou com rollback. Cenários
browser usam renderizadores isolados com fotos reais; não equivalem a login
humano na produção. Prévia administrativa positiva e aceite visual final devem
ser conferidos na sessão normal do hotel após READY. Capturas antes/depois e
logs ficam em out/tv-premium e out/tourism-v4/tv-*, fora do commit.

Releitura manteve os hashes dos 20 conjuntos protegidos, apresentação e guias.
Bugan active, dois administradores ativos, 13 Serviços originais habilitados;
quatro guias desabilitados e sem publicação; 222 registros, sendo 221 review e
Netflix application. Busca real de leitura confirmou SporTV 37/38/39/537/538/539.
Admin de passos, ordem, imagens, traduções, números, categorias, formatos e
publicação permanece no fluxo existente. Home, comunicações, voos, F&B, QR e
roomToken não foram alterados; nenhuma chamada Google/AirLabs ou escrita remota.
Publicação técnica não autoriza habilitar guias ou publicar a grade.

Regressões adicionais do candidato: composição 61/61 e matriz V4 premium 168/168,
sem chamadas de API no harness. A seleção V3/V4 e as seis identidades foram
preservadas. Smoke público real deve ser relido após o deployment READY.
