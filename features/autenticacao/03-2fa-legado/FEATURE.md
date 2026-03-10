# Feature 03 — 2FA Legado (Password + Session RPC)

## Resumo
Fluxo de autenticacao original baseado em Supabase signInWithPassword + sessao 2FA via RPCs. Parece estar em processo de depreciacao em favor do OTP flow, mas ainda funcional.

## Arquitetura

```
Frontend (Account.tsx)
    ↓ signInWithPassword(email, password)
    ↓ Supabase Auth retorna sessao
    ↓ RPC: create_2fa_session(user_id)
    │   ├─ Gera token de sessao
    │   └─ Armazena em two_factor_sessions (10min TTL)
    ↓
    ↓ RPC: verify_2fa_session(session_id, token)
    │   ├─ Valida token + nao expirado
    │   └─ Marca como verified
    ↓
    ↓ RPC: complete_2fa_session(session_id)
    │   ├─ Verifica que sessao foi verified
    │   └─ Retorna confirmation
    ↓
    ↓ Sessao completa → Dashboard
```

## Tabela: two_factor_sessions

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID PK | gen_random_uuid() |
| email | TEXT | Email do usuario (plain text!) |
| session_token | TEXT UNIQUE | Token de sessao |
| expires_at | TIMESTAMP | Expiracao (10 min) |
| ip_address | TEXT | IP do request (pode ser plain!) |
| attempts | INT DEFAULT 0 | Tentativas |
| created_at | TIMESTAMP | Criacao |

**Diferenca vs pending_2fa_sessions:**
- `two_factor_sessions`: email em PLAIN TEXT, IP pode ser plain
- `pending_2fa_sessions`: email HASHED, IP hashed — mais seguro

## RPCs
- `create_2fa_session(user_id)` — Cria sessao com token random
- `verify_2fa_session(session_id, token)` — Verifica token
- `complete_2fa_session(session_id)` — Marca como completa

## Erros Conhecidos / Riscos

1. **Email em plain text:** Tabela `two_factor_sessions` armazena email sem hash — menos seguro que `pending_2fa_sessions`
2. **IP potencialmente em plain text:** Nao confirma se IP e hashed
3. **Sem cleanup automatico:** Mesma tabela, mesmo problema
4. **Possivelmente deprecated:** Codigo existe mas pode nao ser o fluxo principal
5. **Dupla tabela de sessao:** `two_factor_sessions` + `pending_2fa_sessions` — redundancia
