# Multi-stage Dockerfile for Chat Service
# Build context: 'Backend' directory
# Build command: docker build -f Services/Chat/Dockerfile -t nexusmind-chat .

# ----------------- Dependencies Stage -----------------
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package manifests for Chat service
COPY Services/Chat/package*.json ./Services/Chat/

# Install production dependencies
RUN npm install --prefix ./Services/Chat --omit=dev

# ----------------- Runner Stage -----------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8002

# Copy installed production node_modules
COPY --from=deps /app/Services/Chat/node_modules ./Services/Chat/node_modules

# Copy Chat application source
COPY Services/Chat/ ./Services/Chat/

# Run as non-root user for container security
RUN chown -R node:node /app
USER node

WORKDIR /app/Services/Chat

EXPOSE 8002

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:${PORT:-8002}/health || exit 1

CMD ["node", "index.js"]
