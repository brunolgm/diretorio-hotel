# LibGuest: guia rápido do admin

## Objetivo
Servir como referência curta para a operação diária do painel administrativo do LibGuest.

## Ordem recomendada de uso
1. revisar informações do hotel
2. revisar serviços
3. revisar departamentos
4. revisar políticas
5. validar a rota pública

## Rotina recomendada

### Informações do hotel
- conferir nome, cidade, horários e contatos
- revisar links principais
- confirmar logo, preset visual e cor de destaque
- revisar subdomínio público quando aplicável

### Serviços
- manter títulos curtos e claros
- revisar CTA e link de destino
- ativar apenas itens prontos para o hóspede

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
- pode revisar e editar hotel, serviços, departamentos e políticas

### Editor
- acessa o painel do hotel
- pode editar informações do hotel, identidade visual e configurações operacionais do cadastro principal
- não gerencia usuários

### Operador
- acessa o painel do hotel
- pode criar e manter serviços, departamentos e políticas
- não gerencia usuários nem configuração principal do hotel

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

## Tradução
- português continua sendo a base canônica
- inglês e espanhol são gerados no save
- se houver falha de tradução, o conteúdo em português continua publicado

## Validação rápida após mudanças
1. abrir a rota pública no celular
2. revisar hero, serviços, contatos e políticas
3. testar botões principais
4. validar idioma quando necessário

## Rotina após entrega ao cliente
- revisar ajustes iniciais enviados pelo hotel
- manter contatos, horários e links atualizados
- revisar analytics básicos para entender os primeiros acessos
- usar o handoff como referência quando houver nova revisão operacional
- evitar publicar conteúdo ainda não aprovado pelo hotel

## Naming atual
- produto atual: `LibGuest`
- domínio operacional atual: `guestdesk.digital`
- `GuestDesk` deve ser tratado como naming legado

## Diagnóstico operacional rápido
- quando um save falhar, revisar primeiro campos obrigatórios, links e contexto do hotel atual
- quando o upload de logo falhar, revisar formato, tamanho e tentar novamente com arquivo mais leve
- quando a tradução falhar parcialmente, lembrar que o conteúdo em português continua publicado e usar retraduzir depois do ajuste final
- olhar primeiro o toast exibido na tela e depois os logs do servidor/preview com contexto de módulo, ação, operação, `hotelId` e `targetId`
- nunca expor em log: senhas, tokens, secrets, payloads completos ou dados privados desnecessários
