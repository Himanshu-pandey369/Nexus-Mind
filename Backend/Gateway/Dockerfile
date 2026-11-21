# Multi-stage Dockerfile for Gateway Service
# Build context: 'Backend' directory
# Build command: docker build -f Gateway/Dockerfile -t nexusmind-gateway .

# ----------------- Dependencies Stage -----------------
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package manifests for shared modules and Gateway
COPY package*.json ./
COPY Shared/package*.json ./Shared/
COPY Gateway/package*.json ./Gateway/

# Install production dependencies
RUN npm install --prefix ./Shared --omit=dev && \
    npm install --prefix ./Gateway --omit=dev && \
    npm install --omit=dev

# ----------------- Runner Stage -----------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8000

# Copy installed production node_modules
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/Shared/node_modules ./Shared/node_modules
COPY --from=deps /app/Gateway/node_modules ./Gateway/node_modules

# Copy Shared modules and Gateway application source
COPY Shared/ ./Shared/
COPY Gateway/ ./Gateway/

# Run as non-root user for container security
RUN chown -R node:node /app
USER node

WORKDIR /app/Gateway

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:${PORT:-8000}/health || exit 1

CMD ["node", "index.js"]
