# Architecture

Этот проект специально оставлен простым. Цель - учебный starter-project, а не enterprise architecture.

## Monorepo layout

```text
splitter-app-f/
  backend/              Express API, Prisma, Dockerfile, docker-compose.yml
  frontend/             Expo React Native app
  scripts/              helper scripts for students
  README.md             quick start
  BEGINNER_SETUP.md     detailed setup guide
  TROUBLESHOOTING.md    common errors and fixes
```

## Backend

Stack:

- Node.js 18/20
- TypeScript
- Express
- Prisma
- SQLite
- JWT auth
- Docker Compose

Important files:

- `backend/src/server.ts` - app bootstrap, CORS, routes, health check
- `backend/src/config/env.ts` - required env validation
- `backend/src/config/prisma.ts` - Prisma client
- `backend/src/routes/` - REST endpoints
- `backend/src/middleware/auth.ts` - JWT middleware
- `backend/src/middleware/errorHandler.ts` - global error handler
- `backend/prisma/schema.prisma` - database schema
- `backend/docker-compose.yml` - backend + SQLite volume

Routes are mounted in `server.ts`:

```ts
app.use("/auth", authRoutes);
app.use("/friends", friendsRoutes);
app.use("/groups", groupsRoutes);
app.use("/sessions", sessionsRoutes);
app.use("/uploads", uploadsRoutes);
```

The `/sessions/scan` route parses receipt photos before it creates a session. Failed OCR returns an error instead of a sample receipt. The `/friends/invite` and `/friends/join` routes issue and redeem short-lived signed invite tokens.

Avatar uploads use Cloudflare R2 when configured. Local development and Docker Compose can use the persistent avatar directory (`data/avatars` or `/app/data/avatars`), served under `/media/avatars`. Docker's `/app/data` volume holds both SQLite data and local avatars; only the avatar subdirectory is public.

Health check:

```text
GET /health
```

Swagger:

```text
GET /api-docs
```

## Database

Prisma schema lives in:

```text
backend/prisma/schema.prisma
```

Docker startup runs:

```bash
prisma migrate deploy
```

For local development after schema changes:

```bash
npm --prefix backend run db:migrate
```

## Frontend

Stack:

- Expo SDK 54
- React Native
- Expo Router
- TypeScript
- Axios
- Zustand
- TanStack Query
- Tamagui dependencies still exist, but the main UI is mostly React Native StyleSheet/shared UI

Important files:

- `frontend/app/` - screens and routes
- `frontend/src/features/` - feature modules
- `frontend/src/features/auth/api/index.ts` - shared Axios client
- `frontend/src/shared/config/env.ts` - frontend env validation and API URL
- `frontend/src/shared/ui/` - reusable UI components
- `frontend/src/shared/config/currencies.ts` - supported currencies and currency-aware number formatting
- `frontend/src/shared/lib/stores/app-store.tsx` - persisted theme, language, and preferred currency
- `frontend/app.json` - Expo configuration
- `frontend/metro.config.js` - Metro resolver workarounds
- `frontend/babel.config.js` - Babel plugins

## API connection

Frontend reads:

```text
EXPO_PUBLIC_API_URL
```

from `frontend/.env`.

The Axios client is created in:

```text
frontend/src/features/auth/api/index.ts
```

For Expo Go on a real phone, use:

```text
http://YOUR_COMPUTER_IP:8080
```

For browser web preview on the same computer, this can work:

```text
http://localhost:8080
```

## Docker architecture

`backend/docker-compose.yml` starts the backend service with a persistent SQLite volume.

On startup it applies Prisma migrations and starts Express.

Docker Compose also persists local avatar files in `/app/data/avatars`. The app uses the dark/light theme selected in the profile screen. Receipt currency may be changed per bill; no exchange-rate conversion is performed.

Default local port:

- Backend API: `8080`

## Env strategy

Backend:

- Docker Compose provides safe local defaults.
- `backend/.env.example` documents variables for local npm dev.
- `backend/src/config/env.ts` fails fast when critical variables are missing.

Frontend:

- `frontend/.env.example` explains the difference between localhost and LAN IP.
- `frontend/src/shared/config/env.ts` warns during development when API URL is missing or points to localhost on mobile.

## Web mode limitation

The stable path for students is Expo Go mobile. Web mode is useful for quick previews, but React Native web and Tamagui-related packages can expose bundling edge cases.

Do not spend class time debugging web first. Verify:

1. backend health check
2. frontend mobile through Expo Go
3. auth/API flow

Then investigate web separately if needed.

## How to add your own feature

Backend:

1. Add a route file in `backend/src/routes/`.
2. Export an Express router.
3. Mount it in `backend/src/server.ts`.
4. Use Prisma through `backend/src/config/prisma.ts` if database access is needed.
5. If schema changes, edit `backend/prisma/schema.prisma` and run migration.

Frontend:

1. Add API functions in `frontend/src/features/<feature>/api/`.
2. Use the shared `apiClient`.
3. Add screens in `frontend/app/`.
4. Keep UI components simple and reuse `frontend/src/shared/ui/`.
5. Test through Expo Go.

## What not to do

- Do not add a new framework unless it solves a real class assignment problem.
- Do not create complex service layers for simple CRUD.
- Do not hardcode your personal IP in source code.
- Do not commit `.env` files.
- Do not delete migrations unless you intentionally reset the project database.
