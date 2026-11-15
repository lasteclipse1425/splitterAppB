# Receipt Splitter Starter

Russian version: [README.ru.md](./README.ru.md).

A student starter project for splitting a restaurant bill:

- `frontend/` — React Native Expo app
- `backend/` — Node.js + Express API
- SQLite with Prisma ORM
- Docker Compose for the backend and database

The goal is to let students clone the repository, follow the setup instructions, and run the app without guessing ports, IP addresses, or environment variables.

## Features

- Photograph a paper receipt. The backend recognizes item names, prices, and currency. If recognition fails, the app shows an error instead of substituting test data.
- Choose the people at the table, split items equally or by quantity, and review each person's total.
- Add friends by scanning a QR code or pasting an invitation link. Receipt scanning uses a photo and OCR; friend and group invitations use QR links.
- Review past bill-splitting sessions.
- Edit your username, email, avatar, password, language, theme, and default currency in your profile. You can choose a separate currency for each bill.
- Supported currencies: UZS, USD, EUR, RUB, GBP, JPY, KZT, CNY, TRY, AED, KRW, and INR. Currency selection changes the currency label and number formatting; it does not convert amounts using exchange rates.

In local Docker mode, profile photos are stored in the persistent `/app/data/avatars` volume. For production hosting without persistent local storage, configure Cloudflare R2 using `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, and `CDN_BASE_URL`.

## Requirements

- Node.js 18 or 20 LTS (Node.js 20 is recommended)
- npm 9+
- Docker Desktop
- Git
- Expo Go on your phone for the mobile workflow

Check your setup:

```bash
node -v
npm -v
docker --version
docker compose version
```

You can also run:

```bash
npm run doctor
```

## Quick start

1. Install dependencies:

   ```bash
   npm run setup
   ```

2. Start the backend with Docker:

   ```bash
   npm run backend:docker
   ```

   The backend is available at `http://localhost:8080`. Check it with:

   ```bash
   curl http://localhost:8080/health
   ```

   Expected response:

   ```json
   { "status": "ok" }
   ```

3. Find your computer's local IP address:

   ```bash
   npm run ip
   ```

4. Create `frontend/.env` from the example:

   Windows PowerShell:

   ```powershell
   Copy-Item frontend/.env.example frontend/.env
   ```

   macOS/Linux:

   ```bash
   cp frontend/.env.example frontend/.env
   ```

   If you are using Expo Go on your phone, set `EXPO_PUBLIC_API_URL` to your computer's IP address, for example `http://192.168.1.23:8080`.

5. Check the environment files:

   ```bash
   npm run check-env
   ```

6. Start the frontend:

   ```bash
   npm run frontend:dev
   ```

   Open Expo Go on your phone and scan the QR code shown in the terminal.

## Expo Go: localhost vs. local IP

On a phone, `localhost` refers to the phone itself, not your computer. For Expo Go, use your computer's local IP:

```text
EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_IP:8080
```

For a web preview running on the same computer, you can use:

```text
EXPO_PUBLIC_API_URL=http://localhost:8080
```

## Useful commands

```bash
npm run doctor                   # Check Node, npm, Docker, and environment files
npm run check-env                # Validate .env files
npm run ip                       # Show local IP addresses
npm run backend:docker           # Start the backend (SQLite in a Docker volume)
npm run backend:docker:detached  # Start Docker in the background
npm run backend:logs             # View backend logs
npm run backend:stop             # Stop Docker containers
npm run frontend:dev             # Start Expo
npm run frontend:start:clean     # Start Expo and clear its cache
npm run frontend:web             # Start an experimental web preview
```

## Docker setup

`backend/docker-compose.yml` starts the backend on port `8080` and stores the SQLite database in a Docker volume. On startup, the backend runs `prisma migrate deploy` to apply existing database migrations.

Stop the project:

```bash
npm run backend:stop
```

Stop the project and remove the database volume:

```bash
docker compose -f backend/docker-compose.yml down -v
```

Warning: `down -v` deletes the SQLite data stored in the Docker volume.

## Run the backend locally without Docker

Docker is the simplest option for most students. To run the backend directly:

```bash
Copy-Item backend/.env.example backend/.env  # Windows PowerShell
npm --prefix backend install
npm --prefix backend run db:migrate
npm run backend:dev
```

On macOS/Linux, replace the first command with `cp backend/.env.example backend/.env`. Make sure `DATABASE_URL` in `backend/.env` points to a SQLite file (see `backend/.env.example`).

## Web mode

The main student workflow is the mobile app in Expo Go. Web mode is available for preview:

```bash
npm run frontend:web
```

If web mode is unstable, use the mobile workflow first. React Native, Expo, and Tamagui dependencies may behave differently in a web bundle.

## Adding a feature

1. Add backend routes under `backend/src/routes/`.
2. Register routes in `backend/src/server.ts`.
3. Update `backend/prisma/schema.prisma` if you need database tables.
4. Create a migration:

   ```bash
   npm --prefix backend run db:migrate
   ```

5. Add frontend API helpers under `frontend/src/features/<feature>/api/`.
6. Add screens under `frontend/app/`.
7. Check the flow in Expo Go and verify the backend health endpoint.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for more details.

## Troubleshooting

- `ERR_NETWORK`: The phone cannot reach the backend. Check the IP address, firewall, and `EXPO_PUBLIC_API_URL`.
- Docker Desktop is not running: Start Docker Desktop, then run `npm run backend:docker` again.
- Node.js version issues: Use Node.js 20 LTS.
- Expo cache problems: Run `npm run frontend:start:clean`.
- Backend is not responding: Check `curl http://localhost:8080/health` and `npm run backend:logs`.

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for more solutions.

## Beginner setup guide

If you are new to Docker, Expo, React Native, or `.env` files, start with [BEGINNER_SETUP.md](./BEGINNER_SETUP.md).
