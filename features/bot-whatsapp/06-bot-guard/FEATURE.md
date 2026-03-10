# Feature 06 — Bot Guard (Anti-Loop & Anti-Spam)

## Resumo
Conjunto de filtros no Main Router que previne loops (bot respondendo a si mesmo), spam, mensagens duplicadas, e delivery receipts. Usa Redis para debounce per-user.

## Mecanismos

### 1. Delivery Receipt Filter
```
IF messages[0].statuses[0].status === "delivered" → IGNORE
```
WhatsApp envia notificacoes de entrega/leitura que nao sao mensagens reais.

### 2. Forwarded Message Filter
```
IF messages[0].context.forwarded === true → IGNORE
```
Mensagens encaminhadas de outras conversas sao bloqueadas (especialmente audios).

### 3. Self-Message Filter
```
IF recipient_id === "554384983452" → IGNORE
```
Previne o bot de processar suas proprias mensagens. Numero hardcoded.

### 4. Redis Debounce
```
Key: {phone}_debounce
Operation: SETEX (set with expiry) → GETDEL (get and delete)
```
Se key ja existe quando nova mensagem chega, mensagem e ignorada. Previne processamento duplicado de mensagens rapidas.

## Erros Conhecidos / Riscos

1. **Self-filter hardcoded:** Numero 554384983452 fixo no workflow
2. **Debounce key previsivel:** Baseado apenas no phone
3. **Sem rate limiting por hora/dia:** Apenas debounce instantaneo
4. **Forward filter pode frustrar usuarios:** Audio encaminhado do proprio usuario bloqueado
5. **Sem logging de mensagens bloqueadas:** Nao rastreia quantas mensagens sao filtradas
6. **Sem blacklist:** Nao ha mecanismo para bloquear numeros abusivos
