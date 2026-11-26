# LibGuest: guia rápido do admin

## Pedidos Premium e KDS — implementação local de 12/11/2026

Em **Gastronomia → Pedidos**, os indicadores contam pedidos com ao menos um grupo
no estado indicado, considerando os filtros de setor, busca e período. Um pedido
de vários setores pode participar de mais de um indicador. A fila abre um detalhe
por vez. Busca consulta código e itens já autorizados; nomes de hóspedes e
apartamentos não entram no índice. Dados privados e observações exigem a consulta
explícita e a capability existente. A impressão tem estado próprio.

**Gastronomia → KDS** exige papel editor ou superior, capability `orders.configure`
e módulos `core.directory`/`fb.menu` habilitados. Cada tela pertence ao hotel do
usuário autenticado. Cadastre nome, localização, tipo e setores que o configurador
pode ler. As seis áreas são Visão geral, Telas, Exibição, Fluxo, Alertas e Segurança.

Em Segurança, gere um código temporário. Na TV/tablet, abra `/kds`, informe o nome
do dispositivo e digite o código de uso único em até dez minutos. A URL não contém
credencial. O navegador recebe cookie HttpOnly com sessão de até trinta dias.
Gerar novo código, revogar acesso ou salvar a tela invalida o dispositivo anterior.
Revogar a capability do configurador, inativar seus setores ou desabilitar os módulos
também impede novas consultas. Após editar, faça novo pareamento.

Monitor não apresenta ações. Operacional exige que a equipe faça login no mesmo
navegador (o botão abre outra aba) e tenha `orders.read` e `orders.transition` no
setor. Expedição só avança pedidos prontos/em entrega. Todas as ações têm confirmação
e revisão/CAS; se uma resposta não for confirmada, aguarde o estado atualizado antes
de tentar novamente. “Detalhes autorizados” abre Pedidos já filtrado pelo código;
observações privadas permanecem nessa área autenticada, fora da TV.

Escolha Kanban, lista compacta ou tickets, colunas, tema, contraste, tamanho e limite
visível. O cabeçalho informa quantos grupos do total estão na tela. Limites de atenção
e crítico começam desativados: configure os minutos do hotel. Som é opcional e precisa
de um clique para permissão no navegador. O tempo exibido parte do registro do pedido.
Concluídos, quando habilitados, abrangem as últimas 24 horas.

As consultas atualizam a cada quatro segundos, com espera progressiva em falhas e
reconexão ao voltar à rede. O aviso de dados desatualizados bloqueia ações; uma TV
offline pode continuar mostrando seu último retrato local. A revogação é imediata
no servidor e refletida na próxima consulta da tela conectada.

Novas telas usam tema claro; telas já configuradas mantêm seu tema salvo. A prévia
no cadastro acompanha o layout escolhido sem mostrar comandas reais. Pedidos
permite ordenar a fila por antiguidade ou recência; a impressão exibida continua
sendo independente do atendimento.

O release candidate passou os nove gates com PostgreSQL/Auth reais isolados,
incluindo duas telas concorrentes. Ainda não foi publicado: a migration KDS precisa
de revisão e aplicação autorizada. Evidências, impacto, rollback e sequência de
publicação estão no fechamento RC da Sprint 53.

## Objetivo
Servir como referência curta para a operação diária do painel administrativo do LibGuest.

## Ordem recomendada de uso
1. revisar informações do hotel
2. revisar serviços
3. revisar departamentos
4. revisar políticas
5. revisar comunicados e banners, quando aplicáveis
6. revisar apartamentos e QRs, quando aplicáveis
7. validar idiomas e a rota pública

O dashboard mostra uma checklist baseada nos dados do hotel autenticado. Ela orienta a configuração inicial sem substituir a homologação manual dos links, idiomas e conteúdo.

## Rotina recomendada

### Informações do hotel
- conferir nome, cidade, horários e contatos
- revisar links principais
- confirmar logo, preset visual e cor de destaque
- revisar subdomínio público quando aplicável

### Serviços
- manter títulos curtos e claros
- revisar CTA, tipo de ação e link de destino
- ativar apenas itens prontos para o hóspede

### Apartamentos e QR
- cadastrar o número real do apartamento
- revisar o link Thex da mesa correspondente antes de ativar
- preferir inativar o apartamento quando o QR não puder mais ser usado
- regenerar token apenas quando o QR físico antigo precisar ser invalidado

### Departamentos
- confirmar nome, descrição, horário e link de contato
- garantir que os canais reais estejam funcionando

### Políticas
- manter linguagem objetiva
- revisar textos sempre que houver mudança operacional

### Usuários
- distribuir papéis mínimos necessários
- desativar acessos antigos
- evitar uso excessivo de papel administrativo
- lembrar que todo acesso administrativo vale apenas para o hotel vinculado ao perfil

## Permissões atuais por papel

### Administrador
- acessa todos os módulos do hotel
- gerencia usuários, papéis e status de acesso
- pode revisar e editar hotel, serviços, apartamentos, departamentos e políticas

### Editor
- acessa o painel do hotel
- pode editar informações do hotel, identidade visual, serviços e apartamentos/QRs
- não gerencia usuários

### Operador
- acessa o painel do hotel
- pode criar e manter serviços, departamentos e políticas
- não gerencia usuários nem a configuração principal do hotel

### Visualizador
- acessa o painel em modo leitura
- acompanha dashboard, listas e status operacionais
- não publica nem altera conteúdo

## Regras operacionais de acesso
- usuário inativo não acessa o painel administrativo
- o acesso continua sempre limitado ao `hotel_id` vinculado ao perfil
- a área de usuários é restrita a administradores
- o sistema impede desativar o próprio acesso
- o sistema impede remover o próprio papel de administrador
- o hotel deve manter pelo menos um administrador ativo

## Tipos de ação em serviços
- `standard`: preserva o comportamento atual do serviço no diretório
- `external_url`: abre a URL fixa configurada no serviço
- `room_restaurant_menu`: usa o contexto do QR do apartamento para abrir o cardápio correto

## QR dinâmico por apartamento
- o QR impresso aponta para o LibGuest, não diretamente para o Thex
- o navegador guarda apenas contexto mínimo de quarto
- o `restaurant_menu_url` é resolvido no servidor no momento do redirecionamento
- mudar o link Thex no admin não exige reimpressão enquanto o token continuar o mesmo

## Tradução
- português continua sendo a base canônica
- inglês e espanhol são gerados no save
- se houver falha de tradução, o conteúdo em português continua publicado

## Validação rápida após mudanças
1. abrir a rota pública no celular
2. revisar hero, serviços, contatos e políticas
3. testar botões principais
4. validar idioma quando necessário
5. validar QR do apartamento quando houver serviço com `room_restaurant_menu`

## Rotina após entrega ao cliente
- revisar ajustes iniciais enviados pelo hotel
- manter contatos, horários e links atualizados
- revisar analytics básicos para entender os primeiros acessos
- usar o handoff como referência quando houver nova revisão operacional
- evitar publicar conteúdo ainda não aprovado pelo hotel

## Naming atual
- produto atual: `LibGuest`
- domínio principal: `libguest.digital`
- domínio legado/transição: `guestdesk.digital`
- `GuestDesk` deve ser tratado como naming legado

## Diagnóstico operacional rápido
- quando um save falhar, revisar primeiro campos obrigatórios, links e contexto do hotel atual
- quando o upload de logo falhar, revisar formato, tamanho e tentar novamente com arquivo mais leve
- quando a tradução falhar parcialmente, lembrar que o conteúdo em português continua publicado e usar retraduzir depois do ajuste final
- quando o cardápio por apartamento não abrir, revisar `service_action_type`, status do apartamento, token ativo e `restaurant_menu_url`
- olhar primeiro o toast exibido na tela e depois os logs do servidor/preview com contexto de módulo, ação, operação, `hotelId` e `targetId`
- nunca expor em log: senhas, tokens, secrets, payloads completos ou dados privados desnecessários

## Traduções do Room Service do Bugan

Em **Gastronomia → Combos e adicionais → Editar traduções do Room Service**, use a
busca ou o filtro de tipo para localizar um produto, combo, grupo ou adicional.
Confira o nome original e o contexto em português, ajuste **Nome em inglês** e
**Nome em espanhol** e selecione **Salvar traduções** no próprio registro.
Os textos salvos passam a aparecer no cardápio, carrinho e checkout do Room
Service; nomes operacionais, preços, limites e opções permanecem preservados.
Um campo vazio usa o nome em português naquele idioma.

Se outra pessoa salvar o mesmo registro ou alterar seu nome em português,
recarregue a página e revise antes de gravar. A tela sinaliza traduções cujo nome
original mudou. O acesso exige perfil editor ou administrador com a permissão
comercial já utilizada no Room Service do Bugan. Esta área não edita o Filipe nem
conteúdo de outro hotel.

Para editar os textos editoriais, selecione **Descrições de produtos** ou
**Títulos de categorias** em **Tipo de conteúdo**. A descrição mostra o nome do
produto e o texto original para conferência, com caixas maiores para inglês e
espanhol. A categoria mostra seu título e o cardápio de origem. Salve cada
registro em **Salvar traduções**; a edição vale somente para o Room Service.

Descrições aceitam até 10.000 caracteres e quebras de linha; títulos de categorias
aceitam até 160 caracteres, em uma linha. Um campo vazio mantém o texto original
naquele idioma. Alterações simultâneas ou mudanças no texto original exigem
recarregar e revisar antes de salvar. Os textos já revisados são carregados como
valores iniciais; o que for salvo pelo hotel passa a ter precedência. O português
do cadastro compartilhado com o Filipe, os preços e as regras não são alterados.

### Tradução automática comercial — candidato local, não publicado (26/11/2026)

[IMPLEMENTADO E CONFIRMADO NO CÓDIGO] Nos rascunhos de **Combos e adicionais** do
Room Service do Bugan, salvar nomes em português gera inglês e espanhol para o
combo, seus grupos de escolhas, grupos de adicionais e opções. Requer o recurso
de idiomas já habilitado. O salvamento não ativa o rascunho.

Textos identificados como **Tradução automática** podem ser ajustados em **Editar
traduções do Room Service**. Salvar nessa área protege as duas traduções contra
novas gerações automáticas, inclusive um campo vazio deixado para usar português.
Os textos revisados anteriores também são protegidos. Se o português mudar,
uma tradução revisada é mantida para revisão; o hóspede não recebe o texto antigo
como se estivesse atualizado. Nomes automáticos acompanham mudanças em português.

Se o tradutor falhar, o rascunho em português continua salvo e o Admin informa
traduções pendentes. Reabrir e salvar o rascunho tenta completar os idiomas
automáticos pendentes; também é possível completar e revisar os textos manualmente.
Uma gravação concorrente exige recarregar e conferir. Preços e regras não são
enviados ao tradutor. Esta versão foi validada somente no laboratório local com
provedor sintético; a aplicação e a migration ainda não foram publicadas.

Atualização de publicação: o candidato foi autorizado e publicado com a migration.
O tradutor real foi conferido no Admin com rascunho temporário inativo. Termos
iguais aos nomes já revisados do Bugan reutilizam a tradução aprovada quando o
par EN/ES não é ambíguo; os demais nomes usam o tradutor externo. Assim,
**Refrigerante** mantém **Soft drink / Refresco**. Traduções revisadas pelo hotel
continuam tendo precedência. Novos textos gerados ainda devem ser conferidos.
