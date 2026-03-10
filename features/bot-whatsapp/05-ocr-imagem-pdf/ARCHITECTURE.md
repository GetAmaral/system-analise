# Critica Arquitetural — OCR de Imagens e PDFs

## Problemas

### 1. Dados sensiveis em transito
Documentos financeiros (notas fiscais, comprovantes) trafegam em base64 entre N8N nodes sem criptografia.

**Recomendacao:** Processar localmente se possivel. Se nao, garantir TLS em todas conexoes.

### 2. Sem limite de tamanho
PDF de 100 paginas seria convertido para base64 (~133% do tamanho original) e enviado ao Mistral. OOM risk.

**Recomendacao:** Limite de 5MB ou 10 paginas. Rejeitar com mensagem.

### 3. include_image_base64 desnecessario
Flag `true` faz o Mistral retornar base64 de imagens encontradas no documento. Nao e utilizado pelo AI Agent.

**Recomendacao:** Setar `false` para reduzir payload.

### 4. Sem cache de resultados
Mesmo documento enviado 2 vezes e processado 2 vezes. Custo duplicado.

**Recomendacao:** Hash SHA-256 do arquivo como cache key.

## Escalabilidade

| Aspecto | Limite | Gargalo |
|---------|--------|---------|
| File size | Sem limite | Memoria N8N |
| Mistral API | Rate limit desconhecido | API key tier |
| PDF pages | Sem limite | Custo por pagina |
