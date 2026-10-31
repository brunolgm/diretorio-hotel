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
