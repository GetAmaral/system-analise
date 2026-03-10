# Critica Arquitetural — Transcricao de Audio

## Problemas

### 1. Sem limite de duracao
Audio de qualquer duracao e transcrito. Um audio de 30 minutos custaria ~$0.18 e levaria tempo significativo.

**Recomendacao:** Rejeitar audios > 2 minutos com mensagem amigavel.

### 2. Sem indicador de progresso
Usuario envia audio e nao sabe se bot esta processando. Pode enviar duplicatas.

**Recomendacao:** Enviar "Transcrevendo seu audio..." antes de processar.

### 3. Idioma fixo
Hardcoded `pt`. Whisper funciona melhor com deteccao automatica.

**Recomendacao:** Remover parametro `language` e deixar auto-detect.

## Escalabilidade

| Aspecto | Limite | Gargalo |
|---------|--------|---------|
| Concurrent | Sequencial no N8N | 1 por vez |
| Duracao | Sem limite | Custo/tempo |
| Whisper API | ~50 RPM | OpenAI tier |
