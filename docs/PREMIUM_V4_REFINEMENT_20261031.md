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
