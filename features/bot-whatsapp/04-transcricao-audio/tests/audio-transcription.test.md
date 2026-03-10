# Testes — Transcricao de Audio

## T01 — Audio curto transcrito corretamente
**Tipo:** Integracao
**Passos:** Enviar audio de 5 segundos dizendo "Gastei vinte reais no almoco"

**Esperado:**
- [ ] Transcricao correta
- [ ] AI processa como criar_gasto
- [ ] Gasto criado com value_spent=20

---

## T02 — Audio longo (>2 min)
**Tipo:** Performance
**Passos:** Enviar audio de 3 minutos

**Esperado (ATUAL):**
- [ ] Transcrito integralmente (custo alto)
**Esperado (IDEAL):**
- [ ] Rejeitado com mensagem de limite

---

## T03 — Audio encaminhado bloqueado
**Tipo:** Bot guard
**Passos:** Encaminhar audio de outra conversa

**Esperado:**
- [ ] Mensagem ignorada (forwarded filter)

---

## T04 — Qualidade ruim (muito ruido)
**Tipo:** Edge case
**Passos:** Enviar audio com muito ruido de fundo

**Esperado:**
- [ ] Transcricao parcial ou erro
- [ ] AI responde pedindo para repetir

---

## T05 — Audio em ingles (language=pt)
**Tipo:** Edge case
**Passos:** Enviar audio em ingles

**Esperado (ATUAL):**
- [ ] Transcricao pode ter erros (forced pt)
**Esperado (IDEAL):**
- [ ] Auto-detect language
