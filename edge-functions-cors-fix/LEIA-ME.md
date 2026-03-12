# Edge Functions - CORS Corrigido

Cada arquivo aqui e a versao corrigida da edge function correspondente.
O `Access-Control-Allow-Origin: *` foi substituido por validacao de origin.

## Como usar

Copie o conteudo do arquivo e cole no lugar do `index.ts` correspondente em:
`supabase/functions/<nome-da-funcao>/index.ts`

## Templates usados

### Template PADRAO (12 funcoes)
Origins permitidos: `totalassistente.com.br` e `www.totalassistente.com.br`
Headers: `authorization, x-client-info, apikey, content-type`

- `check-email-exists.ts`
- `create-checkout.ts`
- `create-user-admin.ts`
- `delete-account.ts` (inclui Content-Type no CORS)
- `fetch-market-data.ts`
- `google-calendar.ts`
- `google-calendar-sync-cron.ts`
- `start-otp-login.ts`
- `sync-profile-to-auth.ts`
- `unlink-phone.ts`
- `verify-otp-secure.ts`
- `vip-google-connect.ts`

### Template HOTMART (1 funcao)
Mesmo que o padrao + header extra: `x-hotmart-hottok`

- `hotmart-webhook.ts`

### Template GOOGLE WEBHOOK (1 funcao)
Mesmo que o padrao + headers extras: `x-goog-channel-id, x-goog-resource-id, x-goog-resource-state`

- `google-calendar-webhook.ts`

## Deploy

Apos substituir os arquivos, faca deploy com:
```bash
supabase functions deploy <nome-da-funcao> --project-ref SEU_PROJECT_REF
```
