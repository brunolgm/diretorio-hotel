# Home V4 — hotfix compacto — 31/10/2026

Base conferida: main 74a344f, working tree limpa. Implementação isolada em fix/v4-compact-home-hotfix. Consultar também PREMIUM_V4_REFINEMENT_20261031.md; o pacote anterior e suas decisões permanecem preservados.

## Escopo

Quatro arquivos de produção: public-important-notice.tsx, public-communications.css, public-experience-mobile-tasks.tsx e public-experience-v4.css, todos em components/public/. Nenhuma outra página foi editada.

Alerta: somente o CSS mobile do tema Bugan foi ajustado. Faixa normal de 44 px, triângulo vermelho, rótulo e resumo na mesma linha, ellipsis visual, seta de detalhes com nome acessível e fechamento local existente. Alvos de 28×44 px, espaçados e operáveis por teclado. Altura intrínseca permite texto ampliado; sem altura máxima fixa. Texto completo permanece no destino original. A mudança de marcação envolve apenas um span no texto do link, sem mudar o conteúdo ou a apresentação desktop. Prioridade, datas, publicação, idioma, isolamento e revisão da dispensa continuam nos modelos existentes.

Essenciais: composição desktop/tablet nova somente quando desktopEssentials e theme_preset=bugan. Mobile mantém a grade anterior; demais temas mantêm o markup anterior. Três grupos com divisórias discretas: Wi-Fi com SSID e Como conectar junto à seta, café com dias/horários diretamente visíveis, e check-in/out próximos. getPublicEssentials e seu parser breakfastPeriods existentes são reutilizados, como na página Informações. Sem horários ou senhas operacionais inseridos no componente; conteúdo não reconhecido pelo parser é mostrado integralmente, inclusive informações adicionais.

## Verificação

Matriz específica de 83 cenários: PT/EN/ES, avisos curtos/longos em 360/375/390/430, detalhes completos, fechamento/reload, teclado, ausência de aviso, 200% global e ampliação extrema do texto do alerta; essenciais em 768/1024/1280/1440/1536, valores canônicos alternativos, Wi-Fi expandido, observações de café não reconhecidas, ausência de overflow, mobile e cinco outros temas preservados. As fixtures são isoladas e não publicam registros. A ampliação global extrema de 400% evidencia overflow preexistente no seletor de idioma; o hotfix não altera esse cabeçalho. O teste extremo de 48 px fica limitado ao texto do aviso para verificar seu crescimento sem modificar áreas fora do escopo.

Gates locais confirmados: 564 testes de segurança, 83 cenários específicos, regressões V4 de 109 e 168 cenários, TypeScript, lint, build e diff check. Lint mantém apenas quatro avisos preexistentes de imagens. Resultados de commit, preview e produção devem ser obtidos do estado final confirmado, não inferidos a partir deste documento.

## Evidências e limites

Capturas antes: out/compact-home/before/. Capturas depois: out/compact-home/after/. Alerta 390 e essenciais 1440 usam componentes reais, fotos existentes e dados de fixture. Não foi criado aviso em produção. Capturas reais pós-deploy e smoke devem ser identificados separadamente. Não há validação operacional de Wi-Fi/equipamentos neste hotfix.

Nenhum schema, migration, Admin, autenticação, analytics, Gastronomia/Sprint 53, Central de Voos, TV, Guia do Quarto ou serviço foi alterado. Não executar scripts de retirada/finalização, não criar ou reativar TESTE e não publicar conteúdo. Publicação técnica autorizada somente após gates verdes, preview READY e nova conferência de concorrência da main.
