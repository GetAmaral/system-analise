# Analise Comparativa: Documentacao de Features vs Auditoria Sherlock

**Data da analise:** 2026-03-13
**Fontes:**
- Documentacao de features: repositorio GetAmaral/system-analise (29 features documentadas)
- Auditoria Sherlock: 2026-03-10 (escopo completo: Frontend, N8N, Edge Functions, Database, Seguranca, QA)

---

## Indice

1. [Resumo Executivo](#resumo-executivo)
2. [Analise por Feature](#analise-por-feature)
3. [Tabela de Gaps Consolidada](#tabela-de-gaps-consolidada)
4. [Riscos e Bugs Combinados](#riscos-e-bugs-combinados)
5. [Preocupacoes de UX](#preocupacoes-de-ux)
6. [Prioridade de Testes](#prioridade-de-testes)
7. [Sumario Final](#sumario-final)

---

## Resumo Executivo

| Metrica | Valor |
|---------|-------|
| Features documentadas | 29 |
| Features confirmadas pela auditoria | 12 (listadas originalmente) |
| Features descobertas pela auditoria (nao documentadas inicialmente) | 24 |
| Features documentadas NAO cobertas pela auditoria | 0 |
| Gaps na documentacao (encontrados pela auditoria) | 17 |
| Gaps na auditoria (documentados mas nao detalhados) | 4 |
| Informacoes conflitantes | 8 |
| Problemas criticos combinados | 12 |
| Problemas altos combinados | 19 |
| Problemas de UX identificados | 23 |

**Conclusao principal:** A documentacao e SIGNIFICATIVAMENTE mais detalhada que a auditoria em termos de fluxos de dados, schemas, e analise arquitetural. A auditoria, por sua vez, e mais abrangente na descoberta de features nao listadas e problemas de seguranca sistematicos. Juntas, formam uma visao completa do sistema, mas revelam inconsistencias preocupantes.

---

## Analise por Feature

### Feature 01 — Agendamento Proprio (Criar Eventos)

| Dimensao | Analise |
|----------|---------|
| **Consistencia Docs vs Audit** | ALTA. Ambos documentam o fluxo frontend + N8N, tabela `calendar`, trigger `tr_sync_calendar_to_google`, e Edge Function `google-calendar`. A auditoria confirma o status como "OK". |
| **Gaps na docs** | Nenhum significativo. Docs sao mais detalhadas que a auditoria neste ponto. |
| **Gaps na auditoria** | Auditoria nao detalha: (1) que `reminder` e hardcoded como `true` no frontend, (2) que RRULE nao e validado pelo Zod, (3) o problema de idempotencia no N8N. |
| **Conflitos** | Nenhum. |
| **Bugs/Riscos** | **Docs:** reminder sempre true, RRULE sem validacao, race condition optimistic + realtime, N8N sem validacao de datas. **Audit:** URL Supabase hardcoded (useGoogleCalendar.ts:301), timezone hardcoded. Combinado: 7 riscos. |
| **UX** | Usuario nao pode criar evento SEM lembrete pelo site. Todos eventos geram notificacao indesejada. |
| **Prioridade de teste** | ALTA — fluxo central, multiplos bugs documentados. |

---

### Feature 02 — Consulta de Compromissos

| Dimensao | Analise |
|----------|---------|
| **Consistencia Docs vs Audit** | ALTA. Auditoria confirma status "OK". |
| **Gaps na docs** | Nenhum. |
| **Gaps na auditoria** | Auditoria nao menciona: (1) AI similarity matching com threshold 0.90, (2) busca sem paginacao carregando TODOS eventos, (3) exdates comparacao por toDateString(). |
| **Conflitos** | Nenhum. |
| **Bugs/Riscos** | SELECT sem paginacao (performance), AI matching com latencia 2-5s, exdates perde informacao de hora. |
| **UX** | Busca via WhatsApp lenta (2-5s para AI scoring). Flickering possivel com real-time + muitos eventos. |
| **Prioridade de teste** | MEDIA — funcionalidade core mas bugs sao de performance, nao funcionais. |

---

### Feature 03 — Modificacao de Compromissos

| Dimensao | Analise |
|----------|---------|
| **Consistencia Docs vs Audit** | ALTA. Auditoria confirma status "OK". |
| **Gaps na docs** | Nenhum. |
| **Gaps na auditoria** | Auditoria nao menciona: (1) PUT vs PATCH inconsistencia entre frontend e N8N, (2) drag & drop de recorrentes modifica master, (3) sem undo. |
| **Conflitos** | Nenhum. |
| **Bugs/Riscos** | PUT vs PATCH (perde dados no Google), drag em recorrentes afeta TODAS ocorrencias, last-write-wins sem deteccao. |
| **UX** | CRITICO: arrastar ocorrencia de evento recorrente modifica TODAS as ocorrencias. Sem undo para edicoes. |
| **Prioridade de teste** | ALTA — drag & drop de recorrentes pode confundir e frustrar usuarios. |

---

### Feature 04 — Exclusao de Compromissos

| Dimensao | Analise |
|----------|---------|
| **Consistencia Docs vs Audit** | ALTA. |
| **Gaps na docs** | Nenhum. |
| **Gaps na auditoria** | Auditoria nao menciona: (1) exclusao de ocorrencia unica via exdates, (2) N8N nao suporta exclusao de ocorrencia unica, (3) sem soft delete. |
| **Conflitos** | Nenhum. |
| **Bugs/Riscos** | exdates por toDateString (mesma issue da busca), sem soft delete, Google delete pode falhar silenciosamente. |
| **UX** | DELETE permanente sem lixeira. Se Google falha, inconsistencia entre plataformas. |
| **Prioridade de teste** | MEDIA — funcionalidade basica, riscos conhecidos. |

---

### Feature 05 — Sincronizacao Google Calendar

| Dimensao | Analise |
|----------|---------|
| **Consistencia Docs vs Audit** | ALTA. Auditoria confirma Edge Functions `google-calendar`, `google-calendar-webhook`, `google-calendar-sync-cron`. |
| **Gaps na docs** | Nenhum — documentacao extremamente detalhada nesta feature. |
| **Gaps na auditoria** | Auditoria menciona problemas mas nao detalha: (1) retry 410 sem limite (recursao infinita), (2) duas implementacoes de processEventChange, (3) webhook handler nao refresha token. |
| **Conflitos** | **Docs:** client secret "no codigo". **Audit:** confirma S24 "Google client secret exposto no codigo da Edge Function". Consistente mas com severidades diferentes — docs trata como risco, audit como MEDIA. Deveria ser ALTA. |
| **Bugs/Riscos** | OAuth state nao assinado (S17), webhook sem HMAC (S15), cron sem auth (S8), recursao 410 infinita, duas chaves de criptografia. Total: 9 riscos. |
| **UX** | Rate limit 5min no sync manual pode frustrar. Eventos all-day ignorados pode confundir usuario que vem do Google Calendar. |
| **Prioridade de teste** | CRITICA — feature complexa com 9 riscos documentados incluindo seguranca. |

---

### Feature 06 — Lembretes Recorrentes

| Dimensao | Analise |
|----------|---------|
| **Consistencia Docs vs Audit** | ALTA. Auditoria confirma N8N `Lembretes Total Assistente` e trigger `reset_recurring_reminders`. |
| **Gaps na docs** | Nenhum. |
| **Gaps na auditoria** | Auditoria nao detalha: (1) janela +-1min que pode perder lembretes, (2) sem deduplicacao de notificacao, (3) plan_status check pode bloquear lembrete criado quando tinha plano. |
| **Conflitos** | Nenhum. |
| **Bugs/Riscos** | Janela de +-1min (lembrete perdido se N8N atrasa), sem retry se WhatsApp falha, duracao fixa 15min, duas tabelas duplicadas (calendar + calendar_vip). |
| **UX** | Usuario pode criar lembrete e NUNCA recebe-lo se plano expirar. Antecedencia de 30min nao configuravel. |
| **Prioridade de teste** | ALTA — lembretes perdidos sao criticos para confianca do usuario. |

---

### Feature 07 — Agenda Diaria Automatica (Premium)

| Dimensao | Analise |
|----------|---------|
| **Consistencia Docs vs Audit** | ALTA. Auditoria confirma Schedule Trigger 7AM no Main. |
| **Gaps na docs** | Nenhum. |
| **Gaps na auditoria** | Auditoria nao menciona: (1) eventos recorrentes NAO expandidos na agenda diaria, (2) sem opt-out, (3) grace period de 7 dias na query de elegibilidade. |
| **Conflitos** | Nenhum. |
| **Bugs/Riscos** | Eventos recorrentes nao aparecem (BUG funcional), sem opt-out, horario fixo 7h. |
| **UX** | CRITICO: usuario com lembrete diario recorrente NAO ve na agenda diaria. Sem forma de desativar envio. |
| **Prioridade de teste** | ALTA — bug funcional confirmado (recorrentes nao expandidos). |

---

### Feature 08 — VIP Calendar (Phone-Based)

| Dimensao | Analise |
|----------|---------|
| **Consistencia Docs vs Audit** | ALTA. Auditoria classifica como S4 CRITICO (telefone = auth). |
| **Gaps na docs** | Nenhum — documentacao alinhada com severidade da auditoria. |
| **Gaps na auditoria** | Auditoria nao menciona: (1) XSS no HTML de callback, (2) dead code `renderSuccessRedirect`, (3) scopes excessivos do OAuth, (4) sem revocacao de token no disconnect. |
| **Conflitos** | Nenhum — ambos concordam na severidade CRITICA. |
| **Bugs/Riscos** | ZERO autenticacao, phone como OAuth state, XSS em HTML, sem revogacao. SEVERIDADE MAXIMA. |
| **UX** | Funcionalidade perigosa para usuarios VIP — qualquer pessoa pode manipular calendarios. |
| **Prioridade de teste** | CRITICA — vulnerabilidade de seguranca confirmada por ambas fontes. |

---

### Feature 09 — Login via OTP

| Dimensao | Analise |
|----------|---------|
| **Consistencia Docs vs Audit** | ALTA. Auditoria confirma Edge Functions `start-otp-login` + `verify-otp-secure`, tabela `two_factor_sessions`. |
| **Gaps na docs** | Nenhum. |
| **Gaps na auditoria** | Auditoria menciona salt `_salt_2024` (S10) mas nao detalha: (1) PROJECT_URL hardcoded, (2) sem cleanup automatico de pending_2fa_sessions, (3) rate limit por IP pode bloquear NAT. |
| **Conflitos** | **Docs:** delete-account "requer JWT". **Audit (S19):** "janela de 5min, sem auth real" e "valida created_at". Conflito sobre nivel de seguranca do delete-account. |
| **Bugs/Riscos** | Salt estatico, sem cleanup de sessoes, rate limit por NAT, sem deteccao de device novo. |
| **UX** | Resend cooldown 60s pode frustrar. Rate limit em escritorios pode bloquear colegas. |
| **Prioridade de teste** | ALTA — fluxo critico de autenticacao. |

---

### Feature 10 — Google OAuth Login

| Dimensao | Analise |
|----------|---------|
| **Consistencia Docs vs Audit** | ALTA. Auditoria confirma `signInWithGoogle`, callback `/auth/callback`. |
| **Gaps na docs** | Nenhum. |
| **Gaps na auditoria** | Auditoria nao detalha: (1) bypass completo de 2FA, (2) email_stats=true sem consentimento (LGPD), (3) tokens no URL hash. |
| **Conflitos** | Nenhum. |
| **Bugs/Riscos** | Bypass de 2FA, auto-creation sem LGPD compliance, tokens no hash. |
| **UX** | Rapido e conveniente mas sem 2FA. Profile criado sem onboarding adequado. |
| **Prioridade de teste** | MEDIA — funciona mas com implicacoes de privacidade. |

---

### Feature 11 — 2FA Legado

| Dimensao | Analise |
|----------|---------|
| **Consistencia Docs vs Audit** | MEDIA. Auditoria confirma tabela `two_factor_sessions` mas nao distingue entre sistema legado e novo. |
| **Gaps na docs** | Nenhum. |
| **Gaps na auditoria** | Auditoria nao identifica que existem DOIS sistemas de 2FA coexistindo (legado com email plain text vs novo com hash). |
| **Conflitos** | **CONFLITO IMPORTANTE:** Auditoria trata `two_factor_sessions` e `pending_2fa_sessions` como partes do mesmo sistema, mas documentacao revela que sao sistemas SEPARADOS em coexistencia — legado vs novo. |
| **Bugs/Riscos** | Email em plain text na tabela legada, IP potencialmente em plain text, sem deprecation path claro. |
| **UX** | Dois fluxos de 2FA podem causar comportamento inconsistente entre sessoes. |
| **Prioridade de teste** | ALTA — testar se fluxo legado ainda e acionado em algum cenario. |

---

### Feature 12 — RBAC e Controle de Planos

| Dimensao | Analise |
|----------|---------|
| **Consistencia Docs vs Audit** | ALTA. Auditoria confirma `user_roles`, enum `app_role`, funcao `has_role()`. |
| **Gaps na docs** | Nenhum. |
| **Gaps na auditoria** | Auditoria nao detalha: (1) plan_type como TEXT sem enum e perigoso, (2) NULL = lifetime premium, (3) 89+ funcoes SECURITY DEFINER como superficie de ataque. Audit menciona S13 (controle client-side) mas nao aprofunda. |
| **Conflitos** | **Docs:** tabela features x planos detalhada (Free/Standard/Premium). **Audit:** nao tem esta tabela. Complementar, nao conflitante. |
| **Bugs/Riscos** | plan_type TEXT permite inconsistencia, NULL = lifetime perigoso, logica duplicada em 3 camadas, RBAC sem frontend admin. |
| **UX** | PlanBlocker mostra preco R$37,90 hardcoded — pode estar desatualizado. |
| **Prioridade de teste** | ALTA — controle de acesso e fundamento do modelo de negocio. |

---

### Feature 13 — Gestao de Conta

| Dimensao | Analise |
|----------|---------|
| **Consistencia Docs vs Audit** | ALTA. Auditoria identifica S2 (create-user-admin sem auth) e S3 (sync-profile-to-auth lista todos usuarios) como CRITICOS. |
| **Gaps na docs** | Nenhum — documentacao concorda com severidade. |
| **Gaps na auditoria** | Auditoria nao detalha: (1) check-email-exists vaza hasSubscription, (2) delete-account sem confirmacao extra (senha/OTP). |
| **Conflitos** | **Docs:** delete-account "Seguro (requer auth)". **Audit (S19):** "Janela de 5min, sem auth real". A docs e mais recente e parece ter avaliacao diferente do nivel de seguranca. Necessita verificacao. |
| **Bugs/Riscos** | create-user-admin e sync-profile sem auth (CRITICO), email enumeration, CORS wildcard, listUsers() sem paginacao (OOM). |
| **UX** | Email enumeration expoe se usuario e pagante. Delete sem confirmacao forte. |
| **Prioridade de teste** | CRITICA — vulnerabilidades S2/S3 confirmadas por ambas fontes. |

---

### Feature 14 — Roteador Principal (Main Workflow)

| Dimensao | Analise |
|----------|---------|
| **Consistencia Docs vs Audit** | ALTA. Auditoria detalha Main com WhatsApp Trigger, Schedule Trigger 7AM, Bot Guard. |
| **Gaps na docs** | Nenhum. |
| **Gaps na auditoria** | Auditoria nao menciona: (1) onboarding em phones_whatsapp separado de profiles, (2) sem webhook signature verification do Graph API, (3) tres providers WhatsApp simultaneos (Q3). |
| **Conflitos** | **Docs:** lista Graph API e Evolution como ativos, Z-API como "referenciado mas nao identificado como ativo". **Audit (Q3):** lista "3 provedores WhatsApp simultaneos". Discordancia sobre se Z-API e ativo. |
| **Bugs/Riscos** | Phone Number ID hardcoded, sem verificacao de assinatura webhook, sem rate limiting real. |
| **UX** | Forward filter bloqueia audios encaminhados do proprio usuario — frustrante. |
| **Prioridade de teste** | ALTA — ponto de entrada de todo trafego WhatsApp. |

---

### Feature 15 — Fluxo Premium (AI Agent)

| Dimensao | Analise |
|----------|---------|
| **Consistencia Docs vs Audit** | ALTA. Auditoria confirma GPT-4.1-mini, Redis memory, Mistral OCR. |
| **Gaps na docs** | Nenhum. |
| **Gaps na auditoria** | Auditoria nao menciona: (1) HTTP sem HTTPS entre instancias N8N, (2) sem fallback de AI provider, (3) sem maxTokens configurado (custo imprevisivel), (4) URLs internas expostas no JSON. |
| **Conflitos** | **Audit:** transcricao "disponivel para nao-pagantes". **Docs (Feature 17):** confirma que Standard tem MESMAS capacidades. Consistente — ambos identificam o problema. |
| **Bugs/Riscos** | HTTP plain entre instancias, phone como Redis key sem hash, sem fallback AI, custo sem controle. |
| **UX** | TTL Redis 1h — usuario perde contexto de conversa frequentemente. |
| **Prioridade de teste** | ALTA — fluxo principal de interacao para premium. |

---

### Feature 16 — Fluxo Standard

| Dimensao | Analise |
|----------|---------|
| **Consistencia Docs vs Audit** | **CONFLITO SIGNIFICATIVO.** |
| **Gaps na docs** | Nenhum. |
| **Gaps na auditoria** | Auditoria descreve Standard como "versao simplificada: sem Agent, sem Think Tool, sem Redis memory, sem OCR". **Documentacao diz o OPOSTO:** "workflows funcionalmente identicos", "NAO ha diferenca funcional". |
| **Conflitos** | **CONFLITO CRITICO:** Audit diz que Standard e simplificado. Docs dizem que sao identicos. Este e o conflito MAIS GRAVE da analise. Um dos dois esta errado. Se docs estao corretas, e um bug de negocio critico (billing bypass). Se audit esta correta, docs estao erradas. **NECESSITA VERIFICACAO IMEDIATA.** |
| **Bugs/Riscos** | Se docs estao corretas: billing bypass total via WhatsApp. Se audit esta correta: documentacao imprecisa. |
| **UX** | Se identicos: usuario paga premium sem motivo. Se diferentes: experiencia consistente com plano. |
| **Prioridade de teste** | **CRITICA** — verificar empiricamente se workflows sao identicos ou diferentes. |

---

### Feature 17 — Transcricao de Audio

| Dimensao | Analise |
|----------|---------|
| **Consistencia Docs vs Audit** | ALTA. Auditoria confirma OpenAI Whisper, "disponivel para nao-pagantes". |
| **Gaps na docs** | Nenhum. |
| **Gaps na auditoria** | Auditoria nao detalha: (1) language `pt` hardcoded, (2) sem limite de duracao, (3) sem feedback "Transcrevendo...". |
| **Conflitos** | Nenhum. |
| **Bugs/Riscos** | Sem limite de duracao (custo), language hardcoded, forward filter bloqueia audios legitimos. |
| **UX** | Sem indicador de processamento — usuario envia duplicatas. Audio encaminhado do proprio usuario bloqueado. |
| **Prioridade de teste** | MEDIA — funcional mas com riscos de custo e UX. |

---

### Feature 18 — OCR de Imagens e PDFs

| Dimensao | Analise |
|----------|---------|
| **Consistencia Docs vs Audit** | ALTA. Auditoria confirma Mistral AI OCR no User Premium. |
| **Gaps na docs** | Nenhum. |
| **Gaps na auditoria** | Auditoria nao menciona: (1) include_image_base64 desnecessario, (2) sem cache (duplica custo), (3) dados sensiveis em transito. |
| **Conflitos** | Nenhum. |
| **Bugs/Riscos** | Sem limite de tamanho (OOM), base64 em memoria, sem feedback de processamento. |
| **UX** | Sem indicador de progresso durante OCR. PDF grande pode causar timeout silencioso. |
| **Prioridade de teste** | MEDIA — funcional mas com riscos de estabilidade. |

---

### Feature 19 — Bot Guard

| Dimensao | Analise |
|----------|---------|
| **Consistencia Docs vs Audit** | MEDIA. Auditoria confirma Bot Guard com RPC `check_bot_guard`, tabelas `bot_events`, `bot_blocks`. Docs descrevem mecanismo diferente (Redis debounce no Main Router). |
| **Gaps na docs** | Docs nao mencionam: RPC `check_bot_guard`, tabelas `bot_events` e `bot_blocks`, hash FNV-1a. Focam em Redis debounce. |
| **Gaps na auditoria** | Auditoria nao menciona: (1) filtro de delivery receipts, (2) forward filter, (3) self-message filter, (4) onboarding stages. |
| **Conflitos** | **CONFLITO:** Docs descrevem Bot Guard como Redis debounce + filtros no N8N. Auditoria descreve como RPC SQL + tabelas. Provavel que AMBOS existam — duas camadas de protecao — mas nenhuma fonte documenta o sistema completo. |
| **Bugs/Riscos** | Sem rate limiting real (apenas debounce), sem blacklist, forward filter agressivo. |
| **UX** | Audios encaminhados do proprio usuario bloqueados. Sem feedback quando mensagem e filtrada. |
| **Prioridade de teste** | MEDIA — protetor, nao feature principal. |

---

### Feature 20 — Despesas e Receitas (CRUD Financeiro)

| Dimensao | Analise |
|----------|---------|
| **Consistencia Docs vs Audit** | ALTA. Auditoria confirma N8N `Financeiro - Total`, frontend `AddExpenseModal`, tabela com tipo `entrada`/`saida`. |
| **Gaps na docs** | Nenhum. |
| **Gaps na auditoria** | Auditoria nao detalha: (1) race condition optimistic + realtime (Q26), (2) temp ID colisao Date.now() (Q27), (3) timezone mismatch client vs UTC. Porem Q26/Q27 aparecem na secao de hooks da auditoria. |
| **Conflitos** | Nenhum — complementares. |
| **Bugs/Riscos** | Race condition, timezone mismatch, sem soft delete, sem audit trail, sem transacoes recorrentes, tabela chamada "spent" para receitas+despesas (semanticamente confuso). |
| **UX** | "Flash" visual quando optimistic update e realtime conflitam. Transacao do dia 31 pode aparecer no mes errado por timezone. |
| **Prioridade de teste** | ALTA — feature core do sistema financeiro. |

---

### Feature 21 — Limites por Categoria

| Dimensao | Analise |
|----------|---------|
| **Consistencia Docs vs Audit** | ALTA. Auditoria confirma `useCategoryLimits`, tabela `category_limits`, alerta em 80%. |
| **Gaps na docs** | Nenhum. |
| **Gaps na auditoria** | Auditoria menciona "sem validacao de limites negativos" e "toast sem detalhe tecnico" mas nao detalha que limite NAO e enforced no insert. |
| **Conflitos** | Nenhum. |
| **Bugs/Riscos** | Limite apenas visual (nao impede gastos), calculo client-side, sem notificacao push, sem historico. |
| **UX** | Limite nao bloqueia gastos — expectativa do usuario pode ser diferente. Sem notificacao proativa. |
| **Prioridade de teste** | MEDIA — feature Premium, risco funcional claro. |

---

### Feature 22 — Metas Financeiras

| Dimensao | Analise |
|----------|---------|
| **Consistencia Docs vs Audit** | ALTA. Auditoria confirma `useFinancialGoals`, campos em `profiles`. |
| **Gaps na docs** | Nenhum. |
| **Gaps na auditoria** | Auditoria menciona "sem validacao de input, NaN nao tratado" mas nao detalha: (1) threshold dia 25/75% hardcoded, (2) sem notificacao fora do dashboard, (3) timezone na verificacao do dia. |
| **Conflitos** | Nenhum. |
| **Bugs/Riscos** | Armazenado em profiles (sem historico), 100% client-side, alerta sem acao. |
| **UX** | Alerta do dia 25 so visivel se abrir o app. Sem notificacao push ou WhatsApp. |
| **Prioridade de teste** | BAIXA — feature visual, baixo risco funcional. |

---

### Feature 23 — Limite Mensal de Gasto

| Dimensao | Analise |
|----------|---------|
| **Consistencia Docs vs Audit** | ALTA. Auditoria confirma `useSpendingLimit`, divisao por zero possivel, limite default 1000 hardcoded. |
| **Gaps na docs** | Nenhum. |
| **Gaps na auditoria** | Auditoria menciona "divisao por zero possivel" e "DST bug no calculo de mes" — docs nao mencionam DST bug. |
| **Conflitos** | **NOVO BUG da auditoria:** DST bug no calculo de mes nao documentado nas feature docs. |
| **Bugs/Riscos** | Default arbitrario R$1000, nao bloqueia inserts, timezone, divisao por zero, DST bug. Redundancia com limites por categoria sem integracao. |
| **UX** | Default silencioso de R$1000 pode alarmar usuarios que nao sabem que existe. Sem onboarding. |
| **Prioridade de teste** | MEDIA — risco de DST bug merece verificacao. |

---

### Feature 24 — Portfolio de Investimentos

| Dimensao | Analise |
|----------|---------|
| **Consistencia Docs vs Audit** | ALTA. Auditoria confirma frontend `InvestmentsView`, Edge Function `fetch-market-data`, tabela `investments`. |
| **Gaps na docs** | Nenhum. |
| **Gaps na auditoria** | Auditoria confirma S7 (fetch-market-data sem rate limit) mas nao detalha: (1) market_symbol nao existe no banco, (2) taxas Tesouro hardcoded, (3) historico de portfolio FALSO, (4) DECIMAL(10,2) limita portfolios grandes. |
| **Conflitos** | Nenhum — complementares. |
| **Bugs/Riscos** | **12 riscos listados na documentacao** — mais que qualquer outra feature. market_symbol faltante, taxas falsas, grafico historico fake, sem quantidade de ativos, APIs sem resiliencia. |
| **UX** | CRITICO: usuario toma decisoes financeiras baseado em taxas HARDCODED do Tesouro. Grafico de 6 meses e FALSO — redistribui valores atuais linearmente. |
| **Prioridade de teste** | CRITICA — dados financeiros incorretos podem causar dano real ao usuario. |

---

### Feature 25 — Hotmart Webhook

| Dimensao | Analise |
|----------|---------|
| **Consistencia Docs vs Audit** | ALTA. Auditoria confirma Edge Function `hotmart-webhook`, tabelas, RPCs, auto-criacao de perfil. |
| **Gaps na docs** | Nenhum. |
| **Gaps na auditoria** | Auditoria menciona S16 (sem HMAC) mas nao detalha: (1) "Standard Plan" mapeia para premium (confuso), (2) sem validacao de valor (amount), (3) refund nao revoga acesso imediato, (4) grace period nao enforced. |
| **Conflitos** | Nenhum. |
| **Bugs/Riscos** | Sem HMAC, mapeamento confuso de plano, sem validacao de valor, refund mantendo acesso, grace period morto. |
| **UX** | Compra chamada "Standard Plan" da acesso Premium — confuso. |
| **Prioridade de teste** | CRITICA — gateway de pagamento com falhas de seguranca. |

---

### Feature 26 — Checkout e Planos

| Dimensao | Analise |
|----------|---------|
| **Consistencia Docs vs Audit** | MEDIA. Auditoria confirma URLs hardcoded (Q1) e PricingSection com precos. |
| **Gaps na docs** | Nenhum. |
| **Gaps na auditoria** | Auditoria nao detalha: (1) precos INCONSISTENTES entre componentes (R$97 vs R$37,90), (2) upgrade-mensal = upgrade-anual (mesmo offer code), (3) recibo menciona Kiwify (sistema usa Hotmart). |
| **Conflitos** | **CONFLITO DE PRECOS:** Docs documentam R$97/ano e R$37,90/mes como precos diferentes em componentes diferentes. Audit lista R$0/R$9,90/R$19,90 no PricingSection. Tres precos diferentes para os mesmos planos. |
| **Bugs/Riscos** | Precos inconsistentes (confusao do usuario), cancelamento nao implementado, recibo menciona gateway errado. |
| **UX** | CRITICO: usuario ve precos diferentes dependendo de onde olha. Cancelamento prometido mas nao funciona. |
| **Prioridade de teste** | CRITICA — inconsistencia de precos e experiencia de compra. |

---

### Feature 27 — Gestao de Assinatura

| Dimensao | Analise |
|----------|---------|
| **Consistencia Docs vs Audit** | ALTA. Auditoria confirma triggers de linking, funcoes SQL. |
| **Gaps na docs** | Nenhum. |
| **Gaps na auditoria** | Auditoria menciona Q11 (grace period deprecated) e Q10 (botao cancelar desabilitado) mas nao detalha: (1) getDaysInGracePeriod() retorna null (funcao quebrada), (2) estado em 3 tabelas, (3) Kiwify como dead infrastructure. |
| **Conflitos** | **CONFLITO MENOR:** Auditoria diz grace_period_end = end_date + 30 dias. Docs dizem webhook calcula grace como +7 dias para overdue. Valores diferentes para grace period. |
| **Bugs/Riscos** | Grace period morto, funcao quebrada, estado distribuido, cancelamento nao implementado, Kiwify abandonado. |
| **UX** | Frontend mostra notificacao de grace period mas features ja estao bloqueadas — confuso e frustrante. |
| **Prioridade de teste** | ALTA — ciclo de vida da assinatura afeta revenue. |

---

### Feature 28 — Relatorio PDF via WhatsApp

| Dimensao | Analise |
|----------|---------|
| **Consistencia Docs vs Audit** | ALTA. Auditoria confirma N8N `Relatorios Mensais-Semanais`, PDFco, triggers semanais/mensais. |
| **Gaps na docs** | Nenhum. |
| **Gaps na auditoria** | Auditoria confirma Q1 (Gotenberg nao utilizado) e Q2 (3 estrategias de PDF) mas nao detalha: (1) edge function `generate-monthly-report` nao existe (feature quebrada), (2) sem opt-out, (3) sem arquivo historico, (4) 12 riscos listados na docs. |
| **Conflitos** | **CONFLITO:** Auditoria diz Feature 6 "PARCIAL" porque usa PDFco e nao Gotenberg. Docs confirmam e expandem: frontend usa jsPDF, N8N usa PDFco, Gotenberg existe mas e ignorado. Tres sistemas paralelos. |
| **Bugs/Riscos** | Edge function faltante (frontend quebrado), sem opt-out, sem retry, PDFs nao salvos, 3 estrategias de PDF diferentes. |
| **UX** | CRITICO: frontend tenta chamar edge function que NAO existe — feature quebrada. Sem opt-out para relatorios automaticos. |
| **Prioridade de teste** | CRITICA — feature parcialmente quebrada confirmada por ambas fontes. |

---

### Feature 29 — Export Frontend (PDF + Excel)

| Dimensao | Analise |
|----------|---------|
| **Consistencia Docs vs Audit** | ALTA. Auditoria confirma frontend usa biblioteca XLSX e jsPDF. |
| **Gaps na docs** | Nenhum. |
| **Gaps na auditoria** | Auditoria nao detalha: (1) exporta TODAS transacoes ignorando filtros, (2) pode travar browser com dataset grande (Q23 menciona sem paginacao em useExpenses), (3) duplicacao com sistema N8N. |
| **Conflitos** | Nenhum. |
| **Bugs/Riscos** | Client-side only (pode travar), ignora filtros, duplica relatorio N8N. |
| **UX** | Exporta tudo ignorando filtros aplicados — confuso. Dataset grande pode travar navegador. |
| **Prioridade de teste** | BAIXA — funcional mas com limites de escala. |

---

## Tabela de Gaps Consolidada

### Gaps na Documentacao (coisas que a auditoria encontrou e nao estavam documentadas)

| # | Gap | Severidade | Feature Afetada |
|---|-----|-----------|-----------------|
| G1 | JWT verify=false em TODAS edge functions (config.toml) | CRITICA | Todas as Edge Functions |
| G2 | Chave criptografia `google_calendar_secret_key_2024` hardcoded em N8N | CRITICA | Sync Google Calendar |
| G3 | Service role key em vault.decrypted_secrets | MEDIA | Database |
| G4 | Webhook payload JSONB pode conter dados sensiveis | MEDIA | Hotmart Webhook |
| G5 | OAuth state userId em base64 | MEDIA | Google Calendar |
| G6 | DOMPurify supply chain risk | MEDIA | Frontend Utils |
| G7 | DST bug no calculo de mes (useSpendingLimit) | MEDIA | Limite Mensal |
| G8 | TOAST_REMOVE_DELAY = 1000000ms (~11.5 dias) | BAIXA | Frontend Global |
| G9 | Hook morto useRedirectFreePlan | BAIXA | Frontend |
| G10 | Categorias com acento inconsistente (educacao vs educacao) | BAIXA | Financeiro |
| G11 | Tabela reminder potencialmente fantasma | BAIXA | Lembretes |
| G12 | Schemas de validacao duplicados (utils vs lib) | BAIXA | Frontend |
| G13 | Sem Error Boundaries no React | MEDIA | Frontend Global |
| G14 | Sem monitoramento (Sentry/Datadog) | ALTA | Infraestrutura |
| G15 | Sem health checks | ALTA | Infraestrutura |
| G16 | Sem backup documentado | ALTA | Database |
| G17 | Sem CI/CD com testes | ALTA | Infraestrutura |

### Gaps na Auditoria (coisas documentadas que a auditoria nao cobriu em detalhe)

| # | Gap | Severidade | Feature |
|---|-----|-----------|---------|
| GA1 | Fluxo Standard vs Premium identico ou nao (conflito entre fontes) | CRITICA | Fluxo Standard |
| GA2 | Edge function `generate-monthly-report` nao existe (frontend quebrado) | ALTA | Relatorios |
| GA3 | Precos inconsistentes entre componentes (R$97 vs R$37,90 vs R$9,90/R$19,90) | ALTA | Checkout |
| GA4 | Grace period morto (calculado mas ignorado em funcoes SQL e frontend) | ALTA | Gestao Assinatura |

---

## Riscos e Bugs Combinados

### Severidade CRITICA (exige acao imediata)

| # | Risco | Fonte | Feature |
|---|-------|-------|---------|
| C1 | JWT verify=false em TODAS edge functions | Audit S1 | Global |
| C2 | create-user-admin sem autenticacao | Ambos | Gestao de Conta |
| C3 | sync-profile-to-auth lista todos usuarios publicamente | Ambos | Gestao de Conta |
| C4 | VIP Calendar: telefone como unica credencial | Ambos | VIP Calendar |
| C5 | Chave cripto hardcoded em N8N | Audit S5 | Google Calendar |
| C6 | Workflows Standard e Premium possivelmente identicos (billing bypass) | Docs | Fluxo Standard |
| C7 | Dados financeiros incorretos (taxas Tesouro hardcoded, grafico falso) | Docs | Investimentos |
| C8 | Edge function generate-monthly-report nao existe | Docs | Relatorios |
| C9 | Precos inconsistentes em multiplos componentes | Docs | Checkout |
| C10 | market_symbol nao existe no banco (impossivel linkar a ticker) | Docs | Investimentos |
| C11 | "Standard Plan" na Hotmart mapeia para premium | Docs | Hotmart Webhook |
| C12 | Email em profiles sem UNIQUE constraint | Audit S12 | Database |

### Severidade ALTA (proximo sprint)

| # | Risco | Fonte | Feature |
|---|-------|-------|---------|
| A1 | check-email-exists permite enumeracao + vaza hasSubscription | Ambos | Gestao Conta |
| A2 | fetch-market-data sem rate limit (DDoS relay) | Audit S7 | Investimentos |
| A3 | Salt estatico _salt_2024 em OTP | Audit S10 | Login OTP |
| A4 | Hotmart webhook sem HMAC | Ambos | Pagamentos |
| A5 | Google Calendar webhook sem HMAC | Ambos | Google Calendar |
| A6 | Controle de acesso apenas client-side (usePlanAccess) | Audit S13 | RBAC |
| A7 | 2FA token em sessionStorage (XSS risk) | Audit S14 | Autenticacao |
| A8 | Grace period morto (calculado, ignorado) | Ambos | Assinatura |
| A9 | getDaysInGracePeriod() retorna null (funcao quebrada) | Docs | Assinatura |
| A10 | Cancelamento nao implementado | Ambos | Checkout |
| A11 | Lembretes com janela +-1min (pode perder) | Docs | Lembretes |
| A12 | Eventos recorrentes NAO expandidos na agenda diaria | Docs | Agenda Diaria |
| A13 | Sem opt-out para envios automaticos (agenda, relatorios) | Docs | Agenda/Relatorios |
| A14 | Race condition optimistic update + realtime | Ambos | Despesas |
| A15 | Recursao 410 sem limite no Google sync | Docs | Google Calendar |
| A16 | Drag & drop de recorrentes modifica master | Docs | Modificacao |
| A17 | Sem monitoramento, health checks, backup | Audit | Infraestrutura |
| A18 | Sem CI/CD com testes | Audit Q16 | Infraestrutura |
| A19 | Sem Error Boundaries no React | Audit Q19 | Frontend |

---

## Preocupacoes de UX

| # | Preocupacao | Severidade UX | Feature |
|---|-------------|---------------|---------|
| U1 | Precos diferentes em paginas diferentes | CRITICA | Checkout |
| U2 | Grafico de investimentos mostra dados FALSOS | CRITICA | Investimentos |
| U3 | Taxas de renda fixa hardcoded (decisoes financeiras erradas) | CRITICA | Investimentos |
| U4 | Cancelamento prometido mas nao funciona | ALTA | Checkout |
| U5 | Relatorio PDF via frontend quebrado (edge function faltante) | ALTA | Relatorios |
| U6 | Grace period notificado mas features ja bloqueadas | ALTA | Assinatura |
| U7 | Eventos recorrentes nao aparecem na agenda diaria | ALTA | Agenda Diaria |
| U8 | Drag de evento recorrente modifica TODAS ocorrencias | ALTA | Calendario |
| U9 | Reminder hardcoded true — todos eventos geram notificacao | MEDIA | Agendamento |
| U10 | Sem opt-out para agenda diaria e relatorios | MEDIA | Agenda/Relatorios |
| U11 | Horario fixo 7h para agenda diaria | MEDIA | Agenda Diaria |
| U12 | Audio encaminhado do proprio usuario bloqueado | MEDIA | Bot Guard |
| U13 | Sem indicador de processamento (audio, OCR) | MEDIA | Transcricao/OCR |
| U14 | TTL Redis 1h — contexto da conversa reseta | MEDIA | Fluxo Premium |
| U15 | Toast permanece 11.5 dias na tela | MEDIA | Frontend Global |
| U16 | Export ignora filtros aplicados | MEDIA | Export Frontend |
| U17 | Sem undo para edicoes e exclusoes | MEDIA | Calendario/Financeiro |
| U18 | Recibo menciona Kiwify (sistema usa Hotmart) | BAIXA | Checkout |
| U19 | Default R$1000 de limite sem onboarding | BAIXA | Limite Mensal |
| U20 | Busca via WhatsApp lenta (2-5s AI scoring) | BAIXA | Consulta |
| U21 | Sem empty states em algumas views | BAIXA | Frontend |
| U22 | Sem offline indicator | BAIXA | Frontend |
| U23 | Breakpoint mobile 768px hardcoded | BAIXA | Frontend |

---

## Prioridade de Testes

### Ordem Recomendada de Teste (por risco ao negocio e usuario)

| Prioridade | Feature | Justificativa | Tipo de Teste |
|-----------|---------|---------------|---------------|
| **P0** | Fluxo Standard vs Premium | Verificar se billing bypass existe — impacto financeiro direto | Funcional + Comparativo |
| **P0** | Gestao de Conta (Edge Functions) | Vulnerabilidades S2/S3 CRITICAS confirmadas | Seguranca |
| **P0** | VIP Calendar | Zero autenticacao confirmada | Seguranca |
| **P0** | Checkout e Precos | Precos inconsistentes confundem usuario | Funcional + Visual |
| **P1** | Hotmart Webhook | Gateway de pagamento com falhas | Integracao + Seguranca |
| **P1** | Investimentos | Dados incorretos para decisoes financeiras | Funcional + Dados |
| **P1** | Relatorios PDF | Edge function faltante, feature parcialmente quebrada | Funcional |
| **P1** | Gestao de Assinatura | Grace period morto, estado distribuido | Funcional + Integracao |
| **P1** | Sync Google Calendar | 9 riscos documentados | Integracao + Seguranca |
| **P2** | Login OTP | Fluxo critico de autenticacao | Funcional + Seguranca |
| **P2** | RBAC e Planos | Fundamento do modelo de negocio | Funcional |
| **P2** | Despesas e Receitas | Feature core, race conditions | Funcional + Performance |
| **P2** | Lembretes Recorrentes | Janela +-1min, lembretes perdidos | Funcional + Temporalidade |
| **P2** | Agenda Diaria | Recorrentes nao expandidos | Funcional |
| **P2** | Modificacao Compromissos | Drag de recorrentes | UX + Funcional |
| **P3** | Agendamento Proprio | 7 riscos mas funcional | Funcional |
| **P3** | Consulta Compromissos | Performance | Performance |
| **P3** | Exclusao Compromissos | Sem soft delete | Funcional |
| **P3** | Google OAuth | Funcional mas com implicacoes LGPD | Funcional + Compliance |
| **P3** | 2FA Legado | Verificar se ainda e acionado | Funcional |
| **P3** | Roteador Principal | Ponto de entrada WhatsApp | Integracao |
| **P3** | Fluxo Premium | Funcional via WhatsApp | Funcional |
| **P3** | Transcricao Audio | Custo e UX | Funcional |
| **P3** | OCR Imagem/PDF | Estabilidade | Funcional |
| **P4** | Bot Guard | Protetor, nao feature | Funcional |
| **P4** | Limites Categoria | Feature Premium visual | Funcional |
| **P4** | Metas Financeiras | Baixo risco | Funcional |
| **P4** | Limite Mensal | DST bug a verificar | Funcional |
| **P4** | Export Frontend | Funcional com limites | Performance |

---

## Sumario Final

### Numeros Consolidados

| Metrica | Quantidade |
|---------|-----------|
| Total de gaps encontrados | 21 (17 na docs + 4 na auditoria) |
| Informacoes conflitantes | 8 |
| Problemas criticos combinados | 12 |
| Problemas altos combinados | 19 |
| Preocupacoes de UX | 23 |
| Features com risco CRITICO | 7 (Standard, Gestao Conta, VIP, Checkout, Investimentos, Relatorios, Hotmart) |
| Features funcionando corretamente | ~10 (com ressalvas menores) |
| Codigo morto identificado | 5 (useRedirectFreePlan, grace period methods, reminder table, generate-monthly-report, renderSuccessRedirect) |

### Top 5 Inconsistencias Mais Criticas

1. **Standard vs Premium identico ou nao** — conflito direto entre documentacao e auditoria. Se workflows sao identicos, TODO o modelo de monetizacao esta comprometido.

2. **Precos inconsistentes em 3+ locais** — R$97/ano, R$37,90/mes, R$9,90/$19,90/mes aparecem em componentes diferentes. Usuario nao sabe quanto vai pagar.

3. **Grace period: infraestrutura morta** — Calculado no webhook, ignorado nas funcoes SQL de verificacao, funcao frontend retorna null. Tres camadas quebradas.

4. **Bot Guard: duas descricoes diferentes** — Auditoria descreve RPC SQL. Documentacao descreve Redis debounce. Provavelmente coexistem, mas nenhuma fonte documenta o sistema completo.

5. **Dados de investimento fabricados** — Taxas do Tesouro hardcoded e grafico historico que redistribui valores atuais. Usuario toma decisoes financeiras com dados incorretos.

### Features com Maior Risco (ordenadas)

1. **Fluxo Standard** — potencial billing bypass total
2. **Gestao de Conta** — 2 edge functions CRITICAS sem auth
3. **VIP Calendar** — zero autenticacao
4. **Checkout/Planos** — precos inconsistentes + cancelamento quebrado
5. **Investimentos** — dados financeiros incorretos
6. **Hotmart Webhook** — gateway de pagamento sem HMAC
7. **Relatorios** — edge function faltante + 3 sistemas paralelos

### Recomendacao de Acao Imediata

1. **VERIFICAR** se workflows N8N Standard e Premium sao realmente identicos ou diferentes
2. **DESABILITAR** ou proteger `create-user-admin` e `sync-profile-to-auth`
3. **UNIFICAR** precos em constante unica usada por todos componentes
4. **CORRIGIR** funcoes SQL para incluir grace period
5. **CRIAR** edge function `generate-monthly-report` ou remover chamada do frontend
6. **ADICIONAR** coluna `market_symbol` na tabela `investments`
7. **REMOVER** taxas hardcoded do Tesouro e buscar de API real

---

*Analise gerada em 2026-03-13 pela squad QA-UX Inspector*
*Fontes: Documentacao GetAmaral/system-analise + Auditoria Sherlock 2026-03-10*
