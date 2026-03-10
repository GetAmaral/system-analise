# Feature 05 — OCR de Imagens e PDFs

## Resumo
Imagens e documentos PDF recebidos via WhatsApp sao processados pelo Mistral OCR API. Texto extraido e passado ao AI Agent para interpretacao (ex: registrar gasto de nota fiscal).

## Arquitetura

```
WhatsApp image/document
    ↓ Extrair media.id do payload
    ↓ Graph API: GET /v17.0/{media.id} → URL do arquivo
    ↓ Download binario
    ↓ Converter para base64
    ↓ Mistral OCR API:
    │   POST https://api.mistral.ai/v1/ocr
    │   Model: mistral-ocr-latest
    │   ├─ Imagem: type=image_url, data:image/jpeg;base64,...
    │   └─ PDF: type=document_url, data:application/pdf;base64,...
    ↓ Texto extraido (markdown)
    ↓ Injeta no prompt do AI Agent
    ↓ AI interpreta conteudo (gasto, nota fiscal, etc.)
```

## Mistral OCR API

### Endpoint
`POST https://api.mistral.ai/v1/ocr`

### Request (Imagem)
```json
{
  "model": "mistral-ocr-latest",
  "document": {
    "type": "image_url",
    "image_url": "data:image/jpeg;base64,{base64}"
  },
  "include_image_base64": true
}
```

### Request (PDF)
```json
{
  "model": "mistral-ocr-latest",
  "document": {
    "type": "document_url",
    "document_url": "data:application/pdf;base64,{base64}"
  },
  "include_image_base64": true
}
```

### Response
- Texto extraido em formato markdown
- Inclui base64 de imagens encontradas (se solicitado)

## Casos de Uso
- **Nota fiscal:** Extrair itens, valores, data → registrar gastos automaticamente
- **Comprovante de pagamento:** Extrair valor e destino
- **Receita medica:** Extrair informacoes de saude
- **Qualquer documento:** OCR generico

## Erros Conhecidos / Riscos

1. **Sem limite de tamanho:** Imagem/PDF de qualquer tamanho processado
2. **Base64 em memoria:** Arquivo convertido para base64 integralmente — pode causar OOM para PDFs grandes
3. **Sem validacao de tipo:** Aceita qualquer arquivo como document
4. **include_image_base64: true:** Aumenta payload de resposta desnecessariamente
5. **Sem feedback:** Usuario nao sabe que OCR esta em progresso
6. **Dados sensiveis:** Conteudo de documentos trafega sem criptografia pelo N8N
7. **Custo por pagina:** Mistral OCR cobra por pagina de PDF
8. **Sem cache:** Mesmo documento enviado 2x e processado 2x
