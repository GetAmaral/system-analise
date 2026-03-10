# Critica Arquitetural — Metas Financeiras

## Problemas

### 1. Armazenado em profiles
Metas financeiras estao em colunas da tabela `profiles` em vez de tabela dedicada. Problemas:
- Nao suporta multiplas metas ou metas por categoria
- Sem historico (alteracao sobrescreve)
- Poluicao da tabela profiles com campos de dominio especifico

**Recomendacao:** Tabela `financial_goals` com tipo, valor, mes_referencia.

### 2. Calculo 100% client-side
Todo calculo de progresso e feito no React. Para consistencia e performance, deveria ser RPC.

### 3. Alerta sem acao
O alerta do dia 25 aparece na tela mas nao gera notificacao. Se o usuario nao abrir o app, nunca vera.

**Recomendacao:** N8N workflow que verifica metas e envia WhatsApp se abaixo do threshold.

## Escalabilidade

| Aspecto | Limite | Gargalo |
|---------|--------|---------|
| Metas por usuario | 2 (fixo) | Colunas em profiles |
| Personalizacao | Nenhuma | Thresholds hardcoded |
