# System Analise — Total Assistente

Auditoria completa de qualidade, seguranca e performance do sistema Total Assistente.

## Estrutura

```
audit/
  2026-03-10-full-system-audit.md     # Relatorio geral (29 tabelas, 143 funcoes, 14 edge functions)

features/
  agenda/                              # 8 features, 95 testes
    01-agendamento-proprio/            # Criacao de eventos
    02-consulta-compromissos/          # Busca e listagem
    03-modificacao-compromissos/       # Edicao de eventos
    04-exclusao-compromissos/          # Remocao (single + recurring)
    05-sync-google-calendar/           # Sync bidirecional Google Calendar
    06-lembretes-recorrentes/          # Lembretes com RRULE
    07-agenda-diaria-automatica/       # Agenda 7h WhatsApp (Premium)
    08-vip-calendar/                   # Agenda VIP (phone-based)

  financeiro/                          # 4 features, 53 testes
    01-despesas-receitas/              # CRUD de transacoes (entrada/saida)
    02-limites-categoria/              # Limites mensais por categoria
    03-metas-financeiras/              # Metas de renda e saldo
    04-limite-mensal-gasto/            # Limite global de gastos

  investimentos/                       # 1 feature, 17 testes
    01-portfolio/                      # Portfolio com market data (CoinGecko, BCB, brapi)

  autenticacao/                        # 5 features, 54 testes
    01-login-otp/                      # Login Email + Password + OTP (6 digitos)
    02-google-oauth/                   # Login via Google OAuth
    03-2fa-legado/                     # 2FA legacy (deprecated)
    04-rbac-planos/                    # Roles (admin/mod/user) + Planos (free/standard/premium)
    05-gestao-conta/                   # Email check, user admin, sync, delete account

  pagamentos/                          # 3 features, 28 testes
    01-hotmart-webhook/                # Webhook Hotmart (compra, cancel, refund, upgrade)
    02-checkout-planos/                # URLs de checkout + precos
    03-gestao-assinatura/              # Ciclo de vida da assinatura

  relatorios/                          # 2 features, 15 testes
    01-relatorio-pdf-whatsapp/         # PDF via PDFco + envio WhatsApp (N8N)
    02-export-frontend/                # Export client-side (jsPDF + xlsx)

  bot-whatsapp/                        # 6 features, 49 testes
    01-roteador-principal/             # Main Router + Bot Guard + Plan routing
    02-fluxo-premium/                  # AI Agent GPT-4.1-mini + tools + Redis memory
    03-fluxo-standard/                 # Fluxo Standard (identico ao Premium — BUG)
    04-transcricao-audio/              # Whisper API transcription
    05-ocr-imagem-pdf/                 # Mistral OCR (imagens + PDFs)
    06-bot-guard/                      # Anti-loop, anti-spam, debounce Redis
```

## Totais

| Categoria | Features | Testes | Vulnerabilidades Criticas |
|-----------|----------|--------|---------------------------|
| Agenda | 8 | 95 | VIP sem auth, XSS, OAuth state inseguro |
| Financeiro | 4 | 53 | Timezone, sem soft delete |
| Investimentos | 1 | 17 | Taxas hardcoded, coluna faltante |
| Autenticacao | 5 | 54 | Edge functions admin sem auth, email enumeration |
| Pagamentos | 3 | 28 | Sem HMAC, grace period morto, precos inconsistentes |
| Relatorios | 2 | 15 | Edge function faltante, sem error handling |
| Bot WhatsApp | 6 | 49 | Sem diferenciacao premium/standard (billing bypass) |
| **TOTAL** | **29** | **311** | |

## Como usar

Cada feature contem:
- `FEATURE.md` — Documentacao tecnica completa (como funciona hoje)
- `ARCHITECTURE.md` — Critica arquitetural + recomendacoes
- `tests/` — Testes prontos para execucao (nao executados ainda)

## Vulnerabilidades Top 5

1. **Bot WhatsApp sem plan gating:** Standard tem mesmas features que Premium via WhatsApp
2. **Edge functions admin sem autenticacao:** `create-user-admin` e `sync-profile-to-auth` publicas
3. **VIP Calendar sem autenticacao:** Qualquer pessoa pode manipular conexoes Google
4. **Hotmart webhook sem HMAC:** Apenas token simples, sem assinatura de payload
5. **Email enumeration:** `check-email-exists` vaza status de assinatura

## Credenciais Necessarias para Testes

- **Avelum Basic Auth** — Para webhooks N8N (registrar-gasto, etc.)
- **Supabase service_role key** — Para testes RLS
- **Hotmart HOTTOK** — Para testes de webhook

## Auditoria

- **Data:** 2026-03-10
- **Agente:** Sherlock (analisador) — READ-ONLY
- **Relatorio completo:** Ver `audit/2026-03-10-full-system-audit.md`
