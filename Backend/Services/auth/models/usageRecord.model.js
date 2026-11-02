import mongoose from "mongoose";

const usageRecordSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    conversationId: {
      type: String,
      index: true,
      default: "",
    },
    agent: {
      type: String,
      required: true,
      index: true,
    },
    model: {
      type: String,
      default: "",
    },
    inputTokens: {
      type: Number,
      default: 0,
      min: 0,
    },
    outputTokens: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalTokens: {
      type: Number,
      default: 0,
      min: 0,
    },
    estimatedCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: "USD",
    },
  },
  {
    timestamps: true,
  }
);

usageRecordSchema.index({ userId: 1, createdAt: -1 });

const UsageRecord = mongoose.model("UsageRecord", usageRecordSchema);

export default UsageRecord;
