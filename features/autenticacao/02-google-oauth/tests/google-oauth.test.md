# Testes — Google OAuth

## T01 — Login Google: novo usuario
**Tipo:** Integracao
**Passos:**
1. Clicar "Entrar com Google"
2. Selecionar conta Google
3. Autorizar

**Esperado:**
- [ ] Profile criado automaticamente
- [ ] name = Google full_name
- [ ] email = Google email
- [ ] Redirect para dashboard

---

## T02 — Login Google: usuario existente
**Tipo:** Integracao
**Passos:** Login com conta Google ja cadastrada

**Esperado:**
- [ ] Profile atualizado (nao duplicado)
- [ ] Sessao estabelecida

---

## T03 — Subscription auto-linked
**Tipo:** Integracao
**Pre-req:** Subscription existente com email = Google email, user_id = NULL

**Esperado:**
- [ ] subscriptions.user_id atualizado para user.id
- [ ] Plano ativo imediatamente

---

## T04 — Subscription ja vinculada (nao re-link)
**Tipo:** Seguranca
**Pre-req:** Subscription com user_id != NULL

**Esperado:**
- [ ] Nao re-vincula (filter: .is('user_id', null))

---

## T05 — Cancel OAuth (usuario cancela no Google)
**Tipo:** Funcional
**Passos:** Iniciar OAuth, cancelar na tela do Google

**Esperado:**
- [ ] Redirect de volta sem sessao
- [ ] Sem profile criado
- [ ] Sem erro visual

---

## T06 — email_stats default (LGPD concern)
**Tipo:** Compliance
**Passos:** Novo usuario via Google

**Esperado (ATUAL):**
- [ ] email_stats = true (sem consentimento explicito)
**Esperado (IDEAL):**
- [ ] Pagina de onboarding com opt-in

---

## T07 — Tokens no URL hash
**Tipo:** Seguranca
**Passos:** Verificar URL apos callback

**Esperado (ATUAL):**
- [ ] Hash contem access_token e refresh_token
**Esperado (IDEAL):**
- [ ] PKCE flow, tokens nao expostos na URL
