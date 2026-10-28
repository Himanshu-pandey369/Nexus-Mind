import mongoose from "mongoose";

// ── Artifact file sub-schema ──────────────────────────────────────────────────

const artifactFileSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    content: { type: String, required: true },
  },
  { _id: false }
);

// ── Artifact sub-schema ───────────────────────────────────────────────────────

const artifactSchema = new mongoose.Schema(
  {
    type: { type: String, required: true }, // e.g. "code_generation"
    files: { type: [artifactFileSchema], default: [] },
  },
  { _id: false }
);

// ── Message schema ────────────────────────────────────────────────────────────

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    images: {
      type: [String],
      default: [],
    },
    // Structured artifacts produced by the Coding Agent (empty for other agents)
    artifacts: {
      type: [artifactSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const Message = mongoose.model("Message", messageSchema);

export default Message;
