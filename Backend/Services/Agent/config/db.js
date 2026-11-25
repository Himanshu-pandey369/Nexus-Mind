import mongoose from "mongoose";
import "dotenv/config";

export const sanitizeMongoError = (error) => {
  const message = error?.message || String(error || "Unknown MongoDB error");
  return message.replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, "mongodb://<redacted>");
};

export const createHealthHandler = (mongooseClient = mongoose) => (_req, res) => {
  const isConnected = mongooseClient.connection?.readyState === 1;
  if (!isConnected) {
    return res.status(503).json({
      status: "unhealthy",
      service: "agent",
      database: "disconnected",
    });
  }

  return res.status(200).json({
    status: "ok",
    service: "agent",
    database: "connected",
  });
};

const connectDb = async ({ mongooseClient = mongoose, env = process.env } = {}) => {
  const uri = env.AGENT_MONGODB_URI || env.MONGODB_URI;
  const isProduction = env.NODE_ENV === "production";

  if (!uri) {
    if (isProduction) {
      throw new Error("AGENT_MONGODB_URI or MONGODB_URI must be defined in production");
    }
    console.warn(
      "[Agent] AGENT_MONGODB_URI or MONGODB_URI is not defined. Image database persistence will not be available."
    );
    return;
  }

  try {
    await mongooseClient.connect(uri);
    console.log("MongoDB connected successfully in Agent service");
  } catch (error) {
    console.error("MongoDB connection failed in Agent service:", sanitizeMongoError(error));
    throw error;
  }
};

export default connectDb;
