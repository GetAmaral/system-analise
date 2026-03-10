# Critica Arquitetural — Google OAuth

## Problemas

### 1. Bypass completo de 2FA
Google OAuth nao passa pelo fluxo OTP. Para usuarios que esperam 2FA em todo login, isso e uma brecha.

**Recomendacao:** Opcao em profiles: `require_2fa_always BOOLEAN DEFAULT false`. Se true, mesmo Google OAuth requer OTP.

### 2. Auto-creation sem consentimento explicito
Profile criado com `email_stats: true` sem opt-in. LGPD pode exigir consentimento antes de ativar tracking.

**Recomendacao:** Redirect para onboarding page apos primeiro login Google.

### 3. Tokens no URL fragment
Embora hash fragments nao sejam enviados ao servidor, podem ser capturados por:
- Extensoes de navegador
- Scripts de terceiros na pagina
- Logs de analytics client-side

**Recomendacao:** Usar PKCE flow (Supabase suporta) para trocar code por tokens server-side.

### 4. Subscription linking race condition
Se dois usuarios com o mesmo email (impossivel em teoria mas possivel via edge cases) fazem login simultaneamente, ambos tentam linkar a mesma subscription.

**Recomendacao:** Transaction-level locking ou constraint mais forte.

## Escalabilidade

| Aspecto | Limite | Gargalo |
|---------|--------|---------|
| OAuth concurrent | Sem limite | Google rate limits |
| Profile creation | Upsert atomico | OK |
| Subscription linking | Race condition possivel | Sem locking |
