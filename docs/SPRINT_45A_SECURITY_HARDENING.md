# Sprint 45A — Hardening de segurança sem alteração de banco

Data: 10/08/2026

Branch: `sprint-45a-security-hardening`

## Resultado

A Sprint 45A reduziu a superfície de ataque das entradas públicas e administrativas exclusivamente em código. Não houve SQL, migration, alteração de schema, dados, RLS, policies, infraestrutura externa ou deploy.

O diagnóstico inicial confirmou uma boa base de autorização nas server actions — autenticação, papel mínimo, hotel derivado do perfil e mutações normalmente filtradas por `id` e `hotel_id` —, mas encontrou validação permissiva no analytics, uploads baseados no MIME/nome informado pelo cliente, lifecycle incompleto de Storage e compensações frágeis entre Auth e `profiles`.

## Analytics

`/api/analytics` passou a aplicar um contrato fechado antes de persistir qualquer evento:

- somente `POST`; métodos não implementados recebem a resposta padrão de método não permitido do Next.js;
- `Content-Type` deve ser JSON;
- body limitado a 8 KiB, tanto por `Content-Length` quanto durante a leitura do stream;
- UTF-8 inválido, JSON inválido, campos desconhecidos e tipos incorretos são rejeitados;
- allowlist central única: `page_view`, `language_selected`, `whatsapp_click`, `website_click`, `booking_click` e `department_click`;
- slug limitado a 80 caracteres, session ID a 64, URL a 2.048 e valor textual de metadata a 120;
- URLs aceitam apenas HTTP/HTTPS, sem credenciais, e têm fragmento removido;
- `departmentId` exige UUID e só é permitido/obrigatório em `department_click`;
- metadata aceita apenas objeto simples com a chave opcional `label`; arrays, objetos profundos, binários e chaves extras são rejeitados.

O browser não envia mais `hotelId`. A API resolve o hotel pelo slug validado e reconstrói a linha de persistência no servidor. Quando há departamento, a API confirma a associação ao hotel resolvido. O evento legítimo `website_click` permanece no contrato e o nome legado incompatível `banner_click` não é aceito.

Esta camada é o gatekeeper da aplicação, mas a remoção do insert direto permitido pela RLS atual depende da Sprint 45B.

## Uploads e Storage

Logo, hero e banner agora compartilham validação server-side do conteúdo real:

| Uso | Bytes máximos | Dimensões máximas | Pixels máximos |
| --- | ---: | ---: | ---: |
| Logo | 5 MiB | 4.096 × 4.096 | 16 MP |
| Hero | 10 MiB | 8.192 × 8.192 | 40 MP |
| Banner | 2 MiB | 6.000 × 4.000 | 24 MP |

Os formatos permitidos são JPEG, PNG e WebP. O mecanismo implementado é uma validação server-side por assinatura binária, estrutura de cabeçalho, formato, dimensões e consistência de MIME. Arquivo vazio, acima do limite, dimensão zero/absurda, MIME divergente e conteúdo SVG/HTML são recusados. SVGs internos versionados não foram alterados.

Não foi adicionada dependência pesada de imagem. Não há decodificação integral nem re-encode para remover metadata; essas capacidades podem ser avaliadas futuramente com uma biblioteca server-only aprovada.

O nome original não participa do path. Cada objeto recebe UUID aleatório, extensão derivada do conteúdo e isolamento por hotel/categoria, no formato geral `<hotel_id>/<categoria>/<uuid>.<ext>`; banners também incluem o ID do recurso.

O lifecycle segue uma compensação simples:

1. validar conteúdo;
2. gerar path no servidor;
3. enviar o novo objeto sem sobrescrever o anterior;
4. persistir a nova URL;
5. se a persistência falhar, tentar remover o novo objeto;
6. somente após sucesso, tentar limpar o objeto anterior pertencente ao bucket/hotel.

Falhas de cleanup são registradas no servidor sem expor paths internos ao usuário. URLs externas não são removidas. Exclusões de logo, hero e banner também evitam deixar o banco apontando para um objeto já apagado.

Como hardening futuro de baixo risco, deve-se validar a origem e o hostname esperados da public URL antes de extrair um path para operações de remoção no Storage. Essa mudança não foi implementada nesta sprint.

## Auth e profiles

Na criação de usuário, a falha ao criar o profile sempre aciona a tentativa de remover o usuário Auth recém-criado. Falha de compensação é detectada e registrada separadamente, e sucesso parcial nunca é retornado.

Na edição, o profile é atualizado primeiro usando um snapshot mínimo. Se a alteração posterior no Auth falhar, o profile anterior é restaurado quando possível; falhas dessa restauração também ficam explícitas no log técnico. Como Auth e Postgres não compartilham transação, atomicidade forte não é prometida e reconciliação continua necessária.

Exclusão de usuário não foi adicionada nesta sprint porque o painel atual não possui esse fluxo. A concorrência da proteção do último administrador também não foi alterada e permanece para a RPC transacional da Sprint 45B.

## Server actions, IDs, QR e logs

As actions sensíveis continuam derivando hotel e papel no servidor. Operações por recurso confirmam `id` e `hotel_id`; IDs externos de apartamentos, banners, comunicados, departamentos, políticas, serviços e usuários passaram a exigir UUID antes da consulta/mutação. Enums já existentes continuam em allowlists fechadas.

O helper de autorização ganhou uma regra testável de papel mínimo e hotel coincidente. O `roomToken` mantém a geração existente de 18 bytes aleatórios, mas entradas agora precisam ter exatamente 24 caracteres base64url antes de qualquer consulta privilegiada. Respostas inválidas são uniformes e tokens não são incluídos em logs ou erros.

Respostas ao cliente são genéricas e úteis. Logs novos usam códigos/contexto técnico controlado, sem payload integral, token, segredo, stack, SQL ou detalhe da Admin Auth API.

## Testes de segurança

Foi adotado `node:test`, disponível no Node 22 do projeto, sem instalar runner adicional. O script é `npm run test:security`.

Os testes usam apenas fixtures sintéticas e cobrem:

- analytics válido, evento legado/inválido, campo inesperado, `hotelId` arbitrário, metadata profunda, regras por evento, Content-Type e body acima do limite;
- PNG, JPEG e WebP sintéticos válidos, MIME falso, arquivo vazio/acima do limite, dimensões excessivas e SVG/HTML disfarçado;
- geração de path aleatório, isolado e com extensão derivada;
- usuário sem autenticação/contexto, papel insuficiente, administrador A acessando A e tentando atingir B, editor tentando ação de administrador e ID válido de hotel incorreto;
- falha de profile após Auth, compensação chamada, falha da compensação reportada e restauração do profile após falha de Auth;
- formato de UUID e `roomToken`.

Não há acesso a produção, Supabase real, upload real, usuário real, QR real nem segredos nas fixtures. A cobertura ainda não executa cada server action contra um banco mockado; prioriza os contratos puros compartilhados e os cenários negativos de maior risco. Integrações com policies reais pertencem à homologação da Sprint 45B.

## Pendências deliberadas

### Sprint 45B — banco e governança

- baseline completa de RLS e grants;
- migrations de policies e alinhamento de papéis;
- remoção do insert público direto em analytics;
- RPC transacional para a invariante do último administrador;
- audit log persistente;
- revisão/mudança das policies de Storage.

### Sprint 45C — proteção operacional

- rate limit distribuído (Redis/KV ou equivalente);
- monitoramento externo e alertas;
- retenção;
- reconciliação Auth/profile e Storage agendada;
- métricas e resposta operacional a abuso.

Não foi criado um `Map` em memória como falso rate limiter serverless.
