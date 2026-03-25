require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const app = express();
app.use(express.json());
app.use(cors());

const JELLYFIN_URL = process.env.JELLYFIN_URL || "https://jellyfin.pomflix.com";
const API_KEY = process.env.JELLYFIN_API_KEY;
const SIGNUP_SECRET = process.env.SIGNUP_SECRET;
const PORT = process.env.PORT || 3001;

if (!API_KEY) {
  console.error("❌  JELLYFIN_API_KEY is not set in .env — server cannot start safely.");
  process.exit(1);
}if (!SIGNUP_SECRET) {
  console.error("\u274c  SIGNUP_SECRET is not set in .env \u2014 server cannot start safely.");
  process.exit(1);
}

// Rate limiter: max 5 signup attempts per IP per 15 minutes
const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many signup attempts. Please try again later." },
});
// ─── Health check ────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// ─── Signup ───────────────────────────────────────────────────────────────────
app.post("/signup", signupLimiter, async (req, res) => {
  // Verify shared secret — rejects any caller that isn't the Pomflix app
  const secret = req.headers["x-pomflix-secret"];
  if (!secret || secret !== SIGNUP_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { name, email, username, password } = req.body;

  // Input validation
  if (!username || typeof username !== "string" || username.trim().length < 2) {
    return res.status(400).json({ error: "Username must be at least 2 characters." });
  }
  if (!password || typeof password !== "string" || password.length < 4) {
    return res.status(400).json({ error: "Password must be at least 4 characters." });
  }

  const headers = {
    "Content-Type": "application/json",
    "X-Emby-Token": API_KEY,
  };

  try {
    // 1. Create the Jellyfin user
    const createRes = await fetch(`${JELLYFIN_URL}/Users/New`, {
      method: "POST",
      headers,
      body: JSON.stringify({ Name: username.trim() }),
    });

    if (!createRes.ok) {
      const body = await createRes.text();
      // Jellyfin returns 400 with "invalid user name" if it already exists
      if (createRes.status === 400) {
        return res.status(409).json({ error: "That username is already taken." });
      }
      console.error("Jellyfin create user error:", createRes.status, body);
      return res.status(502).json({ error: "Could not create account. Try again." });
    }

    const newUser = await createRes.json();

    // 2. Set the user's password (Jellyfin accounts start with no password)
    const pwRes = await fetch(`${JELLYFIN_URL}/Users/${newUser.Id}/Password`, {
      method: "POST",
      headers,
      body: JSON.stringify({ CurrentPw: "", NewPw: password }),
    });

    if (!pwRes.ok) {
      const body = await pwRes.text();
      console.error("Jellyfin set password error:", pwRes.status, body);
      // Best-effort cleanup: delete the user we just created
      await fetch(`${JELLYFIN_URL}/Users/${newUser.Id}`, {
        method: "DELETE",
        headers,
      }).catch(() => {});
      return res.status(502).json({ error: "Account created but password could not be set. Please try again." });
    }

    // 3. (Optional) Update display name to full name if provided
    if (name && name.trim() && name.trim() !== username.trim()) {
      await fetch(`${JELLYFIN_URL}/Users/${newUser.Id}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ ...newUser, Name: name.trim() }),
      }).catch(() => {}); // non-fatal
    }

    console.log(`✅  Created Jellyfin user: ${username} (${newUser.Id})`);
    return res.status(201).json({ success: true });

  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Server error. Please try again." });
  }
});

app.listen(PORT, () => {
  console.log(`🍎  Pomflix server running on port ${PORT}`);
});
