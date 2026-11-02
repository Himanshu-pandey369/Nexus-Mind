import mongoose from "mongoose";

const creditTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["CREDIT", "DEBIT", "REFUND"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    balanceBefore: {
      type: Number,
      required: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    source: {
      type: String,
      enum: ["FREE_ALLOCATION", "AGENT_USAGE", "PAYMENT", "REFUND", "ADMIN"],
      required: true,
    },
    referenceId: {
      type: String,
      index: true,
    },
    description: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for idempotency and duplicate transaction protection
creditTransactionSchema.index(
  { userId: 1, referenceId: 1 },
  { unique: true, sparse: true }
);

// Index for efficient paginated history queries
creditTransactionSchema.index({ userId: 1, createdAt: -1 });

const CreditTransaction = mongoose.model(
  "CreditTransaction",
  creditTransactionSchema
);

export default CreditTransaction;
