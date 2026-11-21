# NexusMind Environment Variables

Never commit real credentials. `.env` files and the Firebase service-account file are ignored by Git and excluded from Docker build contexts. Set production values in Render's environment-variable dashboard, not in frontend build variables.

## Gateway (`Backend/Gateway`)

| Variable | Required | Notes |
|---|---|---|
| `PORT` | Platform-provided | Render supplies this; local default is `8000`. |
| `NODE_ENV` | Yes | Set to `production` on Render. |
| `AUTH_SERVICE` | Yes | Auth's public Render URL; Render Blueprint supplies `RENDER_EXTERNAL_URL`. |
| `CHAT_SERVICE` | Yes | Chat's public Render URL. |
| `PAYMENT_SERVICE` | Yes | Payment's public Render URL. |
| `AGENT_SERVICE` | Yes | Agent's public Render URL. |
| `INTERNAL_SECRET` | Yes in production | Same high-entropy secret in all five services; Render generates it on Auth and references it from the other services. |
| `FRONTEND_URL` | Yes for browser deployment | Comma-separated allowed browser origin(s); CORS is not API authorization. |
| `REDIS_URL` | Yes | Redis URL for sessions and rate limits; use `rediss://` with hosted TLS Redis. |
| `TRUST_PROXY` | Recommended | `true` behind Render's proxy. |
| `RATE_LIMIT_*` | No | Optional rate-limit tuning; see `Backend/Gateway/middleware/rateLimiter.js`. |

## Auth (`Backend/Services/auth`)

| Variable | Required | Notes |
|---|---|---|
| `PORT` | Platform-provided | Render supplies this; local default is `8001`. |
| `NODE_ENV` | Yes | Set to `production` on Render. |
| `AUTH_MONGODB_URI` | Yes | Auth database URI. |
| `REDIS_URL` | Yes | Session store; use hosted TLS Redis. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Yes in production | Full Firebase Admin service-account JSON; store only as a Render secret. |
| `INTERNAL_SECRET` | Yes in production | Shared service-auth secret. |

## Chat (`Backend/Services/Chat`)

| Variable | Required | Notes |
|---|---|---|
| `PORT` | Platform-provided | Render supplies this; local default is `8002`. |
| `NODE_ENV` | Yes | Set to `production` on Render. |
| `CHAT_MONGODB_URI` | Yes | Chat database URI. |
| `INTERNAL_SECRET` | Yes in production | Shared service-auth secret. |

## Payment (`Backend/Services/Payment`)

| Variable | Required | Notes |
|---|---|---|
| `PORT` | Platform-provided | Render supplies this; local default is `8003`. |
| `NODE_ENV` | Yes | Set to `production` on Render. |
| `PAYMENT_MONGODB_URI` | Yes | Payment database URI. |
| `AUTH_SERVICE_URL` | Yes | Auth's public Render URL; HTTPS is used in production. |
| `INTERNAL_SECRET` | Yes in production | Shared service-auth secret for calling Auth and accepting Gateway requests. |
| `RAZORPAY_KEY_ID` | Yes | Public key ID; safe for the backend to return to the client. |
| `RAZORPAY_KEY_SECRET` | Yes | Private Razorpay API secret; backend only. |
| `RAZORPAY_WEBHOOK_SECRET` | Yes | Webhook signature secret; backend only. |

## Agent (`Backend/Services/Agent`)

| Variable | Required | Notes |
|---|---|---|
| `PORT` | Platform-provided | Render supplies this; local default is `8083`. |
| `NODE_ENV` | Yes | Set to `production` on Render. |
| `AGENT_MONGODB_URI` | Optional | Agent image persistence database. |
| `AUTH_SERVICE_URL` | Yes | Auth's public Render URL; HTTPS is used in production. |
| `CHAT_SERVICE_URL` | Yes | Chat's public Render URL; HTTPS is used in production. |
| `INTERNAL_SECRET` | Yes in production | Shared service-auth secret. |
| `REDIS_URL` | Yes | Hosted TLS Redis for agent memory. |
| `OPENROUTER_API_KEY` | Yes for OpenRouter agents | Private provider key; backend only. |
| `GOOGLE_API_KEY` | Yes for image analysis | Private provider key; backend only. |
| `TAVILY_API_KEY` | Yes for Search agent | Private provider key; backend only. |
| `CLOUDINARY_CLOUD_NAME` | Yes for asset upload | Cloudinary account setting. |
| `CLOUDINARY_API_KEY` | Yes for asset upload | Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | Yes for asset upload | Private Cloudinary secret; backend only. |
| `CLOUDFLARE_ACCOUNT_ID` | Yes for image generation | Cloudflare account setting. |
| `CLOUDFLARE_API_TOKEN` | Yes for image generation | Private Cloudflare token; backend only. |
| `QDRANT_URL` | Yes for PDF RAG | Qdrant cluster URL. |
| `QDRANT_API_KEY` | Yes for PDF RAG | Private Qdrant credential; backend only. |
| `QDRANT_COLLECTION` | No | Defaults to `nexusmind_pdf_rag`. |
| `GEMINI_MODEL`, `CLOUDINARY_*_FOLDER` | No | Optional model and storage-folder settings. |

## Frontend (deployed separately)

| Variable | Notes |
|---|---|
| `VITE_SERVER_URL` | Public Gateway URL. |
| `VITE_FIREBASE_API` | Firebase Web API key. This is public client configuration, not a Firebase Admin credential. |
| `VITE_RAZORPAY_KEY_ID` | Optional public Razorpay key ID fallback. |

Never set database URLs, `INTERNAL_SECRET`, Firebase Admin JSON, Redis credentials, or provider private keys as `VITE_*` variables.

## Service authentication and URLs

In production, every downstream service requires `x-internal-secret` for all application routes; only `/health` is unauthenticated for Render health checks. Gateway adds this header after authenticating the user's session, and Agent/Payment add it to their REST calls. Use one high-entropy secret only as a server-side environment variable. Do not treat CORS as authentication.

| Environment | Service URL format |
|---|---|
| Local development | `http://localhost:<port>` |
| Docker Compose | `http://<compose-service-name>:<port>` |
| Render Free Web Services | Public URL from `RENDER_EXTERNAL_URL`, e.g. `https://<service>.onrender.com` |
