# Backend

Express + Prisma + SQLite API for the Receipt Splitter starter project.

Use the root documentation first:

- `../README.md` - quick start
- `../BEGINNER_SETUP.md` - detailed beginner setup
- `../TROUBLESHOOTING.md` - common errors
- `../ARCHITECTURE.md` - project structure

## Docker start

From the repository root:

```bash
npm run backend:docker
```

Backend URL:

```text
http://localhost:8080
```

Health check:

```bash
curl http://localhost:8080/health
```

Swagger:

```text
http://localhost:8080/api-docs
```

## Local npm start

Docker is recommended for students. If you run backend locally:

```bash
copy .env.example .env
npm install
npm run db:migrate
npm run dev
```

Make sure `DATABASE_URL` in `.env` points at your SQLite file (see `.env.example`).

### Avatar storage

When R2 is not configured, local development stores avatars under `backend/data/avatars` and serves them from `/media/avatars/...`. Docker Compose enables the same local mode and stores files under `/app/data/avatars` in the persistent `/app/data` volume. The avatar directory is excluded from Git.

For a production host without persistent local storage, configure Cloudflare R2 with `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, and `CDN_BASE_URL`. Do not enable local avatar storage on an ephemeral production filesystem.

## Useful commands

```bash
npm run dev
npm run build
npm run db:generate
npm run db:migrate
npm run db:deploy
npm run db:studio
```

### Add random local demo friends

This creates synthetic users and accepted friendships in a local SQLite database only. Find your account's `uniqueId` in the profile screen, then run:

```bash
npm run friends:add-random -- --target "USER#1234" --count 5
```

The count is optional (defaults to 5; maximum 50). This command refuses to run when `DATABASE_URL` is not a local SQLite file.
