# NexusMind — Environment Variables Reference

> **Never commit real credentials to version control.** All `.env` files are gitignored.

## Gateway (`Backend/Gateway/.env`)

| Variable | Required | Example | Description |
|---|---|---|---|
| PORT | Yes | `8000` | Gateway listen port |
| NODE_ENV | Yes | `production` | Environment mode |
| AUTH_SERVICE | Yes | `http://auth-service:8001` | Auth service internal URL |
| CHAT_SERVICE | Yes | `http://chat-service:8002` | Chat service internal URL |
| PAYMENT_SERVICE | Yes | `http://payment-service:8003` | Payment service internal URL |
| AGENT_SERVICE | Yes | `http://agent-service:8083` | Agent service internal URL |
| FRONTEND_URL | Yes | `https://your-domain.com` | Frontend origin for CORS |
| Redis_URL | Yes | `redis://redis:6379` | Redis connection (Docker) or `redis://localhost:6379` (local) |
| TRUST_PROXY | No | `true` | Set `true` when behind Nginx/Caddy |
| RATE_LIMIT_GENERAL_WINDOW_MS | No | `900000` | General rate limit window (ms) |
| RATE_LIMIT_GENERAL_MAX | No | `300` | Max requests per window (general) |
| RATE_LIMIT_AUTH_WINDOW_MS | No | `900000` | Auth rate limit window (ms) |
| RATE_LIMIT_AUTH_MAX | No | `30` | Max auth requests per window |
| RATE_LIMIT_AI_WINDOW_MS | No | `60000` | AI rate limit window (ms) |
| RATE_LIMIT_AI_MAX | No | `30` | Max AI requests per window |
| RATE_LIMIT_UPLOAD_WINDOW_MS | No | `60000` | Upload rate limit window (ms) |
| RATE_LIMIT_UPLOAD_MAX | No | `10` | Max uploads per window |
| RATE_LIMIT_PAYMENT_WINDOW_MS | No | `900000` | Payment rate limit window (ms) |
| RATE_LIMIT_PAYMENT_MAX | No | `30` | Max payment requests per window |

## Auth Service (`Backend/Services/auth/.env`)

| Variable | Required | Example | Description |
|---|---|---|---|
| PORT | Yes | `8001` | Auth service listen port |
| NODE_ENV | Yes | `development` | Environment mode |
| MONGODB_URI | Yes | `mongodb+srv://user:pass@cluster.mongodb.net/auth` | MongoDB Atlas URI for auth database |
| INTERNAL_SECRET | Yes | `<32-byte hex>` | Shared secret for internal service calls. Must match in auth, payment, agent. Generate: `openssl rand -hex 32` |
| Redis_URL | Yes | `redis://redis:6379` | Redis connection |
| FRONTEND_URL | Yes | `http://localhost:5173` | Frontend URL for CORS |

**Note**: Firebase service account (`serviceAccountKey.json`) must be present in `Services/auth/` directory.

## Chat Service (`Backend/Services/Chat/.env`)

| Variable | Required | Example | Description |
|---|---|---|---|
| PORT | Yes | `8002` | Chat service listen port |
| NODE_ENV | No | `development` | Environment mode |
| MONGODB_URI | Yes | `mongodb+srv://user:pass@cluster.mongodb.net/chat` | MongoDB Atlas URI for chat database |

## Payment Service (`Backend/Services/Payment/.env`)

| Variable | Required | Example | Description |
|---|---|---|---|
| PORT | Yes | `8003` | Payment service listen port |
| NODE_ENV | No | `development` | Environment mode |
| MONGODB_URI | Yes | `mongodb+srv://user:pass@cluster.mongodb.net/payment` | MongoDB Atlas URI for payment database |
| AUTH_SERVICE_URL | Yes | `http://auth-service:8001` | Auth service URL for credit fulfillment |
| INTERNAL_SECRET | Yes | `<32-byte hex>` | Must match auth service |
| RAZORPAY_KEY_ID | Yes | `rzp_test_...` | Razorpay API key ID |
| RAZORPAY_KEY_SECRET | Yes | `...` | Razorpay API key secret |
| RAZORPAY_WEBHOOK_SECRET | Yes | `...` | Razorpay webhook HMAC secret (from Razorpay dashboard) |

## Agent Service (`Backend/Services/Agent/.env`)

| Variable | Required | Example | Description |
|---|---|---|---|
| PORT | Yes | `8083` | Agent service listen port |
| MONGODB_URI | Yes | `mongodb+srv://user:pass@cluster.mongodb.net/agent` | MongoDB Atlas URI for agent database |
| GROQ_API_KEY | No* | `gsk_...` | Groq API key (not currently used as primary — OpenRouter is primary) |
| OPENROUTER_API_KEY | Yes | `sk-or-v1-...` | OpenRouter API key — primary LLM for chat, search, pdf, ppt agents |
| GOOGLE_API_KEY | Yes | `...` | Google Gemini API key — used for imageAnalyzer agent |
| TAVILY_API_KEY | Yes | `tvly-...` | Tavily Search API key — used by search agent |
| CHAT_SERVICE_URL | Yes | `http://chat-service:8002` | Chat service URL for conversation history |
| AUTH_SERVICE_URL | Yes | `http://auth-service:8001` | Auth service URL for credit management |
| INTERNAL_SECRET | Yes | `<32-byte hex>` | Must match auth service |
| Redis_URL | Yes | `redis://redis:6379` | Redis connection for conversation memory |
| CLOUDINARY_CLOUD_NAME | Yes | `your-cloud-name` | Cloudinary cloud name |
| CLOUDINARY_API_KEY | Yes | `...` | Cloudinary API key |
| CLOUDINARY_API_SECRET | Yes | `...` | Cloudinary API secret |
| CLOUDINARY_GENERATED_FOLDER | No | `nexusmind/generated-images` | Cloudinary folder for AI-generated images |
| CLOUDINARY_PDFS_FOLDER | No | `nexusmind/generated-pdfs` | Cloudinary folder for generated PDFs |
| CLOUDINARY_PPTS_FOLDER | No | `nexusmind/generated-presentations` | Cloudinary folder for generated PPTs |
| CLOUDFLARE_ACCOUNT_ID | Yes | `...` | Cloudflare account ID for FLUX image generation |
| CLOUDFLARE_API_TOKEN | Yes | `...` | Cloudflare API token for Workers AI |
| QDRANT_URL | Yes | `https://...qdrant.io` | Qdrant Cloud URL for PDF RAG vector store |
| QDRANT_API_KEY | Yes | `...` | Qdrant Cloud API key |
| QDRANT_COLLECTION | No | `nexusmind_pdf_rag` | Qdrant collection name for PDF embeddings |
| GEMINI_MODEL | No | `gemini-3.1-flash-lite` | Gemini model for image analysis |

## Shared Internal Secret

The `INTERNAL_SECRET` must be **identical** across all three services that use it:
- `Services/auth/.env`
- `Services/Payment/.env`
- `Services/Agent/.env`

Generate a secure secret: `openssl rand -hex 32`

## Notes on Service URL Configuration

| Deployment Mode | URL Format |
|---|---|
| Local development (bare Node.js) | `http://localhost:<port>` |
| Docker Compose | `http://<service-name>:<port>` |

Docker Compose overrides `.env` file values for service URLs — do not change service URLs in `.env` files for Docker deployment. The `docker-compose.prod.yml` injects the correct Docker-internal URLs via its `environment:` section.
