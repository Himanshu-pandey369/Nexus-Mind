import mongoose from "mongoose";

const creditReservationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ["PENDING", "COMMITTED", "REFUNDED"],
      default: "PENDING",
      index: true,
    },
    description: {
      type: String,
      default: "",
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 10 * 60 * 1000), // 10 minutes TTL
      index: { expires: 0 },
    },
  },
  {
    timestamps: true,
  }
);

const CreditReservation = mongoose.model(
  "CreditReservation",
  creditReservationSchema
);

export default CreditReservation;
