# Critica Arquitetural — Roteador Principal

## Problemas

### 1. Sem verificacao de assinatura do webhook
Graph API envia `X-Hub-Signature-256` com HMAC do payload. Nao verificado no N8N.

**Recomendacao:** Middleware de verificacao antes de processar mensagem.

### 2. Tres providers WhatsApp
Graph API para receber, Evolution API para enviar, Z-API referenciado. Complexidade desnecessaria.

**Recomendacao:** Unificar em um provider. Graph API pode enviar e receber.

### 3. Bot guard com valores hardcoded
Numero do bot (554384983452) e phone number ID hardcoded. Qualquer mudanca requer editar workflow.

**Recomendacao:** Variaveis de ambiente ou tabela de configuracao.

### 4. Onboarding duplicado
phones_whatsapp com stages de onboarding separado de profiles. Usuario pode existir em um e nao no outro.

**Recomendacao:** Unificar onboarding via profiles com flag `whatsapp_onboarded BOOLEAN`.

## Escalabilidade

| Aspecto | Limite | Gargalo |
|---------|--------|---------|
| Mensagens/minuto | Sem limite | N8N execution queue |
| Debounce | Redis TTL | Configuravel |
| Users concurrent | N8N worker count | Default 5 concurrent |
