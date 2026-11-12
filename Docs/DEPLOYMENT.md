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
