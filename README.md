# Sistema ECS — Fiedler

Sistema interno para geração e consulta de ECS (solicitações). Substitui o
sistema atual, mantendo o mesmo conceito de código (`ECS-AK-26-1900`), mas
com mecânica de numeração à prova de duplicidade.

## Infraestrutura

- GitHub: `Alishow04/sistema-ecs`
- Hospedagem: Vercel
- Banco: Firebase Firestore
- Frontend: HTML, CSS e JavaScript puro com ES Modules (sem build step)
- Identificação sem login: o responsável é escolhido no navegador e salvo
  em `localStorage` (ver `js/identity.js`)

## Regras que não podem ser quebradas

Estas são garantidas pela mecânica atual (transação atômica + Firestore
Security Rules) e por qualquer código novo que for adicionado depois:

- Nunca repetir ECS — sequência gerada dentro de uma `runTransaction`.
- Sequência é global entre todos os responsáveis — um único contador por
  ano em `ecsCounters/{ano}`, não um contador por pessoa.
- Um ECS criado nunca é reutilizado (nem reaproveitado após cancelamento).
- Ano, número, código ECS e responsável original são imutáveis depois de
  criados (ver `firestore.rules`, regra `allow update` de `ecsRecords`).
- Vendedor (`seller`) e responsável pela criação do ECS (`creatorCode`/
  `creatorName`) são campos e conceitos diferentes — nunca são unificados.
- Interface alinhada à linguagem visual da Central de Orçamentos SPX
  (sidebar navy, acentos azul/amarelo Fiedler, conteúdo claro).

## Funcionalidades

**Prontas:**
- Seleção/troca de responsável sem login
- Novo ECS (Cliente, Solicitante, Vendedor, Filial/Região, UF automática,
  Produto, Marca, Data, Observações)
- Geração atômica do código ECS
- Últimos ECS (20 mais recentes + filtro local rápido)
- **Histórico ECS** — consulta completa: busca livre (por código, cliente,
  solicitante, vendedor, produto, filial, UF, marca, responsável, via
  `searchTokens`), um filtro estrutural por vez (Responsável, Vendedor,
  Produto, Filial, Estado ou Marca), período por data de criação,
  toggle "mostrar cancelados", paginação por cursor com contagem de
  resultados.
- Modal de detalhes do registro (compartilhado entre Últimos ECS e
  Histórico via `js/components/ecs-detail-modal.js`)

**Próximas etapas (nesta ordem sugerida):**
1. Tela detalhada e edição de ECS (com histórico de alterações em
   `ecsRecords/{id}/history`, subcoleção já prevista nas regras)
2. Cancelamento sem exclusão (`cancelled: true` — campo já existe e já é
   respeitado nos filtros do Histórico)
3. Dashboard com KPIs
4. Relatórios e gráficos, exportação PDF e CSV
5. Configurações (edição das listas de `settings/*` pela própria interface)
6. Acabamento visual e segurança adicional (Firebase App Check, por
   exemplo, já que ainda não há Firebase Authentication)

## Decisões técnicas do Histórico (para quem for continuar o código)

- **O período filtra por `createdAt`, não por `ecsDate`.** O Firestore só
  permite `orderBy()` no mesmo campo que recebe um filtro de intervalo
  (`>=`/`<=`). Como a lista sempre ordena pela criação, o período também
  usa `createdAt` — evita ter que escolher entre as duas coisas.
- **Só um filtro estrutural por vez** (Responsável OU Vendedor OU Produto
  OU Filial OU Estado OU Marca), mutuamente exclusivo com a busca livre.
  Isso é visível na própria interface (um único par de selects "Filtrar
  por / Valor") — decisão para não multiplicar o número de índices
  compostos do Firestore a cada nova combinação de filtros. Se no futuro
  for necessário combinar mais filtros ao mesmo tempo, cada combinação
  nova exige seu próprio índice composto em `firestore.indexes.json`.
- **Busca livre usa o campo `searchTokens`** (array de tokens sem acento,
  gravado em todo ECS desde a v1) com `array-contains-any`. O Firestore
  não tem full-text nativo — esta é a solução sem backend adicional.
- **Paginação por cursor** (`startAfter`/`endBefore`), não por número de
  página — é o jeito nativo e eficiente do Firestore; a contagem total
  usa `getCountFromServer` só para mostrar "X resultados" na tela.

## Como rodar

### 1. Credenciais e regras
`js/firebase-config.js` já está preenchido com o projeto `sistema-ecs`.
Se for usar outro projeto Firebase, troque os valores lá.

Publique as regras de segurança (`firestore.rules`) se ainda não estiverem
publicadas:
```bash
firebase deploy --only firestore:rules
```

### 2. Publicar os índices compostos (necessário para o Histórico)
As consultas de filtro/busca/período do Histórico exigem índices compostos
que não existiam antes desta etapa. Publique-os com:
```bash
firebase deploy --only firestore:indexes
```
Se preferir não usar a CLI, rode o app, teste cada filtro do Histórico uma
vez, e quando uma consulta ainda não tiver índice o Firestore lança um erro
no console do navegador com um link direto para criar aquele índice
específico — funciona, mas é mais lento que publicar o arquivo de uma vez.

### 3. Servir localmente
```bash
npx serve .
# ou
python3 -m http.server 5500
```
(ES Modules não funcionam abrindo `index.html` direto com `file://`.)

Em produção, o deploy já é feito via Vercel.

## O que testar nesta etapa (Histórico)

1. Abrir Histórico sem nenhum filtro — deve listar os ECS mais recentes,
   igual a "Últimos ECS", com contagem total no topo.
2. Testar a busca livre com um trecho de cliente ou o código do ECS
   criado anteriormente (`ECS-AK-26-1900`, por exemplo).
3. Testar um filtro estrutural (ex.: Vendedor) e confirmar que os selects
   de busca livre ficam desabilitados enquanto o filtro estiver ativo, e
   vice-versa.
4. Testar o período (De/Até) e confirmar que reduz os resultados
   corretamente.
5. Marcar "Mostrar cancelados" — como ainda não existe funcionalidade de
   cancelamento, não deve mudar nada por enquanto (é esperado; passa a
   fazer diferença quando o item 2 do roadmap for implementado).
6. Paginar com "Próxima"/"Anterior" numa base com mais de 25 registros e
   confirmar que os botões desabilitam nas pontas (primeira/última página).
