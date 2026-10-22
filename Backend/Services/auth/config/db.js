import mongoose from "mongoose";
import "dotenv/config";

const connectDb = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB connected successfully");
};

export default connectDb;