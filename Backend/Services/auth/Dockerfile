# Multi-stage Dockerfile for Auth Service
# Build from the 'Backend' root directory:
#   docker build -f Services/auth/Dockerfile -t nexusmind-auth .

# ----------------- Dependencies Stage -----------------
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package manifests for shared modules and Auth service
COPY package*.json ./
COPY Shared/package*.json ./Shared/
COPY Services/auth/package*.json ./Services/auth/

# Install production dependencies
RUN npm install --prefix ./Services/auth --omit=dev
RUN npm install --omit=dev

# ----------------- Runner Stage -----------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8001

# Copy installed production node_modules
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/Services/auth/node_modules ./Services/auth/node_modules

# Copy Shared modules and Auth application source
COPY Shared/ ./Shared/
COPY Services/auth/ ./Services/auth/

# Run as non-root user for container security
RUN chown -R node:node /app
USER node

WORKDIR /app/Services/auth

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8001/health || exit 1

CMD ["node", "index.js"]
