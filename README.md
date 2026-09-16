# Sistema ECS — v1 (validação de mecânica)

Esta é a primeira versão, focada em provar que o mecanismo central funciona
antes de construir o resto do sistema (Histórico, Relatórios, Configurações,
edição com histórico de alterações — tudo isso vem nas próximas etapas,
conforme conversamos).

## O que esta v1 já faz

- Tela de identificação do responsável (sem login), com "Trocar usuário".
- Formulário **Novo ECS** completo, com combobox pesquisável em
  Vendedor / Filial / Produto / Marca.
- **Estado (UF) derivado automaticamente da Filial/Região** selecionada —
  não é mais um campo digitável, conforme combinamos.
- Geração do código **ECS-{responsável}-{ano}-{sequência}** via transação
  atômica do Firestore (sem duplicar nem pular números, mesmo com dois
  usuários criando ao mesmo tempo).
- Tela "Últimos ECS" com os 20 mais recentes + filtro local (usa o campo
  `searchTokens`, que já é gravado em todo ECS pensando na busca completa
  da próxima etapa).
- Modal de detalhes do registro.

O que **não** está aqui ainda (por decisão, para manter o escopo desta
etapa em "provar a mecânica"): Dashboard com KPIs, Histórico com filtros
avançados, Relatórios/PDF, tela de Configurações, edição de ECS com log de
alterações. A estrutura de arquivos já está pronta para receber tudo isso
sem refatoração (ver `js/views/` e a análise de arquitetura que já validamos).

## Como rodar

### 1. Criar o projeto Firebase
No [console do Firebase](https://console.firebase.google.com/), crie um
projeto novo (ou use um existente), ative o **Firestore Database** (modo
produção) e registre um app Web para pegar as chaves de configuração.

### 2. Preencher as credenciais
Abra `js/firebase-config.js` e substitua os valores de `firebaseConfig`
pelos do seu projeto.

### 3. Publicar as regras de segurança
No console do Firebase → Firestore → Regras, cole o conteúdo de
`firestore.rules` (ou publique via CLI: `firebase deploy --only firestore:rules`).
Leia o comentário no topo do arquivo — sem Firebase Auth, essas regras
garantem a integridade dos dados, não controle de acesso; isso é um
próximo passo, não um problema desta v1.

### 4. Popular as listas de apoio
Abra `seed.html` no navegador e clique em "Rodar seed" **uma única vez**.
Isso grava `settings/vendedores`, `settings/produtos`, `settings/marcas`,
`settings/filiais` (já com UF amarrado) e `settings/responsaveis` com dados
de exemplo — os nomes de responsáveis (AK, CP, ML, JG) e "Olinger - BRU"
vieram do print do sistema atual, mas **vendedores/produtos são só
exemplo**: edite `seed.html` com a lista real antes ou depois de rodar
(dá pra rodar de novo, ele sobrescreve).

**Importante — contador inicial:** o seed *não* mexe em `ecsCounters`.
Se vocês forem continuar a numeração do sistema atual (em vez de começar
do zero), crie manualmente o documento `ecsCounters/2026` com
`{ currentSequence: <último número já usado> }` antes de criar o primeiro
ECS por aqui — senão a numeração reinicia em 1.

### 5. Servir os arquivos
Como o app usa ES Modules (`import`/`export`), não dá para abrir
`index.html` direto com duplo clique (`file://` bloqueia módulos por CORS).
Rode um servidor estático simples na pasta, por exemplo:

```bash
npx serve .
# ou
python3 -m http.server 5500
```

Depois acesse `http://localhost:5500` (ou a porta que aparecer).

Para publicar de verdade depois, o mesmo projeto Firebase já serve para
`firebase deploy` via Firebase Hosting.

## O que testar nesta etapa

1. Selecionar um responsável e confirmar que "Trocar usuário" funciona.
2. Criar um ECS e conferir se o código gerado bate com o esperado
   (`ECS-{código}-{ano}-{sequência com 4 dígitos}`).
3. Selecionar uma Filial e confirmar que a UF aparece sozinha, sem campo
   para digitar.
4. Abrir duas abas com usuários diferentes e criar dois ECS quase ao
   mesmo tempo — os dois devem sair com sequências diferentes e
   consecutivas (é o teste real da transação atômica).
5. Conferir que o registro aparece em "Últimos ECS" e que o modal de
   detalhes mostra os dados certos.
