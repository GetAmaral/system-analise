# Feature 01 — Roteador Principal (Main Workflow)

## Resumo
Workflow N8N central que recebe todas mensagens WhatsApp, aplica filtros de seguranca (bot guard), identifica o usuario, verifica plano, e roteia para o workflow correto (Premium ou Standard).

## Arquitetura

```
WhatsApp (Graph API webhook)
    ↓ Trigger: recebe mensagem
    ↓ Normalize payload (array format)
    ↓ Bot Guard:
    │   ├─ Filtra delivery receipts (status = "delivered")
    │   ├─ Filtra mensagens encaminhadas
    │   ├─ Filtra recipient_id hardcoded (554384983452)
    │   └─ Debounce Redis: {phone}_debounce (SETEX/GETDEL)
    ↓ Detecta tipo de mensagem (text, audio, image, document)
    ↓ Lookup usuario em profiles (por phone)
    ↓ Verifica plano em subscriptions
    ↓ Switch:
    │   ├─ Premium → Executa "User Premium - Total" workflow
    │   └─ Standard/Free → Executa "User Standard - Total" workflow
    ↓
    ↓ Schedule: 7AM BRT → Agenda diaria (Feature agenda/07)
```

## Providers WhatsApp

### Graph API (Facebook) — Primary
- **Phone Number ID:** 744582292082931
- **API Version:** v17.0 (media), v23.0 (messages)
- **Credential:** WhatsApp Header Auth (TDDrQvr1s0RxXTTC)

### Evolution API — Sending
- **Instance:** `mordomo`
- **Host:** `core-evolution.lfuipy.easypanel.host`
- **Credential:** mordomoKEY (pAjSrI7C7LS0u4U3)
- **Format:** phone → `{phone}@s.whatsapp.net`

### Z-API — (Referenciado mas nao identificado como ativo)

## Bot Guard (Detalhes)

### Filtros
1. **Receipts:** `status === "delivered"` → Ignorar
2. **Forwarded:** `messages[0].context.forwarded === true` → Ignorar (especialmente audio)
3. **Recipient filter:** `recipient_id === "554384983452"` → Ignorar (numero do proprio bot)
4. **Debounce Redis:**
   - Key: `{phone}_debounce`
   - SETEX com TTL curto
   - GETDEL verifica se ja processando
   - Previne duplicatas de mensagem rapida

### Onboarding Flow
- **Stage 0:** Novo contato (sem registro em phones_whatsapp)
- **Stage 1:** Contato criado, aguardando email
- **Stage 2:** Email solicitado
- **Stage 3:** Email fornecido, setup completo

## Tabelas Relacionadas

### phones_whatsapp
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| phone | TEXT | Numero do usuario (indexed) |
| stg | INT | Stage de onboarding (1-3) |
| email | TEXT | Email do usuario |

**RLS:** Service role only (strict)

### whatsapp_leads
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| status | TEXT | Status do lead |
| email | TEXT | Email (indexed) |
| phone | TEXT | Phone (indexed) |
| created_at | TIMESTAMP | Indexed DESC |

**RLS:** Admins only (has_role check)

## Erros Conhecidos / Riscos

1. **Phone Number ID hardcoded:** 744582292082931 exposto em todos workflows
2. **Recipient filter hardcoded:** 554384983452 — se numero mudar, guard quebra
3. **Debounce key previsivel:** {phone}_debounce — se Redis comprometido, manipulavel
4. **Sem rate limiting aplicacional:** Apenas debounce Redis, sem limite por hora/dia
5. **Onboarding em phones_whatsapp:** Tabela separada do profiles — duplicacao
6. **Sem webhook signature verification:** Nao verifica assinatura do Graph API
