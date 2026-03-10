# Critica Arquitetural — Fluxo Premium

## Problemas

### 1. HTTP interno sem TLS
Webhooks internos do N8N usam HTTP (nao HTTPS). Dados financeiros trafegam sem criptografia entre instancias.

**Recomendacao:** TLS interno ou VPN entre instancias N8N.

### 2. Redis sem encryption at rest
Dados de conversacao (incluindo valores financeiros mencionados) armazenados em plain text no Redis.

**Recomendacao:** Upstash oferece encryption at rest — verificar se esta habilitado.

### 3. Sem fallback de AI provider
Dependencia unica do OpenAI. Se API cair, bot para completamente.

**Recomendacao:** Fallback para Anthropic ou modelo local (Ollama).

### 4. Custo imprevisivel
Sem maxTokens ou budget control. Conversas longas ou prompts complexos podem gerar custos altos.

**Recomendacao:** maxTokens: 2048 para respostas, monitoramento de custo por usuario.

### 5. Contexto de 5 interacoes insuficiente
Para operacoes complexas (editar evento especifico), 5 interacoes podem nao ser suficientes.

## Escalabilidade

| Aspecto | Limite | Gargalo |
|---------|--------|---------|
| Concurrent users | N8N workers (5 default) | Execucao sequencial |
| OpenAI rate | ~500 RPM (tier 1) | Token bucket |
| Redis connections | Upstash free tier | 10k commands/dia |
| Audio transcription | Whisper API rate | Sequential per message |
