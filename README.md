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
  Tem um botão para **ocultar os números** (fica salvo por navegador): no
  lugar dos KPIs, mostra um sparkline decorativo de atividade dos últimos
  14 dias, sem eixos nem valores — dá uma noção de ritmo sem virar contador
  de desempenho pessoal do dia a dia (ver decisão de produto mais abaixo).
- Novo ECS (Cliente, Solicitante, Vendedor, Filial/Região, UF automática,
  **Marca → Produto/Demanda dependente**, Data, Observações), com **painel "Últimos ECS" ao lado**
  do formulário — dá pra conferir os últimos criados sem trocar de tela.
  Por isso "Últimos ECS" deixou de ser um item separado do menu.
- Geração atômica do código ECS
- **Histórico ECS** — consulta completa: busca livre (por código, cliente,
  solicitante, vendedor, produto, filial, UF, marca, responsável, via
  `searchTokens`), um filtro estrutural por vez (Responsável, Vendedor,
  Produto, Filial, Estado ou Marca), período por data de criação,
  toggle "mostrar cancelados", paginação por cursor com contagem de
  resultados.
- **Detalhes do ECS** — visualização completa, edição (Cliente, Solicitante,
  Vendedor, Filial/UF, Produto, Marca, Data, Observações — nunca código,
  número, ano ou responsável original) e histórico de alterações lido de
  `ecsRecords/{id}/history`. Acessível a partir do painel de Novo ECS, Histórico e
  da confirmação de criação, via `js/router.js` (`goTo('details', {id, backTo})`).
- **Cancelamento sem exclusão** — botão Cancelar/Reativar em Detalhes; o
  registro nunca é apagado nem a sequência liberada, só o campo `cancelled`
  muda (e fica registrado no histórico de alterações).
- **Relatórios** — seletor de período (Este mês / Últimos 3 meses / Este
  ano / Personalizado), resumo (ECS no período, clientes distintos,
  vendedor mais ativo, produto mais pedido) e 4 gráficos (Chart.js): ECS
  por mês, vendedores mais ativos, distribuição por estado e por produto.
  Números "de verdade" aqui, de propósito — ver decisão de produto abaixo.
- **Exportação de Relatórios em PDF e CSV** — "🖨 Imprimir / PDF" usa
  impressão do navegador (sem lib), com um cabeçalho específico para
  impressão (título, período, data de geração, quem gerou) e os filtros/
  botões escondidos na versão impressa. "⬇ Baixar CSV" exporta os mesmos
  registros do relatório atual, pronto para abrir no Excel em pt-BR.
- **Configurações** — edita as listas de apoio (Responsáveis, Filiais,
  Vendedores, Marcas e Produtos por Marca) direto pela interface. Produtos
  são vinculados a uma marca e só aparecem no Novo ECS depois que essa marca
  for escolhida. Itens antigos no formato de lista simples aparecem como
  "Produtos sem vínculo válido" para associação manual, sem atribuição
  automática. Responsáveis nunca são removidos, só ativados/desativados.
- **Acabamento visual** — favicon (SVG inline, sem asset externo), título
  da aba mudando por tela, e uma pequena limpeza de CSS repetido nos
  filtros do Histórico/Relatórios.

**Próximas etapas (nesta ordem sugerida):**
1. Segurança adicional (Firebase App Check, por exemplo, já que ainda não
   há Firebase Authentication)

## Decisão de dados: Marca → Produto/Demanda

- **Marca agora é obrigatória e vem antes de Produto/Demanda** no Novo ECS e
  na edição.
- `settings/produtos.list` passa a usar objetos no formato
  `{ name: "Válvulas", brand: "APV" }`.
- `getProdutosPorMarca(brand)` entrega apenas os produtos vinculados à marca
  escolhida; o campo Produto fica desabilitado enquanto nenhuma marca estiver
  selecionada.
- `getProdutos()` continua devolvendo uma lista plana, sem duplicidades, para
  manter compatibilidade com filtros do Histórico e outras telas.
- Produtos antigos gravados como string não são associados silenciosamente a
  nenhuma marca. Eles aparecem em Configurações como itens legados para que o
  usuário escolha o vínculo correto.
- ECS já criados não são alterados. Marca e Produto continuam copiados no
  próprio registro histórico.

## Decisão de produto: números no Dashboard vs. em Relatórios

Decisão explícita, então vale registrar o raciocínio: o Dashboard é uma
tela que a pessoa encara todo dia, e contadores pessoais ali (principalmente
"Meus ECS") tendem a virar meta implícita e gerar ansiedade em dias
naturalmente mais lentos, mesmo sem essa intenção. Por isso o Dashboard tem
a opção de ocultar os números e trocar por um sparkline decorativo (sem
eixo, sem valor, só a forma da atividade recente).

Relatórios é diferente: é uma tela de análise deliberada, que alguém abre
para entender o panorama de um período — aí os números fazem sentido e não
carregam esse peso do dia a dia. Por isso Relatórios sempre mostra números
reais, sem opção de ocultar.

Se no futuro fizer sentido refinar isso (por exemplo, ocultar só "Meus ECS"
por padrão e manter os agregados do time sempre visíveis, já que o risco de
pressão psicológica se concentra mais no contador pessoal do que no
agregado), é uma mudança pequena em `js/views/dashboard.js`.


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

1. Abrir um ECS pelo painel ao lado do Novo ECS, pelo preview do Dashboard
   ou pelo Histórico e conferir que vai para uma página de Detalhes, não
   mais um modal.
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

## Decisões técnicas de Relatórios

- **Agregação client-side.** O Firestore não tem GROUP BY. `fetchEcsForAggregation`
  traz até 2000 registros do período (reaproveitando os mesmos índices do
  Histórico) e a contagem por mês/vendedor/estado/produto acontece no
  navegador, em `js/views/reports.js`. Para o volume de um sistema interno
  isso é perfeitamente viável. Se um dia o volume crescer muito e 2000
  registros deixarem de ser suficiente, aparece um aviso na tela avisando
  que o resultado está truncado — nesse ponto, a migração natural é para
  contadores denormalizados (atualizados a cada criação/edição/cancelamento),
  em vez de reagregar tudo a cada visita à tela.
- **Chart.js via CDN** (`cdnjs.cloudflare.com`), carregado como script
  clássico no `index.html`, antes do `app.js` como módulo — por isso o
  `Chart` fica disponível como global comum, sem import ES module.
- **Agrupamento mensal usa `createdAt`**, não `ecsDate`, pela mesma razão
  do Histórico: é o campo usado para filtrar o período, então é o mesmo
  usado para agrupar — evita inconsistência entre "o que foi filtrado" e
  "o que foi mostrado".
- Sem cache entre trocas de período — cada "Gerar relatório" busca de novo.
  Para uma tela de análise usada esporadicamente, simplicidade venceu
  otimização prematura.

## O que testar nesta etapa (Dashboard: ocultar números)

1. No Dashboard, clicar "🙈 Ocultar números" e confirmar que os 4 KPIs
   somem e apareça o sparkline no lugar (sem nenhum número visível).
2. Recarregar a página (F5) e confirmar que a preferência persiste (o
   sparkline continua aparecendo, não os números).
3. Clicar "👁 Mostrar números" e confirmar que os KPIs voltam.

## O que testar nesta etapa (Relatórios)

1. Abrir Relatórios com o período padrão ("Este mês") e conferir que os 4
   gráficos carregam e o resumo bate com o que aparece no Histórico para
   o mesmo período.
2. Trocar para "Personalizado", escolher um intervalo e clicar "Gerar
   relatório" — os gráficos e o resumo devem atualizar.
3. Testar um período sem nenhum ECS — os gráficos devem aparecer vazios
   sem quebrar a tela (sem erro no console).
4. Se a base já tiver muitos registros, testar um período bem amplo (ex.:
   "Este ano" com bastante volume) e verificar se o aviso de truncamento
   aparece quando aplicável.

## Decisão de produto: painel "Últimos ECS" dentro de Novo ECS

"Últimos ECS" deixou de ser um item de menu separado. Em vez disso, o
formulário Novo ECS agora tem um painel lateral com os 10 ECS mais
recentes — dá pra criar um ECS e já ver os últimos criados por outras
pessoas sem trocar de tela, e o ECS recém-criado aparece nesse painel
assim que é salvo. O menu ficou só com Dashboard, Novo ECS, Histórico e
Relatórios.

- Componente novo: `js/components/ecs-mini-list.js` — lista compacta (uma
  linha por ECS, sem colunas), pensada para caber em ~300-340px de
  largura, diferente de `ecs-table.js` (usado onde tem espaço de sobra:
  Histórico e o preview do Dashboard).
- Classe de layout nova: `.content--split` (`css/layout.css`) — grid de
  duas colunas que empilha verticalmente abaixo de 900px de largura,
  igual ao breakpoint que já existia para a sidebar.
- O painel lateral e o formulário vivem em containers separados dentro da
  mesma view (`js/views/new-ecs.js`), então trocar entre formulário e tela
  de confirmação ("ECS criado") não reconstrói nem pisca o painel ao lado.

## O que testar nesta etapa (painel lateral do Novo ECS)

1. Abrir Novo ECS e confirmar que o painel "Últimos ECS" aparece ao lado
   do formulário (não mais como item separado do menu).
2. Criar um ECS e confirmar que ele aparece no topo do painel lateral
   assim que a confirmação "ECS criado" aparece, sem precisar recarregar
   a página.
3. Clicar num item do painel lateral e confirmar que abre Detalhes com
   `backTo: 'new-ecs'` (o botão Voltar deve retornar ao Novo ECS).
4. Reduzir a largura da janela (ou testar no celular) e confirmar que o
   painel empilha abaixo do formulário em vez de cortar a tela.

## Decisões técnicas de Exportação (PDF / CSV)

- **PDF via `window.print()`, não jsPDF.** Decisão da etapa de arquitetura,
  mantida aqui: o navegador já sabe salvar como PDF, e isso evita mais uma
  dependência. `css/print.css` concentra as regras `@media print` — esconde
  sidebar, topbar, os filtros e botões da tela (classe `.no-print`), e
  mostra um cabeçalho específico de impressão (`.print-only`) com título,
  período e quem gerou o relatório.
- **Gráficos viram `<img>` só na hora de imprimir.** `Chart.js` desenha em
  `<canvas>`, que imprime de forma inconsistente entre navegadores. No
  evento `beforeprint`, `reports.js` tira um `canvas.toDataURL()` de cada
  gráfico e injeta como `<img data-print-img>` ao lado do canvas (esperado
  ficar escondido); no `afterprint`, as imagens são removidas e o app volta
  ao estado normal. Os gráficos interativos em si nunca são destruídos ou
  recriados por causa disso.
- **CSV usa `;` como separador e BOM UTF-8** — não `,`. Em português do
  Brasil, o Excel usa vírgula como separador decimal, então um CSV separado
  por vírgula abre com tudo numa coluna só; o BOM garante que acentos
  apareçam certos sem o usuário precisar escolher a codificação manualmente.
- **Exportação sempre usa o último relatório gerado**, não dispara uma nova
  consulta ao Firestore — os botões ficam desabilitados até a primeira
  geração completar, e exportam exatamente o que está na tela (inclusive
  sujeito ao mesmo teto de 2000 registros e ao aviso de truncamento).

## O que testar nesta etapa (Exportação PDF / CSV)

1. Gerar um relatório e clicar "⬇ Baixar CSV" — abrir o arquivo no Excel e
   conferir que as colunas e acentos aparecem corretos.
2. Clicar "🖨 Imprimir / PDF" e usar "Salvar como PDF" no diálogo de
   impressão do navegador — conferir que aparecem o cabeçalho (título,
   período, quem gerou), os KPIs e os 4 gráficos, e que sidebar/topbar/
   filtros/botões NÃO aparecem no resultado.
3. Trocar o período, gerar de novo, e confirmar que a exportação reflete
   o novo período (não o anterior).
4. Cancelar o diálogo de impressão (não salvar) e continuar usando a tela
   normalmente — os gráficos interativos devem continuar funcionando.
## Decisões técnicas de Configurações

- **Responsáveis nunca é removido, só desativado.** É a única lista onde
  isso importa de verdade: o código vira parte permanente do `ecsCode` e do
  `creatorCode` de ECS já criados (ver "Regras que não podem ser
  quebradas"). As outras 4 listas (Vendedores, Produtos, Marcas, Filiais)
  são só texto copiado para dentro do ECS no momento da criação — remover
  uma opção da lista não altera nenhum ECS já existente, só deixa de
  aparecer como opção para os próximos.
- **Grava a lista inteira a cada mudança** (`settings-service.saveList`),
  não um item por vez — é assim que o documento `settings/{nome}` já era
  modelado desde a v1 (`{ list: [...] }`), e essas listas são pequenas o
  bastante para isso não ser um problema.
- **Cache atualizado na hora, sem invalidar e reler.** `saveList` escreve
  no Firestore e já sobrescreve `cache[nome]` localmente — por isso o
  combobox de Novo ECS e os filtros do Histórico refletem uma mudança feita
  em Configurações imediatamente, sem precisar de F5.
- **Sem controle de permissão** — qualquer pessoa que abra o app pode
  editar Configurações, igual a qualquer outra tela (não há Firebase
  Authentication ainda). Isso não é uma exposição nova: `firestore.rules`
  já permitia escrita livre em `settings/*` desde a v1; a tela só tornou
  isso mais conveniente. Se isso vier a importar, é o tipo de coisa que
  entra junto com a etapa de segurança adicional.

## O que testar nesta etapa (Configurações)

1. Adicionar um vendedor novo em Configurações e conferir que ele aparece
   no combobox de Vendedor em Novo ECS sem recarregar a página.
2. Remover um produto e confirmar que ele some do combobox de Produto, mas
   um ECS antigo que usava esse produto continua mostrando o valor normal
   em Detalhes.
3. Adicionar uma filial nova com UF e confirmar que ela aparece no
   combobox de Filial/Região em Novo ECS, com a UF preenchendo sozinha.
4. Tentar cadastrar um responsável com código repetido — deve bloquear com
   uma mensagem clara.
5. Desativar um responsável e conferir que ele some da tela de seleção de
   usuário, mas continua aparecendo normalmente nos ECS que já criou.

## Ajuste de usabilidade dos comboboxes (21/09/2026)

- Clicar em um combobox agora abre sempre a lista completa, mesmo quando já há uma opção selecionada.
- Digitar continua filtrando a lista normalmente.
- Comboboxes exibem seta de abertura e botão de limpeza quando há valor selecionado.
- A opção atual aparece marcada na lista.
- Ao trocar ou limpar a Marca, o Produto/Demanda anterior é automaticamente invalidado e limpo; a nova lista é carregada pela Marca selecionada.
- O mesmo comportamento Marca → Produto foi aplicado na criação e na edição de ECS.
