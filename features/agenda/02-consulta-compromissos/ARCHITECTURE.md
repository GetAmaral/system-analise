# Critica Arquitetural — Consulta de Compromissos

## Pontos Positivos
- Real-time via Supabase garante dados frescos sem polling
- FullCalendar com rrulePlugin expande recorrencias client-side (eficiente)
- AI matching no N8N permite busca fuzzy em linguagem natural
- Indices no banco cobrem os queries principais

## Problemas

### 1. Sem paginacao no SELECT
O hook faz `SELECT * FROM calendar WHERE user_id` sem LIMIT. Para um usuario com 1000+ eventos em 2 anos, isso carrega tudo na memoria do browser. FullCalendar tem suporte a lazy loading por range de datas.

**Recomendacao:** Usar `eventSources` do FullCalendar com fetch por range visivel.

### 2. AI scoring e caro e lento para busca
Cada busca via WhatsApp chama GPT-4.1-mini para scoring. Custo ~$0.001 por busca, mas latencia de 2-5s. Para buscas simples ("meus eventos amanha"), um filtro SQL seria suficiente.

**Recomendacao:** Usar AI apenas para buscas fuzzy. Para buscas por data exata, usar SQL direto.

### 3. Dois sistemas de busca desconectados
- Frontend: filtragem local (JavaScript)
- N8N: AI matching (GPT)
Se a logica de filtragem muda, precisa atualizar em dois lugares.

### 4. expandRecurringEvents nao e usado pelo Calendar
A funcao utilitaria `expandRecurringEvents` em `calendarUtils.ts` existe mas o Calendar.tsx usa o rrulePlugin nativo do FullCalendar. Isso e codigo potencialmente morto no contexto do frontend.

**Recomendacao:** Verificar se algum outro consumer usa essa funcao. Se nao, remover ou documentar que e para N8N/backend.

### 5. `toDateString()` para exclusao de ocorrencias
A comparacao de exdates usa `toDateString()` que retorna "Mon Mar 15 2026" — sem hora. Se um evento recorre 2x no mesmo dia (manha e tarde), excluir uma ocorrencia exclui ambas.

**Recomendacao:** Comparar por ISO string completa incluindo hora.

## Escalabilidade

| Aspecto | Limite | Gargalo |
|---------|--------|---------|
| Eventos carregados | ~5-10k antes de lag | Browser memory + render |
| Real-time connections | ~500 por Supabase tier | Supabase Realtime |
| AI matching latencia | 2-5s por busca | GPT API |
| AI matching custo | ~$0.001/busca | OpenAI billing |
