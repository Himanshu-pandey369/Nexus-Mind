import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });

import connectDb from "./config/db.js";
import paymentRouter from "./routes/payment.route.js";

const app = express();
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

try {
  await connectDb();
} catch (error) {
  console.error("MongoDB connection failed:", error.message);
  process.exit(1);
}

app.use("/payment", paymentRouter);

app.get("/health", (req, res) => {
  res.status(200).json({ success: true, service: "payment", status: "healthy" });
});

const PORT = process.env.PORT || 8003;

app.listen(PORT, () => {
  console.log(`Payment service running on port ${PORT}`);
});
