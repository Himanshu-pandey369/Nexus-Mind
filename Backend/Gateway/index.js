import express from "express";
import morgan from "morgan";
import proxy from "express-http-proxy";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import rateLimit from "express-rate-limit";
import { authMiddleware } from "./middleware/auth.middle.js";
import { getCurrentUser } from "./controllers/user.controller.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });

const app = express();

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

// Rate limiter for payment endpoints to protect against order creation spam
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // 60 requests per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many payment requests from this IP, please try again later.",
  },
});

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
  proxy(process.env.AUTH_SERVICE, {
    proxyReqPathResolver: (req) => `/auth${req.url}`,
  })
);

app.get("/me", authMiddleware, getCurrentUser);

app.use(
  "/chat",
  authMiddleware,
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
