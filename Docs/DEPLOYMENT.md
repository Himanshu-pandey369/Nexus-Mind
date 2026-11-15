# NexusMind — Production Deployment Guide

## Prerequisites

- Linux VPS (Ubuntu 22.04 recommended)
- Docker and Docker Compose installed
- Domain name pointing to your VPS (optional but recommended)
- MongoDB Atlas account
- All external API credentials ready

## Server Setup

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version
docker compose version
```

## Environment Configuration

On the production server, populate all `.env` files before deploying. Never commit these files.

```bash
# Clone the repository
git clone <your-repo-url> /opt/nexusmind
cd /opt/nexusmind/Backend

# Create and populate environment files
nano Services/auth/.env
nano Services/Chat/.env
nano Services/Payment/.env
nano Services/Agent/.env
nano Gateway/.env
```

### Production `.env` differences from local

| Variable | Local value | Production value |
|---|---|---|
| NODE_ENV | development | production |
| FRONTEND_URL | http://localhost:5173 | https://your-domain.com |
| Redis_URL | redis://localhost:6379 | redis://redis:6379 |
| AUTH_SERVICE_URL | http://localhost:8001 | http://auth-service:8001 |
| CHAT_SERVICE_URL | http://localhost:8002 | http://chat-service:8002 |
| TRUST_PROXY | false | true (if behind Nginx/Caddy) |

**Important**: Docker Compose `environment:` overrides override `.env` file values. The production Compose file already sets correct Docker-internal URLs for Redis, Auth, and Chat service URLs.

## Docker Deployment

```bash
cd /opt/nexusmind/Backend

# Build and start all services in background
docker compose -f docker-compose.prod.yml up -d --build

# Verify all containers are running
docker compose -f docker-compose.prod.yml ps

# Check logs
docker compose -f docker-compose.prod.yml logs -f
```

## Reverse Proxy Setup (Nginx)

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    location / {
        root /opt/nexusmind/Frontend/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

Set `TRUST_PROXY=true` in `Gateway/.env` when behind Nginx.

## HTTPS Configuration

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com
```

## Updating Deployments

```bash
cd /opt/nexusmind

# Pull latest changes
git pull origin main

# Rebuild and restart only changed services
cd Backend
docker compose -f docker-compose.prod.yml up -d --build --no-deps <service-name>

# Full rebuild
docker compose -f docker-compose.prod.yml up -d --build
```

## Rollback Procedure

```bash
# Roll back to a previous commit
git log --oneline -10
git checkout <commit-hash>
cd Backend
docker compose -f docker-compose.prod.yml up -d --build
```

## Backup Recommendations

- **MongoDB Atlas**: Enable automated backups in Atlas (minimum daily).
- **Redis**: Redis data is ephemeral (session cache). Redis volume data (`redis_data`) persists container restarts but can be lost on `down -v`. Sessions will be invalidated if Redis is wiped.
- **Environment files**: Keep a secure backup of all `.env` files (use a password manager or secrets vault).

## Monitoring and Logs

```bash
# Real-time logs for all services
docker compose -f docker-compose.prod.yml logs -f

# Logs for a specific service
docker compose -f docker-compose.prod.yml logs -f gateway
docker compose -f docker-compose.prod.yml logs -f agent-service

# Container resource usage
docker stats

# Service health
docker compose -f docker-compose.prod.yml ps
```

## Health Check Endpoints

| Service | URL |
|---|---|
| Gateway | GET http://your-vps:8000/health |
| Auth | (internal) GET http://auth-service:8001/health |
| Chat | (internal) GET http://chat-service:8002/health |
| Payment | (internal) GET http://payment-service:8003/health |
| Agent | (internal) GET http://agent-service:8083/health |

---

## Deploying Backend to Render (All-in-One / Free-Tier Friendly)

NexusMind backend can be deployed to [Render](https://render.com) using a single Docker Web Service. This packages the API Gateway and all 4 microservices (`auth`, `chat`, `payment`, `agent`) into an orchestrated container managed by `pm2-runtime`.

### Advantages
- **$0 / Month**: Operates entirely within Render's free Web Service tier (750 free hours/month).
- **Zero Networking Complexity**: Internal microservices communicate securely over `localhost:8001`, `localhost:8002`, `localhost:8003`, and `localhost:8083`. Only the Gateway is exposed to Render on `$PORT`.
- **Automatic Process Supervision**: If any individual microservice encounters an error, PM2 restarts it immediately without restarting the entire container.

---

### Step 1: External Services Setup

#### 1. MongoDB Atlas Network Access
Render services use dynamic outbound IP addresses:
1. Go to **MongoDB Atlas** > **Network Access**.
2. Click **Add IP Address** > select **Allow Access from Anywhere** (`0.0.0.0/0`).
3. Confirm your database connection strings for `auth`, `chat`, `payment`, and `agent` (or use a single MongoDB cluster with different database names in the URI path).

#### 2. Redis Setup (Upstash Redis)
Render charges for Redis, but [Upstash](https://upstash.com) provides a free serverless Redis database:
1. Create a free database at **console.upstash.com**.
2. Copy the **Node.js (ioredis)** connection string (`rediss://default:<password>@<host>:6379`).

---

### Step 2: Deploying to Render

You can deploy using either Render Blueprints (automated) or the Render Web UI (manual).

#### Method A: Blueprint Deployment (Fastest)
1. Push your repository to GitHub (ensure `render.yaml`, `Backend/Dockerfile.render`, and `Backend/pm2.process.config.cjs` are committed).
2. Go to the [Render Dashboard](https://dashboard.render.com).
3. Click **New +** > **Blueprint**.
4. Connect your `NexusMind` repository.
5. Render will automatically detect `render.yaml` and prompt you to input the environment variables.
6. Click **Apply**.

#### Method B: Manual Web Service Deployment
1. Go to the [Render Dashboard](https://dashboard.render.com) > **New +** > **Web Service**.
2. Connect your GitHub repository.
3. Configure the service settings:
   - **Name**: `nexusmind-backend`
   - **Region**: Choose closest to your database (e.g. Frankfurt, Oregon, Singapore)
   - **Branch**: `main`
   - **Root Directory**: `Backend` (or leave empty if using root-relative paths)
   - **Runtime**: `Docker`
   - **Dockerfile Path**: `Backend/Dockerfile.render`
   - **Docker Context**: `Backend`
   - **Instance Type**: `Free`
4. Add the **Environment Variables** (see table below).
5. (Optional) If using a Secret File for Firebase:
   - Click **Secret Files** > **Add Secret File**.
   - Filename: `serviceAccountKey.json`
   - Contents: Paste the JSON contents of your Firebase service account key.
6. Click **Deploy Web Service**.

---

### Step 3: Required Environment Variables on Render

| Variable | Value / Format | Description |
|---|---|---|
| `NODE_ENV` | `production` | Enables production optimizations |
| `TRUST_PROXY` | `true` | Required for rate limiter to identify client IPs behind Render's proxy |
| `Redis_URL` | `rediss://default:...@...upstash.io:6379` | Upstash Redis connection string |
| `INTERNAL_SECRET` | 32-byte hex string | Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `FRONTEND_URL` | `https://your-nexusmind-frontend.vercel.app` | Allowed CORS origin for your frontend |
| `AUTH_MONGODB_URI` | `mongodb+srv://.../auth` | MongoDB URI for auth database |
| `CHAT_MONGODB_URI` | `mongodb+srv://.../chat` | MongoDB URI for chat database |
| `PAYMENT_MONGODB_URI` | `mongodb+srv://.../payment` | MongoDB URI for payment database |
| `AGENT_MONGODB_URI` | `mongodb+srv://.../agent` | MongoDB URI for agent database |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | `{"type":"service_account",...}` | Paste full raw JSON string from `serviceAccountKey.json` |
| `OPENROUTER_API_KEY` | `sk-or-v1-...` | OpenRouter API Key for AI Agents |
| `GOOGLE_API_KEY` | `AIzaSy...` | Gemini Vision key for image analyzer |
| `TAVILY_API_KEY` | `tvly-...` | Tavily Search key for Search Agent |
| `CLOUDINARY_CLOUD_NAME` | `...` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | `...` | Cloudinary API Key |
| `CLOUDINARY_API_SECRET` | `...` | Cloudinary API Secret |
| `CLOUDFLARE_ACCOUNT_ID` | `...` | Cloudflare account for FLUX image gen |
| `CLOUDFLARE_API_TOKEN` | `...` | Cloudflare Workers AI token |
| `QDRANT_URL` | `https://...qdrant.io` | Qdrant Cloud URL for PDF vector store |
| `QDRANT_API_KEY` | `...` | Qdrant Cloud API Key |
| `RAZORPAY_KEY_ID` | `rzp_live_...` or `rzp_test_...` | Razorpay public key ID |
| `RAZORPAY_KEY_SECRET` | `...` | Razorpay secret |
| `RAZORPAY_WEBHOOK_SECRET` | `...` | Razorpay webhook secret |

> [!NOTE]
> If your MongoDB cluster uses a single URI for all collections, you can supply `MONGODB_URI` instead of individual per-service URIs. PM2 will automatically forward it to all services.

---

### Step 4: Post-Deployment Configuration

1. **Test Backend Health**:
   Open in your browser or run:
   ```bash
   curl https://<your-service>.onrender.com/health
   # Response: {"status":"ok","service":"gateway","timestamp":"..."}
   ```
2. **Update Frontend API Base URL**:
   In your Frontend deployment (e.g. Vercel, Netlify, or Render):
   ```env
   VITE_SERVER_URL=https://<your-service>.onrender.com
   ```
3. **Configure Razorpay Webhook**:
   In the **Razorpay Dashboard** > **Settings** > **Webhooks**:
   - Webhook URL: `https://<your-service>.onrender.com/payment/webhook`
   - Secret: Must match `RAZORPAY_WEBHOOK_SECRET`
   - Events: Select `payment.captured`, `order.paid`.

