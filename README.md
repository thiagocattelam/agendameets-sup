# AgendaMeets

Sistema de gerenciamento de agendamentos para equipes de atendimento, com autenticação via Google, controle de acesso por perfis e permissões, importação de dados a partir do Google Sheets e sincronização com a Google Agenda de cada usuário.

## Funcionalidades

- Listagem de agendamentos com filtros por período e atendente (filtros salvos no localStorage)
- Criação, edição e exclusão de agendamentos via modal, com mensagens de erro (sessão expirada, sem permissão, registro excluído, falha de rede)
- Controle de acesso por perfil (Gestão e Atendente) com liberações pontuais por usuário
- Alertas sonoros no browser antes do início de cada agendamento (configurável por usuário ou por agendamento)
- Importação de agendamentos a partir de uma planilha Google Sheets
- Sincronização de agendamentos com a Google Agenda pessoal de cada usuário (conexão opt-in)
- Gestão de usuários (dados, perfil e liberações) e CRUD de assuntos
- Acesso restrito aos domínios configurados em `AUTH_ALLOWED_EMAIL_DOMAINS`, via Google OAuth

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 15 (App Router) |
| UI | React 19 + Tailwind CSS 4 |
| Banco de dados | PostgreSQL via Prisma 6 |
| Autenticação | NextAuth v5 (Google OAuth) |
| Autorização | CASL (`@casl/ability` 7 + `@casl/prisma` 2) |
| Integrações | Google Sheets API v4, Google Calendar API v3 (`googleapis`) |
| Runtime | Node.js 24 |

## Arquitetura

```
agendameets-sup/
├── app/
│   ├── layout.js              # Layout raiz (html/body)
│   ├── login/                 # Página de login pública
│   ├── (home)/                # Grupo de rotas autenticadas
│   │   ├── layout.js          # Injeta sidebar e providers
│   │   ├── page.js            # Dashboard
│   │   ├── agendamentos/      # Lista com filtros e paginação
│   │   ├── usuarios/          # Gestão de usuários, perfis e liberações
│   │   └── assuntos/          # CRUD de assuntos
│   └── api/                   # Route Handlers
│       ├── agendamentos/      # GET (paginado), POST, PUT, DELETE
│       ├── usuarios/          # CRUD + PUT [id]/permissoes (perfil e liberações)
│       ├── assuntos/          # CRUD
│       ├── status/            # GET
│       ├── sync-sheets/       # POST — importa da planilha
│       ├── cron/migrar-status/   # GET — cron diário (Confirmado → Realizado)
│       └── google-calendar/   # connect, callback, disconnect, status
├── components/
│   ├── Header/                # Sidebar colapsável (menu filtrado por permissão, conectar/desconectar agenda)
│   ├── Providers.jsx          # SessionProvider + AlertaProvider
│   ├── AgendamentoModal.jsx   # Modal de criação/edição de agendamento
│   ├── AlertaModal.jsx        # Modal de notificação de alerta
│   ├── AlertaProvider.jsx     # Gerencia estado do alerta ativo
│   ├── AssuntoModal.jsx       # Modal de assunto
│   ├── UsuarioModal.jsx       # Modal de usuário (dados, perfil e liberações)
│   └── Skeleton.jsx           # Placeholder de carregamento
├── hooks/
│   ├── useAbility.js          # Permissões do usuário logado no cliente (CASL)
│   └── useAlertaAgendamentos.js  # Polling + timers de alerta
├── lib/
│   ├── permissoes.js          # Perfis, catálogo de permissões e regras de rota
│   ├── autorizacao.js         # autenticar() para as rotas de API (sessão + ability)
│   ├── camposPublicos.js      # Campos devolvidos pela API nas listagens
│   ├── prisma.js              # Singleton do Prisma Client
│   ├── sheets.js              # Cliente Google Sheets (service account)
│   └── googleCalendar.js      # OAuth + CRUD de eventos na Google Agenda
├── auth.js                    # NextAuth: domínio, criação automática do usuário, regras no JWT
├── auth.config.js             # Configuração edge-safe (provider, sessão, bloqueio de páginas)
├── middleware.js              # Proteção de rotas via NextAuth
└── prisma/
    ├── schema.prisma          # Schema do banco de dados
    └── migrations/            # Histórico de migrações
```

### Modelos de dados

- **Usuario** — `nome`, `ativo`, `email` (único, vincula ao login Google), `alertaMinutos` (antecedência padrão do alerta), `perfil` (`GESTAO` ou `ATENDENTE`), `googleCalendarConectado`. É o usuário da sessão e também quem atende os agendamentos.
- **UsuarioPermissao** — liberação pontual de um usuário: `permissao` (chave do catálogo) e `concedida` (`true` libera, `false` bloqueia).
- **GoogleCredencial** — tokens OAuth da Google Agenda do usuário (1:1 com Usuario).
- **Agendamento** — `dataHoraInicio`, `dataHoraFim`, `cliente`, `linkUmbler`, `observacoes`, `alertaMinutos` (sobrescreve o do usuário), `googleEventId` (evento na Google Agenda); `atendente`/`atendenteId` aponta para o Usuario que atende; FK para Status; M2M com Assunto.
- **Assunto** — categoria/tema da reunião (muitos para muitos com Agendamento).
- **Status** — estado do agendamento com cor em hex para badge visual.

### Autenticação

Login exclusivo via Google OAuth, aceito apenas para os domínios em `AUTH_ALLOWED_EMAIL_DOMAINS`. No primeiro login, o e-mail é cadastrado automaticamente como `Usuario` com perfil `ATENDENTE`. A cada requisição autenticada, o callback `jwt` relê o usuário no banco: se ele foi desativado ou excluído, a sessão cai; se o perfil ou as liberações mudaram, as novas regras valem na hora.

A sessão expõe `usuarioId`, `perfil` e `regras` (regras CASL já calculadas).

### Perfis e permissões

O controle de acesso é RBAC com liberações pontuais, implementado com CASL. Tudo fica centralizado em `lib/permissoes.js`.

| Perfil | Acesso padrão |
|---|---|
| Gestão | Tudo |
| Atendente | Vê todos os agendamentos; cria, edita e exclui só os próprios; lê usuários, assuntos e status |

Liberações pontuais (tela **Usuários** → editar) sobrepõem o perfil de um usuário específico. Cada permissão do catálogo pode ficar em **Padrão** (segue o perfil), **Liberar** (vale para qualquer registro) ou **Bloquear** (retira, inclusive o que o perfil permitia):

- Ver agendamentos
- Criar / editar / excluir agendamentos de qualquer atendente
- Gerenciar assuntos
- Gerenciar usuários
- Gerenciar perfis e liberações

As mesmas regras são aplicadas em três camadas:

- **API** — cada rota chama `autenticar()` e checa a ability; a listagem de agendamentos filtra no banco com `accessibleBy`. Sem permissão a resposta é 403.
- **Middleware** — bloqueia as páginas `/usuarios` e `/assuntos` para quem não tem permissão de escrita nelas.
- **Interface** — menu, botões e opções de atendente são exibidos conforme `useAbility()`.

Ninguém altera o próprio perfil ou liberações, nem se desativa ou se exclui. Para usuários sem permissão de gestão, a API devolve só os campos que as telas usam (`lib/camposPublicos.js`).

### Sistema de alertas

O hook `useAlertaAgendamentos` roda no cliente e faz polling a cada 60 segundos para buscar os agendamentos do dia do usuário logado. Para cada um, agenda um `setTimeout` para disparar `alertaMinutos` antes do início, tocando um alarme de áudio via Web Audio API e exibindo um modal de notificação.

### Importação via Google Sheets

`POST /api/sync-sheets` lê o intervalo `A7:J` da planilha configurada e importa agendamentos. Usuários, status e assuntos são criados automaticamente se não existirem. O campo `linkUmbler` é usado como chave de deduplicação; linhas sem ele são ignoradas.

> A importação ainda não foi adaptada ao modelo de permissões: qualquer usuário logado pode executá-la, e os usuários criados por ela não têm e-mail (não conseguem logar).

### Sincronização com Google Agenda

Cada usuário pode conectar sua própria conta Google (a mesma usada no login) para que seus agendamentos sejam replicados na sua Google Agenda pessoal. A conexão é opt-in, feita pelo popover do usuário em `components/Header/Header.jsx`.

- Fluxo OAuth próprio (independente do login do NextAuth), implementado em `lib/googleCalendar.js` com o pacote `googleapis` e exposto pelas rotas `app/api/google-calendar/{connect,callback,disconnect,status}`. Os tokens ficam na tabela `GoogleCredencial`.
- Escopo solicitado: `calendar.events` (somente inserir/editar/excluir eventos, sem ler a agenda do usuário).
- A URL de consentimento usa `login_hint`/`hd` para sugerir a conta correta, e o callback valida o `id_token` retornado contra o e-mail da sessão. Se não bater, o token é revogado e a conexão é recusada.
- Ao criar, editar, reatribuir o atendente ou excluir um agendamento, o evento correspondente (`Agendamento.googleEventId`) é criado/atualizado/excluído na agenda `primary` do usuário conectado. Falhas de sincronização (ex.: token revogado) não bloqueiam a operação no sistema; apenas marcam o usuário como desconectado (`googleCalendarConectado = false`) quando aplicável.
- **A sincronização é apenas em uma via (sistema → Google Agenda)**; alterações feitas diretamente no Google Calendar não voltam para o sistema.
- Pré-requisito no Google Cloud: a "Google Calendar API" precisa estar habilitada na Library do projeto usado em `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`.

### Cron de status

`GET /api/cron/migrar-status` roda diariamente (agendado em `vercel.json`) e move para **Realizado** os agendamentos **Confirmados** de dias anteriores. Exige o header `Authorization: Bearer $CRON_SECRET`.

## Configuração

### Pré-requisitos

- Node.js 24+
- PostgreSQL

### Variáveis de ambiente

Crie um arquivo `.env` na raiz:

```env
# Banco de dados
DATABASE_URL="postgresql://usuario:senha@localhost:5432/agendameets"

# NextAuth
AUTH_SECRET="sua-chave-secreta"
AUTH_GOOGLE_ID="seu-google-client-id"
AUTH_GOOGLE_SECRET="seu-google-client-secret"

# Domínios aceitos no login (separados por vírgula)
AUTH_ALLOWED_EMAIL_DOMAINS="clinicaexperts.com.br"
NEXT_PUBLIC_AUTH_ALLOWED_EMAIL_DOMAINS="@clinicaexperts.com.br"  # usado como placeholder no formulário

# Google Sheets (service account)
GOOGLE_SERVICE_ACCOUNT_JSON='{ ... }'
GOOGLE_SHEET_ID="id-da-planilha"

# Cron
CRON_SECRET="segredo-do-cron"
```

### Instalação e execução

```bash
npm install
npm run dev
```

Acesse em `http://localhost:3000`.

### Banco de dados

**Banco existente** — aplique as migrations pendentes com:

```bash
npx prisma migrate deploy
```

Use `migrate deploy`, não `migrate dev`: o histórico de migrations está atrás do schema real (algumas colunas foram criadas sem migration), e o `migrate dev` pode propor resetar o banco.

**Banco novo** — pelo mesmo motivo, as migrations não conseguem criar o banco do zero. Crie o schema direto do `schema.prisma` e marque as migrations como aplicadas:

```bash
npx prisma db push
for m in prisma/migrations/*/; do npx prisma migrate resolve --applied "$(basename "$m")"; done
```

**Primeiro gestor** — todo usuário entra como `ATENDENTE`. Depois do primeiro login, promova quem vai administrar o sistema:

```sql
UPDATE "Usuario" SET perfil = 'GESTAO' WHERE email = 'nome@clinicaexperts.com.br';
```

A partir daí, perfis e liberações são geridos pela tela **Usuários**.

### Outros comandos

```bash
npx prisma studio        # Interface visual para inspecionar o banco
npx prisma generate      # Regenerar o cliente após alterar o schema
npm run build            # Build de produção (inclui prisma generate, não aplica migrations)
```
