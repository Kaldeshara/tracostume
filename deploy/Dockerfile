# syntax=docker/dockerfile:1
# Build context: the repository root (see deploy/compose.yaml).

# Full dependencies: builds the app, and doubles as the "tools" image that runs migrations and
# one-off scripts (Drive import, tag enrichment) against the production database.
FROM node:22-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee AS tools
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV npm_config_update_notifier=false
# The env schema (src/env.ts) and prisma.config.ts require a URL at build time only.
ARG DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV DATABASE_URL=$DATABASE_URL
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx -y npm@11 ci --no-audit --no-fund --ignore-scripts \
 && npx prisma generate
COPY . .
RUN npx svelte-kit sync && npm run build
USER node

# Runtime: production dependencies and the built server only.
FROM node:22-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee AS app
WORKDIR /app
ENV NODE_ENV=production npm_config_update_notifier=false
COPY package.json package-lock.json ./
# --ignore-scripts skips the project's postinstall (needs dev tools); the CPU onnxruntime binary
# ships inside onnxruntime-node, so nothing else is lost.
# Only the linux/x64 CPU build of onnxruntime is used on the server; onnxruntime-web is for
# browsers.
RUN npx -y npm@11 ci --omit=dev --no-audit --no-fund --ignore-scripts \
 && find node_modules/onnxruntime-node/bin -mindepth 2 -maxdepth 2 ! -name linux -exec rm -rf {} + \
 && rm -rf node_modules/onnxruntime-node/bin/*/linux/arm64 node_modules/onnxruntime-web \
 && npm cache clean --force
COPY --from=tools /app/build ./build
RUN mkdir -p /data/uploads /data/models && chown -R node:node /data
USER node
ENV UPLOADS_DIR=/data/uploads MODELS_DIR=/data/models PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "build"]
