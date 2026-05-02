const express = require("express");
const router = express.Router();
const Pad = require("../models/Pad");

// GET / CREATE pad — never expose the emails array to the client
router.get("/:id", async (req, res) => {
  try {
    let pad = await Pad.findOne({ padId: req.params.id });
    if (!pad) {
      pad = await Pad.create({ padId: req.params.id });
    }
    // Strip the emails list — each user tracks their own email in localStorage
    const { emails, ...safe } = pad.toObject();
    res.json(safe);
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
      { new: true, upsert: true }
    );
    const { emails, ...safe } = pad.toObject();
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADD an email to the pad's subscriber list (no duplicates)
router.post("/:id/email", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });
    await Pad.findOneAndUpdate(
      { padId: req.params.id },
      { $addToSet: { emails: email.toLowerCase().trim() } },
      { new: true }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// REMOVE a specific email from the list
router.delete("/:id/email", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });
    await Pad.findOneAndUpdate(
      { padId: req.params.id },
      { $pull: { emails: email.toLowerCase().trim() } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
