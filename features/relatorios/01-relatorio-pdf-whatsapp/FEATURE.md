# Feature 01 — Relatorio PDF via WhatsApp (N8N)

## Resumo
Geracao automatica de relatorios semanais e mensais em PDF, enviados via WhatsApp. N8N busca transacoes do periodo, gera HTML, converte para PDF via PDFco, faz upload no WhatsApp Media Manager, e envia como documento.

## Arquitetura

```
Trigger (Cron semanal/mensal)
    ↓ Webhook recebe {user_id, periodo}
    ↓ Busca profile do usuario (nome, phone)
    ↓ Atualiza recurrency_report (marca flag = false)
    ↓ Calcula date range do periodo
    ↓ Query: SELECT * FROM spent WHERE fk_user AND date_spent BETWEEN range
    ↓ Gera HTML com tabela de transacoes + totais
    ↓ PDFco API: HTML → PDF
    ↓ Download PDF binario
    ↓ Upload para WhatsApp Media Manager (Graph API)
    ↓ Envia documento via WhatsApp (Graph API)
```

## N8N Workflow: Relatorios Mensais-Semanais

### Triggers
- **Semanal:** Toda segunda-feira 00:01
- **Mensal:** Todo 1o do mes 00:01

### Webhooks
- `relatorio-semanal`: Recebe `{user_id, semana: "WW/MM/YYYY"}`
- `relatorio-mensal`: Recebe `{user_id, periodo: "MM/YYYY"}`

### Calculo de Date Range

**Semanal:**
- Semana 1: dias 1-7
- Semana 2: dias 8-14
- Semana 3: dias 15-21
- Semana 4: dias 22-28
- Semana 5: dias 29-ultimo dia do mes

**Mensal:**
- Se mes atual: dia 1 ate hoje
- Se mes passado: dia 1 ate ultimo dia

### Geracao de HTML
- Logo: `https://totalassistente.com.br/assets/logo-dark-DnpWvJkw.png`
- Header com nome da empresa e timestamp
- Label do periodo e date range
- Tabela com: Data, Nome, Categoria, Tipo, Valor
- Cores: vermelho claro para saidas, verde claro para entradas
- Totais: despesas, receitas, saldo final (verde se positivo, vermelho se negativo)
- Footer com branding

### PDF Generation
- **Servico:** PDFco (HTML to PDF)
- **Credential:** PDF.co account (ID: UBdmsbhnptWKEJdj)

### Delivery via WhatsApp
1. Upload PDF: `POST https://graph.facebook.com/v23.0/744582292082931/media`
   - Type: application/pdf
   - Auth: WhatsApp Header Auth
2. Send document: `POST https://graph.facebook.com/v23.0/744582292082931/messages`
   - type: "document"
   - filename: "relatorio-mensal.pdf" ou "relatorio-semanal.pdf"
   - caption: "Seu relatorio mensal do Total Assistente!"

### Delivery Alternativa (Desabilitada)
- Evolution API: `POST core-evolution.lfuipy.easypanel.host/message/sendMedia/mordomo`
- Phone hardcoded: 554399281807

## Tabelas

### recurrency_report
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| fk_user | UUID | FK auth.users(id) |
| weekly | BOOLEAN | Flag de relatorio semanal |
| monthly | BOOLEAN | Flag de relatorio mensal |

**RLS:** auth.uid() = fk_user

### reports (business analytics)
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID PK | gen_random_uuid() |
| date_ref | DATE UNIQUE | Data de referencia |
| active_users | INT | Usuarios ativos |
| users_in_grace | INT | Em grace period |
| free_users | INT | Usuarios free |
| monthly_revenue | DECIMAL(12,2) | Receita mensal |

**RLS:** Service role only

## Erros Conhecidos / Riscos

1. **WhatsApp Account ID hardcoded:** `744582292082931` exposto no workflow
2. **PDFco sem limite de tamanho:** Milhares de transacoes geram PDF enorme, possivel timeout
3. **Sem paginacao:** Todas transacoes do periodo em uma unica tabela
4. **Sem error handling:** Se PDFco ou WhatsApp falhar, usuario nao e notificado
5. **Sem retry:** Falha silenciosa, sem mecanismo de retry
6. **Sem confirmacao de entrega:** Nao verifica se WhatsApp foi entregue
7. **Sem arquivo historico:** PDFs nao sao salvos para download posterior
8. **Timezone BRT hardcoded:** Sem respeitar timezone do usuario
9. **Edge function generate-monthly-report nao existe:** Frontend tenta chamar mas funcao faltante
10. **Date validation fraca:** Input invalido faz fallback silencioso para "ultima semana/mes"
11. **Sem opt-out:** Nao ha flag para usuario desabilitar relatorios
12. **Logo URL hardcoded:** Se asset mudar de hash, logo quebra
