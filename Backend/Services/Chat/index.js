import express from "express";
import connectDb from "./config/db.js";
import "dotenv/config";
import chatRouter from "./routes/chat.route.js";

const app = express();
app.use(express.json());

try {
  await connectDb();
} catch (error) {
  console.error("MongoDB connection failed:", error.message);
  process.exit(1);
}

app.use("/chat", chatRouter);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "chat" });
});

app.get("/testing", (req, res) => {
  res.json("hello from chat");
});

const PORT = process.env.PORT || 8002;
const HOST = process.env.INTERNAL_HOST || "127.0.0.1";

app.listen(PORT, HOST, () => {
  console.log(`Chat service started on ${HOST}:${PORT}`);
});
