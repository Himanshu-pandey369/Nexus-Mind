import express from "express";
import helmet from "helmet";
import "dotenv/config";
import connectDb, { createHealthHandler, sanitizeMongoError } from "./config/db.js";
import { warnAgentStartupConfig } from "./config/startupWarnings.js";
import agentRouter from "./routes/agent.route.js";
import imageRoutes from "./routes/imageRoutes.js";
import { createInternalServiceAuth } from "../../Shared/middleware/serviceAuth.js";

const app = express();
app.disable("x-powered-by");
app.use(helmet());
const internalServiceAuth = createInternalServiceAuth();
app.use(express.json());

// Initialize MongoDB connection
try {
  await connectDb();
} catch (error) {
  console.error("MongoDB connection initialization failed:", sanitizeMongoError(error));
  process.exit(1);
}

warnAgentStartupConfig();

app.get("/health", createHealthHandler());

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
