# Testes — Checkout e Planos

## T01 — Checkout premium-anual
**Tipo:** Funcional
```bash
curl -X POST "https://<supabase_url>/functions/v1/create-checkout" \
  -H "Content-Type: application/json" \
  -d '{"planType": "premium-anual"}'
```

**Esperado:**
- [ ] Retorna URL contendo `pay.hotmart.com` e `off=xbjmsoxu`

---

## T02 — Checkout plan invalido
**Tipo:** Validacao
```bash
curl -X POST "https://<supabase_url>/functions/v1/create-checkout" \
  -H "Content-Type: application/json" \
  -d '{"planType": "enterprise"}'
```

**Esperado:**
- [ ] Erro ou fallback (comportamento a verificar)

---

## T03 — upgrade-mensal = upgrade-anual (BUG)
**Tipo:** Bug
**Passos:** Comparar URLs retornadas para upgrade-mensal e upgrade-anual

**Esperado (ATUAL):**
- [ ] Mesma URL (mesmo offer code b50m5zk4)
**Esperado (IDEAL):**
- [ ] URLs diferentes com precos proporcionais

---

## T04 — Precos inconsistentes no frontend
**Tipo:** UI/UX
**Passos:** Comparar SubscriptionManager e PricingSection

**Esperado (ATUAL):**
- [ ] R$ 197/ano vs R$ 454,80/ano para premium
**Esperado (IDEAL):**
- [ ] Preco unico consistente

---

## T05 — Cancelamento: toast "Em desenvolvimento"
**Tipo:** Feature faltante
**Passos:** Clicar "Cancelar Plano" no SubscriptionManager

**Esperado:**
- [ ] Toast "Em desenvolvimento" exibido
- [ ] Nenhuma acao no backend

---

## T06 — Recibo: download .html (NAO PDF)
**Tipo:** Bug
**Passos:** Clicar "Baixar Recibo"

**Esperado (ATUAL):**
- [ ] Arquivo .html baixado (nao .pdf)
**Esperado (IDEAL):**
- [ ] PDF formatado profissionalmente
