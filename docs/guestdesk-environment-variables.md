# GuestDesk: variáveis de ambiente

## Objetivo
Este documento lista as variáveis de ambiente usadas pelo projeto hoje e explica rapidamente para que servem.

## Arquivo local
Normalmente o ambiente local usa:

1. `.env.local`

## Variáveis principais
### Supabase público
`NEXT_PUBLIC_SUPABASE_URL`

Uso:

1. URL do projeto Supabase
2. Usada pelo frontend e pelo app

### Supabase anon key
`NEXT_PUBLIC_SUPABASE_ANON_KEY`

Uso:

1. Chave pública do Supabase
2. Necessária para autenticação e chamadas do app com cliente público

### Google Translation API key
`GOOGLE_CLOUD_TRANSLATION_API_KEY`

Uso:

1. Chave do Google Cloud Translation
2. Usada apenas no servidor
3. Necessária para gerar EN e ES no save

### URL da API de tradução
`GOOGLE_CLOUD_TRANSLATION_API_URL`

Uso:

1. Opcional
2. Permite sobrescrever a URL padrão da API do Google
3. Se não existir, o projeto usa a URL padrão da API v2

## Regras importantes
1. Nunca usar prefixo `NEXT_PUBLIC_` para segredos do servidor
2. A chave do Google Translation deve ficar apenas no servidor
3. Variável ausente de tradução não pode derrubar publicação em PT
4. Sempre validar env vars no ambiente de preview antes de produção

## Checklist rápido de ambiente local
1. Confirmar `NEXT_PUBLIC_SUPABASE_URL`
2. Confirmar `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Confirmar `GOOGLE_CLOUD_TRANSLATION_API_KEY`
4. Rodar `npm run build`
5. Testar save real no admin

## Checklist rápido de preview/produção
1. Copiar env vars obrigatórias
2. Confirmar que a chave do Google está no ambiente correto
3. Fazer um save real de conteúdo
4. Confirmar gravação em PT
5. Confirmar criação ou atualização de EN/ES

## Quando revisar este documento
Revisar sempre que:

1. Entrar nova integração externa
2. Houver mudança no provedor de tradução
3. Houver mudança de autenticação
4. Houver mudança de infraestrutura de deploy
