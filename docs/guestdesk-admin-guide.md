# LibGuest: guia rápido do admin

## Objetivo
Servir como referência curta para a operação diária do painel administrativo do LibGuest.

## Ordem recomendada de uso
1. revisar informações do hotel
2. revisar serviços
3. revisar apartamentos e QR
4. revisar departamentos
5. revisar políticas
6. validar a rota pública

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
- domínio operacional atual: `guestdesk.digital`
- `GuestDesk` deve ser tratado como naming legado

## Diagnóstico operacional rápido
- quando um save falhar, revisar primeiro campos obrigatórios, links e contexto do hotel atual
- quando o upload de logo falhar, revisar formato, tamanho e tentar novamente com arquivo mais leve
- quando a tradução falhar parcialmente, lembrar que o conteúdo em português continua publicado e usar retraduzir depois do ajuste final
- quando o cardápio por apartamento não abrir, revisar `service_action_type`, status do apartamento, token ativo e `restaurant_menu_url`
- olhar primeiro o toast exibido na tela e depois os logs do servidor/preview com contexto de módulo, ação, operação, `hotelId` e `targetId`
- nunca expor em log: senhas, tokens, secrets, payloads completos ou dados privados desnecessários
