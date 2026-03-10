# Feature 04 — Transcricao de Audio

## Resumo
Audio recebido via WhatsApp e transcrito usando OpenAI Whisper API. Texto resultante e processado pelo AI Agent como se fosse mensagem de texto.

## Arquitetura

```
WhatsApp audio message
    ↓ Extrair audio.id do payload
    ↓ Graph API: GET /v17.0/{audio.id}?fields=id,url,mime_type,sha256,file_size
    │   Auth: WhatsApp Header Auth
    ↓ Download audio file (binary)
    ↓ OpenAI Whisper API: POST /audio/transcriptions
    │   Model: whisper-1
    │   Language: pt (Portuguese)
    │   Auth: OpenAi account credential
    ↓ Texto transcrito
    ↓ Injeta no prompt do AI Agent
    ↓ Processamento normal (tool calling, resposta)
```

## Detalhes Tecnicos

### Whisper API
- **Endpoint:** OpenAI `/audio/transcriptions`
- **Model:** whisper-1
- **Language:** `pt` (hardcoded Portuguese)
- **Format:** Multipart form data com audio binary

### Formatos Suportados
- OGG/Opus (formato padrao WhatsApp)
- MP3, WAV, M4A (se enviados)

## Erros Conhecidos / Riscos

1. **Language hardcoded:** `pt` fixo — usuarios de outros idiomas nao atendidos
2. **Sem limite de duracao:** Audio de 10 minutos processado integralmente (custo alto)
3. **Sem pre-processamento:** Nao verifica qualidade ou duracao antes de enviar ao Whisper
4. **Audio encaminhado filtrado:** Bot guard bloqueia forwarded audio — pode ser frustrante
5. **Sem feedback de processamento:** Usuario nao recebe "Transcrevendo audio..." enquanto processa
6. **Custo por segundo:** Whisper cobra por duracao — sem controle de budget
