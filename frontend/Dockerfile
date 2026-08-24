FROM node:22-bookworm-slim AS base

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update \
    && apt-get install \
        --yes \
        --no-install-recommends \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*


FROM base AS dependencies

ENV NODE_ENV=development

COPY package.json package-lock.json ./

RUN npm ci


FROM base AS build

ENV NODE_ENV=production

ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api

ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

COPY --from=dependencies \
    /app/node_modules \
    ./node_modules

COPY . .

RUN mkdir -p public \
    && npm run build


FROM base AS runner

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=build \
    --chown=node:node \
    /app/public \
    ./public

COPY --from=build \
    --chown=node:node \
    /app/.next/standalone \
    ./

COPY --from=build \
    --chown=node:node \
    /app/.next/static \
    ./.next/static

USER node

EXPOSE 3000

HEALTHCHECK \
    --interval=30s \
    --timeout=5s \
    --start-period=20s \
    --retries=3 \
    CMD node -e \
    "fetch('http://127.0.0.1:3000/login').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1));"

CMD ["node", "server.js"]
