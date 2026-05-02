const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const cron = require("node-cron");
require("dotenv").config();

const Pad = require("./models/Pad");
const padRoutes = require("./routes/padRoutes");

const app = express();
const server = http.createServer(app);

// Middleware
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked: ${origin}`));
  },
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

// Send email via Brevo API (HTTPS — works on Render free tier)
async function sendPadEmail(pad, toEmail, subject, messageIntro) {
  const contentPreview = pad.content
    ? pad.content.substring(0, 5000) + (pad.content.length > 5000 ? "\n\n[Content truncated]" : "")
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
        .content-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; white-space: pre-wrap; word-break: break-word; font-size: 14px; color: #1e293b; line-height: 1.7; }
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
          <div class="content-box">${contentPreview}</div>
        </div>
        <div class="footer">TextPad — text lives here, briefly.</div>
      </div>
    </body>
    </html>
  `;

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      sender: { name: "TextPad", email: process.env.BREVO_SENDER_EMAIL },
      to: [{ email: toEmail }],
      subject,
      htmlContent: html
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo API error: ${res.status} — ${err}`);
  }
}

// Cron: every minute
cron.schedule("* * * * *", async () => {
  const now = new Date();

  try {
    // Find expired pads that have subscribers and haven't been emailed yet
    const expiredPads = await Pad.find({
      expiresAt: { $lte: now },
      emails: { $exists: true, $not: { $size: 0 } },
      deletionEmailSent: { $ne: true }
    });

    for (let pad of expiredPads) {
      // Mark FIRST before sending — prevents duplicate sends if cron overlaps
      await Pad.findByIdAndUpdate(pad._id, { deletionEmailSent: true });

      for (let email of pad.emails) {
        await sendPadEmail(
          pad,
          email,
          `🗑️ Your TextPad "${pad.padId}" has been deleted`,
          `Your TextPad <strong>"${pad.padId}"</strong> has been permanently deleted. Here is a copy of its contents:`
        );
      }
      console.log(`Deletion email sent for pad: ${pad.padId} → [${pad.emails.join(", ")}]`);
    }

    // Delete all expired pads (with or without subscribers)
    await Pad.deleteMany({ expiresAt: { $lte: now } });

  } catch (err) {
    console.error("Cron error:", err);
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
