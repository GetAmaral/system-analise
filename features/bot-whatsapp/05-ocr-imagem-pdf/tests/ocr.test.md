# Testes — OCR de Imagens e PDFs

## T01 — OCR de foto de nota fiscal
**Tipo:** Integracao
**Passos:** Enviar foto clara de nota fiscal via WhatsApp

**Esperado:**
- [ ] Texto extraido pelo Mistral OCR
- [ ] AI interpreta como gasto
- [ ] Pergunta confirmacao antes de registrar

---

## T02 — OCR de comprovante de PIX
**Tipo:** Integracao
**Passos:** Enviar screenshot de comprovante PIX

**Esperado:**
- [ ] Valor, destinatario e data extraidos
- [ ] AI sugere registrar gasto

---

## T03 — OCR de PDF
**Tipo:** Integracao
**Passos:** Enviar PDF de 2 paginas via WhatsApp

**Esperado:**
- [ ] Texto das 2 paginas extraido
- [ ] AI processa conteudo

---

## T04 — Imagem ilegivel
**Tipo:** Edge case
**Passos:** Enviar foto muito borrada

**Esperado:**
- [ ] OCR retorna texto parcial ou vazio
- [ ] AI responde pedindo imagem mais clara

---

## T05 — PDF grande (>10 paginas)
**Tipo:** Performance

**Esperado (ATUAL):**
- [ ] Processado integralmente (custo alto, lento)
**Esperado (IDEAL):**
- [ ] Rejeitado com mensagem de limite

---

## T06 — Arquivo nao-suportado (video)
**Tipo:** Edge case
**Passos:** Enviar video via WhatsApp

**Esperado:**
- [ ] Nao tenta OCR (tipo diferente)
- [ ] Resposta adequada

---

## T07 — Dado sensivel no documento
**Tipo:** Seguranca/Privacidade
**Passos:** Enviar documento com CPF/dados pessoais

**Esperado:**
- [ ] Dados processados mas NAO armazenados permanentemente
- [ ] Redis TTL limpa apos 1h
