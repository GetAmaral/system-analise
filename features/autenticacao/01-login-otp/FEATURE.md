# Feature 01 — Login via OTP (Email + Password + Code)

## Resumo
Fluxo principal de autenticacao. Usuario informa email e senha, sistema envia OTP de 6 digitos por email. Apos verificacao, sessao e estabelecida. Implementa rate limiting por IP e email, sessao temporaria com token criptografico de 256 bits, e audit logging.

## Arquitetura

```
Frontend (Account.tsx)
    ↓ startEmailPasswordOtpLogin(email, password)
    ↓ Edge Function: start-otp-login
    │   ├─ Valida email (regex) e password (not empty)
    │   ├─ Rate limit check: IP (10/15min, block 30min)
    │   ├─ Rate limit check: email (5/15min, block 60min)
    │   ├─ Gera token: crypto.getRandomValues (64-char hex, 256-bit)
    │   ├─ Cria sessao em pending_2fa_sessions (10min TTL)
    │   ├─ Envia OTP via Supabase Auth (signInWithOtp)
    │   └─ Retorna: { success, sessionToken, expiresAt }
    ↓
    ↓ sessionStorage: token, email, expires_at
    ↓ Redirect → /verify-otp
    ↓
Frontend (OTPVerification.tsx)
    ↓ Usuario insere codigo de 6 digitos
    ↓ verifyOtpAndLogin(email, code, sessionToken)
    ↓ Edge Function: verify-otp-secure
    │   ├─ Valida formato: code (^\d{6}$), token (^[a-f0-9]{64}$)
    │   ├─ Rate limit check: 15 attempts/15min, block 60min
    │   ├─ Verifica sessao (token match + not expired + attempts < 5)
    │   ├─ Incrementa attempts counter
    │   ├─ Supabase Auth: verifyOtp(email, code)
    │   ├─ Marca sessao como verified
    │   ├─ Audit log: login_success
    │   └─ Retorna: { session: { access_token, refresh_token } }
    ↓
    ↓ setSession(access_token, refresh_token)
    ↓ Redirect → /dashboard
```

## Edge Functions

### start-otp-login
**Arquivo:** `supabase/functions/start-otp-login/index.ts`

**Validacoes:**
- Email: regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- Password: trimmed, not empty

**Rate Limiting:**
- IP hash (SHA-256): max 10 tentativas em 15 min → block 30 min
- Email hash: max 5 tentativas em 15 min → block 60 min
- Funcao SQL: `check_rate_limit(identifier, action_type, max_attempts, window_minutes, block_minutes)`

**Sessao:**
- Tabela: `pending_2fa_sessions`
- Token: 64-char hex (crypto.getRandomValues)
- TTL: 10 minutos
- IP armazenado como hash SHA-256
- Email armazenado como hash

**Hardcoded:** `PROJECT_URL = 'https://totalassistente.com.br'` (deveria ser env var)

### verify-otp-secure
**Arquivo:** `supabase/functions/verify-otp-secure/index.ts`

**Validacoes:**
- Code: `^\d{6}$` (exatamente 6 digitos)
- Session token: `^[a-f0-9]{64}$`
- Email: regex format

**Rate Limiting:**
- Max 15 tentativas em 15 min → block 60 min

**Sessao:**
- Verifica token existe e nao expirou
- Max 5 attempts por sessao
- Incrementa counter em cada tentativa
- Marca como verified apos sucesso (previne reuso)

## Tabelas

### pending_2fa_sessions
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID PK | gen_random_uuid() |
| email_hash | TEXT | Hash SHA-256 do email |
| session_token | TEXT UNIQUE | Token 256-bit (64 hex chars) |
| expires_at | TIMESTAMP | Expiracao (10 min) |
| attempts | INT DEFAULT 0 | Tentativas de verificacao |
| created_at | TIMESTAMP | Criacao |

**RLS:** Service role only (nenhum acesso publico)
**Index:** `session_token` (UNIQUE)

### rate_limits
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID PK | gen_random_uuid() |
| identifier | TEXT | Hash de IP ou email |
| action_type | TEXT | 'login', 'otp', 'reset_password' |
| attempts | INT DEFAULT 0 | Tentativas |
| first_attempt_at | TIMESTAMP | Inicio da janela |
| blocked_until | TIMESTAMP | Bloqueio ate |

**Constraint:** UNIQUE(identifier, action_type)
**Cleanup:** `cleanup_old_rate_limits()` remove entries >24h

### audit_log
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID PK | gen_random_uuid() |
| user_id | UUID | Usuario (se identificado) |
| action | TEXT | 'otp_sent', 'login_success', etc. |
| resource_type | TEXT | Tipo do recurso |
| resource_id | TEXT | ID do recurso |
| details | JSONB | Detalhes extras |
| ip_hash | TEXT | Hash do IP |
| user_agent | TEXT | User agent |
| created_at | TIMESTAMP | Quando |

**RLS:** INSERT service_role, SELECT admins only

## Frontend

### Account.tsx (Login Page)
1. Verifica se email existe via `check-email-exists`
2. Se existe: mostra input de senha → startEmailPasswordOtpLogin
3. Se nao existe: fluxo de registro
4. Botao Google OAuth

### OTPVerification.tsx
- Input de 6 digitos
- Resend cooldown: 60 segundos
- Verifica expiracao client-side
- Redirect para login se nao ha email pendente

### sessionStorage (tokens temporarios)
```javascript
sessionStorage.setItem('otpSessionToken', token)
sessionStorage.setItem('pendingLoginEmail', email)
sessionStorage.setItem('otp_expires_at', expiresAt)
```
- Limpo ao fechar aba (sessionStorage, nao localStorage)
- Limpo apos sucesso ou logout

## Requisitos de Senha
```javascript
password.length >= 8
/[A-Z]/.test(password)           // maiuscula obrigatoria
/\d/.test(password)               // digito obrigatorio
/[!@#$%^&*(),.?":{}|<>]/.test(password)  // caractere especial
```

## Erros Conhecidos / Riscos

1. **PROJECT_URL hardcoded:** `https://totalassistente.com.br` na edge function — deveria ser env var
2. **Sem cleanup automatico:** `pending_2fa_sessions` acumula registros expirados sem trigger de limpeza
3. **Rate limit por IP pode bloquear NAT:** Usuarios atras do mesmo IP compartilham limite
4. **Sem notificacao de bloqueio:** Usuario bloqueado por rate limit nao recebe email informando
5. **Sem deteccao de device novo:** Nao verifica se login e de IP/device desconhecido
6. **Client-side expiry check bypassavel:** Atacante pode alterar sessionStorage, mas server valida tambem (defense-in-depth)
