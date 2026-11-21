import mongoose from "mongoose";
import "dotenv/config";

const connectDb = async () => {
  const uri = process.env.AUTH_MONGODB_URI || process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("AUTH_MONGODB_URI or MONGODB_URI must be defined in environment");
  }
  await mongoose.connect(uri);
  console.log("MongoDB connected successfully (Auth Service)");
};

export default connectDb;