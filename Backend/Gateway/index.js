import express from "express";
import morgan from "morgan";
import proxy from "express-http-proxy";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import { authMiddleware } from "./middleware/auth.middle.js";
import { getCurrentUser } from "./controllers/user.controller.js";
dotenv.config();

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));

app.use(express.json());
app.use(morgan("dev"));
app.use(cookieParser());

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

app.use("/", (req, res) => {
  res.json({ message: "Hello from gateway" });
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`Gateway started on port ${PORT}`);
});
