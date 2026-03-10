# AUDITORIA COMPLETA — Total Assistente
**Data:** 2026-03-10
**Agente:** Sherlock (analisador) — STRICT READ-ONLY
**Escopo:** Frontend, N8N Workflows, Edge Functions, Database Schema, SQL Functions, Triggers, RLS, Hooks, Utils, Seguranca, QA

---

## 1. INVENTARIO DE FEATURES

### 1.1 Features que voce listou (CONFIRMADAS):

| # | Feature | Status | Onde vive |
|---|---------|--------|-----------|
| 1 | Sync bidirecional Google Agenda | OK | Edge Function `google-calendar`, trigger `tr_sync_calendar_to_google`, webhook `google-calendar-webhook` |
| 2 | Agendamento na agenda propria | OK | N8N `Calendar WebHooks`, frontend `CreateEventModal`, tabela `calendar` |
| 3 | Consulta de compromissos | OK | N8N `Calendar WebHooks` (webhook `/busca-total-evento`), frontend `FullAgenda` |
| 4 | Modificacao de compromissos | OK | N8N `Calendar WebHooks` (webhook editar-eventos), frontend `EditEventModal` |
| 5 | Exclusao de compromissos | OK | N8N `Calendar WebHooks` (webhook DELETE-eventos), frontend `DeleteEventDialog` |
| 6 | Relatorios mensais PDF (Gotenberg) | PARCIAL | N8N `Relatorios Mensais-Semanais` usa PDFco, nao Gotenberg. Container Gotenberg existe na VPS mas nao e referenciado |
| 7 | Anotacao de receita | OK | N8N `Financeiro - Total` (webhook `/registrar-gasto`), frontend `AddExpenseModal`, tipo `entrada` |
| 8 | Anotacao de despesa | OK | Mesmo fluxo acima, tipo `saida` |
| 9 | Consulta receita/despesa com janela | OK | N8N `Financeiro - Total` (webhook `/filtros-supabase`), frontend filtros por data |
| 10 | Relatorios personalizados PDF | PARCIAL | Frontend gera via jsPDF (client-side), N8N gera via PDFco (server-side via WhatsApp) |
| 11 | Transcricao de audio e resumos | OK | N8N `Main - Total Assistente` usa OpenAI Whisper, disponivel para nao-pagantes |
| 12 | Autenticacao via codigo Supabase | OK | Edge Functions `start-otp-login` + `verify-otp-secure`, tabela `two_factor_sessions` |

### 1.2 Features que voce NAO listou (DESCOBERTAS):

| # | Feature | Descricao | Onde vive |
|---|---------|-----------|-----------|
| 13 | **Sistema de Investimentos** | Portfolio: Bitcoin, CDB, Tesouro Direto, acoes, crypto. Dados real-time (CoinGecko, BCB, Brapi) | Frontend `InvestmentsView`, Edge Function `fetch-market-data`, tabela `investments` |
| 14 | **Limites de gastos por categoria** | Budget por categoria + limite global mensal. Alerta em 80% | Frontend `useCategoryLimits`, `useSpendingLimit`, tabela `category_limits` |
| 15 | **Metas financeiras** | Meta de saldo, renda estimada mensal | Frontend `useFinancialGoals`, campos `balance_goal` e `estimated_monthly_income` em `profiles` |
| 16 | **Bot anti-spam (Bot Guard)** | Hash FNV-1a, frequencia de mensagens, bloqueio automatico | N8N `Main`, RPC `check_bot_guard`, tabelas `bot_events`, `bot_blocks` |
| 17 | **Lembretes recorrentes** | RRule (diario, semanal, mensal, anual), notificacao via WhatsApp | N8N `Lembretes Total Assistente`, trigger `reset_recurring_reminders` |
| 18 | **Agenda diaria automatica (Premium)** | Todo dia 7h, envia agenda via WhatsApp | N8N `Main` Schedule Trigger 7AM |
| 19 | **Sistema de pagamento Hotmart** | Checkout, webhooks compra/cancelamento/reembolso/chargeback, grace period 7 dias | Edge Function `hotmart-webhook`, tabelas `subscriptions`, `payments` |
| 20 | **OCR de imagens (Mistral AI)** | Leitura de comprovantes/imagens | N8N `User Premium - Total` |
| 21 | **Chat com memoria (Redis)** | Contexto persistente para premium | N8N `User Premium`, nodo `memoryRedisChat` |
| 22 | **Sessoes ativas** | Ver/revogar dispositivos logados | Frontend `/sessoes-ativas`, tabela `active_sessions` |
| 23 | **Google OAuth login** | Login via Google | Frontend `signInWithGoogle`, callback `/auth/callback` |
| 24 | **Exportacao Excel** | Relatorios em XLSX | Frontend usa biblioteca XLSX |
| 25 | **VIP Calendar (phone-based)** | Agenda para VIP sem conta, por telefone | Tabela `calendar_vip`, `vip_google_connections`, Edge Function `vip-google-connect` |
| 26 | **Relatorios semanais automaticos** | Toda segunda 01h via WhatsApp | N8N `Relatorios Mensais-Semanais` trigger semanal |
| 27 | **Service Message 24h** | Re-engajamento inativos (INATIVO) | N8N `Service Message - 24 Hours` |
| 28 | **Webhook Kiwify** | Segundo gateway de pagamento | Tabela `webhook_events_log` com campos Kiwify |
| 29 | **Roles de usuario (RBAC)** | admin, moderator, user | Tabela `user_roles`, enum `app_role`, funcao `has_role()` |
| 30 | **WhatsApp Leads** | Captacao e gestao de leads | Tabela `whatsapp_leads` com RLS admin-only |
| 31 | **Delecao de conta** | Self-service para contas nao confirmadas | Edge Function `delete-account` |
| 32 | **Command Palette** | Busca rapida cmd+k | Frontend usa `cmdk` |
| 33 | **Temas claro/escuro** | Toggle de tema | Frontend usa `next-themes` |
| 34 | **Alertas de gastos** | Tabela `spending_alerts` no schema | Supabase types.ts |
| 35 | **Tabela messages** | Historico de mensagens do chat bot | Tabela `messages` com user_id |
| 36 | **Relatorios administrativos** | Tabela `reports` com metricas: active_users, free_users, monthly_revenue | Tabela `reports` (service_role only) |

---

## 2. EDGE FUNCTIONS — INVENTARIO COMPLETO (14 funcoes)

| # | Funcao | Metodos | Auth | Tabelas | APIs externas | Problemas |
|---|--------|---------|------|---------|---------------|-----------|
| 1 | `check-email-exists` | POST | NENHUMA | profiles, subscriptions, auth.users | - | Enumeracao de emails, sem rate limit |
| 2 | `create-checkout` | POST | Opcional (JWT) | - | Hotmart (URLs hardcoded) | URLs de checkout com cupons expostos no codigo |
| 3 | `create-user-admin` | POST | NENHUMA | auth.users, profiles, subscriptions | - | **CRITICO**: Cria usuarios confirmados sem auth |
| 4 | `delete-account` | POST | NENHUMA (valida created_at) | google_calendar_connections, profiles, auth.users | - | Janela de 5min, sem auth real |
| 5 | `fetch-market-data` | POST | NENHUMA | - | CoinGecko, Brapi, BCB | Sem rate limit, DDoS relay possivel |
| 6 | `google-calendar` | GET/POST | JWT ou Service Role | google_calendar_connections, calendar (6 RPCs) | Google OAuth2, Calendar API v3, userinfo | Client secret no codigo, state em base64 |
| 7 | `google-calendar-sync-cron` | GET | Service Role (interno) | google_calendar_connections | Invoca `google-calendar` | Batch size 10, sem auth externa |
| 8 | `google-calendar-webhook` | POST | Headers Google (channel/resource ID) | google_calendar_connections, calendar | Google Calendar API (incremental sync) | Sem assinatura HMAC, aceita qualquer ID valido |
| 9 | `hotmart-webhook` | POST | X-HOTMART-HOTTOK header | profiles, subscriptions, payments (2 RPCs) | - | Auto-cria perfis sem verificacao, sem HMAC |
| 10 | `start-otp-login` | POST | NENHUMA (valida credenciais) | two_factor_sessions, rate_limits, audit_log | Supabase Auth (signIn, OTP) | Salt estatico `_salt_2024` |
| 11 | `sync-profile-to-auth` | POST | NENHUMA | auth.users (listUsers!), profiles, subscriptions | - | **CRITICO**: Lista todos usuarios, publico |
| 12 | `unlink-phone` | POST | JWT (anon client) | phones_whatsapp | - | Nao valida ownership do telefone |
| 13 | `verify-otp-secure` | POST | Session token | two_factor_sessions, rate_limits, audit_log | Supabase Auth (verifyOtp) | Max 5 tentativas por sessao, salt fraco |
| 14 | `vip-google-connect` | GET/POST | NENHUMA (telefone = auth) | vip_google_connections | Google OAuth2, userinfo | **CRITICO**: Telefone como unica credencial |

### Valores hardcoded encontrados nas Edge Functions:

| Local | Valor | Risco |
|-------|-------|-------|
| `create-checkout` | URLs Hotmart com cupons de desconto | Exposicao de promocoes |
| `google-calendar` | `PRODUCTION_URL: 'https://totalassistente.com.br'` | Baixo |
| `google-calendar` | `DEVELOPMENT_URL: 'https://ignorethissiteavtotal.lovable.app'` | Info disclosure |
| `start-otp-login` | `'_salt_2024'` | Entropia reduzida |
| `verify-otp-secure` | `'_salt_2024'` | Mesmo salt repetido |
| `fetch-market-data` | Lista fixa de acoes/cryptos + SELIC fallback 11.25% | Dados desatualizados |
| `vip-google-connect` | `AI_WHATSAPP_NUMBER: '554396435261'` | Info disclosure |
| `hotmart-webhook` | Periodos: 30 dias (mensal), 365 dias (anual) | Logica de negocio no codigo |

---

## 3. DATABASE — INVENTARIO COMPLETO

### 3.1 Tabelas (22 + 3 views)

| # | Tabela | RLS | PK | FK/Ref | Colunas-chave |
|---|--------|-----|-----|--------|---------------|
| 1 | `profiles` | ON | UUID | auth.users(id) CASCADE | name, phone, email, plan_type, email_stats, value_limit, balance_goal, estimated_monthly_income |
| 2 | `spent` | ON | auto | fk_user → auth.users | name_spent, value_spent, category_spent, type_spent, date_spent, transaction_type |
| 3 | `calendar` | ON | auto | user_id → auth.users | event_name, start_event, end_event, due_at, reminder, is_recurring, rrule, session_event_id_google |
| 4 | `calendar_vip` | ON | UUID | phone (sem FK) | Mesmas colunas de calendar + phone, channel, payload JSONB |
| 5 | `subscriptions` | ON | UUID | user_id → profiles CASCADE, UNIQUE(user_id) | current_plan, status, start_date, end_date, grace_period_end, phone, email |
| 6 | `payments` | ON | UUID | user_id → profiles CASCADE | plan_type, amount, currency, status, transaction_id UNIQUE |
| 7 | `investments` | ON | UUID | user_id → auth.users CASCADE | investment_type, name, amount_invested, current_value, profit_loss (GENERATED) |
| 8 | `category_limits` | ON | UUID | user_id → auth.users CASCADE, UNIQUE(user_id,category) | category, limit_amount |
| 9 | `google_calendar_connections` | ON | UUID | user_id | is_connected, connected_email, scope, last_sync_at |
| 10 | `vip_google_connections` | ON | UUID | phone | Conexao Google para VIP |
| 11 | `user_roles` | ON | UUID | user_id → auth.users CASCADE, UNIQUE(user_id,role) | role (app_role enum) |
| 12 | `two_factor_sessions` | ON | UUID | - | email, session_token UNIQUE, expires_at, is_verified, ip_address |
| 13 | `pending_2fa_sessions` | ON | UUID | - | session_token, expires_at |
| 14 | `rate_limits` | ON | UUID | - UNIQUE(identifier,action_type) | identifier, action_type, attempts, blocked_until |
| 15 | `audit_log` | ON | UUID | - | user_id, action, resource_type, details JSONB, ip_hash |
| 16 | `bot_events` | ON | UUID | - | phone, body, body_hash, body_len |
| 17 | `bot_blocks` | ON | UUID | - | phone, blocked status |
| 18 | `message_log` | ON | - | - | phone, hour, notified |
| 19 | `messages` | ON | UUID | user_id | Historico de chat |
| 20 | `phones_whatsapp` | ON | - | - | Registro de telefones WhatsApp |
| 21 | `whatsapp_leads` | ON | - | - (admin-only RLS) | status, email, phone |
| 22 | `webhook_events_log` | ON | UUID | - | request_id, event_type, order_id, payload JSONB |
| 23 | `recurrency_report` | ON | - | - | Flags de relatorio mensal/semanal |
| 24 | `reports` | ON | UUID | - (service_role only) | date_ref, active_users, monthly_revenue |
| 25 | `spending_alerts` | ON | UUID | - | Alertas de gastos |
| 26 | `log_table` | ON | - | - (RESTRICT all) | Logs internos |
| 27 | `crypto_keys` | ON | - | - (service_role only) | Chaves de criptografia |
| 28 | `reminder` | ON | - | fk_iduser (TEXT, nao UUID) | Lembretes antigos |
| 29 | `active_sessions` | ON | - | - | Sessoes ativas |

**Views:** `user_plan_view`, `view_users`, `google_connection_status`

### 3.2 Funcoes SQL (143 total — criticas listadas)

| # | Funcao | Tipo | Escrita? | Descricao |
|---|--------|------|----------|-----------|
| 1 | `handle_new_user()` | SECURITY DEFINER | INSERT profiles | Cria perfil no signup |
| 2 | `user_has_premium(uuid)` | SECURITY DEFINER | Nao | Verifica plano premium |
| 3 | `user_has_standard(uuid)` | SECURITY DEFINER | Nao | Verifica plano standard |
| 4 | `user_has_paid_plan(uuid)` | SECURITY DEFINER | Nao | Verifica plano pago |
| 5 | `has_role(uuid, app_role)` | SECURITY DEFINER | Nao | Verifica role RBAC |
| 6 | `check_rate_limit(identifier, action, max, window, block)` | SECURITY DEFINER | UPDATE rate_limits | Rate limiting |
| 7 | `log_audit_event(...)` | SECURITY DEFINER | INSERT audit_log | Audit trail |
| 8 | `get_active_plan(uuid, text)` | SECURITY DEFINER | Nao | Retorna plano ativo |
| 9 | `sync_subscription_with_profile()` | SECURITY DEFINER | UPDATE profiles | Synca subscription → profile |
| 10 | `sync_email_to_subscriptions_profile()` | SECURITY DEFINER | UPDATE profiles | Synca email entre tabelas |
| 11 | `link_payments_to_user()` | SECURITY DEFINER | UPDATE payments | Liga pagamentos ao usuario por phone |
| 12 | `link_subscriptions_to_user()` | SECURITY DEFINER | UPDATE subscriptions | Liga subscriptions por phone |
| 13 | `calculate_grace_period()` | SECURITY DEFINER | UPDATE subscriptions | Calcula grace period |
| 14 | `sync_calendar_event_to_google()` | SECURITY DEFINER | HTTP call | Sync bidirecional Google |
| 15 | `normalize_phone(text)` | SECURITY DEFINER | Nao | Remove nao-digitos |
| 16 | `find_profile_by_email(text)` | SECURITY DEFINER | Nao | Busca perfil por email |
| 17 | `check_email_exists(text)` | SECURITY DEFINER | Nao | Verifica existencia |
| 18 | `cleanup_expired_2fa_sessions()` | SECURITY DEFINER | DELETE | Limpa sessoes expiradas |
| 19 | `cleanup_old_rate_limits()` | SECURITY DEFINER | DELETE | Limpa rate limits antigos |
| 20 | `store_google_connection(...)` | SECURITY DEFINER | INSERT/UPDATE | Armazena conexao Google (criptografada) |
| 21 | `secure_get_google_tokens(uuid)` | SECURITY DEFINER | Nao | Retorna tokens (service_role only) |
| 22 | `log_failed_token_access(uuid, text)` | SECURITY DEFINER | UPDATE | Loga tentativa falha |
| 23 | `reset_failed_token_access(uuid)` | SECURITY DEFINER | UPDATE | Reseta contador |
| 24 | `remove_google_calendar_events(uuid)` | SECURITY DEFINER | DELETE | Remove eventos Google |
| 25 | `check_bot_guard(phone, body_hash, body_len)` | SECURITY DEFINER | INSERT bot_events | Anti-spam |

### 3.3 Triggers (43 total)

| # | Trigger | Tabela | Evento | Funcao |
|---|---------|--------|--------|--------|
| 1 | `on_auth_user_created` | auth.users | AFTER INSERT | `handle_new_user()` |
| 2 | `link_payments_on_profile_creation` | profiles | AFTER INSERT | `link_payments_to_user()` |
| 3 | `link_subscriptions_on_profile_creation` | profiles | AFTER INSERT | `link_subscriptions_to_user()` |
| 4 | `trg_profiles_create_recurrency_report` | profiles | AFTER INSERT | Cria recurrency_report |
| 5 | `tg_profiles_updated_at` | profiles | BEFORE UPDATE | Atualiza updated_at |
| 6 | `set_grace_period` | subscriptions | BEFORE INSERT/UPDATE | `calculate_grace_period()` |
| 7 | `sync_subscription_to_profile` | subscriptions | AFTER INSERT/UPDATE | `sync_subscription_with_profile()` |
| 8 | `trg_subscription_sync_profiles` | subscriptions | AFTER INSERT/UPDATE/DELETE | `sync_subscriptions_to_profile()` |
| 9 | `tr_sync_calendar_to_google` | calendar | AFTER INSERT/UPDATE/DELETE | `sync_calendar_event_to_google()` |
| 10 | `capitalize_vip_event_name` | calendar_vip | BEFORE INSERT/UPDATE | `capitalize_event_name()` |
| 11 | `trg_calendar_vip_set_due_at` | calendar_vip | BEFORE INSERT/UPDATE | `calendar_vip_set_due_at()` |
| 12 | `normalize_phone_on_profile` | profiles | BEFORE INSERT/UPDATE | Normaliza telefone |
| 13 | `normalize_phone_on_subscription` | subscriptions | BEFORE INSERT/UPDATE | Normaliza telefone |
| 14 | `normalize_phone_on_payment` | payments | BEFORE INSERT/UPDATE | Normaliza telefone |
| 15 | `trigger_cleanup_2fa` | two_factor_sessions | AFTER INSERT | `auto_cleanup_2fa_on_insert()` |
| 16 | `update_category_limits_updated_at` | category_limits | BEFORE UPDATE | Atualiza updated_at |
| 17 | `update_investments_updated_at` | investments | BEFORE UPDATE | Atualiza updated_at |
| 18 | `trg_profile_sync_plan` | profiles | AFTER INSERT/UPDATE OF email | `sync_email_to_subscriptions_profile()` |

### 3.4 Indexes (70+ — criticos listados)

| Tabela | Index | Colunas |
|--------|-------|---------|
| spent | idx_spent_user_date | (fk_user, date_spent DESC) |
| spent | idx_spent_category | (category_spent) |
| spent | idx_spent_user_category_date | (fk_user, category_spent, date_spent DESC) |
| calendar | idx_calendar_user_id | (user_id) |
| calendar | idx_calendar_due_at | (due_at) WHERE NOT NULL |
| calendar | idx_calendar_next_fire_at | (next_fire_at) WHERE NOT NULL |
| calendar | idx_calendar_active_recurring | (user_id, is_recurring, active) WHERE recurring AND active |
| calendar_vip | idx_calendar_vip_phone | (phone) |
| calendar_vip | idx_calendar_vip_next_fire | (next_fire_at) WHERE active AND reminder |
| profiles | idx_profiles_phone | (phone) WHERE NOT NULL |
| profiles | idx_profiles_email_lower | (LOWER(email)) |
| subscriptions | idx_subscriptions_active_status | (status, current_plan) WHERE active/paid |
| subscriptions | idx_subscriptions_email_lower | (LOWER(email)) |
| payments | idx_payments_transaction_id | (transaction_id) WHERE NOT NULL |
| google_calendar_connections | idx_google_calendar_connected | (user_id, is_connected) WHERE connected |
| two_factor_sessions | idx_two_factor_sessions_token | (session_token) |
| rate_limits | idx_rate_limits_identifier | (identifier, action_type) |

### 3.5 Enum/Tipos Customizados

| Tipo | Valores |
|------|---------|
| `app_role` | 'admin', 'moderator', 'user' |

---

## 4. FRONTEND — INVENTARIO COMPLETO

### 4.1 Paginas (21 rotas)

| Rota | Componente | Auth | Descricao |
|------|-----------|------|-----------|
| `/` | Index | Publica | Landing page |
| `/conta` | Account | Publica | Login/registro unificado |
| `/otp-verification` | OTPVerification | Publica | Verificacao OTP 6 digitos |
| `/auth/callback` | AuthCallback | Publica | OAuth callback (PKCE, merge profiles) |
| `/auth/google-calendar` | GoogleCalendarCallback | Publica | Google Calendar OAuth popup |
| `/auth/error` | AuthError | Publica | Erro de auth |
| `/conta-ativada` | AccountActivated | Publica | Confirmacao email |
| `/2fa` | TwoFactorAuth | Publica | Magic link confirmation |
| `/esqueci-senha` | ForgotPassword | Publica | Reset password request |
| `/redefinir-senha` | ResetPassword | Publica | Reset password form |
| `/verificar-email` | EmailVerification | Publica | Pending verification |
| `/completar-perfil` | CompleteProfile | Protegida | Nome + telefone |
| `/dashboard` | NewDashboard | Protegida | Dashboard principal (tabs) |
| `/agenda` | Calendar | Protegida | FullCalendar (Premium) |
| `/investimentos` | InvestmentsView | Protegida | Portfolio (Standard+) |
| `/relatorios` | ReportsView | Protegida | Relatorios (Premium) |
| `/profile` | Profile | Protegida | Configuracoes |
| `/sessoes-ativas` | ActiveSessions | Protegida | Gerenciar sessoes |
| `/planos` | NewPlans | Publica | Precos |
| `/terms`, `/privacy`, `/cookies` | Legal pages | Publica | Juridico |
| `*` | NotFound | Publica | 404 |

### 4.2 Hooks (12 hooks)

| Hook | Supabase Ops | Problemas encontrados |
|------|-------------|----------------------|
| `useExpenses` | CRUD `spent`, real-time listener | Race condition optimistic update vs real-time; temp ID colisao (Date.now()); sem validacao de valor negativo |
| `useGoogleCalendar` | CRUD `calendar`, `google_calendar_connections`, Edge Function invoke | **URL Supabase hardcoded**; timezone hardcoded Sao_Paulo; race condition DB local vs Google; mobile detect por User-Agent |
| `useInvestments` | CRUD `investments`, APIs externas (CoinGecko, BCB) | Fallback SELIC 11.25% hardcoded; AbortController timeout 5s; sem backup de API; sem validacao de resposta |
| `useCategoryLimits` | `category_limits` + `spent` (aggregation mensal) | Sem validacao de limites negativos; toast sem detalhe tecnico |
| `useSpendingLimit` | `profiles.value_limit` + `spent` (soma mensal) | Limite default 1000 hardcoded; divisao por zero possivel; DST bug no calculo de mes |
| `useFinancialGoals` | `profiles` (balance_goal, estimated_monthly_income) | Sem validacao de input; NaN nao tratado |
| `useSubscription` | RPC `get_active_plan`, `subscriptions`, `payments` | Dados de multiplas fontes = inconsistencia; grace period deprecated mas codigo presente; canCancel 7 dias hardcoded |
| `usePlanAccess` | Leitura do AuthContext | Controle de acesso CLIENT-SIDE (nao seguro); regex para remover sufixo -mensal/-anual |
| `useFilterUrlSync` | Nenhuma (React Router) | Sem validacao de datas do URL; debounce 300ms |
| `useRedirectFreePlan` | Nenhuma | **HOOK NO-OP** — codigo morto, sem efeito |
| `useIsMobile` | Nenhuma | Breakpoint 768px hardcoded |
| `useToast` | Nenhuma | TOAST_REMOVE_DELAY = 1000000ms (~11.5 dias); ID counter nao e unico entre tabs |

### 4.3 Utils (7 arquivos)

| Util | Funcao | Problemas |
|------|--------|-----------|
| `calendarUtils.ts` | formatToICal, expandRecurringEvents, stabilizeRRule | exdates usa toDateString() (perde hora); rrulestr pode throw; sem timezone em expansao |
| `checkout.ts` | handleCheckout, getRenewalLink | Sem validacao de planType; window.open pode ser bloqueado; sem fallback |
| `exportUtils.ts` | Excel + PDF export | Sem limite de tamanho; pode crashar browser com dataset grande; cores hardcoded |
| `logger.ts` | dev/error/warn/info + sanitize | Sem remote logging (erros perdidos em prod); recursao sem limite; isDev via import.meta.env |
| `rateLimiter.ts` | localStorage rate limiter | Compartilhado entre usuarios no mesmo device; sem criptografia; sem cleanup |
| `sanitize.ts` | DOMPurify wrappers (input, HTML, URL, email, phone) | Supply chain risk (DOMPurify); recursao sem limite; validacao de email fraca |
| `validation.ts` | Zod schemas (email, password, name, phone, OTP) | **DUPLICADO** em `lib/validation.ts`; regex de nome incompleto para Unicode; password special chars limitados |

### 4.4 Contexts

| Context | Descricao | Problemas |
|---------|-----------|-----------|
| `AuthContext.tsx` (~1000 linhas) | Estado completo de auth, profile, session. Login email+OTP, Google OAuth, 2FA, signup, reset | 2FA token em sessionStorage (XSS); safety timeout 6s bloqueia se Supabase lento; Google profile merge com ilike (duplicatas); OTP fallback tenta 3 tipos sequencialmente |

### 4.5 Componentes criticos (60+ total)

| Componente | Funcao | Problemas |
|-----------|--------|-----------|
| `NewDashboard` | Shell principal com tabs | Lazy-load OK; URL sync com tabs |
| `DashboardView` | KPIs + graficos + transacoes recentes | Calculo de periodo sem cache; re-renderiza em cada filtro |
| `AddExpenseModal` | Criar gasto/receita | Schema Zod OK; sem validacao de valor maximo |
| `EditExpenseModal` | Editar gasto/receita | Pre-fill OK; sem undo |
| `CreateEventModal` | Criar evento com recorrencia | RRULE gerado client-side; sem validacao de timezone |
| `PlanBlocker` | Bloqueio de feature por plano | Preco hardcoded R$37,90 |
| `TransactionsDataGrid` | Tabela com sort/filter/export | TanStack table; paginacao 10/pagina |
| `ProtectedRoute` | Auth guard | Redireciona para /conta se nao autenticado |
| `ProfileGuard` | Completude do perfil | Telefone nao mais obrigatorio |
| `GoogleCalendarConnection` | OAuth connect/disconnect | Variantes sidebar/compact |
| `SubscriptionManager` | Gestao de plano | Botao cancelar desabilitado (nao implementado) |
| `PricingSection` | Precos | Free R$0, Standard R$9,90, Premium R$19,90 |

---

## 5. N8N WORKFLOWS — INVENTARIO COMPLETO (8 workflows)

### 5.1 Main - Total Assistente (2960 linhas)

| Aspecto | Detalhe |
|---------|---------|
| **Trigger** | WhatsApp Trigger (OAuth webhook) + Webhook `/teste` |
| **Funcao** | Router principal: recebe mensagem WhatsApp, verifica usuario, rota para Premium ou Standard |
| **Nodos** | Profile lookup, Bot Guard check, Plan check, Audio transcription (Whisper), OTP send |
| **Schedule** | 7AM diario: agenda para premium users |
| **Rotas** | Premium → `User Premium - Total`, Standard → `User Standard - Total` |
| **IDs hardcoded** | WhatsApp Phone ID: 744582292082931 |

### 5.2 User Premium - Total (6455 linhas, 143 nodos)

| Aspecto | Detalhe |
|---------|---------|
| **Funcao** | AI Agent completo para usuarios premium |
| **AI Stack** | GPT-4.1-mini, AI Agent, LLM Chain, Text Classifier, Information Extractor |
| **Memoria** | Redis Chat Memory (contexto persistente) |
| **OCR** | Mistral AI OCR (api.mistral.ai/v1/ocr) |
| **Tools** | HTTP Request Tool, Think Tool |
| **Intencoes** | Financeiro, Calendario, Relatorio, Lembrete, Conversa geral |
| **Provedores msg** | Z-API, Core Evolution, WhatsApp Graph API |

### 5.3 User Standard - Total (5450 linhas, 123 nodos)

| Aspecto | Detalhe |
|---------|---------|
| **Funcao** | Versao simplificada para standard users |
| **AI Stack** | GPT-4.1-mini, LLM Chain (sem Agent, sem Think Tool) |
| **Sem** | Redis memory, OCR, advanced reasoning |

### 5.4 Financeiro - Total (2844 linhas)

| Aspecto | Detalhe |
|---------|---------|
| **Webhooks** | `/registrar-gasto`, `/editar-supabase`, `/excluir-supabase`, `/filtros-supabase` |
| **Funcao** | CRUD completo de gastos/receitas no Supabase |
| **AI** | Information Extractor para normalizar dados (GPT-4.1-mini) |
| **Categorias** | 11 categorias, 5 tipos, entrada/saida |

### 5.5 Calendar WebHooks (3177 linhas, 72 nodos)

| Aspecto | Detalhe |
|---------|---------|
| **Webhooks** | `/calendar-creator`, `/busca-total-evento`, editar-eventos, DELETE-eventos |
| **Funcao** | CRUD calendario + sync Google Calendar |
| **AI** | Similarity matching de eventos (score >= 0.90) |
| **RPCs** | `decrypt_token_json` para tokens Google |

### 5.6 Lembretes Total Assistente (3081 linhas)

| Aspecto | Detalhe |
|---------|---------|
| **Webhooks** | `/criar-lembrete-total`, `/criar-lembrete-recorrente-total` |
| **Schedule** | 50s interval para check de lembretes due |
| **Funcao** | Cria lembretes, verifica due_at, envia WhatsApp |
| **Redis** | Cache de mensagem (TTL 3600s) |

### 5.7 Relatorios Mensais-Semanais (1127 linhas)

| Aspecto | Detalhe |
|---------|---------|
| **Schedules** | Segunda 01h (semanal), Dia 1 01h (mensal) |
| **Funcao** | Gera PDF via PDFco, envia via WhatsApp |
| **Tabelas** | recurrency_report, profiles, spent |

### 5.8 Service Message - 24 Hours (215 linhas, INATIVO)

| Aspecto | Detalhe |
|---------|---------|
| **Schedule** | 10 min (desativado) |
| **Funcao** | Re-engajamento de usuarios inativos 24h |
| **Tabela** | message_log (filter by hour >= 24h ago) |

---

## 6. PROBLEMAS DE SEGURANCA (COMPLETO)

### 6.1 SEVERIDADE CRITICA (5)

| # | Problema | Impacto | Local |
|---|---------|---------|-------|
| S1 | JWT verify=false em TODAS edge functions | Endpoints publicos sem auth | `supabase/config.toml` |
| S2 | `create-user-admin` sem auth | Cria usuarios confirmados publicamente | Edge Function |
| S3 | `sync-profile-to-auth` lista todos usuarios | DoS + vazamento de PII | Edge Function |
| S4 | `vip-google-connect` telefone = auth | Acesso ao Google Calendar de qualquer VIP | Edge Function |
| S5 | Chave criptografia hardcoded | `google_calendar_secret_key_2024` em texto claro | N8N workflows |

### 6.2 SEVERIDADE ALTA (11)

| # | Problema | Local |
|---|---------|-------|
| S6 | `check-email-exists` permite enumeracao de emails | Edge Function |
| S7 | `fetch-market-data` sem rate limit (DDoS relay) | Edge Function |
| S8 | `google-calendar-sync-cron` sem auth externa | Edge Function |
| S9 | `unlink-phone` nao valida ownership | Edge Function |
| S10 | Salt estatico `_salt_2024` no hashing | Edge Functions OTP |
| S11 | Phone-based linking sem UNIQUE constraint | Funcoes SQL: link_payments, link_subscriptions |
| S12 | Email sem UNIQUE constraint em profiles | Funcao find_profile_by_email retorna primeiro match |
| S13 | Controle de acesso apenas client-side (usePlanAccess) | Frontend hooks |
| S14 | 2FA token em sessionStorage (XSS risk) | AuthContext.tsx |
| S15 | Google Calendar webhook sem assinatura HMAC | Edge Function google-calendar-webhook |
| S16 | Hotmart webhook sem assinatura HMAC (so token) | Edge Function hotmart-webhook |

### 6.3 SEVERIDADE MEDIA (8)

| # | Problema | Local |
|---|---------|-------|
| S17 | OAuth state userId em base64 (info disclosure) | Edge Function google-calendar |
| S18 | URL Supabase hardcoded no hook | useGoogleCalendar.ts:301 |
| S19 | Janela 5min para delete-account (timing attack) | Edge Function delete-account |
| S20 | Rate limiter em localStorage (compartilhado entre users) | rateLimiter.ts |
| S21 | DOMPurify supply chain risk | sanitize.ts |
| S22 | Service role key em vault.decrypted_secrets (deveria ser env) | Migration 20260210000000 |
| S23 | Webhook payload JSONB pode conter dados sensiveis | webhook_events_log |
| S24 | Google client secret exposto no codigo da Edge Function | google-calendar/index.ts |

---

## 7. PROBLEMAS DE QUALIDADE (COMPLETO)

### 7.1 Inconsistencias Funcionais (12)

| # | Problema | Detalhe |
|---|---------|--------|
| Q1 | **Gotenberg nao utilizado** | Container existe, PDFs via PDFco + jsPDF |
| Q2 | **3 estrategias de PDF** | jsPDF (frontend), PDFco (N8N), Gotenberg (ocioso) |
| Q3 | **3 provedores WhatsApp** | Graph API, Z-API, Core Evolution — simultaneos |
| Q4 | **2 gateways de pagamento** | Hotmart (ativo) + Kiwify (tabela existe) |
| Q5 | **Schemas de validacao duplicados** | `utils/validation.ts` E `lib/validation.ts` |
| Q6 | **Hook morto** | `useRedirectFreePlan` nao faz nada |
| Q7 | **Toast delay 11.5 dias** | TOAST_REMOVE_DELAY = 1000000ms |
| Q8 | **Service Message INATIVO** | Feature de re-engajamento desligada |
| Q9 | **Categorias com acento inconsistente** | `educacao` vs `educação` |
| Q10 | **Botao cancelar desabilitado** | SubscriptionManager tem botao sem funcionalidade |
| Q11 | **Grace period deprecated** | useSubscription tem metodos que retornam null |
| Q12 | **Tabela `reminder` potencialmente fantasma** | RLS existe mas tabela pode nao estar em uso |

### 7.2 Gaps de Cobertura (13)

| # | Gap | Risco |
|---|-----|-------|
| Q13 | **Sem monitoramento (Sentry/Datadog)** | Erros silenciosos em producao |
| Q14 | **Sem health checks** | Sem uptime monitor |
| Q15 | **Sem backup documentado** | 28 tabelas sem evidencia de backup |
| Q16 | **Sem CI/CD com testes** | npm test sem pipeline |
| Q17 | **Sem versionamento de API** | Breaking changes afetam todos |
| Q18 | **Sem dead-letter queue** | Webhook perdido = pagamento perdido |
| Q19 | **Sem Error Boundaries** | React crash = tela branca |
| Q20 | **Sem empty states** | Algumas views sem UI para dados vazios |
| Q21 | **Sem offline indicator** | Sem service worker |
| Q22 | **Sem cleanup automatico** | 2FA sessions, rate_limits, bot_events crescem indefinidamente |
| Q23 | **Sem pagination em queries** | useExpenses busca TODOS os gastos do usuario |
| Q24 | **Sem audit automatico** | log_audit_event existe mas nao e chamado por triggers |
| Q25 | **Sem i18n** | Todo texto hardcoded em PT-BR |

### 7.3 Problemas de Frontend (10)

| # | Problema | Local |
|---|---------|-------|
| Q26 | Race condition: optimistic update + real-time listener | useExpenses |
| Q27 | Temp ID colisao (Date.now() precision) | useExpenses |
| Q28 | Safety timeout 6s bloqueia se Supabase lento | AuthContext |
| Q29 | OTP fallback tenta 3 tipos sequencialmente (lento) | AuthContext |
| Q30 | Google profile merge com ilike (duplicatas) | AuthContext |
| Q31 | Sem timeout em chamadas Supabase | supabase/client.ts |
| Q32 | Sem retry logic no client Supabase | supabase/client.ts |
| Q33 | Breakpoint mobile 768px hardcoded (nao CSS variable) | useIsMobile |
| Q34 | localStorage rate limiter compartilhado entre usuarios | rateLimiter.ts |
| Q35 | Recursao sem limite em sanitizeData e sanitizeObject | logger.ts, sanitize.ts |

---

## 8. PROBLEMAS DE PERFORMANCE (ATUALIZADOS)

| # | Problema | Impacto | Status |
|---|---------|---------|--------|
| P1 | `spent(fk_user, date_spent)` | Queries de periodo | **INDICE EXISTE** (idx_spent_user_date) |
| P2 | `spent(category_spent)` | Filtros por categoria | **INDICE EXISTE** (idx_spent_category) |
| P3 | `calendar(next_fire_at)` | Scheduler 50s | **INDICE EXISTE** (idx_calendar_next_fire_at) |
| P4 | `google_calendar_connections(user_id)` | Join | **INDICE EXISTE** (idx_google_calendar_connected) |
| P5 | `user_plan_view` N+1 | get_active_plan por row | PENDENTE |
| P6 | `bot_events`/`message_log` sem TTL | Crescimento ilimitado | PENDENTE |
| P7 | `messages` sem indice user_id | Chat lento | VERIFICAR se existe |
| P8 | **useExpenses sem paginacao** | Carrega TODOS gastos de uma vez | PENDENTE |
| P9 | **DashboardView recalcula a cada filtro** | Sem memoizacao de KPIs | PENDENTE |
| P10 | **FullCalendar lazy-load** | Componente pesado | OK (ja lazy) |
| P11 | **Pending 2FA sessions sem cleanup** | Crescimento ilimitado | PENDENTE |
| P12 | **Rate limits sem cleanup automatico** | Crescimento ilimitado | PENDENTE |

---

## 9. MAPA DE FLUXOS N8N

```
TRIGGERS                          WORKFLOWS                        DESTINO
─────────────────────────────────────────────────────────────────────────────
WhatsApp Message ──────────────→ Main - Total Assistente ────────→ Premium/Standard routing
                                   ├─ Audio? → OpenAI Whisper       ├─→ User Premium - Total
                                   ├─ Bot Guard check                │    ├─ AI Agent (GPT-4.1-mini)
                                   ├─ Profile lookup                 │    ├─ Redis memory
                                   └─ Plan check                     │    ├─ Mistral OCR
                                                                     │    ├─ Text Classifier
                                                                     │    ├─ Information Extractor
                                                                     │    └─ HTTP tools
                                                                     └─→ User Standard - Total
                                                                          └─ Basic LLM chain (sem Agent)

Schedule 7AM ──────────────────→ Main (agenda diaria) ──────────→ WhatsApp (premium users)

Webhook /registrar-gasto ──────→ Financeiro - Total ────────────→ Supabase INSERT spent
Webhook /editar-supabase ──────→ Financeiro - Total ────────────→ Supabase UPDATE spent
Webhook /excluir-supabase ─────→ Financeiro - Total ────────────→ Supabase DELETE spent
Webhook /filtros-supabase ─────→ Financeiro - Total ────────────→ Supabase SELECT + filter

Webhook /calendar-creator ─────→ Calendar WebHooks ─────────────→ Supabase + Google Calendar
Webhook /busca-total-evento ───→ Calendar WebHooks ─────────────→ Supabase SELECT calendar
Webhook /editar-eventos ───────→ Calendar WebHooks ─────────────→ Supabase UPDATE + Google
Webhook /delete-eventos ───────→ Calendar WebHooks ─────────────→ Supabase DELETE + Google

Webhook /criar-lembrete ───────→ Lembretes Total Assistente ────→ Supabase + Google Calendar
Webhook /criar-lembrete-recorr→ Lembretes (recorrente) ────────→ Supabase + RRULE
Schedule 50s ──────────────────→ Lembretes (check due) ────────→ WhatsApp reminder

Schedule Mon 01h ──────────────→ Relatorios Mensais-Semanais ──→ PDFco → WhatsApp
Schedule 1st 01h ──────────────→ Relatorios Mensais-Semanais ──→ PDFco → WhatsApp

Schedule 10min ────────────────→ Service Message 24h (INATIVO) ─→ WhatsApp re-engagement

Frontend CRUD ─────────────────→ Supabase Direct (RLS) ────────→ spent, calendar, investments,
                                                                   category_limits, profiles

Edge Functions ────────────────→ Supabase Service Role ────────→ auth.users, subscriptions,
                                   ├─ google-calendar                payments, 2fa sessions
                                   ├─ hotmart-webhook
                                   ├─ start-otp-login
                                   └─ verify-otp-secure
```

---

## 10. MAPA COMPLETO DE TABELAS

```
                         ┌─────────────────┐
                         │   auth.users    │ (Supabase internal)
                         └────────┬────────┘
                                  │ ON DELETE CASCADE
          ┌───────────────────────┼────────────────────────────┐
          │                       │                             │
    ┌─────▼──────┐          ┌─────▼──────┐              ┌─────▼──────┐
    │  profiles   │          │   spent    │              │  calendar  │
    │ plan, phone │          │ financeiro │              │  eventos   │
    │ email_stats │          │ 11 categ.  │              │ recorrente │
    │ goals, limit│          │ entrada/   │              │ reminder   │
    └─────┬──────┘          │ saida      │              │ google sync│
          │                  └────────────┘              └─────┬──────┘
          │                                                    │ trigger
    ┌─────┼──────────────────┐                          ┌─────▼──────┐
    │     │                  │                          │  google_    │
┌───▼───┐ ┌▼────────────┐ ┌─▼──────────────┐          │  calendar_  │
│subscr.│ │category_     │ │  investments   │          │ connections │
│plan   │ │limits        │ │  btc, cdb,     │          └────────────┘
│status │ │por categoria │ │  tesouro, acoes│
│grace  │ └──────────────┘ └────────────────┘
└───────┘
    ┌────────────┐  ┌────────────┐  ┌──────────────┐  ┌────────────┐
    │ payments   │  │ user_roles │  │ recurrency_  │  │  reports   │
    │ hotmart    │  │ RBAC enum  │  │ report       │  │ admin only │
    └────────────┘  └────────────┘  └──────────────┘  └────────────┘

    ┌────────────────── VIP (phone-based, sem auth.users) ──────────┐
    │  calendar_vip  │  vip_google_connections                      │
    └────────────────┴──────────────────────────────────────────────┘

    ┌────────────────── Bot/Comms ─────────────────────────────────┐
    │ bot_events │ bot_blocks │ message_log │ messages │            │
    │ phones_whatsapp │ whatsapp_leads │ spending_alerts            │
    └──────────────────────────────────────────────────────────────┘

    ┌────────────────── Auth/Security/Audit ───────────────────────┐
    │ two_factor_sessions │ pending_2fa_sessions │ rate_limits     │
    │ active_sessions │ audit_log │ webhook_events_log │ log_table │
    │ crypto_keys │ reminder (legacy)                              │
    └──────────────────────────────────────────────────────────────┘
```

---

## 11. ESTATISTICAS FINAIS DO SISTEMA

| Metrica | Valor |
|---------|-------|
| **Tabelas** | 29 (incluindo legacy) |
| **Views** | 3 |
| **Funcoes SQL** | 143 |
| **Triggers** | 43 |
| **Policies RLS** | 100+ |
| **Indexes** | 70+ |
| **Enums** | 1 (app_role) |
| **Migracoes** | 99 |
| **Edge Functions** | 14 |
| **Workflows N8N** | 8 (7 ativos, 1 inativo) |
| **Nodos N8N** | ~450+ |
| **Endpoints webhook** | 14+ |
| **Paginas frontend** | 21 rotas |
| **Componentes React** | 60+ |
| **Hooks customizados** | 12 |
| **Utils** | 7 arquivos |
| **APIs externas** | 9 (Google, Facebook/WhatsApp, OpenAI, Mistral, CoinGecko, BCB, Brapi, PDFco, Hotmart) |
| **Provedores WhatsApp** | 3 (Graph API, Z-API, Core Evolution) |
| **Provedores PDF** | 3 (jsPDF, PDFco, Gotenberg — so 2 usados) |
| **Gateways pagamento** | 2 (Hotmart ativo, Kiwify incerto) |
| --- | --- |
| **Problemas criticos** | 5 |
| **Problemas altos** | 11 |
| **Problemas medios** | 8 |
| **Problemas de QA** | 35 |
| **Problemas de performance** | 12 |
| **Features encontradas nao listadas** | 24 |
| **Codigo morto identificado** | 3 (useRedirectFreePlan, grace period methods, reminder table) |
| **Valores hardcoded** | 15+ |

---

## 12. PLANO DE ACAO RECOMENDADO

### P0 — CRITICO (fazer imediatamente)

- [ ] Habilitar `verify_jwt = true` em edge functions que requerem auth
- [ ] Proteger ou remover `create-user-admin`
- [ ] Substituir `listUsers()` em `sync-profile-to-auth` por lookup individual
- [ ] Adicionar auth real em `vip-google-connect`
- [ ] Rotacionar e mover para env a chave `google_calendar_secret_key_2024`
- [ ] Adicionar UNIQUE constraint em `profiles.email`
- [ ] Validar phone ownership nas funcoes de linking

### P1 — ALTA (proximo sprint)

- [ ] Rate limiting em `check-email-exists`, `fetch-market-data`
- [ ] Auth em `google-calendar-sync-cron`
- [ ] Validar ownership em `unlink-phone`
- [ ] Rotacionar salt `_salt_2024` para valor aleatorio por env
- [ ] HMAC validation em `hotmart-webhook` e `google-calendar-webhook`
- [ ] Remover URL Supabase hardcoded de `useGoogleCalendar.ts`
- [ ] Adicionar Error Boundaries no React
- [ ] Implementar paginacao em `useExpenses`

### P2 — MEDIA (roadmap)

- [ ] Consolidar estrategia PDF (escolher: Gotenberg vs PDFco vs jsPDF)
- [ ] Consolidar provedores WhatsApp
- [ ] Decidir status Kiwify (ativo ou remover)
- [ ] Eliminar duplicacao `utils/validation.ts` + `lib/validation.ts`
- [ ] Remover hook morto `useRedirectFreePlan`
- [ ] Corrigir TOAST_REMOVE_DELAY para valor razoavel
- [ ] Implementar Sentry/Datadog
- [ ] Adicionar health checks
- [ ] Documentar backup strategy
- [ ] Implementar cleanup automatico (pg_cron para 2FA, rate_limits, bot_events)
- [ ] Resolver inconsistencia acento categorias
- [ ] Implementar botao cancelar assinatura

### P3 — MELHORIA CONTINUA

- [ ] Materializar `user_plan_view`
- [ ] TTL para tabelas de log
- [ ] Versionar APIs
- [ ] Dead-letter queue para webhooks pagamento
- [ ] CI/CD com testes
- [ ] Remote logging
- [ ] Service worker / offline mode
- [ ] Mover service_role_key de vault para env var
- [ ] Auto-audit em triggers de tabelas criticas

---

*— Sherlock, diagnosticando com precisao 🔬*
