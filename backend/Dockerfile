### Stage 1: build
FROM node:20-bullseye-slim AS builder
WORKDIR /app

# 1. Копируем манифесты зависимостей
COPY package*.json ./

# ДОБАВЛЕН ФЛАГ --ignore-scripts, чтобы заблокировать "postinstall" на пустом месте
RUN npm ci --ignore-scripts

# 2. Теперь копируем исходный код и схему Prisma (/app/prisma/schema.prisma)
COPY . .

# 3. Генерируем Prisma Client (теперь схема на месте!)
RUN npx prisma generate

# 4. Компилируем TypeScript в папку dist
RUN npm run build

# 5. Очищаем dev-зависимости для продакшена
RUN npm prune --production


### Stage 2: runtime
FROM node:20-bullseye-slim
WORKDIR /app
ENV NODE_ENV=production

# Копируем результаты сборки в финальный образ
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

EXPOSE 8080

CMD ["node", "dist/server.js"]