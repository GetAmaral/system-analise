# Feature 05 — Gestao de Conta

## Resumo
Funcionalidades de gerenciamento: verificacao de email existente, criacao de usuario admin, sync de perfil, delecao de conta, e alteracao de senha. Inclui edge functions CRITICAS com falhas de seguranca.

## Edge Functions

### check-email-exists
**Arquivo:** `supabase/functions/check-email-exists/index.ts`

**Fluxo:**
1. Recebe email
2. Verifica em profiles (query rapida)
3. Fallback: verifica em auth.users (admin API)
4. Verifica em subscriptions (compras existentes)
5. Retorna: `{ exists, hasSubscription }`

**VULNERABILIDADE — Email Enumeration:**
- Retorna `hasSubscription: true` para emails com assinatura
- Atacante pode distinguir entre:
  - Email inexistente
  - Email existente sem assinatura
  - Email existente COM assinatura (informacao de plano vazada!)
- **Fix:** Retornar apenas `{ exists: true/false }` uniformemente

### create-user-admin
**Arquivo:** `supabase/functions/create-user-admin/index.ts`

**Fluxo:**
1. Recebe: email, name, phone
2. Cria usuario via admin API (email auto-confirmed)
3. Cria profile
4. Vincula subscriptions por email

**VULNERABILIDADE CRITICA — Sem autenticacao:**
- Qualquer request pode chamar esta funcao
- Nao verifica JWT, API key, ou service role
- Permite criar usuarios arbitrarios
- **Fix:** Adicionar validacao de JWT ou API key

### sync-profile-to-auth
**Arquivo:** `supabase/functions/sync-profile-to-auth/index.ts`

**Fluxo:**
1. Lista TODOS usuarios (`listUsers()` sem paginacao)
2. Para cada profile sem auth user correspondente:
   - Cria auth user com UUID random como senha
   - Atualiza profile.id para match
   - Vincula subscriptions

**VULNERABILIDADES:**
- **Sem autenticacao:** Qualquer request pode invocar
- **listUsers() sem paginacao:** Carrega todos usuarios na memoria — OOM para >10k users
- **Expoe contagem total de usuarios** via performance timing

### delete-account
**Arquivo:** `supabase/functions/delete-account/index.ts`

**Fluxo:**
1. Requer autenticacao (JWT)
2. Deleta usuario via admin API
3. CASCADE deleta: profile, calendar, subscriptions, etc.

**Status:** Seguro (requer auth)

## Alteracao de Senha

### Frontend: AuthContext.tsx
```typescript
updatePassword(currentPassword, newPassword) {
  // 1. Verifica senha atual via signInWithPassword
  // 2. Valida requisitos da nova senha
  // 3. supabase.auth.updateUser({ password: newPassword })
  // 4. signOut({ scope: 'global' }) — logout de todos devices
}
```

**Requisitos:**
- Min 8 chars, 1 maiuscula, 1 digito, 1 especial

**Bom:** Faz global signout apos trocar senha.

## Erros Conhecidos / Riscos

1. **check-email-exists vaza hasSubscription:** Enumeration de usuarios premium
2. **create-user-admin sem auth:** Qualquer pessoa pode criar usuarios
3. **sync-profile-to-auth sem auth:** Qualquer pessoa pode triggerar sync
4. **sync-profile-to-auth sem paginacao:** OOM risk
5. **CORS wildcard:** Todas edge functions usam `Access-Control-Allow-Origin: *`
6. **Sem rate limit em check-email-exists:** Permite enumeration em massa
7. **delete-account sem confirmacao extra:** Nao pede senha ou OTP antes de deletar
