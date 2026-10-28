# Bugan Recife — refinamento Public Experience V3

[IMPLEMENTADO E CONFIRMADO NO CÓDIGO] A composição V3 mantém os seis destinos canônicos e encurta somente os labels do header: Início, Hotel, Serviços, Gastronomia, Turismo, Voos e Contato, com equivalentes EN/ES. Logo oficial sem recoloração/deformação: caixa desktop 220 × 66 px e mobile 166 × 49,8 px; Recife é identificação tipográfica separada.

Hero: fonte real preservada; título configurável como nome do hotel elimina a repetição de boas-vindas sem editar mídia/traduções. Manifesto define focal desktop 50% / 0%; o focal mobile original 55% / 50% permanece independente. Foto/overlay desktop iniciam abaixo do header. Overlay V3: gradiente esquerdo rgba(24,20,17,.61), .18 em 45%, transparente em 76%; gradiente inferior .28 até transparente em 54%. Nenhuma máscara uniforme, geração, recoloração de foto ou upscale.

Fachada, Filipe e acomodação continuam reais, com cópia e CTAs preservados. Ajustes de escala, proporção, padding, overlay, cards, margens e footer são de apresentação. Fontes licenciadas continuam ausentes; mantidos os fallbacks existentes, sem downloads de terceiros.

## Configuração compartilhada

Nova tabela opcional hotel_public_presentation e RPC save_current_hotel_public_presentation. Nenhum seed, baseline, entitlement ou lifecycle é alterado pela migration. RPC deriva tenant da sessão, exige editor ativo/appearance, trava hotel, aplica revisão PT409, valida JSON/path e registra audit. Leitura pública exige hotel ativo + core.directory + experience.appearance. Preview autenticado continua próprio tenant/RLS.

Editor em /admin/hotel/apresentacao, acessível por Hotel → Mídia e conteúdo da experiência pública → Editar benefícios e cards editoriais. Textos PT/EN/ES, ícones, cards e focal desktop são configuráveis. Upload valida assinatura/MIME/dimensões/pixels e 2 MiB agregados antes da primeira escrita; usa Storage server-only, paths novos e upsert false. Respostas incertas preservam arquivos; imagens anteriores não são removidas automaticamente.

Benefícios: localização privilegiada, acomodações modernas, piscina na cobertura, academia e bem-estar. Dados específicos do Bugan estão no manifesto docs/bootstrap/bugan-public-v3-refinement-20261028.json, fora do JSX compartilhado.

Cards de Turismo são camada editorial ilustrativa, não atrações ou ofertas operacionais inventadas. Praça de Boa Viagem e Shopping Recife permanecem no domínio canônico sem alterações. Os quatro cards levam ao catálogo canônico, respeitam entitlement + item publicado e suportam 2/3/4/7 itens testados, até 16 configuráveis. Mobile usa scroll horizontal sem biblioteca adicional.

## Assets editoriais aprovados

Extração pixel a pixel, WebP lossless, exclusivamente dos quatro visuais de Turismo do golden-master-public-v3.png. Nenhuma fotografia real foi substituída e o golden inteiro não será enviado ao Storage. Os recortes são thumbnails limitados pela resolução da referência; não há reconstrução nem upscale de arquivo. Manifesto de origem/crop: docs/references/bugan/public-v3/tourism/manifest.json.

Bucket hotel-assets. Paths determinísticos abaixo são aplicados pelo executor autenticado; existência real e status de aplicação são registrados em out/bugan-v3-refinement-applied.json e verificados por leitura.

| Arquivo | Bytes | Dimensões | SHA-256 | Path |
|---|---:|---|---|---|
| praia-boa-viagem.webp | 20606 | 138 × 80 | 2abbba7b34a31a777934c65b69084960ff964700bb2e565039b82edad9471753 | 5eb7d695-ccf7-4594-b9df-fc46aaa25695/hero/editorial/2abbba7b-34a3-4a77-8934-c65b69084960.webp |
| centro-historico.webp | 20888 | 144 × 80 | 89f0b035a09947029c658c35460d788a83df80e1c28d8a6328215d754debcfc4 | 5eb7d695-ccf7-4594-b9df-fc46aaa25695/hero/editorial/89f0b035-a099-4702-8c65-8c35460d788a.webp |
| passeios-culturais.webp | 18342 | 149 × 80 | f9b7a5ec2804b6302eac7dd6d59e5bba19463300c1a745a84a093ba63c01f14e | 5eb7d695-ccf7-4594-b9df-fc46aaa25695/hero/editorial/f9b7a5ec-2804-4630-8eac-7dd6d59e5bba.webp |
| cultura-local.webp | 24056 | 147 × 80 | 2dfa074f8c5e5b015b5e982e17ace2c54b499ef88984c036ee1474122228ed5b | 5eb7d695-ccf7-4594-b9df-fc46aaa25695/hero/editorial/2dfa074f-8c5e-4b01-8b5e-982e17ace2c5.webp |

## Validação

[APROVADO] 17 testes direcionados; security 428/428; TypeScript OK; lint 0 erros / 4 warnings históricos; build OK. Matriz SQL local com rollback cobre payload, roles, RLS, isolamento, audit, revisão e preservação de hotéis/profiles/entitlements. Executor de aplicação: 4 mocks sem rede/credenciais reais (sucesso, tenant incorreto, módulo desabilitado, conflito).

[APROVADO] 45 cenários de navegador local e gate de Turismo: cinco marcas, PT/EN/ES, ausência de overflow, drawer, seis acessos, quatro imagens carregadas, layouts 2/3/4/7 cards e reordenação do editor preservando arquivo selecionado. Screenshots das outras quatro marcas são idênticas pixel a pixel ao renderer b08d73f no mesmo laboratório, não uma alegação de homologação visual de hotéis reais.

Capturas full-page obtidas com viewports 1440 × 900, 1536 × 864, 390 × 844 e 430 × 932:
- out/v3-refinement/bugan-1440x900.png
- out/v3-refinement/bugan-1536x864.png
- out/v3-refinement/bugan-390x844.png
- out/v3-refinement/bugan-430x932.png

Fixtures usam o renderer real, fontes/fotos aprovadas e serviços locais sem sessão/DB/Google. Harness: tests/browser/public-v3-refinement.mjs; TOOL_NODE_MODULES aponta para esbuild temporário; V3_BROWSER_CHANNEL=msedge usa perfil headless isolado. Nunca acessa a sessão Edge do usuário. Relatório: out/v3-refinement/browser-report.json.

## Aplicação e checkpoint

Commit/deploy/smoke e status real são registrados em out/v3-refinement/release-report.json. A configuração do tenant e os quatro uploads dependem de execução autenticada canônica, com senha apenas no prompt local de out/apply-bugan-v3-refinement.ps1. Nenhuma impersonação, criação de usuário, DML de governança ou service-role para associar dados. O service-role operacional é usado somente para Storage depois de validar a sessão/tenant/módulos.

[IMPLEMENTADO PARCIALMENTE] Até a confirmação desse executor, o código compartilhado pode estar publicado, mas os benefícios, cards e override desktop ainda não estão associados ao tenant. Não confundir screenshots de fixture com estado autenticado em produção.

[NÃO CONFIRMADO] Aprovação humana final da experiência autenticada em https://libguest.digital/preview. O hotel permanece suspended; somente banner e UHs/QR continuam recomendações legítimas. Não ativar nesta entrega.

Arquivos de implementação: components/public/public-experience-overview.tsx, components/public/bugan.css, lib/public-presentation.ts, lib/public-hotel-data.ts, lib/authenticated-hotel-preview.ts, components/public/hotel-public-page-content.tsx, app/admin/hotel/apresentacao/*, components/admin/presentation-editor.tsx, app/admin/hotel/page.tsx, types/database.ts e a migration 20261028230359. Fixtures, matrizes e referências são testes/ferramentas permanentes; out/* contém somente artefatos locais e não entra no commit.

Grand Mercure, Novotel, Mercure, Bugan e Default permanecem clientes canônicos; a nova apresentação não aplica visual Bugan às demais marcas. Branches históricas de Sprint 52 e Bugan são preservadas. Nenhuma IA, REC/SBRF, Wi-Fi, horário, UH, serviço, departamento, política, administrador, slug, subdomain, brand ou tradução aprovada é alterada.
