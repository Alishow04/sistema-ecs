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
- **Dashboard** (tela inicial) — KPIs de Hoje / Este mês / Este ano / Meus ECS
  (ano), mais um preview dos 5 ECS mais recentes com atalho para o Histórico.
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
- **Detalhes do ECS** — visualização completa, edição (Cliente, Solicitante,
  Vendedor, Filial/UF, Produto, Marca, Data, Observações — nunca código,
  número, ano ou responsável original) e histórico de alterações lido de
  `ecsRecords/{id}/history`. Acessível a partir de Últimos ECS, Histórico e
  da confirmação de criação, via `js/router.js` (`goTo('details', {id, backTo})`).
- **Cancelamento sem exclusão** — botão Cancelar/Reativar em Detalhes; o
  registro nunca é apagado nem a sequência liberada, só o campo `cancelled`
  muda (e fica registrado no histórico de alterações).

**Próximas etapas (nesta ordem sugerida):**
1. Relatórios e gráficos, exportação PDF e CSV
2. Configurações (edição das listas de `settings/*` pela própria interface)
3. Acabamento visual e segurança adicional (Firebase App Check, por
   exemplo, já que ainda não há Firebase Authentication)


## Decisões técnicas de Detalhes/Edição/Cancelamento

- **Edição e cancelamento passam por `runTransaction`**, igual à criação —
  lê o documento, calcula só os campos que mudaram, grava o `update` e uma
  entrada de histórico por campo alterado numa única transação atômica.
  Ou tudo é gravado (dado + histórico), ou nada é.
- **`ecs-service.updateEcs` só grava o que realmente mudou** — se o
  formulário for reenviado sem alteração nenhuma, não gera entrada de
  histórico vazia.
- **`state` (UF) é tratado como campo editável comum**, mas a interface
  nunca deixa digitá-lo — ele é recalculado a partir da Filial/Região toda
  vez que ela muda, inclusive na edição.
- **`js/router.js`** é um mínimo despachante de navegação: existe porque
  Detalhes precisa ser aberto a partir de três lugares diferentes (Últimos
  ECS, Histórico, confirmação de criação) sem precisar passar a função
  `navigate` do `app.js` manualmente por cada view. Qualquer view pode
  chamar `goTo('nome-da-view', { ...params })`.
- O antigo modal de detalhes (`ecs-detail-modal.js`) foi removido — agora
  existe só uma forma de ver/editar um ECS (a view `details`), evitando
  duas UIs diferentes para a mesma coisa.

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

## Decisões técnicas do Dashboard

- **Virou a tela inicial** (antes era Novo ECS). Com o Dashboard pronto,
  faz mais sentido pousar numa visão geral do que direto na criação — o
  botão "+ Novo ECS" continua sempre visível na sidebar e no topbar.
- **Todos os KPIs reaproveitam `buildHistoricoQuery`/`countHistorico`**,
  os mesmos do Histórico — nenhum índice novo do Firestore foi necessário.
  "Meus ECS (ano)" é o filtro estrutural `creatorCode` combinado com o
  intervalo do ano, exatamente a mesma combinação que o índice
  `(cancelled, creatorCode, createdAt)` já cobre.
- **De propósito, sem agregações por produto/UF/vendedor aqui** — isso é
  GROUP BY, que o Firestore não faz nativamente e barato; fica reservado
  para a etapa de Relatórios, que pode precisar de uma abordagem diferente
  (por exemplo, contadores denormalizados atualizados a cada criação/edição,
  em vez de calcular tudo na hora).

## Como rodar

### 1. Credenciais e regras
`js/firebase-config.js` já está preenchido com o projeto `sistema-ecs`.
Se for usar outro projeto Firebase, troque os valores lá.

Publique as regras de segurança (`firestore.rules`) se ainda não estiverem
publicadas:
```bash
firebase deploy --only firestore:rules
```

### 2. Publicar os índices compostos (necessário para o Histórico e o Dashboard)
As consultas de filtro/busca/período do Histórico e os KPIs do Dashboard
exigem índices compostos. Publique-os com:
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
5. Marcar "Mostrar cancelados" — agora que o cancelamento existe (ver
   próxima seção), deve trazer de volta os registros cancelados.
6. Paginar com "Próxima"/"Anterior" numa base com mais de 25 registros e
   confirmar que os botões desabilitam nas pontas (primeira/última página).

## O que testar nesta etapa (Detalhes / Edição / Cancelamento)

1. Abrir um ECS pela lista (Últimos ECS ou Histórico) e conferir que vai
   para uma página de Detalhes, não mais um modal.
2. Clicar "Editar", mudar Cliente e Filial (a UF deve atualizar sozinha) e
   salvar — voltar para o modo leitura com os dados novos.
3. Conferir que a seção "Histórico de alterações" mostra a mudança, com
   valor antigo, novo e quem alterou.
4. Tentar salvar sem mudar nada — não deve criar entrada de histórico.
5. Cancelar o ECS, confirmar que o pill "Cancelado" aparece em Detalhes e
   nas tabelas, e que ele some do Histórico por padrão (some até marcar
   "Mostrar cancelados").
6. Reativar o mesmo ECS e confirmar que o pill some e ele volta a aparecer
   nas listas padrão.

## O que testar nesta etapa (Dashboard)

1. Fazer login (selecionar responsável) e confirmar que a tela inicial
   agora é o Dashboard, com a saudação certa pro horário do dia.
2. Conferir que os 4 KPIs batem com o que você vê manualmente no Histórico
   (ex.: filtrar Histórico por hoje e comparar com o KPI "Hoje").
3. Criar um ECS novo e voltar ao Dashboard — o KPI "Hoje" e o preview de
   "Últimos ECS" devem refletir a criação.
4. Clicar num ECS do preview e confirmar que abre Detalhes com
   `backTo: 'dashboard'` (o botão Voltar deve retornar ao Dashboard, não
   ao Histórico).
5. Clicar "Ver histórico completo →" e confirmar que vai para o Histórico.

