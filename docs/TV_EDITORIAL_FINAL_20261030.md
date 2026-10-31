# TV e Canais — acabamento final

Data de referência: 30/10/2026 (America/Sao_Paulo).

## Implementado e confirmado no código

- Cinco passos preservados. Redação PT/EN/ES aprovada no manifesto
  `bootstrap/bugan-tv-editorial-final-20261030.json`: ligar LG, selecionar HDMI,
  verificar NET, abrir Mosaico e escolher canal. HDMI varia por apartamento;
  Mosaico continua identificável no controle físico.
- Fotos originais LG/NET preservadas, sem recortes ou marcações de coordenadas
  não verificadas. Ampliação em diálogo nativo com Escape, foco devolvido ao
  acionador e botão de fechar traduzido.
- Detalhes completos omitidos somente quando vazios, iguais às instruções
  estruturadas ou ao texto exato de preparação editorial. Descrições adicionais
  úteis e Serviços sem guia continuam aparecendo, independentemente do hotel.
- Último passo de guias sem canais abre ajuda; TV continua abrindo a lista.
- Busca antes da paginação, 12 canais/página e aplicativo Netflix preservados.
- Nenhuma alteração de schema, RLS, Auth, lifecycle, entitlements, QR, roomToken,
  AirLabs, cache, quota ou formulários administrativos.

## Validação

- Segurança: 531/531 testes, incluindo negativas de preview e isolamento.
- Navegador: 127 cenários finais, 44 TV/canais e 148 Guias/Admin.
- PT/EN/ES nos tamanhos 360×640, 375×667, 390×645, 390×844, 430×932,
  768×1024, 1024×768, 1440×900 e 1536×864.
- Fotos decodificadas e proporção comparada; cinco etapas, progresso, foco,
  diálogo, Escape, CTA, rolagem e ausência de overflow horizontal verificados.
- Contrato do dock observado: static abaixo de 768, fixed no desktop.
  Não foi identificado defeito real que justificasse mudar o dock.
- Outros guias e seis temas testados; descrições úteis preservadas.
- Busca sportv = seis canais; 539 = um; Netflix = aplicativo. Paginação,
  formatos não confirmados e estado vazio cobertos pela regressão TV.
- TypeScript e build aprovados. Lint: zero erros e quatro avisos preexistentes
  de imagens. `git diff --check` aprovado.
- Evidências locais ignoradas pelo Git: `out/hotfix-*.log`,
  `out/tourism-v4/tv-final-acceptance.json`, `tv-final-report.json`,
  `tv-premium-report.json`, `guides-report.json`,
  `tv-final-step5-390x645.png`, `tv-final-step5-1440x900.png` e fotos ampliadas.

Os testes de componentes usam fixtures isoladas; não comprovam uma sessão
administrativa real, operação física ou gravação dos textos no banco.
Leitor de tela humano, teclado virtual de dispositivo físico e homologação
operacional permanecem não confirmados; a estrutura ARIA e o foco foram testados.

## Confirmado por leitura de produção

Checkpoint: Bugan active, dois administradores ativos, 13 Serviços habilitados,
quatro Guias do Quarto desabilitados, zero guias publicados, 222 registros no
rascunho de TV. O guia de TV permanece na revisão 6 com a redação anterior.
As fotografias reais permanecem associadas às cinco etapas. Alexa mantém
restrição de compatibilidade e os demais guias não foram reescritos.

## Implementado parcialmente: persistência editorial

Executor único: `scripts/finalize-bugan-tv.ps1`, que chama o núcleo validado
por `finalize-bugan-tv.mjs`. Executar na raiz do projeto:

```powershell
powershell -NoProfile -File scripts/finalize-bugan-tv.ps1
```

A senha é solicitada de forma oculta no terminal, nunca no chat. O executor
usa autenticação normal do administrador Bugan e a RPC canônica com
`p_publish=false`, revisão esperada e hashes da configuração e Serviço.
Valida perfil, módulos, lifecycle, Serviços, administradores e ausência de
publicações. Altera apenas títulos e corpos PT/EN/ES, preserva canais e imagens,
relê revisão 7 e conteúdo, confere auditoria e o estado dos outros guias.
Uma repetição confirmada é idempotente; conflitos ou respostas ambíguas
interrompem sem repetição automática nem compensação destrutiva.

Não foi executado com senha nesta retomada. Não afirmar persistência editorial
até obter `tv_editorial_confirmed` e a releitura. Publicação técnica do código
não atualiza automaticamente os textos persistidos e não publica guias.

## Não confirmado / pendências operacionais

Confirmar equipamentos, HDMI por apartamento, numeração real dos canais,
disponibilidade da Alexa, revisão editorial e homologação humana. A publicação
operacional dos quatro guias e dos 222 registros continua sem autorização.

Os identificadores finais de commit, preview, produção e o smoke posterior
devem ser registrados após conclusão do fluxo técnico.
