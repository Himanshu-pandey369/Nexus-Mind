# Multi-stage Dockerfile for Agent Service
# Build context: 'Backend' directory
# Build command: docker build -f Services/Agent/Dockerfile -t nexusmind-agent .

# ----------------- Dependencies Stage -----------------
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package manifests for shared modules and Agent service
COPY package*.json ./
COPY Shared/package*.json ./Shared/
COPY Services/Agent/package*.json ./Services/Agent/

# Install production dependencies
RUN npm install --prefix ./Shared --omit=dev && \
    npm install --prefix ./Services/Agent --omit=dev && \
    npm install --omit=dev

# ----------------- Runner Stage -----------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8083

# Copy installed production node_modules
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/Shared/node_modules ./Shared/node_modules
COPY --from=deps /app/Services/Agent/node_modules ./Services/Agent/node_modules

# Copy Shared modules and Agent application source
COPY Shared/ ./Shared/
COPY Services/Agent/ ./Services/Agent/

# Run as non-root user for container security
RUN chown -R node:node /app
USER node

WORKDIR /app/Services/Agent

EXPOSE 8083

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:${PORT:-8083}/health || exit 1

CMD ["node", "index.js"]
