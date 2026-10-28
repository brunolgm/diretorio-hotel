# Bootstrap autenticado de hotel existente

## Contrato e autorização

Infraestrutura compartilhada; dados específicos ficam em manifestos revisados.
Não é um endpoint público nem um seed SQL avulso. O executor Node faz login normal
no Supabase Auth; a RPC recebe hotel alvo e repete no banco a validação de administrador
ativo do próprio hotel. Platform Admin sem profile do hotel não ganha essa permissão.
Não se gera magic link, JWT, identidade ou contexto impersonado. Só draft/suspended;
nenhuma ativação, alteração de entitlements ou de administradores faz parte do fluxo.

`apply_current_hotel_bootstrap` aplica cada lote atomicamente e mantém um registro
privado por hotel/namespace/chave. Repetição preserva IDs; manifesto alterado, registro
preexistente sem proveniência, exclusão ou edição humana posterior geram PT409.
Não há upsert destrutivo sobre conteúdo criado fora do bootstrap. Campos de hotel
preenchem apenas lacunas. Turismo e mídia usam suas RPCs canônicas; editoriais usam
as mesmas tabelas, campos e constraints do Admin, em uma transação autenticada.

Storage é feito exclusivamente pelo operador server-side, com credencial operacional
já configurada e autenticação do hotel validada antes de upload. Caminhos são do hotel,
slot e hash de conteúdo; arquivos existentes precisam ter o mesmo SHA. Upsert=false.
Nenhuma falha ou resposta ambígua dispara exclusão de arquivo. Reexecução pode confirmar
a associação anterior sem duplicar; conflitos exigem leitura antes de nova tentativa.
Golden master e SVG não são enviados. Validação reutiliza MIME/assinatura/dimensões/
pixels do projeto; editoriais limitados a 2 MiB por upload individual.

O catálogo global de aeroportos já permite insert/update somente ao service_role
server-side. `ensureCatalogAirport` é um helper operacional insert-only sobre esse
contrato: valida dados, confirma leitura após concorrência/resposta incerta e recusa
qualquer divergência de registro existente. O arquivo de origem deve ser revisado.
Nenhuma permissão de catálogo é delegada ao navegador ou ao admin do hotel.

## Execução local

Requer Node 22.15+ e as dependências existentes. O operador usa o ambiente server-side
local já autorizado e vinculado ao projeto, nunca distribui service role ao hotel.
O executor verifica project ref/URL antes de rede. Não copiar chaves para comandos.

Plano offline, sem login/escrita:

```powershell
node --conditions=react-server scripts/bootstrap-hotel.mjs --plan --manifest docs/bootstrap/bugan-recife-20261028.json --media-root out/bugan-activation/media
```

Execução real autorizada do Bugan, ainda suspended:

```powershell
powershell -NoProfile -File scripts/bootstrap-hotel.ps1 -Manifest docs/bootstrap/bugan-recife-20261028.json -Email libguestbugan@yahoo.com -MediaRoot out/bugan-activation/media
```

O wrapper verifica arquivos antes de pedir a senha. `Read-Host -AsSecureString`
recebe senha oculta; credenciais vão somente pelo stdin privado do processo Node.
Não vão em argumentos, ambiente, arquivos, relatório, audit ou logs. O processo mantém
sessão em memória e encerra apenas a sessão local, preservando outras sessões/contas.
Nunca informar senha no chat. Não executar sob ferramentas que capturem entrada privada.

Primeiro lote: dados/slug/editoriais/Turismo/Voos. Segundo: quatro slots V3 com links
para os serviços efetivamente criados. Ambos são idempotentes. Traduções são etapa
separada: PT já confirmado nunca é revertido; ausência/falha do provider vira pendência.
Relatório regenerável: `out/bootstrap-<hotel-id>.json`, ignorado pelo Git, sem credenciais.
Se a execução interromper, conferir o estágio/estado por leitura antes de repetir.

## Idiomas, slug e preview

EN/ES reutilizam o Google server-side existente e o mesmo batch; nunca se traduz na
leitura pública ou no preview. Persistência verifica fonte/revision. Tradução existente
é preservada pelo bootstrap; parcialidade existente é pendência. V3 ganhou campos
editoriais EN/ES com fallback por campo. Editar texto PT invalida derivados; salvar
mídia pelo Admin executa tradução save-time. Falha mantém PT e exibe warning.

Slug: `/admin/hotel/slug` ou RPC autenticada `update_current_hotel_slug`. Administrador
somente em preparação; validação/unicidade/revisão/audit. ID, subdomain e roomToken
preservados. Alias privado reserva o slug anterior contra reaproveitamento por outro
hotel e só resolve conteúdo publicamente ativo com core.directory. Não há abertura
de hotel suspenso por alias.

Prévia compartilhada: `https://libguest.digital/preview`, sessão editor/admin do hotel,
entitlements experience.preview + core.directory. Nenhum hotel_id vem da URL; usa RLS,
só conteúdo elegível/publicado e a mesma composição pública. Sem roomToken ou analytics,
sem Google na leitura, force-dynamic/noindex. Não torna hotel suspenso público.
A aba `/admin/experiencia?tab=preview` usa essa rota durante preparação.
Destinos de CTAs continuam sendo os destinos públicos reais, sujeitos ao lifecycle.
Homologação visual nos quatro viewports exige revisão humana; não se automatiza browser.

## Manifesto Bugan e fontes

`docs/bootstrap/bugan-recife-20261028.json`, snapshot aprovado de 28/10/2026. Inclui 13
serviços, três departamentos, duas políticas, dois itens Turismo, configuração REC,
quatro slots V3 e logo oficial. Arquivos otimizados reais têm hashes fixados no manifesto.
Dados institucionais/endereço/telefones ficam em conteúdo editável porque esses campos
separados não existem em hotels; horários/SSID usam seus campos canônicos existentes.
Café da manhã não é duplicado no Restaurante Filipe; remete às informações rápidas.

Fontes: página oficial Let's Atlantica, descubraobugan.com e fotografias aprovadas.
REC/SBRF e ARP 080735S 0345522W: DECEA eAIP vigente 01/10/2026,
https://aisweb.decea.mil.br/eaip/20-2026_2026_10_01/eAIP/AD%202%20SBRF-pt-BR.html.
Nome IATA: portal oficial Investe Recife, https://investerecife.recife.pe.gov.br/aeroporto/.
Timezone America/Recife validada pelo catálogo IANA do runtime. Links oficiais de
partida/chegada, tempos, antecedências e margens ficam vazios. Ações de pedido não
são habilitadas. Textos padrão de Voos já localizados evitam copy PT concorrente.

Não há UHs inventadas, WhatsApp, senha Wi-Fi fixa, IA, promoção, horário conflitante
de música, preço de estacionamento ou comunicado fictício. Banner vazio pode ser
recomendação legítima; readiness não é enfraquecido. Fontes licenciadas ausentes usam
fallback aprovado. Focais iniciais exigem revisão no golden master; não são homologados
por mera gravação no banco.