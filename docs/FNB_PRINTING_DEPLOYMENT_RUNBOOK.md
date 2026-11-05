# F&B — implantação e reversão sem desenvolvimento

Procedimento canônico de operação do pacote Printing Bridge 1.3.0, protocolo,
payload e renderer V1. Candidato local da Sprint 53; sua existência não autoriza
ativação de hotel real. Bugan Recife continua piloto aprovado, não ativado.

## Preparação

O hotel precisa ter `core.directory` e `fb.menu` habilitados pela Plataforma,
cardápio publicado e configuração operacional nativa. Usar o Admin para criar
estabelecimentos, modalidades, setores e permissões individuais. Configurar
horários, preços e produtos reais apenas em processo editorial autorizado.

No PC/mini-PC Windows x64, instalar o driver oficial de cada impressora e uma
fila nominal no Windows. Conferir uma impressão do próprio Windows em processo
operacional autorizado. A Bridge usa essa fila; não configura IP, driver ou
impressora padrão. Não é necessário instalar Node, .NET SDK, VS Code ou Codex.

Obter o ZIP self-contained, seu SHA-256 por canal confiável e o manifesto.
Conferir o hash do ZIP antes de extrair. SHA-256 verifica integridade; não é
assinatura de código. Este LAB não exige assinatura. Não utilizar pacote com
hash divergente nem substituir DLLs ou scripts dentro do pacote.

## Instalar e parear

1. No Admin, em **Impressão**, criar a Bridge do hotel e gerar código de
   pareamento de uso único. O código vence em cinco minutos.
2. Abrir PowerShell como Administrador do Windows. Executar o script oficial
   `Install-LibGuestPrintingBridge.ps1` da pasta extraída. Informar a URL HTTPS
   do Cloud e o identificador da Bridge quando solicitados. São metadados;
   o código secreto é solicitado depois, com entrada oculta.
3. Informar o código no provisionador. Não colocá-lo em argumentos, histórico,
   JSON, arquivos, chamados, screenshots ou logs. Não executar `pair`/importação
   manual para instalar um serviço.
4. O provisionador verifica o PID do servidor do pipe contra o PID do serviço
   registrado no SCM antes de transmitir o código. O serviço realiza o exchange
   e protege a credencial com DPAPI **CurrentUser** sob
   `NT SERVICE\LibGuestPrintingBridge`, conta virtual sem senha de operador.
5. O instalador conclui o modo de serviço automático, configura recuperação e
   exige diagnóstico `credential_readable=true` sob a mesma identidade. Falha
   nessa prova bloqueia o comissionamento; não converter DPAPI para LocalMachine.
6. Conferir versão, protocolo e heartbeat no Admin. Heartbeat não comprova papel.

Binários ficam em `Program Files\LibGuest\PrintingBridge`, em diretório de
versão/hash. Configuração não secreta e estado ficam em
`ProgramData\LibGuest\PrintingBridge`; configurações e dados são separados por
device. SQLite, vault e logs não ficam no diretório dos binários. ACLs restringem
os dados à identidade adequada. O diagnóstico oficial expõe somente metadados
técnicos, sem payload comercial, dados do hóspede ou credenciais.

## Selecionar filas e comissionar

1. No Admin, atualizar as filas da Bridge. A enumeração acontece no PC do serviço,
   nunca no celular/computador que abriu o Admin.
2. Conferir nome, driver, presença e horário da descoberta. Criar destino lógico
   e cadastrar a impressora escolhendo uma **fila detectada**. O fluxo normal
   não oferece campo livre de queue name ou configuração JSON.
3. Associar cada setor nativo ao destino. Definir cópias explicitamente; não há
   transferência automática para backup depois de possível envio.
4. Gerar um teste no Admin pelo fluxo C1. Teste não cria pedido fictício e pode
   ser comissionado com impressão de pedidos desligada.
5. Conferir job, tentativa, destino, impressora, fila, spool job ID e estado no
   Cloud. `submitted` significa submissão ao spooler, não confirmação física.
6. Conferir o papel presencialmente: título, legibilidade, largura, alinhamento,
   acentos e corte. Registrar verificação humana somente depois dessa observação.
   Esse registro separado não converte o resultado técnico em “impresso”.
7. Conferir o pré-flight: catálogo, entitlements, configuração nativa, setores,
   rotas, device ativo/pareado, versão, heartbeat, fila atual e teste da revisão
   atual. Falta de evidência física é WARNING; bloqueio técnico é BLOCKER.
8. Escolher **SOMENTE VISUALIZAÇÃO** ou **VISUALIZAÇÃO + PEDIDOS**. A primeira
   mantém o catálogo e bloqueia novos pedidos/impressões originadas deles.
   A segunda exige pré-flight sem BLOCKER e ativa pedidos/impressão atomicamente.

Fila ausente, descoberta vencida ou mudança de driver bloqueia o caminho normal.
Não substituir silenciosamente a fila. Atualizar a descoberta, selecionar
explicitamente a configuração atual e gerar novo teste quando a revisão mudar.

O painel avançado de manutenção permite exceção técnica explícita, auditada e
limitada a duas horas, exigindo configuração de impressão e supervisão de pedidos.
Ela não é implantação normal nem equivale a pré-flight aprovado. Fixtures de
contrato usam `isolated_contract_validation`; hotel novo não usa essa exceção.

## Operação e acompanhamento

O registro do pedido origina o job, antes do aceite. Submissão ao spooler não
aceita o pedido. Aceitar não gera segunda impressão original. Cancelamento pelo
hóspede permanece bloqueado; o acompanhamento apresenta o contato canônico do
hotel/serviço, sem inventar telefone. Staff autorizado cancela com motivo e CAS.
O aviso CANCELAMENTO é job independente, com linhas do setor e roteamento original.

Ambiguidade exige análise humana. Não reenviar automaticamente nem alterar o job
anterior para fabricar sucesso. Reimpressão explícita cria job independente,
marcado e auditado, com risco de duplicação visível.

## Atualização, diagnóstico e reversão

Usar o instalador oficial do novo pacote, mesmo device e mesma URL. A atualização
preserva vault e journal, verifica identidade/ownership e guarda versões de
binários, manifesto e configuração anteriores. URL divergente em instalação
pareada é recusada para não transferir bearer a outro endpoint. Caminhos com
reparse point são recusados. Instalação parcial permanece identificável para
diagnóstico/retomada; não remover manualmente pastas ou journal.

Usar `Get-LibGuestBridgeStatus.ps1` como Administrador: identidade, versão,
leitura do vault, pendências, jobs e spool IDs. O pipe é local, tem ACL explícita
e nega logon de rede; não é endpoint de impressão.

Para suspender operação autorizada: selecionar catálogo somente no Admin,
conferir impressão desligada e tratar tentativas em andamento/ambíguas. Preservar
pedidos, auditoria, deduplicação e vault. Não restaurar banco como rotina de rollback.
Desinstalar com `Uninstall-LibGuestPrintingBridge.ps1`: para e remove somente o
serviço identificado pelo manifesto; preserva dados, configuração e binários.
Reinstalar pacote oficial compatível com schema local/protocolo, mesma identidade
e device, pareando novamente se solicitado. Versão incompatível deve falhar
fechada. Não apagar SQLite, fabricar ACK ou reexecutar job com possível I/O.

## Rede e limites do LAB

Bridge → HTTPS Cloud com bearer opaco de device/tenant. Cloud não inicia conexão
com o PC. Não abrir porta TCP de entrada para a Bridge. Windows Spooler → fila/
driver instalado → impressora. A aplicação não abre socket de impressora nem
usa RAW TCP/ESC-POS. Admin móvel seleciona metadados recebidos do PC de impressão.

Somente no LAB isolado, o instalador admite certificado efêmero pinado em loopback
e transporte simulado. `Set-LibGuestBridgeLabTransport.ps1` troca entre simulado
e físico sem editar JSON; recusa produção. Nenhum desses parâmetros é padrão
produtivo nem deve ser usado para contornar o pré-flight.

O LAB físico desta rodada é exclusivamente MP-4200 TH, porta
`Bematech_IP_172.21.7.248`, IP informado `172.21.7.248`. Seleção pelo discovery
genérico; o produto não conhece esse nome. Limite: um TESTE, um pedido sintético,
um CANCELAMENTO e uma reimpressão somente se necessária. Sem carga física. Não
usar o tenant real do Bugan, outras filas, Goomer/TheX/PMS/OPERA ou provedores.

Referências de plataforma: [CreateServiceW e conta virtual](https://learn.microsoft.com/en-us/windows/win32/api/winsvc/nf-winsvc-createservicew)
e [segurança de named pipes](https://learn.microsoft.com/en-us/windows/win32/ipc/named-pipe-security-and-access-rights).
