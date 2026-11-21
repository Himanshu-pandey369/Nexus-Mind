# Multi-stage Dockerfile for Payment Service
# Build context: 'Backend' directory
# Build command: docker build -f Services/Payment/Dockerfile -t nexusmind-payment .

# ----------------- Dependencies Stage -----------------
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package manifests for Payment service
COPY Services/Payment/package*.json ./Services/Payment/

# Install production dependencies
RUN npm install --prefix ./Services/Payment --omit=dev

# ----------------- Runner Stage -----------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8003

# Copy installed production node_modules
COPY --from=deps /app/Services/Payment/node_modules ./Services/Payment/node_modules

# Copy Payment application source
COPY Services/Payment/ ./Services/Payment/
COPY Shared/ ./Shared/

# Run as non-root user for container security
RUN chown -R node:node /app
USER node

WORKDIR /app/Services/Payment

EXPOSE 8003

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:${PORT:-8003}/health || exit 1

CMD ["node", "index.js"]
