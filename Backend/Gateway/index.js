import express from "express";
import morgan from "morgan";
import proxy from "express-http-proxy";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { authMiddleware } from "./middleware/auth.middle.js";
import { getCurrentUser } from "./controllers/user.controller.js";
import {
  generalLimiter,
  authLimiter,
  aiChatLimiter,
  paymentLimiter,
  agentRateLimitMiddleware,
} from "./middleware/rateLimiter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });

const app = express();

const AUTH_SERVICE = process.env.AUTH_SERVICE || "http://127.0.0.1:8001";
const CHAT_SERVICE = process.env.CHAT_SERVICE || "http://127.0.0.1:8002";
const PAYMENT_SERVICE = process.env.PAYMENT_SERVICE || "http://127.0.0.1:8003";
const AGENT_SERVICE = process.env.AGENT_SERVICE || "http://127.0.0.1:8083";

// Configure trust proxy safely according to deployment topology
// When running behind reverse proxy (e.g. Nginx, Cloudflare), set TRUST_PROXY=true or number of hops
const trustProxySetting = process.env.TRUST_PROXY;
if (trustProxySetting !== undefined && trustProxySetting !== "") {
  app.set(
    "trust proxy",
    trustProxySetting === "true"
      ? true
      : trustProxySetting === "false"
      ? false
      : !isNaN(Number(trustProxySetting))
      ? Number(trustProxySetting)
      : trustProxySetting
  );
} else if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Health check endpoint (bypasses rate limiting)
app.get("/health", (req, res) => {
  return res.status(200).json({
    status: "ok",
    service: "gateway",
    timestamp: new Date().toISOString(),
  });
});

const configuredFrontend = process.env.FRONTEND_URL;
const allowedOrigins = configuredFrontend
  ? configuredFrontend
      .split(",")
      .map((url) => url.trim().replace(/\/+$/, ""))
      .filter(Boolean)
  : [];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.length === 0) {
        return callback(null, true);
      }
      const normalizedOrigin = origin.replace(/\/+$/, "");
      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  })
);

app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(morgan("dev"));
app.use(cookieParser());

// Apply global general API rate limiter
app.use(generalLimiter);

app.set("etag", false);
app.post("/test", (req, res) => {
  console.log("Gateway test route reached");

  return res.status(200).json({
    success: true,
    message: "Gateway is working",
  });
});

app.use(
  "/auth",
  authLimiter,
  proxy(AUTH_SERVICE, {
    proxyReqPathResolver: (req) => `/auth${req.url}`,
  })
);

app.get("/me", authMiddleware, getCurrentUser);

app.use(
  "/chat",
  authMiddleware,
  aiChatLimiter,
  proxy(CHAT_SERVICE, {
    proxyReqPathResolver: (req) => `/chat${req.url}`,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers["x-user-id"] = srcReq.user.userID;
      return proxyReqOpts;
    },
  })
);

app.use(
  "/agent",
  authMiddleware,
  agentRateLimitMiddleware,
  proxy(AGENT_SERVICE, {
    limit: "15mb",
    proxyReqPathResolver: (req) => `/agent${req.url}`,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers["x-user-id"] = srcReq.user.userID;
      return proxyReqOpts;
    },
  })
);

app.use(
  "/credits",
  authMiddleware,
  proxy(AUTH_SERVICE, {
    proxyReqPathResolver: (req) => `/credits${req.url}`,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers["x-user-id"] = srcReq.user.userID;
      return proxyReqOpts;
    },
  })
);

app.use(
  "/usage",
  authMiddleware,
  proxy(AUTH_SERVICE, {
    proxyReqPathResolver: (req) => `/usage${req.url}`,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers["x-user-id"] = srcReq.user.userID;
      return proxyReqOpts;
    },
  })
);

// Public: Credit packages
app.use(
  "/payment/packages",
  proxy(PAYMENT_SERVICE, {
    proxyReqPathResolver: () => `/payment/packages`,
  })
);

// Public / Server-to-server: Razorpay Webhook (unauthenticated, forwards raw body and signature)
app.use(
  "/payment/webhook",
  proxy(PAYMENT_SERVICE, {
    proxyReqPathResolver: () => `/payment/webhook`,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      if (srcReq.headers["x-razorpay-signature"]) {
        proxyReqOpts.headers["x-razorpay-signature"] =
          srcReq.headers["x-razorpay-signature"];
      }
      return proxyReqOpts;
    },
    proxyReqBodyDecorator: (bodyContent, srcReq) => {
      return srcReq.rawBody || bodyContent;
    },
  })
);

// Authenticated Payment Routes (Order creation, verification, history, retry)
app.use(
  "/payment",
  authMiddleware,
  paymentLimiter,
  proxy(PAYMENT_SERVICE, {
    proxyReqPathResolver: (req) => `/payment${req.url}`,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers["x-user-id"] = srcReq.user.userID;
      return proxyReqOpts;
    },
  })
);

app.use("/", (req, res) => {
  res.json({ message: "Hello from gateway" });
});

const PORT = process.env.PORT || 8000;
const HOST = "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`Gateway started on ${HOST}:${PORT}`);
});
