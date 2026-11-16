import express from "express";
import connectDb from "./config/db.js";
import "dotenv/config";
import authRouter from "./routes/auth.route.js";
import creditRouter from "./routes/credit.route.js";
import usageRouter from "./routes/usage.route.js";

const app = express();
app.set("trust proxy", 1);
app.use(express.json());

try {
  await connectDb();
} catch (error) {
  console.error("MongoDB connection failed:", error.message);
  process.exit(1);
}

// Health check route
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "auth" });
});

// Authentication routes
app.use("/auth", authRouter);

// Credit management routes
app.use("/auth/credits", creditRouter);
app.use("/credits", creditRouter);

// Token usage tracking routes
app.use("/auth/usage", usageRouter);
app.use("/usage", usageRouter);

const PORT = process.env.PORT || 8001;
const HOST = process.env.INTERNAL_HOST || "127.0.0.1";

app.listen(PORT, HOST, () => {
  console.log(`Auth & Credit service running on ${HOST}:${PORT}`);
});
