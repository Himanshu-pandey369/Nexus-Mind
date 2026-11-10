import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    packageId: {
      type: String,
      required: true,
    },
    packageName: {
      type: String,
      default: null,
    },
    razorpayOrderId: {
      type: String,
      required: true,
      unique: true,
    },
    razorpayPaymentId: {
      type: String,
      default: null,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
    },
    credits: {
      type: Number,
      required: true,
      min: 0,
    },
    bonusCredits: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["pending", "verified", "fulfilled", "failed"],
      default: "pending",
      index: true,
    },
    paymentMethod: {
      type: String,
      default: null,
    },
    fulfillmentError: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for user payment history queries
paymentSchema.index({ userId: 1, createdAt: -1 });

// Index for finding pending/verified orders that may need fulfillment retry
paymentSchema.index({ status: 1, createdAt: -1 });

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
