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
// Supports both Coding Agent project artifacts  { type:"code_generation", files:[...] }
// and PDF Agent document artifacts              { type:"pdf", title, url }
// and PPT Agent presentation artifacts          { type:"ppt", title, url }

const artifactSchema = new mongoose.Schema(
  {
    type:  { type: String, required: true }, // e.g. "code_generation" | "pdf"
    files: { type: [artifactFileSchema], default: [] },
    // PDF Agent fields (optional for coding artifacts)
    title: { type: String, default: "" },
    url:   { type: String, default: "" },
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
    // Structured artifacts: Coding Agent project files OR PDF Agent document metadata
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
