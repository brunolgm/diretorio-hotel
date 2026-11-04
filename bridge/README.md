# LibGuest Printing Bridge — C2

Componente Windows separado do Next.js. C2 só tem simulador LAB; produção faz
heartbeat e informa adapter indisponível, sem claims novos. C3 Admin, C4 adapters
físicos e C5 instalação/homologação continuam posteriores. Não há listener,
spooler, socket de impressora, ESC/POS, shell, auto-update ou instalador.

## Build e laboratório

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
Migrations locais 0→1→2 transacionais; application_id próprio; integrity_check;
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
é autorizado separadamente e gravado antes do intent; intent antes do simulador.
Resultado é commitado antes do HTTP e tem chave estável nos retries.

Depois de intent sem resultado: `ambiguous`, sem nova execução. Com resultado
durável e ACK perdido: repetir ACK, sem executar simulador. Após autorização sem
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
não foram homologados. C4 deverá carregar conteúdo autorizado válido através de
fronteira controlada e não reutilizar cegamente o simulador; C5 valida instalação,
hardware, papel, setor, cópias, rede e operação. Submitted não é papel impresso.
