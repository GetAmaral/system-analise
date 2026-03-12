# Total Assistente — Arquitetura Completa do Sistema

**Objetivo deste documento:** Dar a um programador novo TUDO que ele precisa saber para entender como o sistema funciona, de ponta a ponta.

**Data:** 2026-03-11
**Gerado por:** Sherlock (analisador) — analise automatizada do codebase + VPS

---

## Indice

1. [Visao Geral](#1-visao-geral)
2. [Infraestrutura (VPS + Docker)](#2-infraestrutura)
3. [Frontend (React)](#3-frontend)
4. [Backend (Supabase)](#4-backend-supabase)
5. [Edge Functions](#5-edge-functions)
6. [Banco de Dados (Schema)](#6-banco-de-dados)
7. [N8N (Workflows de Automacao)](#7-n8n-workflows)
8. [Integracoes Externas](#8-integracoes-externas)
9. [Fluxo de Autenticacao](#9-fluxo-de-autenticacao)
10. [Fluxo do Google Calendar](#10-fluxo-google-calendar)
11. [Fluxo de Pagamentos](#11-fluxo-de-pagamentos)
12. [Planos e Funcionalidades](#12-planos)
13. [Comandos Uteis](#13-comandos-uteis)

---

<a id="1-visao-geral"></a>
## 1. Visao Geral

O **Total Assistente** e um assistente financeiro pessoal com WhatsApp bot, calendario integrado com Google Calendar, e gestao de gastos/investimentos.

### Diagrama de Alto Nivel

```
                    ┌──────────────────────────────┐
                    │     totalassistente.com.br    │
                    │      (React + Vite + Nginx)   │
                    └──────────┬───────────────────┘
                               │ HTTPS
                    ┌──────────▼───────────────────┐
                    │         Traefik (Proxy)       │
                    │    Let's Encrypt SSL/TLS      │
                    └──┬────────┬──────────┬───────┘
                       │        │          │
              ┌────────▼──┐ ┌──▼─────┐ ┌──▼──────────┐
              │  N8N Main │ │  N8N   │ │ N8N Webhook  │
              │  (UI+API) │ │ Worker │ │  Processor   │
              └─────┬─────┘ └───┬────┘ └──────┬──────┘
                    │           │              │
              ┌─────▼───────────▼──────────────▼─────┐
              │           PostgreSQL (N8N data)       │
              │           Redis (Queue + Cache)       │
              │           RabbitMQ (Message Broker)   │
              └──────────────────────────────────────┘

              ┌──────────────────────────────────────┐
              │         Supabase (Cloud)              │
              │  ┌─────────────────────────────────┐  │
              │  │  PostgreSQL (dados do app)       │  │
              │  │  Auth (usuarios/sessoes)         │  │
              │  │  Edge Functions (serverless)     │  │
              │  │  Storage (arquivos)              │  │
              │  └─────────────────────────────────┘  │
              └──────────────────────────────────────┘

              ┌──────────────────────────────────────┐
              │       Integracoes Externas            │
              │  WhatsApp (Meta API) │ Google Calendar │
              │  Hotmart/Kiwify     │ OpenAI (GPT)    │
              │  Gotenberg (PDF)    │ Market Data APIs │
              └──────────────────────────────────────┘
```

### Stack Tecnologico

| Camada | Tecnologia |
|--------|-----------|
| **Frontend** | React 18 + TypeScript + Vite + Tailwind CSS |
| **UI Components** | Radix UI + shadcn/ui |
| **Backend** | Supabase (PostgreSQL + Auth + Edge Functions) |
| **Automacao** | N8N (workflows, bots, crons) |
| **AI** | OpenAI GPT-4.1-mini via LangChain (no N8N) |
| **Hospedagem VPS** | Hetzner (IP: 188.245.190.178) |
| **Containers** | Docker Compose (8 servicos) |
| **Proxy** | Traefik v3.2 (SSL automatico) |
| **Cache/Queue** | Redis 8.4 |
| **Message Broker** | RabbitMQ 4 |
| **Pagamentos** | Hotmart + Kiwify (webhooks) |
| **Comunicacao** | WhatsApp Business API (Meta Graph API v23.0) |

---

<a id="2-infraestrutura"></a>
## 2. Infraestrutura (VPS + Docker)

### Servidor

| Campo | Valor |
|-------|-------|
| Provider | Hetzner |
| IP | 188.245.190.178 |
| Acesso | `ssh -i ~/.ssh/totalassistente root@188.245.190.178` |
| OS | Linux |
| Timezone | America/Sao_Paulo |

### Containers Docker

O sistema roda via `docker-compose.yml` em `/home/totalAssistente/`:

| Container | Imagem | Porta | Funcao | RAM Max |
|-----------|--------|-------|--------|---------|
| `totalassistente-traefik` | Traefik v3.2 | 80, 443 | Proxy reverso + SSL | — |
| `totalassistente-n8n` | N8N v2.4.4 | 5678 | Interface N8N + API | 2048M |
| `totalassistente-n8n-worker` | N8N v2.4.4 | — | Processador de fila (concurrency=20) | 2048M |
| `totalassistente-n8n-webhook` | N8N v2.4.4 | — | Processador de webhooks | 1024M |
| `totalassistente-postgres` | PostgreSQL 18-alpine | 5432 | Banco do N8N | — |
| `totalassistente-redis` | Redis 8.4-alpine | 6379 | Cache + fila do N8N | 896M |
| `totalassistente-rabbitmq` | RabbitMQ 4-alpine | 5672, 15672 | Message broker | 512M |
| `totalassistente-site` | Nginx (custom build) | 80 | Frontend React | 128M |
| `totalassistente-gotenberg` | Gotenberg | — | Geracao de PDFs | — |

### Redes Docker

| Rede | Containers | Exposta? |
|------|-----------|----------|
| `frontend` | Traefik, N8N, Site | Sim (via Traefik) |
| `backend` | PostgreSQL, Redis, RabbitMQ | Nao (interna) |

### Nginx (Site)

**Dominio:** `totalassistente.com.br`

**Rotas:**
- `/*` → React SPA (static files)
- `/webhook/*` → Proxy para N8N webhook container
- `/webhook-test/*` → Proxy para N8N webhook testing

**Config:** `/home/totalAssistente/data/nginx.conf`

### Traefik

- SSL via Let's Encrypt (auto-renovacao)
- Rate limit: 100 requests/burst
- Headers de seguranca: HSTS, X-Frame-Options, CSP
- Dashboard em `traefik.{DOMAIN}` (com basic auth)

---

<a id="3-frontend"></a>
## 3. Frontend (React)

### Localizacao

```
/home/totalAssistente/site/
├── src/
│   ├── pages/           # 24 paginas (rotas)
│   ├── components/      # 60+ componentes
│   │   └── ui/          # shadcn/ui (Radix-based)
│   ├── contexts/        # AuthContext (estado global)
│   ├── hooks/           # 12 hooks customizados
│   ├── integrations/    # Cliente Supabase
│   ├── utils/           # Helpers
│   ├── constants/       # Categorias, configs
│   └── assets/          # Imagens, CSS
├── supabase/
│   ├── functions/       # Edge Functions (13+)
│   ├── migrations/      # 30+ migrations SQL
│   └── config.toml      # Config do Supabase
├── package.json
├── vite.config.ts
└── tailwind.config.ts
```

### Dependencias Principais

| Pacote | Versao | Uso |
|--------|--------|-----|
| React | 18.3.1 | Framework UI |
| Vite | 5.4.19 | Build tool (SWC) |
| @supabase/supabase-js | 2.57.0 | Cliente Supabase |
| TanStack React Query | 5.83.0 | Cache + data fetching |
| TanStack React Table | 8.21.3 | Tabelas de dados |
| FullCalendar | 6.1.19 | Visualizacao de calendario |
| Recharts | 2.15.4 | Graficos |
| React Hook Form + Zod | — | Formularios + validacao |
| Tailwind CSS | 3.4.17 | Estilizacao |
| Radix UI | — | Componentes acessiveis |
| Lucide React | — | Icones |
| jsPDF | — | Export PDF |
| XLSX | — | Export Excel |

### Rotas Principais

| Rota | Pagina | Descricao |
|------|--------|-----------|
| `/` | Index | Landing page |
| `/conta` | Account | Login/signup unificado (passwordless) |
| `/otp-verification` | OTPVerification | Digitacao do codigo OTP |
| `/auth/callback` | AuthCallback | Callback OAuth (Google) |
| `/auth/google-calendar` | GoogleCalendarCallback | Callback Google Calendar |
| `/dashboard` | NewDashboard | Dashboard principal |
| `/agenda` | NewDashboard (tab) | Calendario/lembretes |
| `/investimentos` | NewDashboard (tab) | Gestao de investimentos |
| `/relatorios` | NewDashboard (tab) | Relatorios |
| `/profile` | Profile | Configuracoes do usuario |
| `/planos` | NewPlans | Pagina de planos/precos |
| `/calendario` | Calendar | Visualizacao calendario completo |

### Hooks Customizados

| Hook | Funcao |
|------|--------|
| `useAuth()` | Autenticacao (login, signup, logout, OTP) |
| `useExpenses()` | CRUD de gastos |
| `useGoogleCalendar()` | Integracao Google Calendar |
| `useSubscription()` | Dados da assinatura |
| `useInvestments()` | CRUD de investimentos |
| `useSpendingLimit()` | Limites de gasto |
| `useCategoryLimits()` | Limites por categoria |
| `useFinancialGoals()` | Metas financeiras |
| `usePlanAccess()` | Verificacao de plano |

### Cliente Supabase

```typescript
// /src/integrations/supabase/client.ts
export const supabase = createClient<Database>(
  VITE_SUPABASE_URL,    // https://ldbdtakddxznfridsarn.supabase.co
  VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true
    }
  }
)
```

### Edge Functions que o Frontend Chama

| Funcao | Onde no Frontend | O que faz |
|--------|-----------------|-----------|
| `google-calendar` | useGoogleCalendar.ts | OAuth + sync + CRUD eventos |
| `check-email-exists` | Account page | Verifica se email ja existe |
| `start-otp-login` | AuthContext | Inicia fluxo OTP |
| `verify-otp-secure` | AuthContext | Verifica codigo OTP |
| `create-checkout` | Checkout utils | Gera link de pagamento |
| `delete-account` | EmailVerificationWrapper | Deletar conta |
| `fetch-market-data` | MarketSearchDialog | Busca dados de mercado |
| `unlink-phone` | PhoneManagement | Desvincula telefone |

---

<a id="4-backend-supabase"></a>
## 4. Backend (Supabase)

### Dados do Projeto

| Campo | Valor |
|-------|-------|
| Project Ref | `ldbdtakddxznfridsarn` |
| URL | `https://ldbdtakddxznfridsarn.supabase.co` |
| Region | (verificar no dashboard) |

### O que o Supabase faz neste projeto

1. **Banco de dados** — PostgreSQL com todas as tabelas do app
2. **Autenticacao** — Supabase Auth (email/password, Google OAuth, OTP)
3. **Edge Functions** — 13+ funcoes serverless (webhooks, cron, OAuth)
4. **RLS (Row Level Security)** — Politicas de acesso por usuario
5. **RPC Functions** — 60+ funcoes SQL chamadas via API REST

### Config.toml

Todas as edge functions estao com `verify_jwt = false` (autenticacao e manual no codigo):

```toml
[functions.google-calendar]
verify_jwt = false

[functions.google-calendar-webhook]
verify_jwt = false

[functions.google-calendar-sync-cron]
verify_jwt = false

[functions.delete-account]
verify_jwt = false

[functions.kiwify-webhook]
verify_jwt = false

[functions.create-checkout]
verify_jwt = false

[functions.start-otp-login]
verify_jwt = false

[functions.verify-otp-secure]
verify_jwt = false

[functions.fetch-market-data]
verify_jwt = false

[functions.vip-google-connect]
verify_jwt = false

[functions.sync-profile-to-auth]
verify_jwt = false

[functions.create-user-admin]
verify_jwt = false
```

---

<a id="5-edge-functions"></a>
## 5. Edge Functions (Detalhe)

Localizacao: `/home/totalAssistente/site/supabase/functions/`

| Funcao | Tipo | Auth | Descricao |
|--------|------|------|-----------|
| **google-calendar** | OAuth + CRUD | JWT manual | Fluxo OAuth Google, criar/editar/deletar eventos, sync |
| **google-calendar-webhook** | Webhook receiver | Google headers | Recebe notificacoes push do Google Calendar |
| **google-calendar-sync-cron** | Cron | Service role | Sincronizacao periodica de calendarios |
| **hotmart-webhook** | Webhook receiver | HOTTOK header | Processa compras, cancelamentos, reembolsos Hotmart |
| **kiwify-webhook** | Webhook receiver | (verificar) | Processa pagamentos Kiwify |
| **create-checkout** | API | Nenhum | Gera links de checkout (Hotmart/Kiwify) |
| **start-otp-login** | API | Rate limit | Inicia login OTP (envia codigo por email) |
| **verify-otp-secure** | API | Rate limit | Verifica codigo OTP |
| **check-email-exists** | API | Nenhum | Verifica se email existe no sistema |
| **delete-account** | API | JWT | Deleta conta do usuario |
| **fetch-market-data** | API | (verificar) | Busca cotacoes e dados de mercado |
| **unlink-phone** | API | JWT | Desvincula telefone do perfil |
| **create-user-admin** | API | **NENHUM (VULNERAVEL)** | Cria usuarios — sera removida |
| **sync-profile-to-auth** | API | **NENHUM (VULNERAVEL)** | Sync profile→auth — sera removida |
| **vip-google-connect** | OAuth VIP | **NENHUM (VULNERAVEL)** | Google Calendar VIP por telefone — sera removida |

### Dependencias entre Edge Functions

```
google-calendar-sync-cron
    └─→ chama google-calendar (via supabase.functions.invoke)
         └─→ chama RPCs: secure_get_google_tokens, store_google_connection, store_access_token

google-calendar-webhook
    └─→ chama RPCs: secure_get_google_tokens (descriptografa tokens)
```

---

<a id="6-banco-de-dados"></a>
## 6. Banco de Dados (Schema)

### Tabelas Principais

#### Usuarios e Perfis

**profiles**
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID (PK) | = auth.users.id |
| name | text | Nome do usuario |
| email | text | Email |
| phone | text | Telefone |
| avatar_url | text | URL da foto |
| plan_type | text | free / standard / premium |
| plan_status | boolean | Plano ativo? |
| plan_end_date | timestamp | Vencimento |
| plan_period | text | mensal / anual |
| created_at | timestamp | Criacao |
| updated_at | timestamp | Ultima atualizacao |

**subscriptions**
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID (PK) | |
| user_id | UUID (FK profiles) | |
| phone | text | Telefone (para leads sem user) |
| email | text | Email |
| current_plan | text | Plano atual |
| plan_period | text | mensal / anual |
| status | text | active / canceled / expired / overdue |
| start_date | timestamp | Inicio |
| end_date | timestamp | Vencimento |
| transaction_id | text | ID Hotmart/Kiwify |
| payment_method | text | Metodo pagamento |

**payments**
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID (PK) | |
| user_id | UUID (FK) | |
| amount | numeric | Valor |
| status | text | completed / refunded |
| transaction_id | text | ID externo |
| plan_status | text | new / renewal |

#### Financeiro

**spent** (Gastos)
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID (PK) | |
| user_id | UUID (FK) | |
| value | numeric | Valor do gasto |
| category | text | Categoria |
| date | date | Data |
| notes | text | Descricao |

**investments** (Investimentos)
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID (PK) | |
| user_id | UUID (FK) | |
| name | text | Nome |
| investment_type | text | Tipo (acao, cripto, etc) |
| amount_invested | numeric | Valor investido |
| current_value | numeric | Valor atual |
| profit_loss | numeric | Lucro/prejuizo |

**category_limits** (Limites por categoria)
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID (PK) | |
| user_id | UUID (FK) | |
| category | text | Categoria |
| limit_amount | numeric | Limite mensal |

#### Calendario

**calendar** (Eventos dos usuarios standard/premium)
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID (PK) | |
| user_id | UUID (FK) | |
| event_name | text | Titulo |
| desc_event | text | Descricao |
| start_event | timestamp | Inicio |
| end_event | timestamp | Fim |
| is_recurring | boolean | Recorrente? |
| rrule | text | Regra de recorrencia (RFC 5545) |
| reminder | boolean | Lembrete ativo? |
| connect_google | boolean | Sincronizado com Google? |
| session_event_id_google | text | ID do evento no Google |
| active | boolean | Ativo? |
| next_fire_at | timestamp | Proximo disparo de lembrete |

**calendar_vip** — Mesma estrutura, mas usa `phone` ao inves de `user_id`

**google_calendar_connections**
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID (PK) | |
| user_id | UUID (FK) | |
| is_connected | boolean | Conectado? |
| connected_email | text | Email Google |
| encrypted_access_token | text | Token OAuth (CRIPTOGRAFADO) |
| encrypted_refresh_token | text | Refresh token (CRIPTOGRAFADO) |
| expires_at | timestamp | Validade do access token |
| sync_token | text | Token de sync incremental |
| webhook_id | text | ID do webhook Google Push |
| webhook_expiration | timestamp | Validade do webhook |

#### WhatsApp

**messages** (Conversas do bot)
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID (PK) | |
| phone | text | Telefone |
| incoming | boolean | Mensagem recebida? |
| text_body | text | Texto da mensagem |
| media_type | text | Tipo de midia |
| timestamp | timestamp | Hora |

**message_log** (Fila de mensagens de servico)
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID (PK) | |
| phone | text | Destino |
| hour | timestamp | Agendado para |
| notified | boolean | Ja enviado? |

**phones_whatsapp** (Telefones vinculados)
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID (PK) | |
| user_id | UUID (FK) | |
| phone | text | Numero |
| primary | boolean | Principal? |
| verified | boolean | Verificado? |

#### Seguranca

**two_factor_sessions** — Sessoes 2FA com token + expiracao (5 min)
**audit_log** — Log de acoes sensiveis (IP hash, user agent)
**rate_limits** — Controle de rate limit por endpoint
**bot_blocks** — Telefones bloqueados por spam
**bot_events** — Log de atividades do bot
**user_roles** — Roles RBAC (admin, moderator)
**webhook_events_log** — Log de webhooks recebidos

### Funcoes SQL Importantes (RPCs)

| Funcao | Chamada por | O que faz |
|--------|-----------|-----------|
| `secure_get_google_tokens` | Edge functions | Descriptografa e retorna tokens Google |
| `store_google_connection` | google-calendar | Criptografa e salva tokens Google |
| `store_access_token` | google-calendar | Atualiza access token apos refresh |
| `encrypt_token(text, text)` | Varias | Criptografa com AES-CBC |
| `decrypt_token(text, text)` | Varias | Descriptografa com AES-CBC |
| `decrypt_token_json(text, text)` | **N8N workflows** | Wrapper de decrypt para RPC REST |
| `check_rate_limit` | OTP functions | Verifica rate limit |
| `check_bot_guard` | N8N Main | Anti-spam do bot |
| `find_profile_by_phone` | Hotmart webhook | Busca perfil por telefone |
| `find_subscription_by_phone` | Hotmart webhook | Busca assinatura por telefone |
| `create_2fa_session` | Auth flow | Cria sessao 2FA |
| `verify_2fa_session` | Auth flow | Valida token 2FA |

---

<a id="7-n8n-workflows"></a>
## 7. N8N (Workflows de Automacao)

### Acesso

- **URL:** `https://n8n.{DOMAIN}` (basic auth)
- **JSONs exportados:** `/home/totalAssistente/jsonsProd/`

### Workflows

#### 1. Main - Total Assistente (64 nodes)

**Trigger:** WhatsApp incoming + Schedule
**Funcao:** Orquestrador principal do bot WhatsApp

```
WhatsApp msg recebida
  → Verifica bot_guard (anti-spam)
  → Busca profile do usuario
  → Verifica plano (free/standard/premium)
  → Roteia para workflow do plano (Standard ou Premium)
  → Resposta processada por IA (GPT via LangChain)
  → Envia resposta via WhatsApp
```

**Integracoes:** WhatsApp API, Supabase, Redis, OpenAI

#### 2. User Standard - Total (132 nodes)

**Trigger:** Chamado pelo Main
**Funcao:** Chatbot para usuarios plano Standard

- LangChain Agent com ferramentas
- Memoria de conversa via Redis
- Ferramentas: criar evento, registrar gasto, consultar saldo
- Classificacao de intencao

#### 3. User Premium - Total (154 nodes)

**Trigger:** Chamado pelo Main
**Funcao:** Chatbot para usuarios plano Premium

- Tudo do Standard +
- Mais ferramentas disponiveis
- Integracao Google Calendar bidirecional
- Relatorios avancados

#### 4. Calendar WebHooks - Total Assistente (76 nodes)

**Trigger:** Webhook (Google Push Notification)
**Funcao:** Processa mudancas no Google Calendar

```
Google envia webhook (evento criado/editado/deletado)
  → Busca tokens criptografados do usuario
  → Chama decrypt_token_json para descriptografar  ← CHAVE HARDCODED (corrigir!)
  → Refresh do access token se expirado
  → Busca detalhes do evento na API Google
  → Atualiza tabela calendar no Supabase
```

**ATENCAO:** 3 nodes chamam `decrypt_token_json` com `google_calendar_secret_key_2024` hardcoded.

#### 5. Lembretes Total Assistente (71 nodes)

**Trigger:** Schedule (a cada 1 minuto, 2 triggers redundantes)
**Funcao:** Dispara lembretes de eventos

```
A cada minuto:
  → Busca eventos com reminder=true e next_fire_at <= agora
  → Busca tokens Google do usuario
  → Chama decrypt_token_json para descriptografar  ← CHAVE HARDCODED (corrigir!)
  → Cria evento no Google Calendar se conectado
  → Envia lembrete via WhatsApp
  → Atualiza next_fire_at
```

**ATENCAO:** 2 nodes chamam `decrypt_token_json` com chave hardcoded.

#### 6. Financeiro - Total (72 nodes)

**Trigger:** Schedule (semanal + mensal)
**Funcao:** Gera relatorios financeiros

```
Trigger semanal/mensal:
  → Busca gastos do periodo
  → Processa com LangChain Agent
  → Gera resumo em linguagem natural
  → Envia via WhatsApp
  → Salva no banco
```

#### 7. Relatorios Mensais-Semanais (32 nodes)

**Trigger:** Schedule (semanal + mensal)
**Funcao:** Gera PDFs de relatorios

- Agrega dados do Supabase
- Gera PDF via PDFco API
- Salva/envia relatorio

#### 8. Service Message - 24 Hours (5 nodes)

**Trigger:** Schedule (a cada 10 minutos)
**Funcao:** Envia mensagens de servico pendentes

```
A cada 10 min:
  → Busca message_log onde notified=false
  → Envia via WhatsApp (Meta Graph API)
  → Marca notified=true
```

### Resumo de Triggers N8N

| Tipo | Workflows |
|------|-----------|
| **WhatsApp webhook** | Main |
| **Google Calendar webhook** | Calendar WebHooks |
| **Schedule (cron)** | Lembretes (1min), Financeiro (semanal/mensal), Relatorios (semanal/mensal), Service Message (10min) |
| **Sub-workflow** | User Standard, User Premium (chamados pelo Main) |

---

<a id="8-integracoes-externas"></a>
## 8. Integracoes Externas

### Google Calendar

| Campo | Valor |
|-------|-------|
| Tipo | OAuth 2.0 |
| Scope | `https://www.googleapis.com/auth/calendar` |
| Edge Function | `google-calendar` |
| Tokens | Criptografados com AES-CBC no banco |
| Sync | Bidirecional (app ↔ Google) |
| Push Notifications | Via Google webhook → `google-calendar-webhook` |
| Sync Periodico | `google-calendar-sync-cron` (batches de 10) |

### WhatsApp (Meta)

| Campo | Valor |
|-------|-------|
| API | Facebook Graph API v23.0 |
| Endpoint | `https://graph.facebook.com/v23.0/{phone-id}/messages` |
| Trigger | Webhook no N8N (Main workflow) |
| Envio | HTTP Request nodes nos workflows |
| Armazenamento | Tabelas `messages` e `message_log` |

### Hotmart

| Campo | Valor |
|-------|-------|
| Tipo | Webhook receiver |
| Edge Function | `hotmart-webhook` |
| Auth | Header `X-HOTMART-HOTTOK` |
| Eventos | PURCHASE_COMPLETE, SUBSCRIPTION_CANCELLATION, PURCHASE_REFUNDED, PURCHASE_DELAYED, SUBSCRIPTION_PLAN_CHANGE, PURCHASE_EXPIRED |
| Acao | Cria/atualiza subscriptions + profiles |

### Kiwify

| Campo | Valor |
|-------|-------|
| Tipo | Webhook receiver |
| Edge Function | `kiwify-webhook` |
| Similar ao Hotmart | Processa pagamentos |

### OpenAI (via LangChain no N8N)

| Campo | Valor |
|-------|-------|
| Modelo | GPT-4.1-mini |
| Uso | Chatbot WhatsApp (Standard + Premium) |
| Features | Agent com ferramentas, classificacao de intencao, extracao de informacao |
| Memoria | Redis (historico de conversa) |

### PDFco

| Campo | Valor |
|-------|-------|
| Uso | Geracao de PDFs de relatorios |
| Workflow | Relatorios Mensais-Semanais |

---

<a id="9-fluxo-de-autenticacao"></a>
## 9. Fluxo de Autenticacao

### Login com Email + OTP (fluxo principal)

```
1. Usuario acessa /conta
2. Digita email + senha
3. Frontend chama edge function start-otp-login
   → Verifica rate limit
   → Cria sessao 2FA (RPC create_2fa_session, expira em 5 min)
   → Envia OTP por email (Supabase Auth signInWithOtp)
4. Usuario redirecionado para /otp-verification
5. Digita codigo OTP de 6 digitos
6. Frontend chama edge function verify-otp-secure
   → Valida sessao 2FA (RPC verify_2fa_session)
   → Verifica OTP com Supabase Auth (verifyOtp)
   → Marca sessao como completa (RPC complete_2fa_session)
7. Sessao criada → usuario logado
8. AuthContext carrega profile → redireciona para /dashboard
```

### Login com Google

```
1. Usuario clica "Entrar com Google"
2. supabase.auth.signInWithOAuth({provider: 'google'})
3. Redirect para Google → autoriza
4. Redirect para /auth/callback
5. Supabase cria/atualiza auth.users
6. Se profile nao existe → cria via RPC
7. Usuario logado → /dashboard
```

### Conexao Google Calendar (separada do login)

```
1. Usuario vai em configuracoes → Google Calendar → Conectar
2. Frontend chama edge function google-calendar?action=auth
3. Redirect para Google OAuth (scope: calendar)
4. Google redireciona para /auth/google-calendar com code
5. Edge function troca code por tokens
6. Tokens criptografados e salvos em google_calendar_connections
7. Sync inicial executado (importa ate 500 eventos)
8. Webhook registrado no Google para push notifications
```

---

<a id="10-fluxo-google-calendar"></a>
## 10. Fluxo do Google Calendar

### Sincronizacao Bidirecional

```
APP → GOOGLE:
  Usuario cria evento no app
    → Frontend chama google-calendar?action=create
    → Edge function descriptografa tokens
    → POST na Google Calendar API
    → Salva google_event_id na tabela calendar

GOOGLE → APP:
  Usuario cria/edita evento no Google Calendar
    → Google envia push notification para google-calendar-webhook
    → Edge function busca tokens, descriptografa
    → GET na Google Calendar API (sync incremental)
    → Atualiza tabela calendar

CRON (backup):
  google-calendar-sync-cron roda periodicamente
    → Para cada conexao ativa, chama google-calendar?action=cron-sync
    → Sync incremental usando sync_token
    → Renova webhooks expirando em <24h
```

### Criptografia dos Tokens

```
Armazenamento:
  token_original → SHA256(chave) → AES-CBC encrypt → formato: hash::iv::dados_base64

Leitura:
  hash::iv::dados_base64 → AES-CBC decrypt com SHA256(chave) → token_original

Funcoes SQL:
  encrypt_token(token, chave) → texto criptografado
  decrypt_token(texto_criptografado, chave) → token original
  decrypt_token_json(texto, chave) → mesmo que decrypt_token (wrapper para N8N)

IMPORTANTE: A chave atual (google_calendar_secret_key_2024) esta hardcoded
nas migrations e nos workflows N8N. Sera rotacionada no fix de seguranca.
```

---

<a id="11-fluxo-de-pagamentos"></a>
## 11. Fluxo de Pagamentos

### Hotmart (principal)

```
1. Usuario clica em "Assinar" no /planos
2. Frontend chama edge function create-checkout
   → Retorna URL de checkout da Hotmart
3. Usuario completa compra na Hotmart
4. Hotmart envia webhook POST para /webhook/hotmart
   → Nginx proxeia para N8N webhook container
   → WAIT: na verdade, hotmart-webhook e edge function, nao N8N
5. Edge function hotmart-webhook:
   → Valida HOTTOK
   → Identifica evento (compra, cancelamento, etc)
   → Busca profile por phone ou email
   → Se profile nao existe, CRIA automaticamente
   → Cria/atualiza subscription
   → Registra payment
   → Sincroniza plan_type no profile
```

### Planos

| Plano | Preco (estimado) | Features |
|-------|-----------------|----------|
| **Free** | R$ 0 | Dashboard read-only, calendario read-only, gastos (30 dias) |
| **Standard** | (mensal/anual) | Criar eventos, registrar gastos, limites, relatorios semanais |
| **Premium** | (mensal/anual) | Tudo + investimentos, metas, Google Calendar sync, relatorios PDF |

---

<a id="12-planos"></a>
## 12. Planos e Funcionalidades

| Funcionalidade | Free | Standard | Premium |
|---------------|------|----------|---------|
| Dashboard | Leitura | Completo | Completo |
| Calendario | Leitura | CRUD | CRUD + Google Sync |
| Gastos | 30 dias | Ilimitado | Ilimitado |
| Investimentos | — | — | Completo |
| Metas financeiras | — | — | Completo |
| Limites por categoria | — | Sim | Sim |
| Relatorios semanais | — | WhatsApp | WhatsApp + PDF |
| Relatorios mensais | — | — | WhatsApp + PDF |
| WhatsApp bot | Basico | Standard AI | Premium AI |
| Google Calendar | — | Leitura | Bidirecional |
| Export PDF/Excel | — | — | Sim |

---

<a id="13-comandos-uteis"></a>
## 13. Comandos Uteis

### VPS / Docker

```bash
# Conectar no servidor
ssh -i ~/.ssh/totalassistente root@188.245.190.178

# Ver status dos containers
docker ps

# Ver logs de um container
docker logs -f totalassistente-n8n --tail 100
docker logs -f totalassistente-n8n-webhook --tail 100

# Reiniciar um servico
docker-compose restart totalassistente-n8n

# Ver uso de recursos
docker stats

# Backup do banco N8N
docker exec totalassistente-postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup.sql
```

### Supabase

```bash
# Deploy de edge functions
cd /home/totalAssistente/site
npx supabase functions deploy              # todas
npx supabase functions deploy google-calendar  # uma especifica

# Aplicar migrations
npx supabase db push

# Ver logs de edge functions
npx supabase functions logs google-calendar
```

### Frontend

```bash
cd /home/totalAssistente/site
bun install          # instalar dependencias
bun run dev          # dev server (porta 8081)
bun run build        # build producao
bun run preview      # preview do build
```

### N8N

```
URL: https://n8n.{DOMAIN}
Auth: Basic auth (user/password no .env)

Exportar workflows: Settings → Export All
Importar workflow: Settings → Import from File
```

---

## Arquivos Importantes — Mapa Rapido

| O que | Onde |
|-------|------|
| Docker Compose | `/home/totalAssistente/docker-compose.yml` |
| Env vars VPS | `/home/totalAssistente/.env` |
| Nginx config | `/home/totalAssistente/data/nginx.conf` |
| Frontend src | `/home/totalAssistente/site/src/` |
| Frontend env | `/home/totalAssistente/site/.env.local` |
| Edge Functions | `/home/totalAssistente/site/supabase/functions/` |
| Supabase config | `/home/totalAssistente/site/supabase/config.toml` |
| SQL Migrations | `/home/totalAssistente/site/supabase/migrations/` |
| N8N JSONs (prod) | `/home/totalAssistente/jsonsProd/` |
| Types gerados | `/home/totalAssistente/site/src/integrations/supabase/types.ts` |

---

*Documento gerado automaticamente por Sherlock (analisador) em 2026-03-11*
*Baseado em analise direta do codebase, docker-compose, workflows N8N e configuracoes Supabase*
