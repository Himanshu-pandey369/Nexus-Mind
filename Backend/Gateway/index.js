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

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));

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
  proxy(process.env.AUTH_SERVICE, {
    proxyReqPathResolver: (req) => `/auth${req.url}`,
  })
);

app.get("/me", authMiddleware, getCurrentUser);

app.use(
  "/chat",
  authMiddleware,
  aiChatLimiter,
  proxy(process.env.CHAT_SERVICE, {
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
  proxy(process.env.AGENT_SERVICE, {
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
  proxy(process.env.AUTH_SERVICE, {
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
  proxy(process.env.AUTH_SERVICE, {
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
  proxy(process.env.PAYMENT_SERVICE, {
    proxyReqPathResolver: () => `/payment/packages`,
  })
);

// Public / Server-to-server: Razorpay Webhook (unauthenticated, forwards raw body and signature)
app.use(
  "/payment/webhook",
  proxy(process.env.PAYMENT_SERVICE, {
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
  proxy(process.env.PAYMENT_SERVICE, {
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

app.listen(PORT, () => {
  console.log(`Gateway started on port ${PORT}`);
});
