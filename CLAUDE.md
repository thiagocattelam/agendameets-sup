# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev               # Start Next.js dev server (port 3000)
npm run build             # prisma generate + next build (does NOT apply migrations)
npx prisma migrate dev --name <nome>  # Create + apply a migration locally (.env.development)
npm run db:deploy         # Apply pending migrations (local); db:deploy:prod for production
npm run db:status         # Migration status (local); db:status:prod for production
npx prisma generate       # Regenerate Prisma client after schema changes
npx prisma studio         # Open Prisma Studio to inspect the database
```

No lint or test scripts configured.

### Migrations

History was squashed into a baseline `prisma/migrations/0_init` (matches the schema as of 2026-11; older migrations live only in git history). Standard Prisma flow:

- Schema change → `npx prisma migrate dev --name <nome>` locally → commit the migration → `npm run db:deploy:prod`.
- Never change the database with `db push` or manual SQL — that brings back drift between migrations and the database.
- Review generated SQL before applying: Prisma turns a model/column rename into DROP + CREATE (data loss); use `--create-only` and rewrite it as `ALTER ... RENAME`.
- A fresh database is built with `migrate deploy` alone.

## Architecture

Next.js 15 (App Router) + React 19 + Tailwind CSS 4 + Prisma 6 + PostgreSQL + NextAuth v5 + CASL 7.

### App structure

```
app/
├── layout.js              # Root layout (html/body only)
├── globals.css
├── login/                 # Public login page (Google OAuth)
├── (home)/                # Route group — all authenticated pages
│   ├── layout.js          # Wraps with Providers + Header sidebar
│   ├── page.js            # Dashboard (home)
│   ├── agendamentos/      # Appointment list with filters
│   ├── usuarios/          # User management (data, profile, per-user grants)
│   └── assuntos/          # Subject CRUD
└── api/
    ├── agendamentos/      # GET (paginated+filtered), POST, PUT, DELETE
    ├── usuarios/          # GET, POST, PUT, DELETE + PUT [id]/permissoes
    ├── assuntos/          # GET, POST, PUT, DELETE
    ├── status/            # GET
    ├── sync-sheets/       # POST — import from Google Sheets
    ├── cron/migrar-status/   # GET — daily cron (Bearer CRON_SECRET), Confirmado → Realizado
    └── google-calendar/   # connect, callback, disconnect, status

components/
├── Header/Header.jsx      # Collapsible sidebar; nav filtered by permission
├── Providers.jsx          # SessionProvider + AlertaProvider wrapper
├── AgendamentoModal.jsx   # Create/edit appointment modal
├── AlertaModal.jsx        # Upcoming appointment notification modal
├── AlertaProvider.jsx     # Schedules audio alerts from session data
├── AssuntoModal.jsx       # Create/edit subject modal
├── UsuarioModal.jsx       # Create/edit user modal (profile + grants)
└── Skeleton.jsx

hooks/
├── useAbility.js             # CASL ability from session.regras (client)
└── useAlertaAgendamentos.js  # Polls API every 60s; fires browser audio alarms

lib/
├── permissoes.js          # Profiles, permission catalog, rule builder, restricted routes (pure — no Prisma)
├── autorizacao.js         # autenticar() → { session, ability } | { erro }; semPermissao(), naoEncontrado()
├── camposPublicos.js      # Prisma selects for list responses
├── prisma.js              # Prisma client singleton
├── googleCalendar.js      # Google Calendar OAuth + event CRUD
└── sheets.js              # Google Sheets read client (service account auth)

prisma/
├── schema.prisma          # Source of truth for DB schema
└── migrations/            # Migration history (behind the schema — see above)

middleware.js              # NextAuth middleware — protects all routes except /login, /api, _next
auth.js                    # NextAuth: domain check, auto-create Usuario, rules into JWT (uses Prisma)
auth.config.js             # Edge-safe config: Google provider, session callback, page authorization
```

### Data models

| Model | Key fields |
|---|---|
| `Usuario` | `nome`, `ativo`, `email?` (unique), `alertaMinutos?` (default 30), `perfil` (`GESTAO` \| `ATENDENTE`, default `ATENDENTE`), `googleCalendarConectado` |
| `UsuarioPermissao` | PK (`usuarioId`, `permissao`), `concedida` — per-user grant (`true`) or block (`false`) |
| `GoogleCredencial` | `accessToken`, `refreshToken`, `tokenExpiry`, 1:1 `usuarioId` (cascade) |
| `Agendamento` | `dataHoraInicio`, `dataHoraFim`, `cliente`, `linkChat?`, `observacoes?`, `alertaMinutos?`, `googleEventId?`, FK `atendenteId` → Usuario, FK to Status, M2M to Assunto |
| `Assunto` | `descricao`, M2M to Agendamento |
| `Status` | `descricao`, `corHex` (hex color for badge display) |

`Usuario` was formerly `Atendente`. **`Agendamento.atendente`/`atendenteId` intentionally kept its name**: in an appointment, the user acts as the attendant. In appointment-related UI the user list is still called `atendentes`.

### Authentication

NextAuth v5, Google OAuth only. `signIn` restricts login to `AUTH_ALLOWED_EMAIL_DOMAINS`. The `jwt` callback runs on every session read:

- On login (`profile` present) it **upserts** the `Usuario` by email — every allowed-domain email becomes a user with profile `ATENDENTE`.
- Otherwise it re-reads the user; inactive or deleted → returns `null` (session ends).
- Stores `usuarioId`, `perfil` and `regras` (computed CASL rules) in the token, so profile/grant changes apply immediately.

The `session` callback lives in `auth.config.js` (not `auth.js`) so the edge middleware also sees `perfil`/`regras`. Client side: `session.usuarioId`, `session.perfil`, `session.regras`.

### Authorization (RBAC + per-user grants, CASL)

Everything is defined in `lib/permissoes.js`:

- `REGRAS_POR_PERFIL` — base rules. `GESTAO`: `manage all`. `ATENDENTE`: read `Agendamento`/`Usuario`/`Assunto`/`Status`; create/update/delete `Agendamento` only where `atendenteId` = own id.
- `PERMISSOES` — catalog of grantable keys (`agendamento.ver|criar|editar|excluir`, `assunto.gerenciar`, `usuario.gerenciar`, `permissao.gerenciar`), each mapping to one unconditional CASL rule. The key is what's stored in `UsuarioPermissao.permissao` — don't rename without migrating data.
- `montarRegras()` — profile rules, then grants on top (`inverted: !concedida`); later CASL rules take precedence, so a block removes even the profile's conditional permission.
- `ROTAS_RESTRITAS` / `podeAcessarRota()` — page gating shared by middleware and Header.

Enforcement:

- **API routes** start with `const { session, ability, erro } = await autenticar(); if (erro) return erro;` then check `ability.cannot(...)` → `semPermissao()` (403). Record-level checks use `subject("Agendamento", record)`; list filtering uses `accessibleBy(ability, "read").ofType("Agendamento")` (CASL v7 API — not the v6 `.Agendamento` property). New routes must follow this pattern.
- **Middleware** redirects to `/` when `podeAcessarRota` fails.
- **UI** uses `useAbility()` to hide actions; it is never the security boundary.
- Users can't change their own profile/grants, deactivate or delete themselves.
- Users without user-management permissions get `selectUsuarioPublico` from `GET /api/usuarios`; `GET /api/agendamentos` always uses `selectAgendamento` (`lib/camposPublicos.js`). Keep responses limited to fields the screens use.

### Alert system

`useAlertaAgendamentos` (client hook) polls `/api/agendamentos` every 60 s for the current user's appointments today (`atendenteId = session.usuarioId`). For each one, it schedules a `setTimeout` to fire `alertaMinutos` before start (falling back to `atendente.alertaMinutos`, then 30). On trigger, it plays a browser audio alarm and opens `AlertaModal`. `AlertaProvider` wraps the authenticated layout and holds the active alert state.

### Google Calendar sync

Per-user opt-in OAuth flow in `lib/googleCalendar.js` (`getUsuarioComTokens`, `criarEvento`, `atualizarEvento`, `apagarEvento`); tokens in `GoogleCredencial`. Appointment create/update/reassign/delete mirrors to the attendant's primary calendar via `Agendamento.googleEventId`. One-way (system → Google). `invalid_grant` marks the user `googleCalendarConectado = false`.

### Sheets sync

`POST /api/sync-sheets` reads range `A7:J` from the configured Google Sheet, creates missing Usuario/Status/Assunto records on-the-fly, and upserts Agendamentos using `linkChat` as the deduplication key. Rows without a valid `http` linkChat are skipped. **Not yet adapted to permissions**: any logged-in user can run it, and users it creates have no email (can't log in). Planned to be revisited.

### External integrations

- **PostgreSQL** — `DATABASE_URL`
- **Google OAuth** — `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SECRET`; allowed domains in `AUTH_ALLOWED_EMAIL_DOMAINS` (comma-separated) and `NEXT_PUBLIC_AUTH_ALLOWED_EMAIL_DOMAINS` (form placeholder)
- **Google Sheets** — `GOOGLE_SERVICE_ACCOUNT_JSON` (full JSON), `GOOGLE_SHEET_ID`. Read-only (`spreadsheets.readonly`). Helper in `lib/sheets.js` accepts a range string.
- **Google Calendar** — same OAuth client; Calendar API must be enabled in the Google Cloud project.
- **Cron** — `CRON_SECRET`; schedule in `vercel.json`.

### Path alias

`@` maps to the project root, e.g. `import { getSheetData } from "@/lib/sheets"`.
