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

## Deploying the five services to Render

The root [`render.yaml`](../render.yaml) defines five independent Docker **Web Services**, each on the **Free** plan. Each service has its own public Render URL; Gateway remains the frontend entry point. The Blueprint references each service's `RENDER_EXTERNAL_URL` for public HTTPS REST calls and disables commit-triggered deploys (`autoDeployTrigger: "off"`).

### Before creating the Blueprint

1. Prepare four MongoDB database URIs (`AUTH_MONGODB_URI`, `CHAT_MONGODB_URI`, `PAYMENT_MONGODB_URI`, `AGENT_MONGODB_URI`), an Upstash Redis TLS URL, Firebase Admin service-account JSON, and the provider credentials used by your enabled AI and payment features.
2. In MongoDB Atlas, configure network access for Render's dynamic outbound addresses. Allowing `0.0.0.0/0` is broad; use strong database credentials, least-privilege database users, and TLS.
3. Store the Firebase service-account JSON and every API/database credential only in Render's environment-variable dashboard. Do not add a credential file or production `.env` to Git.

### Blueprint deployment (manual)

1. Push the reviewed project changes to the intended GitHub branch yourself; no deployment or push is performed by this project setup.
2. In the Render Dashboard, choose **New → Blueprint**, connect the repository, and select its `main` branch (or change `branch` on each service in `render.yaml` to your chosen branch).
3. Review the Blueprint: it must list exactly `nexusmind-gateway`, `nexusmind-auth`, `nexusmind-chat`, `nexusmind-payment`, and `nexusmind-agent`, all as **Web Services / Docker / Free**. It must not list private services or a combined backend service.
4. Enter the prompted `sync: false` values in Render's dashboard. `nexusmind-auth` generates `INTERNAL_SECRET`; the other four services receive that secret by reference. Enter the public frontend origin for Gateway's `FRONTEND_URL`.
5. Explicitly choose **Apply** when ready to create the services. The Blueprint has commit-triggered auto-deploys turned off; deploy later changes manually from each service's **Manual Deploy** menu.
6. Wait for all five health checks to pass. In Render, copy each service's actual `onrender.com` URL and confirm Gateway's `AUTH_SERVICE`, `CHAT_SERVICE`, `PAYMENT_SERVICE`, and `AGENT_SERVICE`, plus Payment/Agent's upstream URL variables, resolve to those HTTPS hosts.

### Manual Web Service setup (without a Blueprint)

Create five separate services via **New → Web Service**, each from the same repository and branch. Use **Docker** runtime, **Free** plan, region Oregon, and turn off automatic deploys. For every service, leave Root Directory empty and use Docker Context `Backend`; Dockerfile paths are relative to the repository root:

| Render service | Dockerfile path | Docker context | Health check |
|---|---|---|---|
| `nexusmind-gateway` | `Backend/Gateway/Dockerfile` | `Backend` | `/health` |
| `nexusmind-auth` | `Backend/Services/auth/Dockerfile` | `Backend` | `/health` |
| `nexusmind-chat` | `Backend/Services/Chat/Dockerfile` | `Backend` | `/health` |
| `nexusmind-payment` | `Backend/Services/Payment/Dockerfile` | `Backend` | `/health` |
| `nexusmind-agent` | `Backend/Services/Agent/Dockerfile` | `Backend` | `/health` |

Create Auth first and set a random 32-byte `INTERNAL_SECRET`; add the exact same secret to Gateway, Chat, Payment, and Agent. Create the remaining services and configure their service URL variables with the corresponding public HTTPS Render URLs. Create Gateway last. The five Dockerfiles use their own `CMD ["node", "index.js"]`; Render supplies `PORT`.

### Environment variable checklist

**Gateway**
- Blueprint-provided: `NODE_ENV`, `TRUST_PROXY`, `AUTH_SERVICE`, `CHAT_SERVICE`, `PAYMENT_SERVICE`, `AGENT_SERVICE`, and shared `INTERNAL_SECRET`.
- Enter in Render: `FRONTEND_URL` (one or more comma-separated HTTPS origins) and `REDIS_URL` (`rediss://...`).

**Auth**
- Enter in Render: `AUTH_MONGODB_URI`, `REDIS_URL`, and `FIREBASE_SERVICE_ACCOUNT_JSON`.
- `INTERNAL_SECRET` is generated by the Blueprint. For manual setup, generate one strong random value and share it with all five services.

**Chat**
- Enter in Render: `CHAT_MONGODB_URI`.
- `INTERNAL_SECRET` is shared from Auth.

**Payment**
- Enter in Render: `PAYMENT_MONGODB_URI`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`.
- `AUTH_SERVICE_URL` is sourced from Auth's public `RENDER_EXTERNAL_URL`; `INTERNAL_SECRET` is shared from Auth.

**Agent**
- Enter in Render: `AGENT_MONGODB_URI`, `REDIS_URL`, `OPENROUTER_API_KEY`, `GOOGLE_API_KEY`, `TAVILY_API_KEY`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `QDRANT_URL`, and `QDRANT_API_KEY`.
- `AUTH_SERVICE_URL` and `CHAT_SERVICE_URL` are sourced from the public Auth and Chat `RENDER_EXTERNAL_URL` values; `INTERNAL_SECRET` is shared from Auth. `QDRANT_COLLECTION` defaults to `nexusmind_pdf_rag`.

**Frontend (deployed separately)**
- Set `VITE_SERVER_URL` to the Gateway's `https://<gateway>.onrender.com` URL and `VITE_FIREBASE_API` to the Firebase web API key. The Firebase web API key and Razorpay key ID are public client configuration, not substitutes for backend secrets. Never put MongoDB, Redis, Firebase Admin, AI-provider, Cloudinary, Cloudflare, or Razorpay secret keys in `VITE_*` variables.

### Verify and connect integrations

After deployment, call `https://<service>.onrender.com/health` for each service. Only Gateway should be used by the browser; direct requests to downstream application routes require the shared service secret and should return `403` without it. Keep service authentication enabled regardless of CORS settings.

Set the Razorpay webhook URL to `https://<gateway>.onrender.com/payment/webhook` and use the same secret as `RAZORPAY_WEBHOOK_SECRET`. Test login, chat, agent credit reservation/commit, payment fulfillment, and a real webhook in Razorpay test mode.

### Render Free limitations

- Each free web service is limited to 0.1 CPU and 512 MB RAM. The AI Agent's memory/model workload may exceed this and be restarted or fail.
- A free service spins down after 15 minutes without inbound traffic and can take about a minute to wake. Calls across independently sleeping services can add substantial latency or time out.
- The workspace receives 750 free instance-hours per calendar month total. Five continuously active services need about 3,650 hours/month, so all five cannot stay continuously awake within that allowance; once it is exhausted, free services are suspended for the rest of the month.
- Free services have ephemeral filesystems, no persistent disk, no SSH/shell access, and no horizontal scaling. Keep durable user data in MongoDB/Cloudinary/Qdrant/Redis providers, not container files.
- Render Free is explicitly intended for testing/hobby use, not production applications. This configuration prepares the architecture for a manual trial deployment, but the Free tier is not a reliable production target.

References: [Render Free services](https://render.com/docs/free), [Blueprint specification](https://render.com/docs/blueprint-spec).