# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json nest-cli.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src

# prisma generate кладёт клиент в ./generated, nest build компилирует src + prisma + generated в ./dist
RUN npx prisma generate && npx nest build

# ---------- runtime ----------
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

# node_modules целиком (с prisma CLI и ts-node) — они нужны для migrate deploy и db seed при старте.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/generated ./generated
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts /app/package.json /app/tsconfig.json ./

EXPOSE 3000

# Накатываем миграции и сид (idempotent, upsert) при каждом старте, затем поднимаем REST.
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node dist/src/main.js"]
