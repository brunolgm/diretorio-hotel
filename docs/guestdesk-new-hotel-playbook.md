# GuestDesk: playbook de novo hotel

## Objetivo
Este playbook serve para subir um novo hotel no GuestDesk sem depender de memória ou improviso.

## Resultado esperado
Ao final, o hotel deve ter:

1. acesso administrativo
2. slug público funcionando
3. dados principais configurados
4. serviços publicados
5. departamentos publicados
6. políticas publicadas
7. validação básica concluída

## Etapa 1: preparar o hotel no banco
1. Criar o registro do hotel
2. Definir nome
3. Definir slug público
4. Preencher cidade, se aplicável
5. Confirmar se o slug está correto e amigável

## Etapa 2: preparar o usuário admin
1. Criar ou associar o usuário no auth
2. Garantir que existe registro em `profiles`
3. Associar `hotel_id`
4. Garantir papel compatível com acesso admin

## Etapa 3: entrar no painel
1. Fazer login
2. Abrir `/admin`
3. Confirmar se o hotel correto está carregando

## Etapa 4: configurar informações principais
No módulo de hotel:

1. Nome
2. Cidade
3. Horários de check-in e check-out
4. Café da manhã
5. Wi-Fi
6. Site oficial
7. Link de reservas
8. Instagram
9. WhatsApp
10. Logo

## Etapa 5: cadastrar conteúdo essencial
### Serviços
Cadastrar pelo menos:

1. Wi-Fi / conectividade
2. Café da manhã
3. Estacionamento ou estrutura relevante
4. Informações importantes de uso

### Departamentos
Cadastrar pelo menos:

1. Recepção
2. Reservas, se aplicável
3. Governança ou suporte, se aplicável

### Políticas
Cadastrar pelo menos:

1. Check-in
2. Check-out
3. Política de não fumar, se aplicável
4. Pets, se aplicável

## Etapa 6: validar tradução
1. Salvar um item em português
2. Confirmar status de tradução no admin
3. Testar página pública em `?lang=en`
4. Testar página pública em `?lang=es`

## Etapa 7: validar página pública
1. Abrir `/hotel/[slug]`
2. Confirmar logo
3. Confirmar links
4. Confirmar serviços
5. Confirmar departamentos
6. Confirmar políticas
7. Confirmar WhatsApp
8. Confirmar layout em mobile

## Checklist de entrega do hotel
1. Login admin funcionando
2. Slug público funcionando
3. Conteúdo mínimo publicado
4. Tradução testada
5. Branding validado
6. Página pública aprovada

## Observações práticas
1. Evitar subir hotel com slug provisório em produção
2. Validar links externos antes de publicar
3. Confirmar se o WhatsApp está em formato correto
4. Confirmar se logo tem qualidade suficiente
