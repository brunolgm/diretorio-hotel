# LibGuest: playbook de novo hotel

## Objetivo

Configurar e homologar um hotel no LibGuest com baixo risco, conteúdo mínimo claro e isolamento em relação aos demais hotéis.

## Premissas de segurança

- cada usuário administrativo pertence a um único `hotel_id`
- não reutilizar perfil, conteúdo, slug, subdomínio ou roomToken entre hotéis
- nunca usar dados pessoais reais em homologação
- criação de hotel e administrador inicial ocorre pelo procedimento operacional aprovado, fora do painel atual
- o painel permite configurar somente o hotel vinculado ao perfil autenticado

## Ordem recomendada no painel

1. revisar informações do hotel, cidade, horários, contatos e identidade visual
   - quando a assinatura institucional diferir do nome operacional, registrar o override no catálogo de identidade e validar o mesmo texto nos três idiomas
2. cadastrar e ativar ao menos um serviço
3. cadastrar e ativar ao menos um departamento
4. cadastrar e ativar ao menos uma política
5. cadastrar comunicados e banners apenas quando houver conteúdo aprovado
6. cadastrar apartamentos e validar seus links antes de distribuir novos QRs
7. revisar traduções PT/EN/ES e o fallback em português
8. homologar a experiência pública no celular e no desktop

O dashboard apresenta uma checklist leve dos quatro itens essenciais. Comunicados, banners e apartamentos são recursos operacionais importantes, mas não são tratados como obrigatórios para todos os hotéis.

## Endereços públicos

- domínio principal: `https://{subdomain}.libguest.digital`
- domínio legado compatível: `https://{subdomain}.guestdesk.digital`
- fallback seguro: `/hotel/[slug]`
- slug e subdomínio são identificadores operacionais; não devem ser alterados durante configuração rotineira

## Bandeira e preset visual

- o preset salvo controla apenas a camada visual; não altera conteúdo, permissões ou rotas
- os cinco presets legados continuam sendo as únicas opções operacionais no admin
- `novotel` e `grand-mercure` possuem experiências públicas implementadas, mas sua ativação continua manual e homologada por hotel; `libguest-signature` e `mercure` permanecem foundation-only
- no futuro painel interno de provisionamento, bandeiras homologadas usarão o preset próprio; hotéis independentes, outros segmentos e clientes sem bandeira homologada usarão `libguest-signature`
- `custom` está reservado para evolução futura e ainda não é um preset operacional
- até existir esse painel, nenhuma associação de preset foundation deve ser automática ou feita por edição comum no admin
- nunca inferir bandeira por nome, slug ou subdomínio do hotel
- consultar `guestdesk-brand-design-system.md` antes de planejar ativação ou troca de preset
- uma troca futura de preset deve ser deliberada, reversível e validada no celular e desktop

## Conteúdo mínimo para homologação

- hotel: nome, cidade, check-in, check-out e ao menos um canal principal
- serviços: ao menos um item ativo com ação e destino revisados
- departamentos: ao menos um canal ativo com horário e link revisados
- políticas: ao menos uma orientação ativa
- idiomas: português revisado e EN/ES validados quando houver tradução salva
- apartamento, quando aplicável: número, roomToken ativo e link de cardápio correto
- comunicado e banner, quando aplicáveis: janela de publicação, status e conteúdo aprovados

## Homologação multi-hotel oficial

Validar separadamente, sem copiar IDs ou tokens entre os ambientes:

| Hotel | Slug fallback | Subdomínio |
| --- | --- | --- |
| Novotel Salvador Rio Vermelho | `novotelrv` | `novotelsalvador` |
| Grand Mercure Rio de Janeiro Copacabana | `grandmercureriocopacabana` | `grandmercurecopacabana` |
| Novotel Rio de Janeiro Leme | `novotelrioleme` | `novotelleme` |
| Mercure Rio Boutique Copacabana | `mercurerioboutiquecopacabana` | `mercurerioboutique` |

Para cada hotel:

1. entrar com um perfil vinculado exclusivamente ao hotel esperado
2. confirmar o nome exibido no dashboard e em `/admin/hotel`
3. revisar as listas administrativas e garantir que não exibem conteúdo dos outros hotéis
4. abrir slug, subdomínio principal e, quando necessário, domínio legado
5. validar conteúdo, idiomas, analytics e links sem gerar dados pessoais reais
6. testar um QR já distribuído antes de qualquer rotação de roomToken

## QR por apartamento

- atualizar o link de cardápio não exige reimpressão se o roomToken permanecer igual
- regenerar o token somente para invalidar intencionalmente o QR anterior
- sempre testar o QR existente, o hotel resolvido e o destino final após alterações

## Fechamento

- registrar pendências específicas do hotel
- executar `guestdesk-post-deploy-validation.md`
- usar `guestdesk-client-handoff.md` antes da entrega
- não considerar o ambiente pronto apenas porque a rota abre; conteúdo, links e isolamento também precisam ser confirmados
