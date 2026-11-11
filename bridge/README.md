# LibGuest Printing Bridge — C2 / C4 / implantação 1.3.2

Componente Windows separado do Next.js, versão 1.3.2, preservando a fundação C2.
O adapter Windows Spooler e o renderer V1 estão implementados; C3 integra sua
configuração ao Admin existente. Sem adapter habilitado, faz heartbeat e informa
adapter indisponível, sem novos claims. **C5-REAL Bugan permanece pendente**.
Há instalador oficial e IPC local administrativo com ACL; não há listener TCP,
socket direto de impressora, RAW TCP, ESC/POS, shell de impressão ou auto-update.
O LAB físico local foi executado na MP-4200 TH. Nenhum hotel real foi ativado.

## Build e laboratório

Atualização de 10/11/2026: a correção local `97a18be` de recuperação administrativa
e fuso do teste foi incluída como ancestral do candidato universal Premium V4.
Isso não distribui/atualiza automaticamente a instalação de nenhum hotel. O
procedimento oficial está em [deployment/RECOVERY.md](deployment/RECOVERY.md).
Os registros físicos históricos abaixo conservam seus respectivos escopos/datas;
não significam homologação física dos próximos hotéis.

O Admin orienta a preparação do pacote oficial versionado e do checksum antes
de gerar o código. `Install-LibGuestPrintingBridge.ps1` solicita interativamente
os parâmetros ausentes; `Complete-LibGuestBridgePairing.ps1` usa o fluxo oficial
de conclusão. Não há MSI assinado nem endpoint público de download introduzidos
por esta entrega. Assinatura/distribuição dependem do processo de release.
Nunca passar código de pairing em argumento, arquivo, log ou variável de ambiente.
O assistente não instala serviços ou atualiza computadores reais por navegador.

Windows x64, SDK local **10.0.403**, runtime de publicação **10.0.14**. SDK fixado
por `global.json`, sem instalação automática. Na raiz do repositório:

```powershell
powershell -NoProfile -File scripts/fb-c2-build.ps1
node scripts/fb-local-lab.mjs up
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tests/integration/fb-c2.mjs
node scripts/fb-local-lab.mjs down
```

O laboratório precisa estar vazio; a seed recusa hotéis preexistentes. Não rode
duas suítes de integração simultaneamente no mesmo laboratório. O gerenciador
valida a identificação dos próprios containers/rede antes de removê-los.
`fb-c2-build.ps1` compila, executa testes nativos, publica a pasta self-contained
em `out/fb-c2-publish` e cria certificado efêmero LAB. O restore usa somente
nuget.org, runtime packs oficiais Microsoft, versões fixadas e cache em `out/`.
Não instala SDK, ferramentas, certificados, serviços ou impressoras no Windows.

O harness executa os endpoints C1 reais em Next otimizado e Supabase **local**;
o proxy HTTPS 127.0.0.1:4318 pertence exclusivamente ao teste Node, nunca à
bridge. Seu certificado é validado por hostname, validade, cadeia customizada e
pin SHA256 explícito permitido apenas em LAB loopback. Nenhum certificado é
adicionado ao sistema. Produção usa a validação TLS normal, sem callback LAB.

## Comandos e configuração

```text
LibGuest.PrintingBridge.exe pair --config C:\caminho\config.json
LibGuest.PrintingBridge.exe reprovision --config C:\caminho\config.json
LibGuest.PrintingBridge.exe import-credential --config C:\caminho\config.json
LibGuest.PrintingBridge.exe resume --config C:\caminho\config.json
LibGuest.PrintingBridge.exe run --config C:\caminho\config.json
LibGuest.PrintingBridge.exe run-once --config C:\caminho\config-lab.json
LibGuest.PrintingBridge.exe service --config C:\caminho\config.json
LibGuest.PrintingBridge.exe diagnose --config C:\caminho\config.json
```

`pair`, `reprovision` e `import-credential` recebem segredo por entrada oculta
interativa ou stdin redirecionado por um supervisor seguro. Nunca passe segredo
em argumento, arquivo JSON, variável de ambiente ou comando gravado no histórico.
Não redirecione stdin de arquivo plaintext. O exemplo de produção contém domínio
reservado inválido e GUID vazio: substitua pelos valores autorizados do Cloud.
Configuração desconhecida, incluindo `hotel_id`, é recusada; o Cloud define tenant.

Configuração LAB adicional: `environment: laboratory`, `simulator_enabled: true`,
`data_directory` absoluto isolado, `simulator_scenario` (`success`, `safe_failure`,
`ambiguous`, `delay`, `no_response`), `simulator_delay_milliseconds` e, somente se
necessário, `laboratory_certificate_sha256`. Failpoints são exclusivos LAB.
Exit codes: 0 encerramento normal/cancelamento; 20 bloqueio conhecido; 21 falha
inesperada sanitizada. `run-once` é exclusivo LAB, para um resultado/ACK recuperado
ou novo trabalho; sem trabalho anterior pode aguardar até existir job.

Para Windows Spooler: `windows_spooler_enabled: true` e
`simulator_enabled: false`. O destino/fila vem da autorização Cloud, nunca do
conteúdo comercial; não existe fallback para a impressora padrão. Em produção,
`laboratory_spooler` permanece false. A opção LAB explícita
`laboratory_spooler: true` permite testar o adapter sem enviar documento ao Windows;
é recusada em produção. `diagnose` apenas enumera/consulta metadata das filas da
identidade atual, sem criar journal, instalar serviço ou submeter documento.

## Identidade, segredo e arquivos

DPAPI **CurrentUser**, UI proibida, e DACL protegida só para o SID atual, herdada
por seus arquivos. Parear e executar sob a **mesma conta**; ter administrador
local não é barreira contra comprometimento do Windows. Não alegamos proteção
contra administrador/kernel, memória do processo ou roubo da própria identidade.

`credential.dpapi` só contém ciphertext ligado ao device. Substituição usa arquivo
temporário, Flush(true) e rename. Rotação C1 revoga a credencial anterior
imediatamente, sem sobreposição: importar testa heartbeat da nova credencial antes
de substituir o arquivo. Falha preserva o arquivo anterior, mesmo que já revogado.
Reprovisionamento usa novo pairing Cloud; journal não é apagado. `resume` só remove
bloqueio após heartbeat válido, sem autorizar repetição de trabalho ambíguo.

Destino operacional padrão:
`C:\ProgramData\LibGuest\PrintingBridge\<device-id>`. Produção recusa diretório
fora da raiz ProgramData apropriada. Binários ficam separados em Program Files;
perfil/conta dedicada, permissão de logon de serviço, ACL do binário/configuração
e perfil DPAPI precisam ser provisionados na implantação futura. Não mova vault
entre contas/máquinas nem apague SQLite para resolver incerteza.

## Journal e protocolo

SQLite do Windows (`winsqlite3.dll`), WAL, synchronous FULL, foreign keys,
busy_timeout 3000 ms, secure_delete, temp_store MEMORY, trusted_schema OFF.
Migrations locais 0→1→2→3 transacionais; application_id próprio; integrity_check;
schema desconhecido, corrupção e device divergente bloqueiam sem reset. Um lock
de arquivo FileShare.None impede duas bridges no mesmo diretório/journal, inclusive
entre sessões Windows. Configurar diretórios diferentes para o mesmo device não é
um mecanismo de alta disponibilidade; o Cloud ainda aplica lease/fence.

Tabelas: `metadata`, `jobs`, `contents`, `outbox`, `events`, `simulator_calls`.
Conteúdo comercial e projeção privada são blobs DPAPI, separados de deduplication.
Conteúdo expira no mínimo de validade da fonte e 24h; o privado tem ainda seu TTL
próprio. Startup elimina todo conteúdo antes da rede e exige reautorização
quando não houve intent. Terminal remove conteúdo. Metadados ficam até 180 dias.
Durante execução, expurgo ocorre também em idle/backoff. Serviço parado não executa
GC: ciphertext pode permanecer no disco até o próximo startup/expurgo; ACL/DPAPI
continuam aplicadas. Não há garantia de eliminação forense de backups externos.

C1 v1, payload v1, renderer v1; SHA256 dos bytes UTF8 exatos de
`snapshot_canonical` e igualdade JSON com `snapshot`, sem recanonicalizar em C#.
HTTPS POST apenas `exchange`, `heartbeat`, `claim`, `receipt`, `dispatch`, `result`
em `/api/fb/printing/device/`. Bearer opaco próprio do device, nunca JWT humano ou
service role. Nenhuma mudança C1 foi necessária. `printer_ready` continua null.

ACKs/resultados duráveis são drenados antes de claims; heartbeat fornece âncora
de relógio Cloud + Stopwatch, validade conservadora com margem, sem depender só
do relógio local. Expurgo técnico aguarda a primeira âncora Cloud para não apagar
ACKs/tombstones por relógio local incorreto. Polling ativo padrão 5s, idle 20s, jitter, timeout, backoff
exponencial limitado e cancelamento. Receipt só depois do commit local. Dispatch
é autorizado separadamente e gravado antes do intent; intent antes do adapter.
Resultado é commitado antes do HTTP e tem chave estável nos retries.

Depois de intent sem resultado: `ambiguous`, sem nova execução. Com resultado
durável e ACK perdido: repetir ACK, sem executar adapter. Após autorização sem
intent: reautorizar, sem reutilizar projeção privada do processo anterior. Fence
antigo é reconciliado e bloqueado; após possível I/O e conflito exige operador.
403 pode representar revogação, expiração ou outra proibição C1: parar, manter
journal, eliminar conteúdo e exigir intervenção, sem adivinhar a causa.

O simulador só retorna `submitted/transport_accepted`,
`pre_send_failed/no_io` ou `ambiguous/unknown_after_send`; nunca `confirmed`.
Contador `simulator_calls` é a entrada durável na zona simulada, não prova de
impressão. Os testes matam o executável por processo em 12 checkpoints e recuperam
SQLite real, sem depender apenas de mocks. Logs JSON têm campos fixos e códigos
sanitizados, até três arquivos de 1 MiB, sem bearer, pairing, payload ou PII.

## Dependências

Zero PackageReference/NuGet direto. Framework/BCL e runtime pack oficial Microsoft
10.0.14 são geridos pelo SDK 10.0.403; lockfiles sem dependências externas diretas.
NuGet audit remoto desativado porque não há pacote direto e o teste é local.
Native bindings: SQLite Windows; Crypt32/Kernel32 (DPAPI); Advapi32 (SCM);
ACLs Windows via BCL. Versão SQLite observada no host: 3.53.4, mantida pelo Windows.
Publicação inclui runtime .NET, mas depende das bibliotecas nativas do Windows;
validar a versão suportada do Windows/SQLite em cada hotel faz parte de C5.

## Instalação futura — instrução, não executada

Copiar **a pasta completa** do publish para o diretório de binários protegido,
preparar identidade dedicada com perfil DPAPI, parear sob essa identidade e revisar
ACLs antes do registro. Exemplo conceitual de comando futuro (adaptar conta e
caminhos; senha fora de argumentos/histórico):

```text
sc.exe create LibGuestPrintingBridge binPath= "\"C:\Program Files\LibGuest\PrintingBridge\LibGuest.PrintingBridge.exe\" service --config \"C:\ProgramData\LibGuest\PrintingBridge\config.json\"" start= auto obj= ".\lg-print"
```

Nenhum serviço foi registrado nesta rodada. Integração nativa SCM implementa
start/stop/shutdown e CancellationToken, mas funcionamento real sem usuário
logado, recuperação SCM, reboot/queda de energia e permissões da conta dedicada
não foram homologados. C4 usa conteúdo autorizado válido e uma fronteira de I/O
durável própria. C5-REAL deverá validar instalação, hardware, papel, setor, cópias,
rede e operação. Submitted não é papel impresso.

## Windows Spooler / renderer V1

O endpoint adicional `/api/fb/printing/spooler/dispatch` delega a autorização C1
e acrescenta contexto autorizado de hotel, setor, printer e revisão. Os seis
endpoints C1 continuam preservados. A observação autenticada adicional só admite
`unknown`, `offline`, `paper_out` ou `error`; não declara prontidão física.

Renderer lógico Unicode separado do GDI/Spooler: usa quantidades e opções já
congeladas, sem recalcular combo/preço. Nome default OFF; quarto, nome e notas
dependem de política e projeção privada ainda válida. Marca TESTE LIBGUEST — NÃO
É PEDIDO e REIMPRESSÃO; remove controles de dispositivo/bidi e limita conteúdo.
O renderer usa uma lista explícita de campos; não serializa campos bearer,
roomToken, segredo, CPF, e-mail ou telefone da projeção privada.

Enumeração local/metadata precedem qualquer chamada. A implementação usa
Winspool/GDI, valida fila/configuração/revisão e verifica novamente o deadline
antes de StartDoc. ID positivo é persistido em `spooler_calls` por job/fence;
aceitação termina em `submitted/spooler_accepted`, nunca `confirmed`. Qualquer
incerteza depois da fronteira StartDoc é `ambiguous`, inclusive falha sem ID.
Após intent e restart não há nova submissão automática. Resultado durável conserva
a mesma chave de ACK; revisão avançada pelo reprint administrativo é reconciliada
somente no mesmo job/attempt/fence/hash, sem novo claim ou I/O.

Referências oficiais: [EnumPrinters](https://learn.microsoft.com/en-us/windows/win32/printdocs/enumprinters),
[StartDocW](https://learn.microsoft.com/windows/win32/api/wingdi/nf-wingdi-startdocw).
APIs de driver podem bloquear; cancelamento não garante interrupção de chamada
nativa em andamento. Latência, stop/recovery SCM e comportamento do driver exigem
C5-REAL. Filas visíveis ao usuário podem não existir para a conta do serviço;
pareamento, DPAPI, ACLs e acesso à fila devem usar a identidade operacional definida.

Neste computador havia somente OneNote e Microsoft Print to PDF (esta era a padrão).
Nenhuma foi usada para submissão: potencial UI/arquivo não é um destino LAB seguro.
Testes usam abstraction explícita e metadata nativa; zero documento, spool/PDF ou
papel real. Isso não homologa a impressora de qualquer hotel.

Expurgo lógico usa exclusão, secure_delete e checkpoint WAL; conteúdo persistido
é DPAPI e não reaproveitado no startup. Não há promessa de eliminação física em
SSD, snapshots, backups ou arquivos recuperáveis. Serviço parado não executa GC.

## Gates locais finais — 05/11/2026

C3 181, C4 75, C5-LAB 104, .NET 162, C1↔C2 204 e
C1 767: zero falhas. Regressões B/Auth/SSR/browser/segurança/builds verdes;
relatório completo e inventário em docs/SPRINT_53_FNB.md. GO técnico local para
revisão; C5-REAL pendente, nenhuma propriedade real ativada. Zero stage/commit/push.

## Contrato 1.2.0 — registro e cancelamento

Printing automático nasce de `orders.group_registered` e da outbox transacional
imutável gravada com a confirmação B, não de `orders.accepted`. Aceite não duplica.
`orders.group_cancelled` origina um novo job `cancellation` para cada original:
mesmo setor, cópia e routing_snapshot (dispositivo, impressora, fila e revisões).
Nenhum aviso consulta a rota atual; configuração original alterada bloqueia,
sem failover. Cancelamento antes de materializar aguarda o original; ausência de
original mantém bloqueio, sem escolher destino novo. TTL e ativação sem backfill
continuam vigentes. Original submitted/ambiguous não é sobrescrito nem reimpresso.

Protocolo, payload e renderer continuam V1 com tipo aditivo. Software 1.2+ é
necessário para claim de cancellation e reprint de cancellation; tipos normais
continuam compatíveis com bridges anteriores. Renderer imprime CANCELAMENTO,
referência, setor, itens congelados, data/hora e motivo estruturado; reimpressão
explícita preserva também o marcador REIMPRESSÃO. PII expirada continua redigida.
SQLite schema 3, DPAPI, intent/result e ACK idempotente permanecem preservados.

V1 guest apenas contata o hotel; staff autorizado confirma o cancelamento pelo
Admin. Imprimir aviso não cancela comercialmente e submitted não prova papel.
O pacote 1.1.0 do C5-REAL Fase 0 é evidência histórica, não candidato deste hotfix.
Na execução inicial do hotfix não houve instalação de serviço ou impressão.
O LAB físico autorizado posterior usa exclusivamente **MP-4200 TH**; a fila HS
existe e foi apenas enumerada. Não é destino autorizado desta rodada.

Cancelamento comprovado antes do dispatch do original é encerrado atomicamente
no journal como bloqueado, sem inventar resultado ou chamar o spooler. Exige prova
Cloud do mesmo attempt/hash/fence, receipt confirmado, revisão avançada e ausência
de intent/dispatch/result. Se a resposta se perde, usa receipt para confirmar;
409/410 sozinhos nunca autorizam inferência de no-I/O. Incerteza e intervenção já
sinalizada continuam conservadoras. Isso libera apenas a fila para o NOVO aviso,
sem reimprimir o original ou mudar SQLite schema 3.

## Implantação oficial sem desenvolvimento — candidato 1.3.0

Procedimento canônico: [runbook de implantação/reversão](../docs/FNB_PRINTING_DEPLOYMENT_RUNBOOK.md).
Pacote self-contained Windows x64, protocolo/payload/renderer V1, SQLite schema 3.
Distribui binários e scripts oficiais, manifesto e SHA-256. Checksum não equivale
a assinatura de código. Não requer SDK, Node, VS Code, Codex ou edição de JSON no PC.

- `Install-LibGuestPrintingBridge.ps1`: instalar/atualizar com Administrador Windows.
- `Complete-LibGuestBridgePairing.ps1`: concluir modo automático e provar leitura do vault.
- `Get-LibGuestBridgeStatus.ps1`: diagnóstico técnico sem payload/credenciais.
- `Uninstall-LibGuestPrintingBridge.ps1`: remover somente serviço identificado,
  preservando configuração, vault, journal e versões dos binários.
- `Set-LibGuestBridgeLabTransport.ps1`: troca de transporte exclusivamente LAB.

Binários versionados em Program Files; configuração gerada por device e dados em
ProgramData. Conta virtual `NT SERVICE\LibGuestPrintingBridge`, sem senha de
operador. Pareamento e vault DPAPI **CurrentUser** executados sob a mesma conta
do serviço; essa leitura foi comprovada depois de reiniciar em modo normal.
O provisionador passa o código oculto por pipe local protegido, verifica PID
contra SCM e não o inclui em argumentos, arquivos plaintext, JSON ou logs.
O pipe nega logon de rede e não oferece operação de impressão.

Discovery enumera somente metadados das filas visíveis ao serviço Windows.
O Admin escolhe fila detectada, destino e rota de setor. Ausência, descoberta
vencida ou driver alterado não muda a configuração silenciosamente e bloqueia
o fluxo normal. Teste segue C1 antes da ativação; o pré-flight distingue
PASS/WARNING/BLOCKER e registra evidência humana separada, sem fabricar `printed`.

Hotel sintético novo: 23 verificações antes do LAB físico, sem exceção técnica e
sem mudar código durante a tentativa aprovada. Fluxo completo: **32 aprovadas**.
MP-4200 TH, porta `Bematech_IP_172.21.7.248`, IP informado `172.21.7.248`:
três submissões técnicas, spool IDs **4 TESTE**, **5 pedido**, **6 CANCELAMENTO**.
Bruno confirmou presencialmente o TESTE legível/alinhado, acentos corretos e
corte automático. Pedido submetido enquanto registrado; aceite sem duplicação;
cancelamento independente no destino original. Reimpressão não necessária.
Os ACKs dos outros tickets não são confirmação humana individual de papel.
Serviço local de LAB desinstalado oficialmente ao final, dados preservados.
Isso não é homologação operacional do Bugan nem autorização de implantação real.

## Layout térmico oficial V1 — 05/11/2026

Branch de implementação `feat/fb-ticket-layout-v1`, base `e4d5faffc87d4c04cc0ddf0d444624715020e4e6`.
Um renderer compartilhado usa o nome do hotel da autorização existente: cabeçalho
centralizado **LibGuest + hotel**, sem outlet, ícone quadrado, imagens, gradientes
ou tarjas pretas. Setor aparece na área operacional. Texto preto, negrito,
alinhamento e separadores compõem a hierarquia de papel 80 mm / 203 dpi.

- **Pedido:** `PEDIDO`, referência real do snapshot em destaque, nome autorizado,
  quarto válido ou retirada, data/hora do snapshot e fuso, setor, quantidade e
  produto em negrito, modificadores e observações permitidas, soma das quantidades
  das linhas do setor e rodapé **PREPARAR**.
- **Cancelamento:** **X CANCELADO X**, referência original, PII ainda válida,
  data/hora e motivo humano derivados do snapshot de cancelamento, linhas do
  próprio setor e rodapé **NÃO PREPARAR**. Não consulta cardápio ou routing atuais.
- **Reimpressão:** mantém o documento e acrescenta **REIMPRESSÃO**. A de
  cancelamento reúne REIMPRESSÃO, CANCELADO e NÃO PREPARAR no mesmo papel.
- **Teste:** TESTE DE IMPRESSÃO / NÃO É PEDIDO, hotel, identificadores técnicos de
  destino e Bridge já presentes no envelope, setor, fila e data/hora. Exclui PII,
  produtos de pedido e comando PREPARAR.

Decisão de Bruno nesta tarefa: preservar C1; imprimir nome somente quando a
projeção autorizada o fornecer dentro da validade. Permanecem as permissões
existentes de hotel, destino, snapshot e `name_enabled`. A mudança global do
default OFF é uma decisão separada. Nome/quarto/observações expirados ou ausentes
não são reconstruídos. Nome não entra em título do spool, logs ou diagnóstico.
O renderer anterior não imprimia preços e não possui configuração de preço:
mantido ticket operacional sem valores, sem alterar totais comerciais.

`ThermalLayoutV1` mede texto e altura de fonte GDI, limita a largura à área
imprimível do driver e a 80 mm, reserva margens, quebra palavras longas em
fronteiras Unicode e pagina antes de StartDoc. Fonte, desenho e limpeza de
recursos continuam locais; protocolo/payload/renderer V1 e SQLite schema 3
permanecem iguais. Nenhuma mudança em C1, pairing, commissioning ou migrations.

Cobertura adicional: `LibGuest.PrintingBridge.Tests/TicketLayoutTests.cs`;
prévias SVG sintéticas produzidas por testes com GDI em memória, sem spool.
LAB desta rodada: executor separado `tests/integration/fb-ticket-layout-lab.mjs`,
somente pedido + cancelamento físicos, sem teste físico/reimpressão. Confirmação
humana de papel é independente dos ACKs técnicos; resultado será registrado
após o checkpoint presencial. O bootstrap local do schema existente foi
explicitamente autorizado, sem migration nova nem acesso remoto.

Gates desta implementação: **259 testes nativos** (53 específicos do layout),
segurança **754**, registro/cancelamento **211**, commissioning **156**, C1 **776**,
C2 **204** (12 interrupções de processo), C3 **187**, C4 **87**, C5 **116**.
TypeScript, builds .NET/Next, lint (zero erros; quatro avisos de imagem já
existentes), parser PowerShell e diff check aprovados. Os quatro motivos de
cancelamento usam os mesmos termos do Admin, sem deduzir uma causa adicional.
Prévias sintéticas: `out/fb-ticket-layout-previews/`; inventário e evidências:
`out/fb-ticket-layout-report.json`. Essas prévias não são confirmação de papel.

LAB V1 encerrado: **37 verificações aprovadas**, um pedido físico (spool **7**)
e um cancelamento físico (spool **8**), ambos `submitted` no Cloud e no resultado
local, com ACK durável e `local_state=terminal`. Aceite não duplicou o original;
cancelamento manteve destino/impressora. Nenhum TESTE físico ou reprint.
**Confirmação humana dos dois papéis aprovada por Bruno**, em checkpoint único
em 05/11/2026: pedido legível, cancelamento em destaque, nome, quarto, quantidade,
observações, acentos, largura/alinhamento corretos e corte automático nos dois.
Homologação física do layout concluída no LAB; isso não homologa a operação de
um hotel real. Os estados técnicos continuam `submitted`, separados da evidência humana.
Serviço LAB desinstalado oficialmente com dados técnicos preservados; containers
próprios encerrados. Sem stage, commit, push, deploy ou acesso a tenant real.
