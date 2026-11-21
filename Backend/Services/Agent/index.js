import express from "express";
import "dotenv/config";
import connectDb from "./config/db.js";
import agentRouter from "./routes/agent.route.js";
import imageRoutes from "./routes/imageRoutes.js";
import { createInternalServiceAuth } from "../../Shared/middleware/serviceAuth.js";

const app = express();
const internalServiceAuth = createInternalServiceAuth();
app.use(express.json());

// Initialize MongoDB connection
try {
  await connectDb();
} catch (error) {
  console.error("MongoDB connection initialization failed:", error.message);
}

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "agent" });
});

app.use(internalServiceAuth);
app.get("/", (req, res) => {
  res.json({ message: "Hello from agent" });
});
app.use("/agent", agentRouter);
// Mount image routes under /agent/images (for Gateway proxy) and /images (for direct service calls)
app.use("/agent/images", imageRoutes);
app.use("/images", imageRoutes);

const PORT = process.env.PORT || 8083;
const HOST = process.env.INTERNAL_HOST || "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`Agent service started on ${HOST}:${PORT}`);
});
