# Critica Arquitetural — Fluxo Standard

## Problema CRITICO

### Workflows identicos
O fluxo Standard e uma copia do Premium sem restricoes. Isso significa que o sistema de planos e bypassado completamente via WhatsApp.

**Recomendacao URGENTE:**
1. Standard: Remover tools premium-only (limites, relatorios, OCR)
2. Free: Apenas perguntas basicas, sem tool calling
3. Ou: Adicionar verificacao de plano em cada webhook de tool
4. Ou: Middleware no Main Router que injeta plan_type e cada tool verifica

### Enforcement no webhook level
Cada webhook de tool deveria verificar:
```javascript
if (plan_type !== 'premium' && tool_requires_premium) {
  return { error: 'Feature premium. Faca upgrade em totalassistente.com.br' }
}
```

## Escalabilidade

| Aspecto | Limite | Gargalo |
|---------|--------|---------|
| Custo OpenAI | Mesmo custo para todos usuarios | Sem controle por plano |
| Features | Todas abertas | Sem gating |
