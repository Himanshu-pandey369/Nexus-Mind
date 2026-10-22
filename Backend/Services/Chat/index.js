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

app.listen(process.env.PORT, () => {
  console.log(`Chat service started on port ${process.env.PORT}`);
});
