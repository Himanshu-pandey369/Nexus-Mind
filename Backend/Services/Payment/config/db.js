import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const connectDb = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB connected successfully (Payment Service)");
};

export default connectDb;
