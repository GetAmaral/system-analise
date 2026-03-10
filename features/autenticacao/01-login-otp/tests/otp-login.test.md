# Testes — Login OTP

## T01 — Fluxo completo de login OTP
**Tipo:** Integracao
**Passos:**
1. Acessar /account
2. Inserir email valido existente
3. Inserir senha correta
4. Submeter → receber OTP no email
5. Inserir codigo de 6 digitos
6. Verificar redirect para dashboard

**Esperado:**
- [ ] OTP enviado ao email
- [ ] Sessao criada em pending_2fa_sessions
- [ ] Apos verificacao, session tokens retornados
- [ ] Dashboard acessivel

---

## T02 — Email invalido
**Tipo:** Validacao
**Passos:** Inserir "email-invalido" sem @

**Esperado:**
- [ ] Erro: formato de email invalido
- [ ] Nenhuma request enviada

---

## T03 — Senha vazia
**Tipo:** Validacao
**Passos:** Email valido, senha em branco

**Esperado:**
- [ ] Erro: senha obrigatoria
- [ ] Nenhuma request enviada

---

## T04 — OTP codigo errado
**Tipo:** Seguranca
**Passos:** Inserir codigo "123456" incorreto

**Esperado:**
- [ ] Erro: codigo invalido
- [ ] attempts incrementado na sessao
- [ ] Nao autentica

---

## T05 — Max 5 tentativas por sessao
**Tipo:** Seguranca
**Passos:** Errar codigo 5 vezes

**Esperado:**
- [ ] Na 6a tentativa: "Max attempts exceeded"
- [ ] Sessao bloqueada
- [ ] Precisa reiniciar fluxo

---

## T06 — Rate limit IP: 10 tentativas
**Tipo:** Seguranca
**Passos:** Enviar 11 requests de start-otp-login do mesmo IP

**Esperado:**
- [ ] 11a request: 429 "Too many login attempts"
- [ ] Bloqueio por 30 minutos

---

## T07 — Rate limit email: 5 tentativas
**Tipo:** Seguranca
**Passos:** Enviar 6 requests para o mesmo email

**Esperado:**
- [ ] 6a request: 429 bloqueado
- [ ] Bloqueio por 60 minutos

---

## T08 — Sessao expirada (10 min)
**Tipo:** Seguranca
**Passos:**
1. Iniciar OTP
2. Aguardar 11 minutos
3. Tentar verificar

**Esperado:**
- [ ] Erro: sessao expirada
- [ ] Precisa reiniciar fluxo

---

## T09 — Token de sessao invalido
**Tipo:** Seguranca
```bash
curl -X POST "https://<supabase_url>/functions/v1/verify-otp-secure" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", "code": "123456", "sessionToken": "invalidtoken"}'
```

**Esperado:**
- [ ] Erro: formato de token invalido (nao e 64 hex chars)

---

## T10 — Reuso de sessao verificada
**Tipo:** Seguranca
**Passos:**
1. Completar login OTP com sucesso
2. Tentar usar mesmo sessionToken novamente

**Esperado:**
- [ ] Erro: sessao ja verificada (nao permite reuso)

---

## T11 — Audit log gerado
**Tipo:** Auditoria
**Passos:** Completar login com sucesso

**Validar:**
```sql
SELECT * FROM audit_log WHERE action = 'login_success' ORDER BY created_at DESC LIMIT 1;
```

**Esperado:**
- [ ] Registro com ip_hash, user_agent, details
- [ ] action = 'login_success'

---

## T12 — OTP resend cooldown (60s)
**Tipo:** Funcional
**Passos:** Enviar OTP, tentar reenviar antes de 60s

**Esperado:**
- [ ] Botao de resend desabilitado por 60 segundos
- [ ] Timer visual countdown

---

## T13 — Senha fraca rejeitada
**Tipo:** Validacao
**Passos:** Tentar login com senha "12345" (sem maiuscula, sem especial, <8 chars)

**Esperado:**
- [ ] Validacao client-side rejeita antes de enviar
- [ ] Mensagem indicando requisitos

---

## T14 — sessionStorage limpo apos logout
**Tipo:** Seguranca
**Passos:** Fazer login, depois logout

**Esperado:**
- [ ] sessionStorage vazio (otpSessionToken, pendingLoginEmail removidos)
- [ ] Nao e possivel voltar ao dashboard
