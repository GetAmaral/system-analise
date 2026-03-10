# Testes — 2FA Legado

## T01 — Verificar se fluxo legado ainda e acessivel
**Tipo:** Depreciacao
**Passos:** Verificar se algum code path no frontend chama create_2fa_session

**Esperado:**
- [ ] Identificar se fluxo esta ativo ou morto

---

## T02 — two_factor_sessions: email em plain text
**Tipo:** Seguranca
```sql
SELECT email, ip_address FROM two_factor_sessions LIMIT 5;
```

**Esperado (ATUAL):**
- [ ] Email em plain text (VULNERAVEL)
**Esperado (IDEAL):**
- [ ] Tabela inexistente (migrada para pending_2fa_sessions)

---

## T03 — Sessoes expiradas acumuladas
**Tipo:** Performance
```sql
SELECT COUNT(*) FROM two_factor_sessions WHERE expires_at < now();
```

**Esperado (IDEAL):**
- [ ] 0 (cleanup automatico funcionando)
