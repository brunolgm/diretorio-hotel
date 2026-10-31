# Refinamento Premium V4 — Home, Informações e alerta superior

Referência de execução: 31/10/2026, America/Sao_Paulo. Candidata isolada de main d1db75d na branch fix/v4-premium-refinement-package. Nenhuma migration ou dependência nova.

## Diagnóstico P0 — TESTE

A leitura inicial encontrou quatro registros ativos, sem início/fim de vigência: dois comunicados e dois banners. O histórico distingue três reativações e uma criação posterior; não é uma inferência baseada apenas nos títulos.

| Registro | ID | Evento auditado em 31/10, horário de São Paulo |
| --- | --- | --- |
| Comunicado TESTE 4 | 0b08ba8d-0e4e-4bb6-ab12-7fdd064a73f3 | announcement.activated às 01:06:13 |
| Banner TESTE | e1f4222d-bb17-4990-9cbf-12c1b9c5a04b | banner.activated às 01:06:27 |
| Banner TESTE 2 | 0b012d35-0b6b-49d8-a357-fa53b657be4f | banner.created às 01:06:45 |
| Comunicado TESTE MANUTENÇÃO | 69e72156-1e45-43dc-87e1-33c690291b54 | announcement.activated às 01:07:44 |

Os três IDs antigos têm desativação auditada em 30/10 às 14:51. O banner TESTE 2 tem ID novo e criação em 31/10; não pertencia à retirada anterior. Os comunicados TESTE 2 (5babf6c1…) e TESTE 3 (574684ff…) permaneceram inativos desde 30/10. Os eventos estão associados ao perfil administrador Bugan. A auditoria comprova as operações autenticadas, não a intenção nem se foram acionadas manualmente ou por automação.

Antes da regularização, GET público PT/EN/ES retornou os testes com cache MISS e cache-control private/no-cache/no-store. A projeção pública respeitava os estados ativos e as datas vigentes; não foi encontrada evidência de ressurreição por cache. O endpoint canônico de desativação já invalida o layout público com revalidatePath.

O usuário executou scripts/retire-bugan-refinement-tests.ps1 com autenticação normal. Resultado confirmado por releitura: checked=5, disabledThisRun=4, deleted=0. O quinto registro é um controle já desativado e auditado. As quatro novas desativações foram auditadas em 31/10 entre 02:09:30 e 02:09:37. Somente is_active e updated_at mudaram nos quatro registros. Conteúdos, traduções e IDs não foram substituídos.

Todos os seis registros TESTE conhecidos ficaram inativos. GET público posterior em PT/EN/ES confirmou ausência dos testes e das seções opcionais. Não foi repetido o executor após o sucesso informado. Nenhum registro foi excluído ou ocultado por blacklist na interface.

## Alerta — comparação com o mockup

Fonte visual inspecionada: C:/Users/bruno/Documents/LibGuest Bugan Recife/Mockup do Hotel Bugan Recife (Aprovado).png. A faixa foi comparada com a parte superior desktop/mobile dessa imagem. Mantém posição entre cabeçalho e hero, fundo rosa-pêssego claro no tema Bugan, triângulo vermelho, título Aviso importante, resumo escuro, Ver detalhes com seta e fechamento discreto com alvo de 44px. Outros temas mantêm suas variáveis de superfície e borda.

A referência fornecida foi usada para o alerta. As quatro capturas específicas de Home/Informações citadas no pedido não foram localizadas; nessas páginas, a comparação antes/depois utiliza a baseline dos componentes existentes. A sequência atual de quatro ações e quatro benefícios permanece o contrato da Home V4.

O texto de manutenção de piscina da referência não foi colocado no produto. Título e mensagem vêm dos registros elegíveis do Admin; sem aviso elegível não há faixa nem espaço reservado. Prioridade entre alerta e manutenção, vigência e isolamento continuam no modelo canônico. Detalhes apontam para o comunicado correto e preservam sua mensagem completa.

Dispensar usa somente armazenamento local de identidades públicas hotel/aviso/revisão. Não altera o banco. Mudanças em updated_at ou vigência tornam uma nova revisão visível. Falha de armazenamento mantém fallback em memória. Não foi criado outro módulo administrativo.

## Home

Os seis acessos desktop e a sequência mobile de essenciais, quatro tarefas, editoriais, quatro benefícios, conteúdos opcionais e Turismo foram preservados. A mesma fonte de Wi-Fi/café/horários abastece a faixa compacta desktop; não há catálogo ou valor operacional novo.

No mobile, Informações do Hotel e Acomodações usam imagem acima e texto abaixo, com CTAs completos. Restaurante Filipe permanece com sua composição anterior. Promoções usam grade proporcional com 1/2/3 registros, mantendo o limite canônico de três. Sem elegíveis, o bloco não existe. Promoções e Turismo permitem scroll por teclado e toque nativo, com foco visível e sinalização textual discreta. Os quatro destinos, fotos e URLs de Turismo foram preservados; no desktop os cards aproveitam a largura disponível. Reservar foi conferido no menu mobile contra a URL configurada, sem navegar no motor de reservas.

## Informações e Wi-Fi

Ordem V4: atalhos práticos, Sua estadia, políticas, conteúdo institucional e benefícios, acomodações, serviços relacionados. Desktop em duas colunas para estadia/políticas e leitura institucional limitada; mobile preserva a ordem no DOM. Atalhos só aparecem quando existe alvo correspondente.

Wi-Fi mostra nome da rede, trecho curto extraído das instruções e expansão nativa com o texto administrativo integral. Autenticação, rede de eventos, suporte e ramal *1 foram preservados. Não há campos de nome/sobrenome/UH nem captura desses dados. Nenhuma senha fixa foi criada. O ramal foi conferido no cadastro; sua operação física não foi homologada.

A política Hotel não fumante continua com a descrição Todos os quartos são não fumantes. O título pode indicar escopo mais amplo que a descrição: confirmar com a operação se a regra abrange todo o hotel ou apenas quartos. A política de menores foi mantida literalmente, sem interpretação jurídica adicional.

## Preservação e segurança

Confirmado por leitura: Bugan active, dois administradores ativos, 13 Serviços originais habilitados, quatro Guias do Quarto desabilitados e não publicados, 222 registros de TV sem publicação. Revisão 7 da TV preservada.

Hashes globais de hotels, profiles, hotel_sections e hotel_service_guides são iguais ao início. Ao substituir somente as quatro linhas desativadas pelos seus snapshots anteriores, os hashes globais de comunicados e banners também coincidem: demais hotéis e demais registros preservados. Nenhum código de Gastronomia/Room Service, Goomer, TheX, voos, QR/roomToken, PMS, IA, Auth, RLS ou entitlements foi alterado.

Não havia alterações locais concorrentes ao iniciar. origin/main foi conferida antes e durante a execução. A integração deve ser interrompida se a Sprint 53 introduzir mudanças concorrentes nos mesmos componentes.

## Evidências e validação

Os testes de interface usam componentes reais com dados isolados e fotos reais já autorizadas; avisos e promoções de simulação não são publicações do hotel. A aparência do alerta é exercitada nessas fixtures, pois produção ficou sem aviso elegível após a retirada.

Baseline de componentes antes: out/premium-package/before/. Capturas públicas reais anteriores ao refinamento visual, já após a retirada dos TESTE: out/premium-package/live-before/. Capturas depois: out/tourism-v4/premium-package/ (home, alert, information e information-wifi-open, em 390 e 1440). Capturas full-page podem mostrar o dock fixed no meio da imagem; a verificação interativa confirmou scroll até o último CTA, sem ocultação permanente. Não foi alterado ou ocultado o dock global.

Matriz específica: 109 cenários em PT/EN/ES e viewports 360×640, 375×667, 390×844, 430×932, 768×1024, 1024×768, 1440×900 e 1536×864. Inclui alerta vazio/expirado/estrangeiro/módulo desabilitado, dispensa persistente e revisão nova, detalhes, contraste do aviso, menu Reservar, carrosséis por teclado, Wi-Fi expandido, âncoras, banners 0/1/2/3/4 (limite três) e seis temas.

Gates confirmados: 564/564 testes de segurança, 18 testes direcionados, 168 cenários de regressão premium, 126 jornadas multi-hotel, 148 Guias/Admin e 44 TV. TypeScript, lint, build e diff check aprovados. Lint mantém quatro avisos preexistentes de imagens. A matriz específica final passou nos 109 cenários, incluindo menu Reservar, contraste do alerta, scroll de âncoras e teclado nos carrosséis. Capturas finais conferidas antes do commit. Os commits e deployment devem ser apresentados no relatório de encerramento; não inferir publicação a partir deste documento.

## Classificação

- [IMPLEMENTADO E CONFIRMADO NO CÓDIGO] Refinamentos descritos, executor canônico e testes direcionados.
- [APROVADO] Escopo e mockup do alerta fornecidos pelo usuário; retirada autenticada confirmada no banco e por HTTP público.
- [IMPLEMENTADO, MAS NÃO VALIDADO] Um novo aviso operacional real não foi publicado para validar a faixa em produção. Sua apresentação e dispensa foram validadas em fixtures; produção ficou sem aviso elegível.
- [NÃO CONFIRMADO] Homologação humana final de aparência e tecnologias assistivas reais; intenção das reativações anteriores; alcance operacional da política de não fumantes; funcionamento físico do ramal e dos equipamentos.

Nenhuma publicação operacional dos Guias/TV foi planejada ou autorizada neste pacote. Integração e publicação técnica dependem dos gates finais e devem ser reportadas pelo estado efetivamente confirmado.


## Pacote consolidado — auditoria de recorrência e região opcional — 31/10/2026

Checkpoint inicial main 01e95c2, árvore limpa; branch isolada feat/v4-promotions-updates-audit. A Frente A permanece estritamente somente leitura. Esta seção complementa o histórico anterior, sem substituir os estados que foram verdadeiros na data de suas leituras.

### Frente A — estado e linha do tempo

Snapshot em 31/10/2026, 04:14:33 (America/Sao_Paulo). Sete registros de demonstração: seis ativos e um desativado. Nenhum expirado ou agendado: todos têm starts_at/ends_at nulos. Essas tabelas não possuem coluna de revisão, autoria ou is_published separado; is_active, módulo e vigência determinam a elegibilidade pública. updated_at participa da identidade de revisão do aviso. Autoria só é informada onde há auditoria, nunca inferida pelo título/e-mail.

| Registro | ID | Estado | Criação (BR) | Última alteração (BR) |
|---|---|---|---|---|
| Comunicado TESTE MANUTENÇÃO | 69e72156-1e45-43dc-87e1-33c690291b54 | Desativado | 29/10/2026, 23:53:47 | 31/10/2026, 02:09:32 |
| Comunicado TESTE 2 | 5babf6c1-dbc1-4821-aa98-8c87a26add8d | Ativo/elegível | 30/10/2026, 12:25:53 | 31/10/2026, 02:43:08 |
| Comunicado TESTE 3 | 574684ff-e441-4712-9cf0-c40079ec5a8b | Ativo/elegível | 30/10/2026, 12:26:12 | 31/10/2026, 03:40:28 |
| Comunicado TESTE 4 | 0b08ba8d-0e4e-4bb6-ab12-7fdd064a73f3 | Ativo/elegível | 30/10/2026, 12:27:30 | 31/10/2026, 03:39:19 |
| Banner TESTE | e1f4222d-bb17-4990-9cbf-12c1b9c5a04b | Ativo/elegível | 29/10/2026, 23:52:12 | 31/10/2026, 03:41:24 |
| Banner TESTE 2 | 0b012d35-0b6b-49d8-a357-fa53b657be4f | Ativo/elegível | 31/10/2026, 01:06:44 | 31/10/2026, 02:41:24 |
| Banner TESTE 3 | 2aa0e949-b306-4862-891b-e54c46e6d0da | Ativo/elegível | 31/10/2026, 03:42:15 | 31/10/2026, 03:42:15 |

Histórico disponível de comunicações, horário de Brasília:

| Horário | Ação | ID |
|---|---|---|
| 29/10/2026, 23:52:13 | banner.created | e1f4222d-bb17-4990-9cbf-12c1b9c5a04b |
| 30/10/2026, 14:51:51 | banner.deactivated | e1f4222d-bb17-4990-9cbf-12c1b9c5a04b |
| 30/10/2026, 14:51:54 | announcement.deactivated | 69e72156-1e45-43dc-87e1-33c690291b54 |
| 30/10/2026, 14:51:55 | announcement.deactivated | 5babf6c1-dbc1-4821-aa98-8c87a26add8d |
| 30/10/2026, 14:51:57 | announcement.deactivated | 574684ff-e441-4712-9cf0-c40079ec5a8b |
| 30/10/2026, 14:51:59 | announcement.deactivated | 0b08ba8d-0e4e-4bb6-ab12-7fdd064a73f3 |
| 31/10/2026, 01:06:13 | announcement.activated | 0b08ba8d-0e4e-4bb6-ab12-7fdd064a73f3 |
| 31/10/2026, 01:06:27 | banner.activated | e1f4222d-bb17-4990-9cbf-12c1b9c5a04b |
| 31/10/2026, 01:06:45 | banner.created | 0b012d35-0b6b-49d8-a357-fa53b657be4f |
| 31/10/2026, 01:07:44 | announcement.activated | 69e72156-1e45-43dc-87e1-33c690291b54 |
| 31/10/2026, 02:09:30 | announcement.deactivated | 0b08ba8d-0e4e-4bb6-ab12-7fdd064a73f3 |
| 31/10/2026, 02:09:32 | announcement.deactivated | 69e72156-1e45-43dc-87e1-33c690291b54 |
| 31/10/2026, 02:09:35 | banner.deactivated | 0b012d35-0b6b-49d8-a357-fa53b657be4f |
| 31/10/2026, 02:09:37 | banner.deactivated | e1f4222d-bb17-4990-9cbf-12c1b9c5a04b |
| 31/10/2026, 02:41:24 | banner.activated | 0b012d35-0b6b-49d8-a357-fa53b657be4f |
| 31/10/2026, 02:41:29 | banner.activated | e1f4222d-bb17-4990-9cbf-12c1b9c5a04b |
| 31/10/2026, 03:39:19 | announcement.activated | 0b08ba8d-0e4e-4bb6-ab12-7fdd064a73f3 |
| 31/10/2026, 03:40:28 | announcement.activated | 574684ff-e441-4712-9cf0-c40079ec5a8b |
| 31/10/2026, 03:41:25 | banner.updated | e1f4222d-bb17-4990-9cbf-12c1b9c5a04b |
| 31/10/2026, 03:42:16 | banner.created | 2aa0e949-b306-4862-891b-e54c46e6d0da |

Todos esses eventos registram actor_user_id b1a91675-0dee-4743-9260-9f6daab02751, com request_id nulo. A função de auditoria é executável por service_role e não por anon/authenticated; a aplicação a chama após obter a identidade normal. Isso não identifica a pessoa operadora, browser, automação, IP ou endpoint exato. Não há registro correspondente à criação original dos comunicados nem à alteração do TESTE 2 em 31/10 às 02:43:08. A identidade dessa alteração não está confirmada.

[CAUSA COMPROVADA] A retirada anterior persistiu, foi auditada e teve leitura/smoke sem TESTE. Ocorreram novas gravações depois: dois banners reativados às 02:41, alteração do comunicado TESTE 2 às 02:43, TESTE 4 reativado às 03:39, TESTE 3 reativado às 03:40, edição do banner TESTE às 03:41 e criação de outro banner TESTE 3 às 03:42. O novo banner 2aa0e949… não fazia parte das listas anteriores. A desativação não foi simplesmente ignorada.

[CAUSA COMPROVADA] Banco, consulta anônima real e função publicCommunications concordaram: alertas 5babf6c1…/574684ff…, comunicado promocional 0b08ba8d… e três banners na ordem 2aa0e949…/0b012d35…/e1f4222d…. A Home exibe o primeiro alerta e acesso aos demais; promocao permanece na listagem de comunicados, sem virar banner. Não há informativos elegíveis neste snapshot. PT/EN/ES retornaram HTTP 200, cache MISS e private/no-cache/no-store. Sem evidência de restauração por cache ou diferença de ambiente; produção era 01e95c2 READY.

[CONFIRMADO NO CÓDIGO] /api/admin/communications/status aceita somente desativação, verifica sessão/tenant/módulos/versão e invalida o layout. Os executores anteriores não criam nem reativam registros, exigem snapshots e interrompem em divergência. Não foram executados nesta investigação. O bootstrap atual não contempla domínio de banners/comunicados; nenhum dos sete IDs aparece em hotel_bootstrap_items, e não há bootstrap auditado posterior a 29/10. Não foi encontrada criação/reativação de comunicações nas suítes do repositório: fixtures são renderizadas em loopback, rede externa bloqueada; mocks de status alteram arrays locais. UUID real nas fixtures serve às referências locais e não significa acesso ao tenant real.

Foi identificado outro worktree em C:/Users/bruno/libguest-tv/.tools/libguest-content-bridge, detached em 74a344f, com três adições de projeção TV GET/leitura pública. Foi apenas inspecionado e preservado; nenhuma evidência nessas adições o vincula às reativações. Não há workflow .github no checkout auditado. Automações externas não inventariadas permanecem NÃO CONFIRMADAS.

[CONFIRMADO NO CÓDIGO] Os formulários de edição de comunicado/banner enviam is_active junto ao conteúdo e não verificam expected_updated_at do formulário. Edição de comunicado não grava evento de auditoria; banner.updated registra changed_fields estático, não um diff antes/depois. Atualização e auditoria de status são operações separadas: uma falha de auditoria pode ocorrer após a gravação. Não existem triggers de auditoria nessas duas tabelas.

[HIPÓTESE] Um formulário antigo com checkbox ativo pode restaurar o estado ao salvar conteúdo. É um caminho possível no código, compatível com a lacuna do TESTE 2, mas não está comprovado como origem daquele evento. [NÃO CONFIRMADO] Execução humana versus automação, intenção e origem HTTP exata. Não atribuir a uma pessoa com base na identidade administrativa registrada.

### Por que os smokes passaram

O artefato de 31/10 às 02:32:53 registra 74 cenários e retiredTestContentChecked=true, depois da retirada e antes das ativações das 02:41. A ausência relatada era válida naquele instante. O smoke do hotfix às 03:27:04 registra 74 cenários, retiredTestContentChecked=false: era funcional, com assertivas de navegação/layout/segurança e sem regra editorial padrão. A opção --require-empty-communications falhou com os dados já reativados; a execução funcional foi reportada separadamente. TESTE 4/3 e o banner novo das 03:39–03:42 também são posteriores a esse smoke. Portanto há duas causas distintas para observações posteriores: dados alterados após verificações e smoke funcional sem gate editorial obrigatório. Aprovação funcional não homologa conteúdo.

### Correção duradoura proposta — aguardando aprovação explícita

1. Separar edição de conteúdo e mudança de status; manter permissões legítimas atuais, mas exigir ação editorial explícita e expected_updated_at/revisão capturada no formulário. Rejeitar formulário obsoleto com conflito, sem restaurar is_active.
2. Completar auditoria de criação/edição/ativação/desativação com status/revisão antes e depois, origem técnica e request_id gerado no servidor; sem senha, token ou conteúdo sensível. Tornar gravação e auditoria transacionais, respeitando sessão, módulos e RLS.
3. Classificar origem de demonstração e aposentadoria persistente por IDs/origem conhecida. Registros aposentados não voltam por edição de conteúdo ou replay. Não bloquear genericamente a palavra TESTE: textos legítimos como teste programado do gerador devem continuar permitidos. Novos registros reais permanecem no fluxo editorial legítimo. A modelagem e as mudanças de RPC/banco/fluxo sensível precisam de aprovação antes de implementação.
4. Implantar gate editorial separado do funcional: ler anonimamente os IDs de demonstração aprovados e falhar se elegíveis, inclusive se renomeados; registrar hotel, deployment, horário e dados observados. Não exigir seções vazias quando houver conteúdo legítimo.
5. Após aprovação, preparar um novo plano de retirada com os IDs/versões atuais e auditoria/readback, sem reutilizar cegamente o manifesto antigo de cinco entradas. Esta investigação não autoriza essa execução.

Testes preventivos planejados: edição obsoleta após aposentadoria; status e edição concorrentes; falha de auditoria com rollback; bloqueio de replay; ID aposentado renomeado; texto legítimo com palavra teste permitido; novo demo classificado fora de produção; classificação ausente; origem real em fixtures bloqueada; chamadas externas de escrita detectadas mesmo quando abortadas; isolamento entre hotéis/idiomas; datas e módulos; smoke funcional verde com editorial vermelho explicitamente separado; conferência após deploy e nova ativação posterior.

### Frente B — recorte e implementação

Fonte localizada: C:/Users/bruno/Documents/LibGuest Bugan Recife/Showcase UX_UI do Bugan Recife.png. Somente os painéis 3 e 4 da área Comportamento Dinâmico da Home (promoção horizontal com fotografia/CTA e lista de atualizações) orientam esta alteração. O restante dessa prancha não autoriza alterações. A Home atual e os hotfixes 74a344f/01e95c2 permanecem o contrato fora dessa região. Aprovação humana final da implementação não é inferida da existência da referência.

Apenas o Bugan usa o novo modo region de PublicCommunications. Promoções à esquerda em carrossel nativo, foto HTTPS cadastrada, CTA validado e fallback tipográfico para imagem ausente/falha; limite e ordenação canônicos de três. Botões anterior/próximo, pontos, posição, Home/End/setas, swipe e ResizeObserver preservam slide ao mudar viewport; sem autoplay. Fora do slide ativo, inert evita foco em CTAs fora de tela. Um banner não tem controles extras.

À direita, informativos elegíveis em até três linhas compactas e Ver todas para o destino canônico. Alerta/manutenção permanecem no contrato superior e não são duplicados na lista inferior; comunicado promocional não vira banner. Sem um lado não há coluna vazia; sem ambos não há wrapper nem espaço reservado. Mobile empilha promoções e atualizações, com o Turismo seguindo naturalmente.

Os modos offers/updates compartilhados pelos outros hotéis mantêm exatamente a marcação anterior em LegacyCommunicationSections. Estilos novos são restritos ao wrapper da região. A condição de clear/benefícios foi estendida apenas para reconhecer o novo wrapper, mantendo o mesmo comportamento anterior. Nenhum dado/editor/admin/RLS foi alterado.

Baseline anterior de 54 combinações em out/consolidated-v4/baseline.json e capturas before/. Comparação atual com geometria/texto de header, hero, acessos, essenciais, editoriais, benefícios, Turismo e footer; só o deslocamento vertical natural depois da região é permitido. Evidências visuais usam fixtures isoladas e fotos já existentes, sem publicação de exemplos.

Matriz específica atual: 183 cenários aprovados, incluindo nove viewports de 360 a 1536, PT/EN/ES, estados dinâmicos, imagem quebrada/ausente, CTA inválido/ausente, títulos longos, cap canônico, foco/teclado, resize, toque nativo Chromium e seis temas. Regressões, gates finais e deployment devem ser consolidados pelos resultados efetivamente confirmados ao encerrar.

Preservação lida: Bugan active, dois administradores ativos, 13 serviços habilitados, quatro guias desabilitados e não publicados, 222 canais não publicados, revisão 7 da TV. Nenhuma escrita editorial, desativação, exclusão, mudança estrutural ou publicação de conteúdo foi executada neste pacote. A investigação P0 está diagnosticada; correção sensível está PLANEJADA e não aplicada. A Home não está editorialmente homologada enquanto os TESTE elegíveis permanecerem.


### Recuperação após reinício — 31/10/2026, 07:09:27 (Brasília)

Recuperados os nove arquivos modificados e os dois novos na branch feat/v4-promotions-updates-audit, HEAD 01e95c2. Nenhum arquivo foi descartado ou reimplementado. A baseline anterior de 54 combinações foi preservada. Reexecução atual confirmou 183 cenários específicos, regressões de 109/168, 564 testes de segurança, TypeScript, lint, build e diff check. Lint mantém quatro avisos preexistentes de imagens. Não foi necessária correção de código após a recuperação.

Releitura somente leitura em 31/10 às 07:07:20 confirmou os mesmos sete TESTE e timestamps documentados (seis ativos), Bugan active, dois administradores ativos, 13 serviços habilitados, quatro guias desabilitados/não publicados, 222 canais e revisão 7. Não foi executado qualquer script de aposentadoria. O worktree libguest-content-bridge não foi modificado. Correção sensível do P0 continua planejada, aguardando aprovação explícita; GO técnico da interface não homologa o conteúdo TESTE existente. Commit, integração, deployment e smoke pós-publicação serão registrados pelo estado final confirmado.


### P0 — Fase 1 local autorizada — 31/10/2026

Esta seção substitui apenas o estado anterior de “correção planejada” para o código da Fase 1. Não substitui a linha do tempo nem atribui uma causa histórica sem evidência. Base e main preservada: e3b53e6fcb3ace27240197bb75767f40b7e3ebf8. Branch local: fix/p0-communications-phase1. Autorização: implementar/testar/commit local; sem push, merge, deploy, escrita Supabase, migration, RPC, Auth, RLS/grants ou contas. Worktree separado libguest-content-bridge não operado.

#### Inventário canônico dos caminhos de escrita

| Caminho | Operações e contrato | Proteção da Fase 1 |
| --- | --- | --- |
| app/admin/comunicados/page.tsx + actions.ts | Criação com checkbox inicial existente; listagem: ativar/desativar, excluir e retraduzir | Criação mantém is_active explícito do checkbox e seu default visual; demais formulários enviam updated_at persistido; exclusão e retradução usam CAS |
| app/admin/comunicados/[id]/page.tsx + actions.ts | Título, corpo, categoria e janela de validade | Editor sem checkbox de status; hidden de versão e link de recarga; allowlist + UPDATE condicional atômico; sucesso apenas após persistência confirmada |
| app/admin/banners/page.tsx + actions.ts | Criação, ativar/desativar, excluir e retraduzir | Mesmo contrato de criação; status explícito separado; exclusão e tradução com versão |
| app/admin/banners/[id]/page.tsx + actions.ts | Título, subtítulo, CTA, URL, prioridade, validade e remover imagem | Sem status editorial; versão em editor e confirmação de imagem; CAS em ambas as operações |
| app/admin/banners/upload-image-action.ts | Validar/enviar imagem, vincular URL e limpar imagem anterior | Preflight de versão evita upload já obsoleto; vinculação final tem CAS atômico; conflito confirmado limpa somente upload novo; resposta ambígua ou auditoria falha conserva o arquivo potencialmente vinculado |
| lib/services/translation-admin.ts | Dois helpers de EN/ES e upsert nas tabelas filhas | Tenant e versão são obrigatórios nos dois helpers; chamada sem versão falha fechada sem tradução/upsert. Todos os seis chamadores de comunicados/banners passam tenant e versão da fonte confirmada; resultado já obsoleto é descartado antes do upsert; nunca escreve is_active |
| lib/communications/status.ts + access.ts | Operação compartilhada explícita de status | Sessão normal, perfil ativo, papel, módulo, tenant e hotel não arquivado preservados; versão obrigatória e CAS por ID/hotel/updated_at; operador continua permitido no Admin |
| app/api/admin/communications/status/route.ts | Endpoint autenticado já existente, somente desativação administrativa | Contrato preservado: administrador, bearer normal, origem/JSON/tamanho/allowlist, expected_updated_at obrigatório; nenhuma ativação ou novo endpoint; invalida layout também se o status persistiu e só a auditoria falhou |
| scripts/retire-bugan-test-communications.mjs e wrappers PowerShell existentes | Retirada administrativa mediante snapshot e endpoint canônico | Inspecionados, não executados nem alterados; já passam versão; não criam/reativam conteúdo |
| lib/audit.ts | RPC existente de auditoria após escrita, via cliente servidor existente | Arquivo/RPC/permissões inalterados; aplicação passa a verificar confirmação, usar metadados escalares e requestId de operação nos novos helpers |

Busca por tabelas e chamadas indiretas conferida em app/lib/scripts. Admin Idiomas e Experiência fazem leitura/projeção; não constituem escritores alternativos deste domínio. Bootstrap atual não cria banners/comunicados. Não há campo is_published ou revisão editorial nestas duas tabelas: a elegibilidade atual é is_active + tenant + validade e projeção canônica; não foi inventado um fluxo novo de publicação. O renderer público e sua identidade visual não foram modificados.

#### Mecanismo e comportamento corrigido

[IMPLEMENTADO E CONFIRMADO NO CÓDIGO] EDITORIAL_FIELDS em lib/communications/editorial.ts: comunicado permite title/body/category/starts_at/ends_at; banner permite title/subtitle/cta_label/cta_url/starts_at/ends_at/display_order. Imagem é uma operação própria com image_url; tradução tem claim de versão sem campos de status. O núcleo rejeita atributos extras, inclusive is_active, hotel_id, id, updated_at e published_at. Campos extras de um FormData antigo não são encaminhados ao patch editorial. Criação continua aceitando o status inicial intencional já aprovado; a Fase 1 não converte criação em rascunho.

[IMPLEMENTADO E CONFIRMADO NO CÓDIGO] O valor bruto de updated_at capturado pelo servidor ao abrir cada formulário é obrigatório. A gravação usa UPDATE ... WHERE id = ... AND hotel_id = ... AND updated_at = versão_capturada, com retorno da linha. Não é apenas SELECT seguido de UPDATE incondicional. A versão gerada avança pelo menos 1 ms em relação à anterior, mesmo com relógio parado ou precisão original de seis casas, impedindo replay por timestamp igual. Exclusão também é condicional. O SELECT posterior a uma tentativa sem linhas serve somente para classificar conflito/registro indisponível; não autoriza nova escrita. Upload lê previamente para preparar mídia, mas continua condicionado atomicamente no UPDATE final.

[IMPLEMENTADO E CONFIRMADO NO CÓDIGO] Versão ausente/inválida ou divergente orienta recarregar; editor oferece link de recarga. Registro ausente/inacessível, permissão negada e falha de conexão/indisponibilidade têm mensagens administrativas sem SQL ou detalhes internos. Falhas ambíguas não causam retry automático, sucesso fictício ou compensação editorial. Uma gravação confirmada seguida de falha de auditoria informa explicitamente “alteração gravada, auditoria não confirmada”; não tenta desfazer conteúdo potencialmente já alterado por outra sessão.

#### Auditoria: consistência e limite

[IMPLEMENTADO E CONFIRMADO NO CÓDIGO] Eventos banner.created/updated/deleted/activated/deactivated/image_uploaded/image_removed preservados. Criação/edição/exclusão de comunicado agora registram announcement.created/updated/deleted; status existente permanece. Retradução registra translation_requested após claim persistido, sem fingir sucesso da tradução. Metadados do helper editorial são escalares, com operação, campos submetidos e versões; requestId é correlação local da operação, não atribuição de origem humana/automação. O banner.updated anterior enviava changed_fields como array, incompatível com o contrato escalar da RPC 45B, e ignorava seu retorno. Isso foi corrigido no código, sem afirmar que explica lacunas históricas específicas.

[IMPLEMENTADO PARCIALMENTE] Persistência de conteúdo/status/exclusão e auditoria continuam em chamadas separadas. Falha ou interrupção entre elas pode deixar conteúdo confirmado sem evento. O helper de tradução verifica versão depois de gerar EN/ES e antes do upsert; existe ainda janela entre SELECT e escrita das filhas. Claim/CAS protege a entrada do formulário, mas não transforma parent + traduções em transação. Storage e banco também não são atômicos; arquivos não referenciados podem exigir reconciliação. Escritores legados/diretos que não avancem updated_at podem escapar da detecção de concorrência; o novo patch editorial continua sem poder restaurar status, mas CAS não substitui versionamento obrigatório no banco. Esses limites permanecem até a Fase 2 e não são apresentados como resolvidos.

#### Gate editorial separado

[IMPLEMENTADO E CONFIRMADO NO CÓDIGO] lib/communications/editorial-gate.ts contém o registro revisado das sete identidades conhecidas, associado ao tenant Bugan. Usa communicationEligible/publicCommunications existentes para estado, tenant, datas e conteúdo canônico; renomear o banner não remove sua identidade. Conteúdo legítimo com “teste” é aceito. Banners além do cap de três continuam classificados como elegíveis, com projected=false; visibilidade adicional por módulo/layout não é atestada por este gate. Nenhuma blacklist foi inserida no renderer público.

scripts/check-communications-editorial.mjs consome um snapshot JSON somente leitura, validado, com hotelId, observedAt, announcements e banners completos. Não possui cliente, autenticação, requisições de rede ou qualquer operação de banco. Execução: node --experimental-strip-types scripts/check-communications-editorial.mjs <snapshot.json>. Retornos: 0 verde; 1 exposição conhecida elegível; 2 entrada inválida/indisponível. Não é encadeado ao build nem à suíte funcional: editorial vermelho não impede desenvolvimento local. Cada execução relê o arquivo; snapshot novo detecta identidade conhecida criada/reativada após o smoke anterior. Coleta atual e completa do snapshot é pré-requisito para atestar produção; IDs novos/desconhecidos exigem revisão do registro ou classificação persistente da Fase 2.

[NÃO CONFIRMADO] Não houve nova leitura de Supabase nesta Fase 1 nem homologação editorial atual da produção. Estado conhecido continua sendo a leitura canônica documentada: sete demonstrações, seis ativas/elegíveis, primeira manutenção inativa. Foi reconstruída uma fixture histórica identificada como tal em out/p0-phase1/editorial-known-snapshot.json: funcional green/editorial red, seis violações. Fixture com os sete inativos retorna green. Esses resultados verificam a separação dos gates, não representam desativação ou nova inspeção de dados reais. Risco de formulário obsoleto foi eliminado nos caminhos corrigidos; sua participação exata em cada evento histórico permanece não confirmada.

#### Fase 2 — desenho pronto, não aplicado

[PLANEJADO] 1. Criar contrato transacional específico para comunicados/banners: criação, edição editorial, status, exclusão, vínculo de mídia e traduções. RPC recebe operação, ID, versão esperada e requestId; obtém ator de auth.uid(), tenant do perfil e verifica perfil ativo/papel/módulo/lifecycle no servidor. Allowlists por operação e CAS/versionamento no próprio banco. Edição comum nunca recebe is_active. Preservar operador nos fluxos legítimos e administrador no endpoint de retirada; não aceitar ator/tenant arbitrários do payload.

[PLANEJADO] 2. Avaliar revisão bigint NOT NULL e updated_at gerados/avançados no banco para qualquer escritor permitido; registrar origem unknown/editorial/demo e aposentadoria/reason/retired_at sem classificar por palavra. Identificação e aposentadoria dos sete IDs requerem aprovação nominativa; a existência desta proposta não autoriza desativar os seis ativos. Ativação de aposentado deve falhar no banco; eventual restauração legítima exige contrato distinto, auditado e aprovado.

[PLANEJADO] 3. Gravação e auditoria no mesmo commit, com valores anteriores/posteriores redigidos, ator autenticado, versões e correlação/idempotência por tenant/ator/requestId. Falha de auditoria aborta mutação. Não ampliar genericamente EXECUTE da RPC record_admin_audit_event (hoje service_role) para authenticated. Avaliar SECURITY INVOKER com escritor interno apropriado ou wrapper estritamente validado em esquema privado, com search_path fixo, grants mínimos e sem bypass de tenant. Não oferecer uma RPC SECURITY DEFINER genérica que aceite payload livre. Migração deverá incluir testes do caminho real de privilégio, não apenas mocks.

[PLANEJADO] 4. Inventariar clientes antigos e escrita direta Data API em tabelas pais/filhas. Restringir DML direto de anon/authenticated somente no domínio de comunicações, mantendo SELECT público/RLS canônico e os demais módulos. Exigir RPC para os escritores compatíveis; revisar grants/RLS e acesso operacional service_role separadamente, pois service_role pode contornar RLS. Regras de aposentadoria/versão também devem cobrir acessos privilegiados conforme política operacional aprovada. Nada disso foi aplicado nesta fase.

[PLANEJADO] 5. Tradução externa é preparada fora da transação; commit de cada resultado valida e bloqueia a versão da fonte na mesma transação do upsert/auditoria. Edição posterior invalida tradução antiga. Storage continua externo ao Postgres: uploads imutáveis com tenant/ID, confirmação transacional do vínculo e auditoria, fila/reconciliação de órfãos após confirmação e conferência de referências; resposta ambígua nunca exclui arquivo potencialmente vinculado.

[PLANEJADO] Compatibilidade e migração: validar primeiro em banco comprovadamente isolado; backup e inventário de políticas/grants/dependências; schema aditivo + backfill neutro (origem unknown, sem mudar status/conteúdo real); RPC versionada e testes; aplicativo adaptador mantém expected_updated_at no endpoint existente durante transição, verificando-o atomicamente no banco. Atualizar todos os escritores antes de restringir DML; clientes obsoletos devem receber conflito/recarga ou versão não suportada, sem fallback para escrita direta. Só então ativar enforcement e observar logs. Janela de coexistência deve ser declarada como proteção parcial. Integrar após revisão da Sprint 53, sem alterar seu worktree.

[PLANEJADO] Regressão preventiva: testes SQL reais de isolamento tenant/roles/módulos, RLS/grants e acesso direto; dois clientes concorrentes e replay/idempotência; fonte de tradução alterada durante geração/commit; exclusão concorrente; auditoria falha => rollback da mutação; origem/aposentadoria persistente; criação explícita legítima; datas/timezones e PT/EN/ES; mídia, falhas ambíguas e reconciliação; Admin/temas/Home/Guias/TV e endpoint administrativo antigo. Testes de fixtures da Fase 1 não substituem esses testes de integração do banco.

[PLANEJADO] Reversão: Fase 1 pode ser revertida por commit futuro sem migração de dados, mas isso restaura a vulnerabilidade antiga e deve exigir avaliação/freeze de escrita. Fase 2 deve manter schema aditivo e RPC compatível durante rollback da aplicação; não reabrir DML direto ou remover proteção de aposentadoria automaticamente. Restaurar grants somente por plano aprovado e após avaliação dos clientes. Nunca reativar registros, restaurar snapshot completo sobre edições legítimas ou apagar auditoria como compensação.

[PLANEJADO] Aprovação explícita necessária: integração/push/deploy da branch; migrations e execução da Fase 2; RPCs/RLS/grants e qualquer mudança de contrato sensível; classificação/aposentadoria real por lista de IDs e qualquer alteração de conteúdo. Esta implementação local não autoriza nenhuma dessas ações.

#### Preservação e validação

[IMPLEMENTADO E CONFIRMADO NO CÓDIGO] Nenhum arquivo público de UI/CSS, migration, Auth/RLS, contrato de lib/audit.ts ou dado de hotel foi alterado. Home V4, Turismo, Gastronomia/Filipe, Central de Voos, alerta, footer/dock, Guia TV revisão 7, 222 registros não publicados, quatro guias desabilitados, 13 serviços, dois administradores e lifecycle permanecem fora dos caminhos executados. Preservação por ausência de escrita nesta execução; não é uma nova atestação do conteúdo do banco. Main permanece na base e o worktree separado não foi modificado. Não houve push ou publicação técnica/editorial.

[IMPLEMENTADO E CONFIRMADO NO CÓDIGO] Gates locais: 625 testes de segurança aprovados (61 cenários novos de P0), TypeScript aprovado, lint sem erros com os quatro avisos preexistentes de imagem, build de produção local aprovado e diff check sem problemas. Regressões isoladas do renderer: 183 cenários communications-region e 168 premium-hotfix aprovados, com zero chamadas de API; PT/EN/ES, responsividade e seis temas/hotéis. Testes executam ações administrativas reais transpiladas com clientes em memória, inclusive criação com status inicial explícito, campos editoriais, retradução, ativação e upload. Não há teste mutável de banco real nem validação operacional de equipamentos/grade.

[IMPLEMENTADO E CONFIRMADO NO CÓDIGO] Arquivos desta entrega: quatro páginas e quatro Server Actions de comunicados/banners; upload-image-action.ts e ajuste de invalidação no endpoint de status existente; access.ts, editorial.ts, editorial-gate.ts e status.ts em lib/communications; helpers de comunicados/banners em translation-admin.ts; check-communications-editorial.mjs; communication-status.test.ts, communications-phase1.test.ts e adaptação da regressão isolada tourism-translations.test.ts ao novo contrato obrigatório; este relatório e PRODUCT_MAP.md (21 arquivos). Commit local na branch isolada será identificado pelo git log e pelo relatório final da execução; main não recebe a entrega. GO técnico local não é deploy, homologação editorial da Home ou regularização dos seis conhecidos ativos.
