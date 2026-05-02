const express = require("express");
const router = express.Router();
const Pad = require("../models/Pad");

// GET / CREATE pad
router.get("/:id", async (req, res) => {
  try {
    let pad = await Pad.findOne({ padId: req.params.id });
    if (!pad) {
      pad = await Pad.create({ padId: req.params.id });
    }
    res.json(pad);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE content
router.post("/:id", async (req, res) => {
  try {
    const pad = await Pad.findOneAndUpdate(
      { padId: req.params.id },
      { content: req.body.content },
      { returnDocument: "after", upsert: true } // ✅ fixed
    );
    res.json(pad);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SAVE email
router.post("/:id/email", async (req, res) => {
  try {
    const pad = await Pad.findOneAndUpdate(
      { padId: req.params.id },
      { email: req.body.email },
      { returnDocument: "after" } // ✅ fixed
    );
    res.json(pad);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE email (unsubscribe)
router.delete("/:id/email", async (req, res) => {
  try {
    const pad = await Pad.findOneAndUpdate(
      { padId: req.params.id },
      { email: null, warningSent: false, deletionEmailSent: false },
      { returnDocument: "after" } // ✅ fixed
    );
    res.json(pad);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;