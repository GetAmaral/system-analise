# Critica Arquitetural — Relatorio PDF via WhatsApp

## Problemas

### 1. PDFco como dependencia externa
Servico pago de terceiro para conversao HTML→PDF. Se API cair, nenhum relatorio e gerado. Sem fallback.

**Recomendacao:** Self-hosted Gotenberg ou Puppeteer como fallback. Ou gerar PDF server-side com jsPDF.

### 2. Sem arquivo de relatorios
PDFs gerados e enviados, mas nao salvos. Usuario que perde a mensagem nao pode recuperar.

**Recomendacao:** Salvar PDF no Supabase Storage. Link de download no dashboard.

### 3. Sem error handling
Pipeline de 7 nodes sem tratamento de erro. Qualquer falha e silenciosa.

**Recomendacao:** Error handler no N8N que envia notificacao ao admin + registra falha.

### 4. Sem opt-out
Todos usuarios premium recebem relatorios automaticamente. Deveria haver flag em profiles.

**Recomendacao:** Coluna `receive_weekly_report BOOLEAN DEFAULT true` em profiles ou recurrency_report.

### 5. Edge function faltante
Frontend chama `generate-monthly-report` que nao existe. Feature quebrada.

## Escalabilidade

| Aspecto | Limite | Gargalo |
|---------|--------|---------|
| PDFco API | Rate limit desconhecido | Servico externo |
| WhatsApp sends | 250/dia business tier | Meta rate limits |
| Transacoes por PDF | Sem limite | Timeout em PDFs grandes |
| Delivery | Sequencial por usuario | N8N loop |
