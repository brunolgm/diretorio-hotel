# Recuperação administrativa da Printing Bridge

A manutenção é uma operação local supervisionada. Não ativa ordering, não inicia
o worker e não envia documentos. Usa a identidade virtual do serviço, o vault
DPAPI CurrentUser e o journal existentes. Não trocar identidade, ACL, vault,
device ou arquivos SQLite para contornar um bloqueio.

## Pré-requisitos

Inventariar Cloud, instalação, SCM e fila antes de parar o serviço. Preservar todos
os jobs e resultados. Não continuar se houver intenção de I/O sem resultado
reconciliado. Um ACK submitted não comprova papel físico.

Usar PowerShell elevado e um pacote versionado com checksum conferido.
Checksum não é assinatura. O pacote deve vir de uma origem confiável.
Enter-LibGuestBridgeMaintenance.ps1 valida o manifesto e todos os arquivos e
recusa sobrescrever uma versão instalada. Seus arquivos herdam a proteção
existente de Program Files; o procedimento não altera ACLs.

## Procedimento

1. Usar Get-LibGuestBridgeStatus.ps1 se o worker responder. Não tentar ler vault
   ou SQLite com outra identidade.
2. Após inventário, parar o serviço com Stop-OwnedBridge, do helper oficial
   Bridge-Deployment.ps1. Enter-LibGuestBridgeMaintenance.ps1 exige serviço
   parado, identidade e caminho compatíveis com o manifesto oficial.
3. Executar Enter-LibGuestBridgeMaintenance.ps1 com PackagePath e um diretório
   local exclusivo de EvidenceDirectory. O backup maintenance-service-before.json
   registra o comando normal anterior e a versão candidata. O manifesto de
   instalação original permanece preservado durante esse diagnóstico.
4. Consultar o candidato com diagnose-service --config usando o caminho de
   configuração do manifesto. A resposta maintenance expõe somente metadados
   técnicos limitados, incluindo operator_required, pending e códigos sanitizados.
5. Somente após revisão humana e quiescência Cloud, executar
   Resume-LibGuestBridge.ps1 -Executable com o candidato registrado no backup.
   O cliente verifica o PID do pipe contra o SCM. O pipe permite apenas a
   identidade do serviço, SYSTEM e administradores locais; rede é recusada.
6. O comando resume é aceito apenas no modo de manutenção. Recusa intenção de
   I/O não reconciliada; valida heartbeat/credencial/TLS e relógio do servidor
   antes de desbloquear. Expira trabalho local vencido sem intenção usando
   Journal.Block e usa claim canônico para encerrar jobs vencidos do device.
   Se claim devolver trabalho válido, persiste-o e mantém a operação bloqueada
   para revisão. Nunca despacha, imprime ou fabrica ACK.
7. Com operator_required=false, pending=0 e credencial legível, executar
   Exit-LibGuestBridgeMaintenance.ps1 -EvidenceDirectory apontando para o mesmo
   backup. Ele valida comando/identidade/configuração, restaura o executável
   oficial em service --config e início automático. Não deixa recovery como
   runtime permanente.
8. Observar vários ciclos, heartbeat e ausência de falhas SCM antes de criar
   qualquer teste físico. Usar chave de idempotência estável para um único teste.
   Registrar verify_test apenas após confirmação humana real.

Update-LibGuestBridgePackage.ps1 atualiza um worker oficial saudável com pacote
versionado, preservando configuração, identidade, dados e ACLs. Salva metadados
anteriores e restaura runtime/manifesto se a inicialização ou validação falhar.
Essa atualização não gera pairing nem modifica Cloud ou ordering.

## Horário dos tickets de teste

Testes sem timezone no snapshot usam o fuso local do Windows da Bridge instalada.
O operador deve confirmar que o relógio/fuso dessa máquina corresponde ao local
da impressora. Um timezone explícito no snapshot continua prioritário. Pedidos,
reimpressões e cancelamentos preservam o fuso canônico congelado no snapshot e
seu fallback anterior. Não substituir data histórica, alterar snapshots ou
reimprimir jobs antigos para corrigir uma exibição anterior.

Protocolo, payload, renderer V1 e schema SQLite 3 permanecem compatíveis.
Testes de regressão exercitam falha de autorização, needs_operator,
heartbeat-before-resume, preservação de histórico, recusa de I/O ambíguo,
retorno ao worker e virada do dia em UTC.
