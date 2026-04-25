# LibGuest: variáveis de ambiente

## Objetivo
Registrar de forma prática as variáveis de ambiente usadas hoje pelo LibGuest.

## Supabase público
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Supabase server/admin
- `SUPABASE_SERVICE_ROLE_KEY`

## Tradução
- variáveis da integração com Google Cloud Translation conforme o serviço configurado no ambiente

## Observações importantes
- variáveis públicas devem ser acessadas de forma estática no client quando necessário
- segredos de tradução e de administração devem permanecer server-only
- mudanças em env devem ser refletidas também na validação de preview

## Domínio operacional atual
- `guestdesk.digital` continua sendo o domínio operacional configurado nesta fase
