# NexusMind — Local Development Guide

## Prerequisites
- Node.js 20+
- Docker Desktop (for Redis)
- npm

## Environment Setup

Each service has its own `.env` file. Copy from `.env.example` and fill in your credentials:

```bash
cp Backend/Services/auth/.env.example Backend/Services/auth/.env
cp Backend/Services/Chat/.env.example Backend/Services/Chat/.env
cp Backend/Services/Payment/.env.example Backend/Services/Payment/.env
cp Backend/Services/Agent/.env.example Backend/Services/Agent/.env
cp Backend/Gateway/.env.example Backend/Gateway/.env
```

## Required Credentials

| Variable | Service | Where to Get |
|---|---|---|
| MONGODB_URI | auth, chat, payment, agent | MongoDB Atlas |
| GROQ_API_KEY | agent | console.groq.com |
| GOOGLE_API_KEY | agent | Google AI Studio |
| OPENROUTER_API_KEY | agent | openrouter.ai |
| TAVILY_API_KEY | agent | tavily.com |
| RAZORPAY_KEY_ID | payment | razorpay.com dashboard |
| RAZORPAY_KEY_SECRET | payment | razorpay.com dashboard |
| CLOUDINARY_* | agent | cloudinary.com |
| CLOUDFLARE_ACCOUNT_ID | agent | cloudflare.com |
| CLOUDFLARE_API_TOKEN | agent | cloudflare.com |
| QDRANT_URL | agent | cloud.qdrant.io |
| QDRANT_API_KEY | agent | cloud.qdrant.io |
| INTERNAL_SECRET | auth, payment, agent | Generate: `openssl rand -hex 32` |
| Firebase serviceAccountKey.json | auth | Firebase Console |

## Installation

Install dependencies for each service:

```bash
cd Backend/Gateway && npm install
cd ../Services/auth && npm install
cd ../Chat && npm install
cd ../Payment && npm install
cd ../Agent && npm install
cd ../../..
cd Frontend && npm install
```

## Starting Infrastructure

Start Redis (required before running any service):

```bash
docker run -d --name nexusmind-redis -p 6379:6379 redis:7-alpine
```

## Starting Individual Services (Local Development)

Open separate terminals for each service. For local development, service URLs use `localhost`:

**Gateway** (port 8000):
```bash
cd Backend/Gateway
npm run dev
```

**Auth Service** (port 8001):
```bash
cd Backend/Services/auth
npm run dev
```

**Chat Service** (port 8002):
```bash
cd Backend/Services/Chat
npm run dev
```

**Payment Service** (port 8003):
```bash
cd Backend/Services/Payment
npm run dev
```

**Agent Service** (port 8083):
```bash
cd Backend/Services/Agent
npm run dev
```

**Frontend** (port 5173):
```bash
cd Frontend
npm run dev
```

## Starting the Complete Application (Docker)

For the full Docker stack:

```bash
cd Backend
docker compose -f docker-compose.prod.yml up --build
```

Then start the Frontend separately:
```bash
cd Frontend
npm run dev
```

## Viewing Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f agent-service
docker compose -f docker-compose.prod.yml logs -f gateway
```

## Stopping Services

```bash
# Stop Docker stack
docker compose -f docker-compose.prod.yml down

# Stop Redis only
docker stop nexusmind-redis
```

## Restarting Individual Services

```bash
docker compose -f docker-compose.prod.yml restart agent-service
```

## Resetting Development Infrastructure

```bash
# Stop and remove containers (preserves volumes/data)
docker compose -f docker-compose.prod.yml down

# Full reset including Redis data (CAUTION: deletes session data)
docker compose -f docker-compose.prod.yml down -v
```

## Common Errors

### `ECONNREFUSED 127.0.0.1:8002` in Agent Service
**Cause**: Agent service inside Docker trying to reach Chat Service via localhost.
**Fix**: Ensure `docker-compose.prod.yml` injects `CHAT_SERVICE_URL=http://chat-service:8002` for agent-service. This is now done automatically.

### `Redis connection refused`
**Cause**: Redis not running or wrong URL in `.env`.
**Fix**: Start Redis with Docker. For local dev, use `Redis_URL=redis://localhost:6379`. For Docker, use `Redis_URL=redis://redis:6379`.

### `MongoDB connection failed`
**Cause**: Missing or wrong `MONGODB_URI`.
**Fix**: Check MongoDB Atlas network access — whitelist your IP or use `0.0.0.0/0` for development.

### `ChatGroq model not found`
**Cause**: The model `openai/gpt-oss-120b` is an OpenRouter model, not a Groq model.
**Fix**: This is now fixed. The agent service routes this model through OpenRouter (`ChatOpenRouter`).

### `Unauthorized: Please log in`
**Cause**: Session cookie not set or Redis session expired.
**Fix**: Log in again. Ensure `FRONTEND_URL` is set correctly in Gateway `.env` for CORS.

### CORS errors from Frontend
**Cause**: `FRONTEND_URL` in Gateway `.env` does not match the frontend origin.
**Fix**: Set `FRONTEND_URL=http://localhost:5173` for local development.
