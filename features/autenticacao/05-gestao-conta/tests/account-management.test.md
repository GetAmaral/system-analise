# Testes — Gestao de Conta

## T01 — check-email-exists: email existente
**Tipo:** Funcional
```bash
curl -X POST "https://<supabase_url>/functions/v1/check-email-exists" \
  -H "Content-Type: application/json" \
  -d '{"email": "usuario@existente.com"}'
```

**Esperado:**
- [ ] `{ exists: true }`

---

## T02 — check-email-exists: email inexistente
**Tipo:** Funcional

**Esperado:**
- [ ] `{ exists: false }`

---

## T03 — check-email-exists: vaza hasSubscription (VULNERAVEL)
**Tipo:** Seguranca
```bash
curl -X POST "https://<supabase_url>/functions/v1/check-email-exists" \
  -H "Content-Type: application/json" \
  -d '{"email": "premium@user.com"}'
```

**Esperado (ATUAL):**
- [ ] `{ exists: true, hasSubscription: true }` (VAZA informacao de plano)
**Esperado (IDEAL):**
- [ ] `{ exists: true }` apenas

---

## T04 — create-user-admin: sem auth (VULNERAVEL)
**Tipo:** Seguranca CRITICA
```bash
curl -X POST "https://<supabase_url>/functions/v1/create-user-admin" \
  -H "Content-Type: application/json" \
  -d '{"email": "atacante@evil.com", "name": "Hacker", "phone": "11999999999"}'
```

**Esperado (ATUAL):**
- [ ] Usuario criado com sucesso (SEM AUTENTICACAO — CRITICO)
**Esperado (IDEAL):**
- [ ] 401 Unauthorized

---

## T05 — sync-profile-to-auth: sem auth (VULNERAVEL)
**Tipo:** Seguranca CRITICA
```bash
curl -X POST "https://<supabase_url>/functions/v1/sync-profile-to-auth"
```

**Esperado (ATUAL):**
- [ ] Executa sync de TODOS usuarios (CRITICO)
**Esperado (IDEAL):**
- [ ] 401 Unauthorized

---

## T06 — delete-account: requer autenticacao
**Tipo:** Seguranca
```bash
curl -X POST "https://<supabase_url>/functions/v1/delete-account"
# Sem Authorization header
```

**Esperado:**
- [ ] 401 Unauthorized (CORRETO — esta funcao tem auth)

---

## T07 — delete-account: conta deletada com cascata
**Tipo:** Funcional
**Passos:** Usuario autenticado chama delete-account

**Esperado:**
- [ ] auth.users deletado
- [ ] profiles deletado (CASCADE)
- [ ] calendar deletado (CASCADE)
- [ ] subscriptions deletado (CASCADE)
- [ ] investments deletado (CASCADE)

---

## T08 — alterar senha: requisitos
**Tipo:** Validacao
**Passos:** Tentar alterar senha para "123"

**Esperado:**
- [ ] Rejeitado: min 8 chars, maiuscula, digito, especial

---

## T09 — alterar senha: global signout
**Tipo:** Seguranca
**Passos:**
1. Login em 2 devices
2. Alterar senha no device 1

**Esperado:**
- [ ] Device 2 deslogado (global signout)

---

## T10 — CORS: request de outro dominio
**Tipo:** Seguranca
```bash
curl -X POST "https://<supabase_url>/functions/v1/check-email-exists" \
  -H "Origin: https://evil-site.com" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com"}'
```

**Esperado (ATUAL):**
- [ ] Request aceito (CORS wildcard *)
**Esperado (IDEAL):**
- [ ] CORS bloqueado para origens nao-autorizadas

---

## T11 — check-email-exists: rate limit ausente
**Tipo:** Seguranca
**Passos:** Enviar 100 requests em loop

**Esperado (ATUAL):**
- [ ] Todos requests processados (sem rate limit)
**Esperado (IDEAL):**
- [ ] 429 apos N requests

---

## T12 — delete sem re-autenticacao (RISCO)
**Tipo:** Seguranca
**Passos:** Usuario logado ha 2 horas, clicar delete account

**Esperado (ATUAL):**
- [ ] Conta deletada imediatamente
**Esperado (IDEAL):**
- [ ] Solicita senha ou OTP antes de confirmar
