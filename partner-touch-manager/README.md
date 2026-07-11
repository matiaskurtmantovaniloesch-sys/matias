# Partner Touch Manager

CRM interno do **Time de Relacionamentos/Parcerias** para registrar e acompanhar
**touches** (interações) com cada parceria, ver métricas de saúde do relacionamento
e organizar os contatos captados.

**O Google Sheets é o banco de dados vivo (single source of truth):** tudo que
você cria ou edita na ferramenta é gravado na planilha em segundos, e tudo que a
ferramenta mostra vem da planilha. Se alguém editar direto no Sheets, basta
recarregar a página para ver a mudança.

## Telas

| Rota | O que faz |
|---|---|
| `/` | Dashboard: KPIs, gráficos e widget "Precisa de atenção", com filtro por período e responsável |
| `/parcerias` | Lista de parcerias com busca, filtros e ordenação |
| `/parcerias/[id]` | Detalhe da parceria: timeline de touches, contatos e próximas ações |
| `/contatos` | Diretório de contatos captados, com filtros e export CSV |
| Botão "Registrar touch" | Modal rápido, acessível de qualquer tela (na barra lateral) |

## Stack

Next.js (App Router) + TypeScript · Tailwind CSS + shadcn/ui · Recharts ·
`googleapis` (Google Sheets API v4) com Service Account.

---

## Setup do zero (não precisa ser técnico — siga na ordem)

### 1. Crie a planilha

Crie uma planilha nova no [Google Sheets](https://sheets.new). Pode deixar vazia —
o comando de bootstrap (passo 6) cria as abas e cabeçalhos sozinhos.

Copie o **ID da planilha**: é o trecho comprido da URL entre `/d/` e `/edit`.

> Exemplo: em `https://docs.google.com/spreadsheets/d/1AbC123xyz/edit#gid=0`,
> o ID é `1AbC123xyz`.

### 2. Crie o projeto no Google Cloud e habilite a API

1. Acesse [console.cloud.google.com](https://console.cloud.google.com) e faça login
   com sua conta Google.
2. No topo da tela, clique no seletor de projeto → **Novo projeto** → dê um nome
   (ex.: `partner-touch-manager`) → **Criar**.
3. Com o projeto selecionado, procure por **"Google Sheets API"** na barra de busca
   e clique em **Ativar** (Enable).

### 3. Crie a Service Account (conta de serviço)

1. No menu ☰ → **IAM e administrador** → **Contas de serviço** → **Criar conta de serviço**.
2. Dê um nome (ex.: `touch-manager-bot`) → **Criar e continuar** → pode pular as
   permissões (Concluir).
3. Clique na conta criada → aba **Chaves** → **Adicionar chave** → **Criar nova
   chave** → tipo **JSON** → **Criar**. Um arquivo `.json` será baixado.
   **Guarde esse arquivo em local seguro e nunca o envie para o Git.**

### 4. Compartilhe a planilha com a service account

1. Abra o arquivo JSON baixado e copie o valor do campo `client_email`
   (algo como `touch-manager-bot@seu-projeto.iam.gserviceaccount.com`).
2. Na planilha do Google Sheets, clique em **Compartilhar**, cole esse e-mail e
   escolha o papel **Editor**. Salve.

> Esse é o passo que mais gera erro: se a ferramenta mostrar "A planilha não está
> compartilhada com a conta de serviço", volte aqui.

### 5. Configure as variáveis de ambiente

Na pasta do projeto, copie o arquivo de exemplo e edite:

```bash
cp .env.example .env.local
```

Preencha o `.env.local` com os valores do JSON baixado:

```
GOOGLE_SERVICE_ACCOUNT_EMAIL=touch-manager-bot@seu-projeto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...conteúdo do campo private_key...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_ID=1AbC123xyz
RISK_DAYS_THRESHOLD=30
```

- `GOOGLE_PRIVATE_KEY`: copie o campo `private_key` do JSON **inteiro, com as
  aspas e os `\n`** exatamente como está no arquivo.
- `RISK_DAYS_THRESHOLD`: dias sem touch para uma parceria ser considerada
  "em risco" no dashboard (padrão 30).

### 6. Instale, crie as abas e rode

```bash
npm install        # instala as dependências
npm run init-sheet # cria as abas Parcerias, Contatos e Touches na planilha
npm run dev        # sobe a ferramenta em http://localhost:3000
```

O `init-sheet` é seguro de rodar mais de uma vez — ele só cria o que falta e
nunca apaga dados.

Para rodar em produção: `npm run build && npm start` (ou faça deploy na Vercel,
configurando as mesmas variáveis de ambiente no painel do projeto).

---

## Estrutura das abas da planilha

A primeira linha de cada aba é o cabeçalho. **Não renomeie as colunas** — a
ferramenta usa esses nomes como chave (reordenar colunas é ok).

### Aba `Parcerias`

| Coluna | Descrição |
|---|---|
| `id` | UUID gerado pela ferramenta — não edite |
| `nome` | Nome da parceria/empresa |
| `tipo` | Estratégica, Comercial, Institucional, Mídia, Comunidade |
| `status` | Ativa, Em negociação, Pausada, Encerrada |
| `responsavel` | Pessoa do time dona do relacionamento |
| `data_inicio` | Data de início (dd/mm/aaaa) |
| `health` | Saudável, Atenção, Em risco |
| `ultima_interacao` | Data do último touch — **atualizada automaticamente** |
| `proximo_followup` | Data do próximo follow-up planejado |
| `notas` | Texto livre |

### Aba `Contatos`

| Coluna | Descrição |
|---|---|
| `id` | UUID — não edite |
| `parceria_id` | id da parceria (aba Parcerias) |
| `nome` | Nome do contato |
| `cargo` | Cargo/função |
| `email` | E-mail |
| `telefone` | Telefone/WhatsApp |
| `linkedin` | URL do LinkedIn |
| `origem` | Como foi captado (evento, indicação, inbound…) |
| `decisor` | Sim / Não |
| `notas` | Texto livre |

### Aba `Touches`

| Coluna | Descrição |
|---|---|
| `id` | UUID — não edite |
| `parceria_id` | id da parceria |
| `contato_id` | id do contato (opcional) |
| `data` | Data/hora do touch (dd/mm/aaaa hh:mm) |
| `canal` | Reunião, Call, E-mail, WhatsApp, Evento, Outro |
| `tipo` | Alinhamento, Follow-up, Negociação, Suporte, Social, Onboarding |
| `resumo` | O que aconteceu |
| `sentimento` | Positivo, Neutro, Negativo |
| `proxima_acao` | Próximo passo combinado |
| `data_proxima_acao` | Prazo da próxima ação |
| `responsavel` | Quem conduziu/registrou |

> Ao registrar um touch, a ferramenta atualiza sozinha a `ultima_interacao` da
> parceria (e o `proximo_followup`, se o touch tiver prazo de próxima ação).

## Como funciona por dentro (para quem for dar manutenção)

- **`lib/sheets.ts`** é o único módulo que fala com a API do Google
  (autenticação JWT, `readSheet`, `appendRow`, `updateRowById`, `deleteRowById`,
  bootstrap). Nenhum componente acessa o Google diretamente.
- **`lib/data/*`** é o CRUD tipado por entidade (Parcerias, Contatos, Touches),
  com validação Zod nos Route Handlers em `app/api/*` — as credenciais nunca
  chegam ao navegador.
- Linhas são localizadas **sempre pelo `id`** (UUID), nunca pela posição; delete
  usa `batchUpdate`/`deleteDimension` para não deixar linhas vazias.
- Cota da API (60 leituras/min): cada tela faz no máximo **1 leitura por aba**
  por request, com `revalidate` de 10s — a sensação de "ao vivo" sem estourar a cota.
- Para trocar Service Account por OAuth no futuro, basta substituir o bloco de
  autenticação em `lib/sheets.ts` (`getClient()`); o resto do código não muda.

## Solução de problemas

| Sintoma | Causa provável |
|---|---|
| "A planilha não está compartilhada com a conta de serviço" | Passo 4 não foi feito (compartilhar como **Editor**) |
| "Planilha não encontrada" | `GOOGLE_SHEET_ID` errado no `.env.local` |
| Erro `error:1E08010C:DECODER` ou similar | `GOOGLE_PRIVATE_KEY` colada errada — copie o campo `private_key` inteiro, com `\n` |
| "Limite de requisições atingido" | Muitos recarregamentos seguidos; aguarde ~1 min |
| Aba faltando | Rode `npm run init-sheet` |
