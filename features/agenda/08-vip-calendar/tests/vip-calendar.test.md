# Testes — VIP Calendar

## T01 — Gerar link OAuth para VIP
**Tipo:** Integracao
```bash
curl "https://<supabase_url>/functions/v1/vip-google-connect?action=auth&phone=5543999999999"
```
**Esperado:**
- [x] Response JSON com auth_url valido
- [x] URL contem scope de calendar

---

## T02 — Verificar status de conexao
```bash
curl "https://<supabase_url>/functions/v1/vip-google-connect?action=status&phone=5543999999999"
```
**Esperado:**
- [x] is_connected, connected_email, connected_at retornados

---

## T03 — Desconectar VIP
```bash
curl "https://<supabase_url>/functions/v1/vip-google-connect?action=disconnect&phone=5543999999999"
```
**Esperado:**
- [x] is_connected = false
- [x] Tokens limpos

---

## T04 — Seguranca: phone invalido
```bash
curl "https://<supabase_url>/functions/v1/vip-google-connect?action=auth&phone="
```
**Esperado:**
- [x] 400 "Phone number is required"

---

## T05 — Seguranca: phone de terceiro (VULNERAVEL)
**Tipo:** Seguranca
```bash
curl "https://<supabase_url>/functions/v1/vip-google-connect?action=status&phone=5511999888777"
```
**Esperado (ATUAL):**
- [x] Retorna status de qualquer telefone (VULNERAVEL)
**Esperado (IDEAL):**
- [ ] 401 sem token de autorizacao

---

## T06 — Seguranca: desconectar phone de terceiro (VULNERAVEL)
**Tipo:** Seguranca
```bash
curl "https://<supabase_url>/functions/v1/vip-google-connect?action=disconnect&phone=5511999888777"
```
**Esperado (ATUAL):**
- [x] Desconecta qualquer telefone sem auth (VULNERAVEL)
**Esperado (IDEAL):**
- [ ] 401

---

## T07 — XSS no error callback
**Tipo:** Seguranca
```bash
curl "https://<supabase_url>/functions/v1/vip-google-connect?action=callback&error=<script>alert(1)</script>"
```
**Esperado (ATUAL):**
- [x] Script injetado no HTML (VULNERAVEL)
**Esperado (IDEAL):**
- [ ] HTML entities escapados

---

## T08 — Criar evento VIP via N8N
**Tipo:** Integracao
**Pre-req:** VIP com phone cadastrado
**Passos:** Enviar mensagem de agendamento via WhatsApp para numero VIP

**Esperado:**
- [x] Registro em calendar_vip com phone preenchido
- [x] due_at calculado pelo trigger

**Validar:**
```sql
SELECT * FROM calendar_vip WHERE phone = '5543999999999' ORDER BY created_at DESC LIMIT 1;
```

---

## T09 — RLS: acesso publico bloqueado
**Tipo:** Seguranca
```sql
-- Com token anonimo ou autenticado:
SELECT * FROM calendar_vip;
-- Esperado: 0 rows (policy blocks all)
```

---

## T10 — Trigger capitalize funciona em VIP
```sql
-- Via service_role:
INSERT INTO calendar_vip (phone, event_name, start_event, end_event)
VALUES ('5543999999999', 'teste vip', now(), now() + interval '1h');

SELECT event_name FROM calendar_vip WHERE phone = '5543999999999' ORDER BY created_at DESC LIMIT 1;
-- Esperado: "Teste Vip" (INITCAP)
```
