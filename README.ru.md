!!!A project received from the university during a co-working session. The project is poorly written and raw. I changed some things to make it more convenient for students to work with. This is a better version of the original code.

# Receipt Splitter Starter

English documentation: [README.md](./README.md).

Учебный starter-project для приложения разделения счета:

- `frontend/` - React Native Expo app
- `backend/` - Node.js + Express API
- SQLite
- Prisma ORM
- Docker Compose для backend + database

Главная цель проекта: студент должен скачать репозиторий, выполнить инструкции и запустить приложение без угадывания портов, IP-адресов и env-переменных.

## Возможности приложения

- Сфотографируйте чек: приложение локально распознает текст и предложит позиции и цены для проверки. Для OCR нужна development-сборка; ручной ввод работает и в Expo Go. Серверный API-ключ не требуется.
- Выберите участников, распределите позиции поровну или по количеству заказанных единиц и посмотрите итоговые суммы. Налог и чаевые можно задать в процентах от суммы позиций; они делятся между участниками поровну.
- Добавляйте друзей по QR-коду или вставленной ссылке-приглашению. QR-приглашения используются для друзей и групп.
- Ищите счета в истории по названию или участнику и фильтруйте по периоду. В деталях счета можно поделиться сводкой, отметить свою долю оплаченной и рассчитать примерную конвертацию по введенному курсу.
- В профиле доступны изменение имени, email, фотографии, пароля, языка, темы и валюты по умолчанию. Для каждого счета валюту можно изменить отдельно.
- Поддерживаются UZS, USD, EUR, RUB, GBP, JPY, KZT, CNY, TRY, AED, KRW и INR. Выбор валюты меняет обозначение и формат отображения суммы, но не конвертирует ее по курсу.

Для локального Docker запуска фото профилей сохраняются в постоянный том `/app/data/avatars`. Для production-хостинга без постоянного локального диска настройте Cloudflare R2 (`R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `CDN_BASE_URL`).

## Требования

- Node.js 18 или 20 LTS. Рекомендуется Node.js 20.
- npm 9+
- Docker Desktop
- Git
- Expo Go для ручного ввода или development-сборка для распознавания текста на устройстве

Серверный `GEMINI_API_KEY` необязателен и нужен только для старого endpoint `/sessions/scan`, если его использует другой клиент. Мобильное приложение этот endpoint не вызывает.

Проверка:

```bash
node -v
npm -v
docker --version
docker compose version
```

Можно также запустить:

```bash
npm run doctor
```

## Быстрый старт

1. Установите зависимости:

```bash
npm run setup
```

2. Запустите backend через Docker:

```bash
npm run backend:docker
```

Backend будет доступен здесь:

```text
http://localhost:8080
```

Проверка backend:

```bash
curl http://localhost:8080/health
```

Ожидаемый ответ:

```json
{ "status": "ok" }
```

3. Узнайте локальный IP компьютера:

```bash
npm run ip
```

Пример:

```text
EXPO_PUBLIC_API_URL=http://192.168.1.23:8080
```

4. Создайте `frontend/.env`:

```bash
copy frontend\.env.example frontend\.env
```

На macOS/Linux:

```bash
cp frontend/.env.example frontend/.env
```

Замените `EXPO_PUBLIC_API_URL` на IP из шага выше, если запускаете через Expo Go на телефоне.

5. Проверьте env:

```bash
npm run check-env
```

6. Запустите frontend:

```bash
npm run frontend:dev
```

Откройте Expo Go на телефоне и отсканируйте QR-код.

## Expo Go: localhost vs local IP

Если frontend открыт на телефоне, `localhost` означает сам телефон, а не ваш компьютер. Поэтому для Expo Go нужен адрес вида:

```text
EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_IP:8080
```

Для web preview на том же компьютере можно использовать:

```text
EXPO_PUBLIC_API_URL=http://localhost:8080
```

## Полезные команды

```bash
npm run doctor                 # Проверить Node/npm/Docker/env
npm run check-env              # Проверить .env файлы
npm run ip                     # Показать локальные IP адреса
npm run backend:docker         # Запустить backend (SQLite в Docker volume)
npm run backend:docker:detached # Запустить Docker в фоне
npm run backend:logs           # Смотреть логи backend
npm run backend:stop           # Остановить Docker containers
npm run frontend:dev           # Запустить Expo
npm run frontend:start:clean   # Запустить Expo с очисткой cache
npm run frontend:web           # Web preview, экспериментально
```

## Docker setup

Файл `backend/docker-compose.yml` поднимает backend на порту `8080` с SQLite базой в Docker volume.

При запуске backend автоматически выполняет:

```bash
prisma migrate deploy
```

Это применяет уже существующие migrations к базе данных.

Остановить проект:

```bash
npm run backend:stop
```

Остановить и удалить volume базы данных:

```bash
docker compose -f backend/docker-compose.yml down -v
```

Внимание: `down -v` удалит SQLite данные в Docker volume.

## Backend local dev without Docker

Для большинства студентов проще использовать Docker. Если вы хотите запускать backend локально:

```bash
copy backend\.env.example backend\.env
npm --prefix backend install
npm --prefix backend run db:migrate
npm run backend:dev
```

Убедитесь, что `DATABASE_URL` в `backend/.env` указывает на SQLite файл (см. `backend/.env.example`).

## Web mode

Ручной ввод работает в Expo Go. Для распознавания текста на фото нужна development-сборка; web mode оставлен для preview:

```bash
npm run frontend:web
```

Если web mode нестабилен, сначала проверяйте mobile flow. В проекте есть зависимости React Native/Expo/Tamagui, которые могут вести себя по-разному в web bundle.

## Как добавить свою feature

1. Backend route добавляйте в `backend/src/routes/`.
2. Подключайте route в `backend/src/server.ts`.
3. Если нужны новые таблицы, меняйте `backend/prisma/schema.prisma`.
4. Создавайте migration:

```bash
npm --prefix backend run db:migrate
```

5. Frontend API helper добавляйте в `frontend/src/features/<feature>/api/`.
6. Screen добавляйте в `frontend/app/`.
7. Проверяйте через Expo Go и backend health check.

Подробнее: [ARCHITECTURE.md](./ARCHITECTURE.md).

## Частые ошибки

- `ERR_NETWORK`: телефон не видит backend. Проверьте IP, firewall и `EXPO_PUBLIC_API_URL`.
- Docker Desktop не запущен: запустите Docker Desktop и повторите `npm run backend:docker`.
- Node слишком новый: используйте Node.js 20 LTS.
- Expo cache сломан: `npm run frontend:start:clean`.
- Backend не отвечает: `curl http://localhost:8080/health` и `npm run backend:logs`.

Большой список решений: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).

## Подробный setup для новичков

Если вы никогда не работали с Docker, Expo, React Native или `.env`, начните здесь:

[BEGINNER_SETUP.md](./BEGINNER_SETUP.md)

