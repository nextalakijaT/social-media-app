const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    title:   { type: String, required: true, trim: true },
    content: { type: String, required: true },
    author:  { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    tags:    { type: [String], default: [], set: (tags) => tags.map((t) => t.toLowerCase().trim()) },
    state:   { type: String, enum: ["draft", "published"], default: "draft" },
    like_count:    { type: Number, default: 0 },
    comment_count: { type: Number, default: 0 },
  },
  { timestamps: true }
);

postSchema.index({ title: "text", tags: "text" });

module.exports = mongoose.model("Post", postSchema);