# Sprint 47 — Multi-Hotel Onboarding

## Objetivo e resultado

A Sprint 47 adiciona ao `/platform` um fluxo controlado para criar uma propriedade, reservar sua identidade pública, aplicar o baseline de módulos e convidar seu primeiro administrador. Todo hotel criado nasce com `platform_status = 'draft'`: aparece no diretório global e permite preparação no `/admin`, mas permanece fora de `public_hotels` e com experiência pública/QR bloqueados pelas regras homologadas nas Sprints 46C e 46.8.

Não há ativação automática, workflow adicional de onboarding nem alteração das regras públicas existentes.

## Arquitetura

O fluxo tem duas fronteiras deliberadamente separadas:

1. A server action, protegida por `requirePlatformAccess()`, valida o formulário e usa o cliente Admin server-only apenas para `inviteUserByEmail`.
2. A sessão real do `platform_admin` chama `create_platform_hotel_onboarding(...)`. A RPC executa toda a mutação de banco e o audit em uma única transação.
3. Se a RPC falhar depois do convite, a server action remove o usuário Auth criado. Falha nessa remoção produz uma mensagem específica de compensação incompleta e exige reconciliação administrativa.
4. Se a RPC concluir, nenhuma compensação Auth é executada e o usuário é redirecionado ao detalhe do hotel.

Esse desenho preserva `auth.uid()` como ator real do audit. A service role não cria hotel, profile ou entitlement e nunca chega ao browser.

## Fluxo de interface

A rota `/platform/hoteis/novo` contém cinco etapas:

1. **Identidade:** nome, cidade, bandeira canônica e tema já suportado.
2. **Endereço:** slug editável e subdomínio, ambos gerados como sugestão e validados novamente no servidor e no banco.
3. **Módulos:** catálogo completo de 19 módulos; os 11 do baseline aparecem como incluídos e os oito futuros como “Em breve”, sem toggle.
4. **Administrador:** nome completo e e-mail. Nenhuma senha é solicitada ou armazenada.
5. **Revisão:** identidade, endereço, lifecycle inicial, baseline e administrador, com confirmação explícita de que o hotel não será público antes da ativação.

Após sucesso, o detalhe global mostra “Hotel criado em preparação” e os próximos passos. A ativação futura reutiliza `update_platform_hotel_status` da Sprint 46C.

## Contrato da RPC

`public.create_platform_hotel_onboarding(text,text,text,text,text,text,uuid,text,text)` é `SECURITY DEFINER`, usa `search_path = ''`, tem `EXECUTE` somente para `authenticated` e valida internamente:

- `auth.uid()` associado a `platform_users(role = 'platform_admin', is_active = true)`;
- limites e formatos de todos os campos;
- `brand_code` em `NULL`, `mercure`, `novotel` ou `grand-mercure`;
- `theme_preset` no conjunto já suportado pela aplicação;
- existência do usuário em `auth.users` e correspondência normalizada do e-mail;
- ausência de associação em `platform_users` para o administrador inicial;
- ausência de profile hotel-scoped incompatível;
- unicidade concorrente de slug e subdomínio.

Dentro da mesma transação, a RPC:

- cria o hotel em `draft`;
- cria exatamente os 11 entitlements habilitados;
- associa um profile ativo com role hotel-scoped `administrador`;
- registra um evento `hotel.created` pelo writer controlado.

Um profile vazio criado automaticamente pelo hook de Auth (`hotel_id IS NULL`) pode ser preenchido. Um profile já associado a hotel ou qualquer associação global é rejeitado. Isso não introduz suporte a usuário multi-property.

## Slug e subdomínio

O slug é lowercase, sem acentos, contém apenas `[a-z0-9-]`, não aceita hífens duplicados/nas extremidades e tem entre 3 e 64 caracteres. O subdomínio segue o contrato DNS atualmente suportado, tem entre 3 e 32 caracteres e rejeita nomes reservados (`www`, `app`, `admin`, `api`, `guestdesk`). A interface mostra apenas um preview em `https://<subdomain>.libguest.digital`; DNS não é provisionado.

A migration exige as garantias UNIQUE já auditadas para `hotels.slug` e `hotels.subdomain` e aborta diante de drift. A checagem prévia melhora a mensagem, enquanto o tratamento de `unique_violation` cobre a race condition com erros canônicos:

- `platform_hotel_slug_conflict`
- `platform_hotel_subdomain_conflict`

## Baseline canônico

O contrato TypeScript compartilhado `BASELINE_MODULE_KEYS` contém:

- `core.directory`
- `content.services`
- `content.departments`
- `content.policies`
- `content.announcements`
- `content.banners`
- `rooms.qr`
- `content.languages`
- `experience.appearance`
- `experience.preview`
- `analytics.basic`

Continuam apenas informativos: `experience.navigation`, `experience.seo`, `fb.menu`, `content.tourism`, `analytics.advanced`, `integrations.thex`, `integrations.opera` e `audit.access_logs`.

## Auth, convite e primeiro login

O fluxo escolhido é convite do Supabase Auth, para que o administrador defina o próprio acesso. Usuários Auth já existentes são rejeitados nesta Sprint com “Já existe um usuário com este e-mail.”; vinculação segura de identidade preexistente fica pendente. O destino após autenticação segue a precedência já homologada: usuário somente com profile de hotel entra em `/admin`, não em `/platform`.

O `redirectTo` do convite é construído exclusivamente no servidor. Produção usa `https://libguest.digital/login`; o laboratório aceita somente os origins conhecidos `http://127.0.0.1:54321` e `http://localhost:54321` do Supabase local e direciona para `http://localhost:3000/login`. Host, Origin, query string e FormData não influenciam o destino. `/login` foi escolhido porque não existe uma rota dedicada de confirmação/recovery no fluxo Auth atual.

O envio efetivo do convite e a permissão desses URLs na allowlist do Supabase devem ser confirmados na homologação, sem mudar o contrato de autorização.

## Audit e rollback

Há um único evento `hotel.created`, suficiente para representar a operação atômica. Sua metadata rasa contém somente:

```json
{
  "brand_code": "grand-mercure",
  "baseline_modules": 11
}
```

E-mail, nome, senha, tokens e URLs sensíveis não entram no audit. A RPC reutiliza `record_platform_audit_event(...)`; não insere diretamente em `platform_audit_log`. Falha do writer reverte hotel, entitlements e profile.

O banco fornece atomicidade entre seus quatro objetos. A fronteira Auth é coberta pela compensação server-side. Se a compensação também falhar, o erro não é ocultado e o ID técnico do usuário é registrado apenas no log do servidor para reconciliação.

## Segurança e preflight

A migration aborta se a RPC já existir ou se contratos conhecidos de `hotels`, `profiles`, `platform_users`, entitlements, unicidade, catálogo 46.8 ou audit writer tiverem driftado. As 19 module keys são extraídas com suporte a `_`, ordenadas e comparadas como array exato; chave ausente, extra ou diferente interrompe o preflight. Para os hotéis existentes, o baseline exige a presença das 11 associações, mas preserva legitimamente qualquer `is_enabled = false`. Ela não cria policy global em `hotels`, não concede DML direto ao browser e não amplia a leitura global das tabelas base.

Hotel admin, usuário global inativo e anônimo não podem criar hotéis. O cliente não escolhe `hotel_id`, lifecycle ou ator. `platform_status` é fixado como `draft` dentro da RPC.

## Testes preparados

- `47_multi_hotel_onboarding_rls_verification.sql`: catálogo, assinatura/grants, preflight, unicidade, isolamento de tabelas, lifecycle público, baseline e audit.
- `47_multi_hotel_onboarding_behavioral_matrix.sql`: anônimo, hotel admin, platform admin inativo/ativo, criação draft, 11 entitlements, profile inicial, diretório global, isolamento público, conflitos sem estado parcial e rollback forçado do audit.
- `platform-onboarding.test.ts`: geradores, validação do wizard, catálogo, compensação completa/incompleta, separação service-role/sessão, redirect e ausência de ativação automática.

Os scripts SQL são destinados exclusivamente a banco local descartável e usam `BEGIN/ROLLBACK`. Eles não são executados durante a implementação inicial.

## Limitações e decisões futuras

Ficam fora desta Sprint: vinculação de usuário Auth existente, reenvio/gestão de convites, multi-property user, grupos/redes, prontidão calculada, billing, planos, contratos, DNS, integrações e módulos funcionais marcados como “Em breve”.

A futura gestão comercial poderá governar quais módulos disponíveis compõem um plano, mas não deve enfraquecer o catálogo técnico, o lifecycle ou as garantias transacionais criadas aqui.
