# Stage 1: Build stage
FROM oven/bun:1.3.10 AS builder
WORKDIR /app

COPY package.json bun.lock prisma.config.ts ./
COPY prisma ./prisma/

RUN bun install --frozen-lockfile
RUN bun run db:generate

COPY . .

RUN bun run build

# Stage 2: Production stage
FROM oven/bun:1.3.10-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src/generated ./src/generated

EXPOSE 3030

CMD ["bun", "dist/index.js"]