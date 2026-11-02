import mongoose from "mongoose";
import "dotenv/config";

const connectDb = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("[Agent] MONGODB_URI is not defined. Image database persistence will not be available.");
    return;
  }

  try {
    await mongoose.connect(uri);
    console.log("MongoDB connected successfully in Agent service");
  } catch (error) {
    console.error("MongoDB connection failed in Agent service:", error.message);
  }
};

export default connectDb;
