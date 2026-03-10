# Feature 02 — Google OAuth Login

## Resumo
Login alternativo via Google OAuth. Usuario clica "Entrar com Google", autentica no Google, callback cria/atualiza perfil automaticamente, vincula assinaturas por email, e conecta Google Calendar.

## Arquitetura

```
Frontend (Account.tsx)
    ↓ signInWithGoogle()
    ↓ Supabase Auth: signInWithOAuth({ provider: 'google' })
    ↓ Redirect → Google OAuth consent screen
    ↓ Callback → /auth/callback (AuthCallback.tsx)
    ↓ supabase.auth.getSession()
    ↓ Auto-create profile (se nao existe)
    ↓ Auto-link subscriptions by email (ILIKE)
    ↓ Auto-connect Google Calendar
    ↓ Redirect → /dashboard
```

## Fluxo Detalhado

### 1. Inicio
```typescript
signInWithGoogle() {
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: { prompt: 'select_account' }
    }
  })
}
```

### 2. Callback (AuthCallback.tsx)
```
URL: /auth/callback#access_token=...&refresh_token=...&type=signup
```
1. Extrai tokens do URL hash
2. `setSession(access_token, refresh_token)`
3. Carrega user metadata do Google (nome, email, avatar)
4. Cria profile se nao existe:
   ```typescript
   supabase.from('profiles').upsert({
     id: user.id,
     name: user.user_metadata.full_name,
     email: user.email,
     avatar_url: user.user_metadata.avatar_url,
     email_stats: true
   })
   ```
5. Vincula assinaturas:
   ```typescript
   supabase.from('subscriptions')
     .update({ user_id: user.id })
     .ilike('email', userEmail)
     .is('user_id', null)  // so vincula nao-vinculadas
   ```
6. Conecta Google Calendar (se scope disponivel)

### 3. Profile Auto-Creation
- Email confirmado automaticamente (confia no Google)
- `email_stats: true` por default
- Phone buscado de subscriptions se disponivel

## Acesso
- Disponivel para todos os planos (Free inclusive)

## Erros Conhecidos / Riscos

1. **Email auto-confirmed:** Confia 100% na verificacao do Google. Se atacante controla a conta Google, tem acesso imediato.
2. **Subscription linking by email:** Vincula assinaturas por match de email (case-insensitive). Teoricamente seguro pois Google verifica email, mas sem verificacao adicional.
3. **Sem 2FA adicional:** Google OAuth bypassa completamente o fluxo OTP. Nao ha opcao de "verificar device desconhecido".
4. **profile.email_stats = true por default:** Usuario nao consente explicitamente.
5. **Tokens no URL hash:** Access/refresh tokens aparecem no hash da URL. Se usuario compartilha URL ou tem extensoes que logam URLs, tokens vazam.
6. **Sem state parameter customizado:** Depende do Supabase Auth para CSRF via state — correto, mas nao validado manualmente.
