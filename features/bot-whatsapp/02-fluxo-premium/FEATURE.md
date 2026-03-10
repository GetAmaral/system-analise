# Feature 02 — Fluxo Premium (AI Agent)

## Resumo
Workflow N8N para usuarios premium. AI Agent com GPT-4.1-mini, memoria Redis, tool calling para calendario e financeiro, transcricao de audio, OCR de imagens/PDFs. Temperatura 0.3 para respostas determinísticas.

## Arquitetura

```
Mensagem do usuario (via Main Router)
    ↓ Switch por tipo:
    │   ├─ text → AI Agent (GPT-4.1-mini, temp 0.3)
    │   ├─ audio → Whisper transcription → AI Agent
    │   ├─ image → Mistral OCR → AI Agent
    │   └─ document → Mistral OCR (PDF) → AI Agent
    ↓
    ↓ AI Agent com tools:
    │   ├─ buscar_financeiro → webhook /filtros-supabase
    │   ├─ registrar_gasto → webhook /registrar-gasto
    │   ├─ editar_financeiro → webhook /editar-supabase
    │   ├─ excluir_financeiro → webhook /excluir-supabase
    │   ├─ criar_evento_agenda → webhook /criar-lembrete-total
    │   ├─ buscar_evento_agenda → webhook /busca-total-evento
    │   ├─ editar_evento_agenda → webhook /editar_eventos_total
    │   ├─ excluir_evento_agenda → webhook /excluir-evento-total
    │   ├─ criar_limite → webhook /criar_limite
    │   ├─ editar_limite → webhook /editar_limite
    │   ├─ excluir_limite → webhook /excluir_limite
    │   ├─ buscar_limite → webhook /buscar-limite
    │   └─ Think → reasoning (sem acao)
    ↓
    ↓ Redis Chat Memory:
    │   Key: chatmem-{phone}
    │   TTL: 3600s (1 hora)
    │   Ultimas 5 interacoes
    ↓
    ↓ Resposta via Evolution API
    ↓ POST core-evolution.lfuipy.easypanel.host/message/sendText/mordomo
```

## Modelo AI
- **Provider:** OpenAI
- **Model:** gpt-4.1-mini
- **Temperature:** 0.3
- **Credential:** OpenAi account (ioug5VWKEO9a7n19)

## Redis Chat Memory
- **Provider:** Upstash Redis
- **Key pattern:** `chatmem-{phone_number}`
- **TTL:** 3600 segundos (1 hora)
- **Contexto:** Ultimas 5 interacoes (user + assistant)
- **Formato:** LangChain compatible
- **Credential:** Upstash 1 (amNI4dVfk3J8Bz0v)

## Tool Calling

### Webhooks internos N8N
Todas as tools chamam webhooks em instancias internas do N8N:
```
Financeiro:
- http://n8n-fcwk0sw4soscgsgs08g8gssk.76.13.172.17.sslip.io/webhook/filtros-supabase
- http://n8n-zcgwwscwc8coos88c0g08sks.76.13.172.17.sslip.io/webhook/editar-supabase
- http://n8n-zcgwwscwc8coos88c0g08sks.76.13.172.17.sslip.io/webhook/excluir-supabase

Calendario:
- http://n8n-fcwk0sw4soscgsgs08g8gssk.76.13.172.17.sslip.io/webhook/criar-lembrete-total
- http://n8n-fcwk0sw4soscgsgs08g8gssk.76.13.172.17.sslip.io/webhook/busca-total-evento
```

**Auth:** Basic Auth (Avelum Credential)

## Classificacao de Intencao
Text Classifier categoriza mensagem em:
- criar_gasto, buscar, editar, excluir
- criar_limite, editar_limite, excluir_limite
- criar_evento_agenda, buscar_evento_agenda, editar_evento_agenda, excluir_evento_agenda
- criar_lembrete_agenda, criar_lembrete_recorrente
- relatorio_semanal, relatorio_mensal

## Erros Conhecidos / Riscos

1. **Phone como Redis key:** `chatmem-{phone}` sem hashing — exposto se Redis comprometido
2. **TTL curto (1h):** Sessao reseta frequentemente, usuario perde contexto
3. **URLs internas expostas:** Webhooks N8N com IPs internos no JSON
4. **Sem fallback AI:** Se OpenAI cair, bot nao responde
5. **Sem limit de tokens:** Sem maxTokens configurado — custo imprevisivel
6. **Credentials referenciadas por ID:** IDs de credenciais no JSON exportado
7. **HTTP sem HTTPS:** Webhooks internos via HTTP plain text
