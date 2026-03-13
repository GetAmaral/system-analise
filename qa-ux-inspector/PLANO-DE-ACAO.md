# PLANO DE AÇÃO — Squad QA/UX Inspector
**Data:** 2026-03-13
**Status:** Em planejamento
**Base:** Squad `analisador-n8n` (Sherlock)

---

## 1. VISÃO GERAL

### O que é este squad?
Um **Raio-X completo** do Total Assistente. O Inspector testa todas as funcionalidades do sistema de ponta a ponta, compara com a documentação, verifica no banco de dados e no Google Calendar se tudo está correto, e retorna relatórios detalhados com correções priorizadas.

### Diferença do Sherlock (analisador-n8n)
| | Sherlock | Inspector |
|---|---------|-----------|
| **Faz** | Lê logs, mapeia arquitetura, diagnostica erros | Testa features, audita UX, compara docs vs realidade |
| **Modo** | STRICT READ-ONLY | READ + TEST (envia requests para N8N DEV) |
| **Output** | Diagnósticos técnicos | Relatórios de qualidade + guia de correção |
| **Supabase** | Lê estado atual | Lê estado ANTES e DEPOIS do teste |
| **N8N** | Lê execuções passadas | Simula mensagens WhatsApp via webhook DEV |

### Em resumo
- Sherlock = **detetive** (investiga o que aconteceu)
- Inspector = **auditor de qualidade** (testa se funciona e como deveria funcionar)

---

## 2. ESTRUTURA DO SQUAD

```
squads/qa-ux-inspector/
├── squad.yaml                          # Configuração principal
├── README.md                           # Guia rápido
├── agents/
│   └── inspector.md                    # Definição do agente Inspector
├── tasks/
│   ├── test-feature.md                 # Testar uma feature via N8N DEV
│   ├── audit-feature-docs.md           # Comparar docs vs implementação
│   ├── verify-database.md              # Verificar dados no Supabase pós-teste
│   ├── verify-google-calendar.md       # Verificar Google Calendar pós-teste
│   ├── generate-feature-report.md      # Relatório individual por feature
│   ├── generate-priority-report.md     # Relatório geral de prioridades
│   └── suggest-corrections.md          # Guia de correções ordenado
├── workflows/
│   ├── full-feature-audit.yaml         # Testar + verificar + reportar (1 feature)
│   └── batch-test-all.yaml             # Bateria completa (todas features)
├── templates/
│   ├── feature-test-report-tmpl.md     # Modelo de relatório por feature
│   ├── priority-report-tmpl.md         # Modelo do relatório geral
│   └── correction-guide-tmpl.md        # Modelo do guia de correção
├── checklists/
│   ├── test-checklist.md               # O que testar em cada feature
│   └── ux-checklist.md                 # Critérios de UX
├── data/
│   ├── features-catalog.yaml           # As 29 features com endpoints e tabelas
│   ├── test-scenarios.yaml             # Cenários de teste detalhados
│   ├── n8n-dev-endpoints.yaml          # URLs do N8N DEV
│   └── expected-behaviors.yaml         # Comportamento esperado por feature
└── output/
    ├── test-results/                   # Resultados brutos dos testes
    ├── feature-reports/                # Relatórios individuais
    ├── corrections/                    # Guias de correção
    └── priority-report.md             # Documento final de prioridades
```

---

## 3. AS 29 FEATURES QUE SERÃO TESTADAS

### BLOCO A — AGENDA (8 features) ⭐ Prioridade Alta

| # | Feature | O que o Inspector vai testar |
|---|---------|------------------------------|
| A1 | **Agendamento próprio** | Criar evento via WhatsApp DEV → verificar se aparece no Supabase (`calendar`) e no Google Calendar |
| A2 | **Consulta compromissos** | Buscar evento criado → verificar se a resposta do bot está correta e com boa UX |
| A3 | **Modificação compromissos** | Editar evento via WhatsApp DEV → verificar se DB e Google atualizaram |
| A4 | **Exclusão compromissos** | Deletar evento → verificar se sumiu do DB e do Google |
| A5 | **Sync Google Calendar** | Criar evento → verificar se sincronizou bidirecionalmente |
| A6 | **Lembretes recorrentes** | Criar lembrete com recorrência → verificar se dispara no horário certo |
| A7 | **Agenda diária automática** | Verificar se premium recebe agenda às 7h |
| A8 | **VIP Calendar** | Criar evento por telefone → verificar `calendar_vip` |

### BLOCO B — BOT WHATSAPP (6 features) ⭐ Prioridade Alta

| # | Feature | O que o Inspector vai testar |
|---|---------|------------------------------|
| B1 | **Roteador principal** | Enviar mensagem → verificar se roteia premium vs standard corretamente |
| B2 | **Fluxo premium** | Testar TODAS as intenções: financeiro, calendário, relatório, lembrete, conversa geral |
| B3 | **Fluxo standard** | Testar mesmas intenções com limitações de plano |
| B4 | **Transcrição áudio** | Enviar áudio → verificar se transcreve corretamente |
| B5 | **OCR imagem/PDF** | Enviar imagem → verificar se extrai texto |
| B6 | **Bot Guard** | Enviar muitas mensagens rápidas → verificar se bloqueia spam |

### BLOCO C — FINANCEIRO (4 features)

| # | Feature | O que o Inspector vai testar |
|---|---------|------------------------------|
| C1 | **Despesas/Receitas** | CRUD completo via WhatsApp → verificar tabela `spent` |
| C2 | **Limites categoria** | Gastar até 80% do limite → verificar se gera alerta |
| C3 | **Metas financeiras** | Definir meta → verificar cálculo no dashboard |
| C4 | **Limite mensal** | Atingir limite → verificar comportamento |

### BLOCO D — AUTENTICAÇÃO (5 features)

| # | Feature | O que o Inspector vai testar |
|---|---------|------------------------------|
| D1 | **Login OTP** | Fluxo completo email+senha+código |
| D2 | **Google OAuth** | Login Google → verificar profile criado automaticamente |
| D3 | **2FA legado** | Verificar se ainda funciona ou se é código morto |
| D4 | **RBAC/Planos** | Verificar se permissões por plano estão corretas |
| D5 | **Gestão conta** | Editar perfil, ver sessões ativas |

### BLOCO E — PAGAMENTOS (3 features)

| # | Feature | O que o Inspector vai testar |
|---|---------|------------------------------|
| E1 | **Hotmart webhook** | Simular compra/cancelamento → verificar `subscriptions` e `payments` |
| E2 | **Checkout** | Verificar fluxo de checkout e URLs |
| E3 | **Gestão assinatura** | Verificar status, grace period, botão cancelar |

### BLOCO F — RELATÓRIOS (2 features)

| # | Feature | O que o Inspector vai testar |
|---|---------|------------------------------|
| F1 | **Relatório PDF WhatsApp** | Verificar geração e envio semanal/mensal |
| F2 | **Export frontend** | Verificar Excel/PDF export no site |

### BLOCO G — INVESTIMENTOS (1 feature)

| # | Feature | O que o Inspector vai testar |
|---|---------|------------------------------|
| G1 | **Portfolio** | Verificar dados de mercado (BTC, CDB, Tesouro), cálculos de rendimento |

---

## 4. COMO CADA TESTE FUNCIONA

```
┌─────────────────────────────────────────────────────────┐
│                  CICLO DE TESTE POR FEATURE              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. 📋 LER DOCUMENTAÇÃO                                │
│     → FEATURE.md + ARCHITECTURE.md do repo GitHub       │
│     → Mapear: comportamento esperado, endpoints,        │
│       tabelas envolvidas                                │
│                                                         │
│  2. 📸 SNAPSHOT "ANTES"                                 │
│     → SELECT nas tabelas relevantes do Supabase         │
│     → Registrar estado atual                            │
│                                                         │
│  3. 🧪 EXECUTAR TESTE                                  │
│     → POST para webhook N8N DEV simulando WhatsApp      │
│     → Testar: caminho feliz + edge cases + erro         │
│                                                         │
│  4. 📸 SNAPSHOT "DEPOIS"                                │
│     → SELECT nas mesmas tabelas                         │
│     → Comparar com ANTES                                │
│     → Verificar Google Calendar (se aplicável)          │
│                                                         │
│  5. 🔍 ANÁLISE                                         │
│     → Resposta do bot: faz sentido? UX boa?             │
│     → Dados: corretos? completos?                       │
│     → Docs vs realidade: consistente?                   │
│                                                         │
│  6. 📝 RELATÓRIO                                       │
│     → Status: ✅ OK | ⚠️ PARCIAL | ❌ FALHA           │
│     → Bugs encontrados                                  │
│     → Problemas de UX                                   │
│     → Sugestão de correção + criticidade                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 5. NÍVEIS DE CRITICIDADE

| Nível | Significado | Ação | Exemplo |
|-------|-------------|------|---------|
| **P0 — CRÍTICO** | Feature quebrada, perda de dados, segurança | Corrigir IMEDIATAMENTE | Evento não salva no banco, dados corrompidos |
| **P1 — ALTO** | Funciona parcialmente, UX muito confusa | Corrigir no próximo sprint | Bot responde errado, sync falha sem aviso |
| **P2 — MÉDIO** | Funciona mas com problemas de qualidade | Planejar correção | Formatação ruim, lentidão, edge case falha |
| **P3 — BAIXO** | Melhorias de polish | Backlog | Mensagens poderiam ser mais claras |

---

## 6. CONEXÕES NECESSÁRIAS

### O que o Inspector PRECISA para funcionar:

| # | Conexão | Para quê | Status |
|---|---------|----------|--------|
| 1 | **N8N DEV — URL do webhook `/teste`** | Simular mensagens WhatsApp sem enviar de verdade | ❌ PENDENTE |
| 2 | **Supabase — anon key (read-only)** | Verificar dados nas tabelas após testes | ❌ PENDENTE |
| 3 | **Conta de teste** (email + telefone) | Ter um usuário para executar testes | ❌ PENDENTE |
| 4 | **Google Calendar do usuário de teste** | Verificar se sync funciona | ❌ PENDENTE |
| 5 | **SSH VPS** (herdar do Sherlock) | Ler logs do N8N e Docker | ✅ DISPONÍVEL |
| 6 | **GitHub repo** (system-analise) | Ler documentação das features | ✅ DISPONÍVEL |

### Fluxo de acesso:

```
Inspector
   │
   ├── ENVIA requests ──→ N8N DEV (webhook /teste)
   │                         │
   │                         ↓ simula mensagem WhatsApp
   │                         │
   │                    N8N processa normalmente
   │                         │
   │                         ↓ grava no Supabase
   │
   ├── LÊ resultados ──→ Supabase (SELECT only)
   │                         │
   │                         ↓ verifica se dados estão corretos
   │
   ├── LÊ resultados ──→ Google Calendar API (GET only)
   │                         │
   │                         ↓ verifica se evento sincronizou
   │
   └── LÊ logs ────────→ VPS via SSH (docker logs)
                            │
                            ↓ verifica erros nos containers
```

---

## 7. O QUE JÁ POSSO FAZER AGORA (sem N8N DEV)

Mesmo sem as conexões de teste, posso começar com:

| # | Tarefa | Resultado |
|---|--------|-----------|
| 1 | **Criar toda a estrutura do squad** | Arquivos prontos para uso |
| 2 | **Gerar catálogo completo das 29 features** | YAML com endpoints, tabelas, comportamento esperado |
| 3 | **Comparar docs (repo) vs auditoria (Sherlock)** | Gaps e inconsistências entre documentação e sistema real |
| 4 | **Criar cenários de teste detalhados** | Scripts prontos para executar quando N8N DEV estiver ativo |
| 5 | **Criar checklists de UX** | Critérios para avaliar qualidade de cada feature |
| 6 | **Gerar relatório de gaps na documentação** | O que está documentado mas não funciona, e vice-versa |

---

## 8. OUTPUTS ESPERADOS

### Por feature (29 documentos):
```markdown
# Relatório — [Nome da Feature]

## Status: ✅ OK / ⚠️ PARCIAL / ❌ FALHA

## Testes executados
- Happy path: ✅/❌
- Edge cases: ✅/❌
- Input inválido: ✅/❌

## Verificação de dados
- Supabase: ✅/❌ (detalhes)
- Google Calendar: ✅/❌ (detalhes)

## Comparação docs vs realidade
- O que a doc diz: ...
- O que acontece: ...
- Gap: ...

## Problemas de UX
1. ...
2. ...

## Bugs encontrados
1. [P0] ...
2. [P1] ...

## Correções sugeridas
1. ...
2. ...
```

### Relatório geral final (1 documento):
```markdown
# RELATÓRIO GERAL DE PRIORIDADES — Total Assistente

## Resumo executivo
- Features testadas: 29
- OK: X | Parcial: Y | Falha: Z

## P0 — CRÍTICO (corrigir agora)
1. [Feature] Problema — como corrigir

## P1 — ALTO (próximo sprint)
1. ...

## P2 — MÉDIO (roadmap)
1. ...

## P3 — BAIXO (backlog)
1. ...

## Mapa de dependências
(qual correção desbloqueia outras)
```

---

## 9. PRÓXIMOS PASSOS

### Para você:
1. **Me diga se aprova esta estrutura** (ou ajustes que quer fazer)
2. **Configure o webhook `/teste` no N8N DEV** para eu poder simular mensagens
3. **Me passe as credenciais** (Supabase anon key, conta de teste)
4. **Me diga se quer que eu crie o squad agora** (estrutura de arquivos)

### Para mim:
1. Criar o squad completo (todos os arquivos)
2. Gerar o catálogo de features com cenários de teste
3. Fazer a análise comparativa docs vs auditoria (já posso fazer)
4. Quando você liberar o DEV: executar bateria completa de testes
5. Entregar relatório geral com prioridades

---

## 10. CRONOGRAMA ESTIMADO

| Fase | O que | Depende de |
|------|-------|------------|
| **Fase 1 — Estrutura** | Criar squad + catálogo + cenários | Nada (pode começar agora) |
| **Fase 2 — Análise documental** | Comparar docs vs auditoria | Nada (pode começar agora) |
| **Fase 3 — Testes funcionais** | Executar testes via N8N DEV | Webhook DEV + Supabase key |
| **Fase 4 — Verificação** | Checar DB + Google Calendar | Supabase key + Google access |
| **Fase 5 — Relatórios** | Gerar todos os relatórios | Fases 3 e 4 concluídas |
| **Fase 6 — Prioridades** | Documento geral final | Fase 5 concluída |

---

*Squad projetado por Inspector — QA & UX Auditor*
