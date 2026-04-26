# LibGuest: playbook de novo hotel

## Objetivo
Subir e validar um novo hotel no LibGuest com clareza operacional, baixo risco e uma experiência pública pronta para revisão.

## Ordem recomendada
1. criar o hotel e vincular o perfil administrativo ao `hotel_id`
2. confirmar o `slug` público que continuará como fallback seguro
3. definir o subdomínio quando o hotel já estiver pronto para usar um endereço principal mais curto
4. preencher identidade básica do hotel
5. revisar contatos e links principais
6. escolher o preset visual e, se fizer sentido, a cor de destaque
7. validar a experiência pública

## Configuração mínima em `/admin/hotel`
Antes de considerar o hotel pronto para revisão, confirme:
- nome do hotel
- cidade
- WhatsApp ou link principal de contato
- endereço público principal
- preset visual selecionado

## Endereço público
- endereço preferencial: `https://{subdomain}.guestdesk.digital` quando houver subdomínio configurado
- fallback seguro: `/hotel/[slug]`
- o `slug` continua importante mesmo quando o subdomínio já estiver definido

## Tema visual
- o preset visual define a base da experiência pública
- a cor primária opcional afeta apenas acentos seguros
- a logo ajuda a reforçar a identidade do hotel, mas não é obrigatória para publicar
- sem logo, o LibGuest mantém uma apresentação visual padrão segura
- depois de salvar, revisar a experiência pública no celular

## Boas práticas de identidade visual
- prefira logo nítida, limpa e atual
- evite imagem com texto pequeno, fundo poluído ou baixa resolução
- use o preset visual para aproximar a experiência pública da identidade do hotel
- depois de alterar tema, cor ou logo, revise a página pública em celular e desktop

## Validação mínima
1. rota por slug funcionando
2. subdomínio funcionando quando configurado
3. botões principais funcionando
4. tema visual coerente com a identidade do hotel
5. idioma padrão em português
6. traduções EN/ES salvas quando houver conteúdo traduzido

## Passagem para handoff
Depois que a configuração inicial estiver pronta:
- usar `guestdesk-client-handoff.md` como checklist central de entrega
- separar o que já foi validado tecnicamente do que ainda precisa aprovação do cliente/hotel
- registrar para o cliente o endereço preferencial e o fallback por slug
- revisar a experiência pública no celular antes de considerar o ambiente pronto para entrega

## Boas práticas
- começar com conteúdo simples, correto e consistente
- revisar contatos, links e horários finais antes de compartilhar
- validar a experiência pública no celular
- confirmar logo, preset e leitura visual antes de considerar o hotel pronto

## Naming
- produto atual: `LibGuest`
- domínio operacional atual: `guestdesk.digital`
