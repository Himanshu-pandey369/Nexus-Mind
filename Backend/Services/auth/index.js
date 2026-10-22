import express from "express";
import connectDb from "./config/db.js";
import "dotenv/config";
import authRouter from "./routes/auth.route.js"


const app = express();
app.use(express.json());

try {
  await connectDb();
} catch (error) {
  console.error("MongoDB connection failed:", error.message);
  process.exit(1);
}

app.use("/auth",authRouter)

app.listen(process.env.PORT, () => {
  console.log("Hello from auth service");
});
