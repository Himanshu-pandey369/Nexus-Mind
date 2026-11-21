import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const connectDb = async () => {
  const uri = process.env.PAYMENT_MONGODB_URI || process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("PAYMENT_MONGODB_URI or MONGODB_URI must be defined in environment");
  }
  await mongoose.connect(uri);
  console.log("MongoDB connected successfully (Payment Service)");
};

export default connectDb;
