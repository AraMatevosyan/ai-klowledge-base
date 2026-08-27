FROM node:22-bookworm-slim AS base

WORKDIR /app

RUN apt-get update \
    && apt-get install \
        --yes \
        --no-install-recommends \
        ca-certificates \
        openssl \
    && rm -rf /var/lib/apt/lists/*


FROM base AS development-dependencies

ENV NODE_ENV=development

COPY package.json package-lock.json ./

RUN npm ci


FROM development-dependencies AS build

COPY . .

RUN DATABASE_URL=postgresql://build:build@localhost:5432/build \
    npm run build


FROM base AS production-dependencies

ENV NODE_ENV=production

COPY package.json package-lock.json ./

RUN npm ci --omit=dev \
    && npm cache clean --force


FROM base AS runner

ENV NODE_ENV=production
ENV PORT=3001
ENV UPLOAD_DIR=/app/storage/documents

COPY --from=production-dependencies \
    --chown=node:node \
    /app/node_modules \
    ./node_modules

COPY --from=build \
    --chown=node:node \
    /app/dist \
    ./dist

COPY --from=build \
    --chown=node:node \
    /app/prisma \
    ./prisma

COPY --from=build \
    --chown=node:node \
    /app/prisma.config.ts \
    ./prisma.config.ts

COPY --chown=node:node \
    package.json \
    package-lock.json \
    ./

RUN mkdir -p /app/storage/documents \
    && chown -R node:node /app/storage

USER node

EXPOSE 3001

HEALTHCHECK \
    --interval=30s \
    --timeout=5s \
    --start-period=20s \
    --retries=3 \
    CMD node -e \
    "fetch('http://127.0.0.1:3001/api').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"

CMD [
    "sh",
    "-c",
    "npm run prisma:migrate:deploy && exec node dist/main.js"
]
