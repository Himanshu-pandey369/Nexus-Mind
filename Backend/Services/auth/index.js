import express from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import connectDb from "./config/db.js";
import "dotenv/config";
import authRouter from "./routes/auth.route.js";
import creditRouter from "./routes/credit.route.js";
import usageRouter from "./routes/usage.route.js";
import { createInternalServiceAuth } from "../../Shared/middleware/serviceAuth.js";
import { createHealthHandler } from "../../Shared/middleware/healthCheck.js";

const app = express();
app.disable("x-powered-by");
const internalServiceAuth = createInternalServiceAuth();
app.set("trust proxy", 1);
app.use(helmet());
app.use(express.json());

try {
  await connectDb();
} catch (error) {
  console.error("MongoDB connection failed:", error.message);
  process.exit(1);
}

// Health check route
app.get("/health", createHealthHandler("auth", mongoose));

app.use(internalServiceAuth);

// Authentication routes
app.use("/auth", authRouter);

// Credit management routes
app.use("/auth/credits", creditRouter);
app.use("/credits", creditRouter);

// Token usage tracking routes
app.use("/auth/usage", usageRouter);
app.use("/usage", usageRouter);

const PORT = process.env.PORT || 8001;
const HOST = process.env.INTERNAL_HOST || "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`Auth & Credit service running on ${HOST}:${PORT}`);
});
