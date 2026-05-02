const mongoose = require("mongoose");

const padSchema = new mongoose.Schema({
  padId: { type: String, required: true, unique: true },
  content: { type: String, default: "" },
  email: { type: String, default: null },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000)
  },
  warningSent: { type: Boolean, default: false },
  deletionEmailSent: { type: Boolean, default: false }
});

// TTL index — MongoDB auto-deletes expired documents
padSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 300 }); // 5 min grace after expiry

module.exports = mongoose.model("Pad", padSchema);
