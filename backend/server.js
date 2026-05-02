const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const cron = require("node-cron");
const nodemailer = require("nodemailer");
require("dotenv").config();

const Pad = require("./models/Pad");
const padRoutes = require("./routes/padRoutes");

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));
app.use(express.json());

// Health check
app.get("/", (req, res) => res.json({ status: "TextPad API running" }));

// Routes
app.use("/api/pad", padRoutes);

// Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  socket.on("joinPad", (padId) => {
    socket.join(padId);
  });

  socket.on("typing", ({ padId, content }) => {
    socket.to(padId).emit("update", content);
  });
});

// MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(console.error);

// Email transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Helper: send pad content email
async function sendPadEmail(pad, subject, messageIntro) {
  const contentPreview = pad.content
    ? pad.content.substring(0, 5000) + (pad.content.length > 5000 ? "\n\n[Content truncated — pad had more text]" : "")
    : "(This pad was empty)";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <style>
        body { font-family: 'Courier New', monospace; background: #f9fafb; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .header { background: #064e3b; padding: 32px; text-align: center; }
        .header h1 { color: #6ee7b7; margin: 0; font-size: 28px; letter-spacing: 4px; }
        .header p { color: #a7f3d0; margin: 8px 0 0; font-size: 14px; }
        .body { padding: 32px; }
        .intro { color: #374151; font-size: 15px; margin-bottom: 24px; line-height: 1.6; font-family: Arial, sans-serif; }
        .pad-id { display: inline-block; background: #ecfdf5; color: #065f46; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; margin-bottom: 20px; }
        .content-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; white-space: pre-wrap; word-break: break-word; font-size: 14px; color: #1e293b; line-height: 1.7; max-height: 400px; overflow-y: auto; }
        .footer { background: #f9fafb; padding: 20px 32px; border-top: 1px solid #f0f0f0; text-align: center; color: #9ca3af; font-size: 12px; font-family: Arial, sans-serif; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>TEXTPAD</h1>
          <p>The simplest way to share text online</p>
        </div>
        <div class="body">
          <p class="intro">${messageIntro}</p>
          <div class="pad-id">📄 ${pad.padId}</div>
          <div class="content-box">${contentPreview || "(Empty pad)"}</div>
        </div>
        <div class="footer">
          TextPad — text lives here, briefly. This is an automated message.
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"TextPad" <${process.env.EMAIL}>`,
    to: pad.email,
    subject,
    html
  });
}

// Cron: every minute — check for pads expiring in ~5 min and send warning email
cron.schedule("* * * * *", async () => {
  const now = new Date();
  const fiveMinutesLater = new Date(now.getTime() + 5 * 60 * 1000);
  const fourMinutesLater = new Date(now.getTime() + 4 * 60 * 1000);

  try {
    // Warning: expiring in 4–5 minutes, not yet warned
    const warningPads = await Pad.find({
      expiresAt: { $lte: fiveMinutesLater, $gte: fourMinutesLater },
      email: { $exists: true, $ne: null },
      warningSent: { $ne: true }
    });

    for (let pad of warningPads) {
      await sendPadEmail(
        pad,
        `⚠️ Your TextPad "${pad.padId}" is expiring in 5 minutes`,
        `Your TextPad <strong>"${pad.padId}"</strong> will be permanently deleted in approximately <strong>5 minutes</strong>. Here's a copy of its contents for your records:`
      );
      await Pad.findByIdAndUpdate(pad._id, { warningSent: true });
      console.log(`Warning email sent for pad: ${pad.padId}`);
    }

    // Final: pads that have already expired — send final email then delete
    const expiredPads = await Pad.find({
      expiresAt: { $lte: now },
      email: { $exists: true, $ne: null },
      deletionEmailSent: { $ne: true }
    });

    for (let pad of expiredPads) {
      await sendPadEmail(
        pad,
        `🗑️ Your TextPad "${pad.padId}" has been deleted`,
        `Your TextPad <strong>"${pad.padId}"</strong> has now been permanently deleted. Here is a final copy of its contents:`
      );
      await Pad.findByIdAndUpdate(pad._id, { deletionEmailSent: true });
      console.log(`Deletion email sent for pad: ${pad.padId}`);
    }

    // Clean up expired pads that had their deletion email sent (or have no email)
    const toDelete = await Pad.find({
      expiresAt: { $lte: now },
      $or: [
        { email: { $exists: false } },
        { email: null },
        { deletionEmailSent: true }
      ]
    });

    for (let pad of toDelete) {
      await Pad.findByIdAndDelete(pad._id);
      console.log(`Deleted pad: ${pad.padId}`);
    }

  } catch (err) {
    console.error("Cron error:", err);
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
