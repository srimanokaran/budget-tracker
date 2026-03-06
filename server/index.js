import express from "express";
import crypto from "crypto";
import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const ALLOWED_EMAIL = process.env.ALLOWED_EMAIL;
const SESSION_SECRET = process.env.SESSION_SECRET || "fallback-dev-secret";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || join(__dirname, "data");
const DIST_DIR = join(__dirname, "..", "dist");

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize SQLite
const db = new Database(join(DATA_DIR, "budget.db"));
db.pragma("journal_mode = WAL");

// Create new relational tables
db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY,
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    date TEXT NOT NULL,
    month TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS goals (
    monthly_budget REAL NOT NULL DEFAULT 6000,
    monthly_savings REAL NOT NULL DEFAULT 2000
  )
`);

// Ensure goals has exactly one row
const goalsRow = db.prepare("SELECT COUNT(*) as cnt FROM goals").get();
if (goalsRow.cnt === 0) {
  db.prepare("INSERT INTO goals (monthly_budget, monthly_savings) VALUES (6000, 2000)").run();
}

// ── KV → Relational Migration ──
const kvExists = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='kv'"
).get();

if (kvExists) {
  console.log("Migrating KV data to relational tables...");
  const migrate = db.transaction(() => {
    // Migrate transactions
    const txRow = db.prepare("SELECT value FROM kv WHERE key = ?").get("budget-tracker-v1");
    if (txRow?.value) {
      try {
        const data = JSON.parse(txRow.value);
        const insert = db.prepare(
          "INSERT OR IGNORE INTO transactions (id, type, category, amount, description, date, month) VALUES (?, ?, ?, ?, ?, ?, ?)"
        );
        for (const [month, entries] of Object.entries(data)) {
          for (const e of entries) {
            insert.run(e.id, e.type, e.category, e.amount, e.description || "", e.date, month);
          }
        }
        console.log("  Migrated transactions");
      } catch (err) {
        console.error("  Failed to migrate transactions:", err.message);
      }
    }

    // Migrate goals
    const goalsKV = db.prepare("SELECT value FROM kv WHERE key = ?").get("budget-goals-v1");
    if (goalsKV?.value) {
      try {
        const g = JSON.parse(goalsKV.value);
        db.prepare("UPDATE goals SET monthly_budget = ?, monthly_savings = ?").run(
          g.monthlyBudget ?? 6000,
          g.monthlySavings ?? 2000
        );
        console.log("  Migrated goals");
      } catch (err) {
        console.error("  Failed to migrate goals:", err.message);
      }
    }

    // Migrate theme
    const themeKV = db.prepare("SELECT value FROM kv WHERE key = ?").get("budget-tracker-theme");
    if (themeKV?.value) {
      db.prepare(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('theme', ?)"
      ).run(themeKV.value);
      console.log("  Migrated theme setting");
    }

    // Drop old KV table
    db.exec("DROP TABLE kv");
    console.log("  Dropped kv table. Migration complete.");
  });
  migrate();
}

// ── Prepared Statements ──
const stmts = {
  getTransactions: db.prepare("SELECT * FROM transactions WHERE month = ? ORDER BY id DESC"),
  insertTransaction: db.prepare(
    "INSERT INTO transactions (id, type, category, amount, description, date, month) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ),
  deleteTransaction: db.prepare("DELETE FROM transactions WHERE id = ?"),
  getGoals: db.prepare("SELECT monthly_budget, monthly_savings FROM goals LIMIT 1"),
  updateGoals: db.prepare("UPDATE goals SET monthly_budget = ?, monthly_savings = ?"),
  getSetting: db.prepare("SELECT value FROM settings WHERE key = ?"),
  putSetting: db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ),
};

const app = express();
app.set("trust proxy", 1);

// ── Cookie helpers (no cookie-parser needed) ──
function signCookie(value) {
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
  return `${value}.${sig}`;
}

function verifyCookie(signed) {
  const idx = signed.lastIndexOf(".");
  if (idx < 0) return null;
  const value = signed.slice(0, idx);
  const sig = signed.slice(idx + 1);
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return value;
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(header.split(";").map(c => c.trim().split("=")).filter(p => p.length === 2).map(([k, v]) => [k, decodeURIComponent(v)]));
}

// ── Google OAuth routes ──
const oauthEnabled = GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && ALLOWED_EMAIL;

if (oauthEnabled) {
  const REDIRECT_URI_PATH = "/auth/callback";

  function getRedirectUri(req) {
    const proto = req.protocol;
    const host = req.get("host");
    return `${proto}://${host}${REDIRECT_URI_PATH}`;
  }

  app.get("/login", (_req, res) => {
    res.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Login — Budget Tracker</title>
<style>body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#faf9f7}
a{display:inline-block;padding:14px 32px;background:#1a1a1a;color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px;letter-spacing:1px}</style>
</head><body><div style="text-align:center"><h2 style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#999;margin-bottom:32px">Budget Tracker</h2>
<a href="/auth/google">Sign in with Google</a></div></body></html>`);
  });

  app.get("/auth/google", (req, res) => {
    const redirectUri = getRedirectUri(req);
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email");
    url.searchParams.set("access_type", "online");
    url.searchParams.set("prompt", "select_account");
    res.redirect(url.toString());
  });

  app.get("/auth/callback", async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send("Missing code");

    try {
      const redirectUri = getRedirectUri(req);
      // Exchange code for tokens
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });
      const tokens = await tokenRes.json();
      if (!tokens.access_token) return res.status(401).send("Token exchange failed");

      // Get user info
      const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const user = await userRes.json();

      if (user.email !== ALLOWED_EMAIL) {
        return res.status(403).send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Access Denied</title>
<style>body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#faf9f7}
a{color:#1a1a1a}</style></head>
<body><div style="text-align:center"><h2>Access Denied</h2><p>${user.email} is not authorized.</p><a href="/login">Try another account</a></div></body></html>`);
      }

      // Set signed session cookie (30 days)
      const sessionValue = JSON.stringify({ email: user.email, ts: Date.now() });
      const encoded = Buffer.from(sessionValue).toString("base64url");
      const signed = signCookie(encoded);
      res.setHeader("Set-Cookie", `session=${encodeURIComponent(signed)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${30 * 24 * 60 * 60}`);
      res.redirect("/");
    } catch (err) {
      console.error("OAuth callback error:", err);
      res.status(500).send("Authentication failed");
    }
  });

  app.get("/auth/logout", (_req, res) => {
    res.setHeader("Set-Cookie", "session=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0");
    res.redirect("/login");
  });
}

// ── Auth middleware ──
if (oauthEnabled) {
  app.use((req, res, next) => {
    // Skip auth routes
    if (req.path === "/login" || req.path.startsWith("/auth/")) return next();

    const cookies = parseCookies(req);
    if (cookies.session) {
      const verified = verifyCookie(cookies.session);
      if (verified) {
        try {
          const session = JSON.parse(Buffer.from(verified, "base64url").toString());
          if (session.email === ALLOWED_EMAIL) return next();
        } catch {}
      }
    }

    // API routes get 401, pages redirect to login
    if (req.path.startsWith("/api/")) return res.status(401).json({ error: "Unauthorized" });
    res.redirect("/login");
  });
} else if (process.env.PASSWORD) {
  // Fallback: basic auth if OAuth not configured
  app.use((req, res, next) => {
    const auth = req.headers.authorization;
    if (auth) {
      const [, encoded] = auth.split(" ");
      const [, pass] = Buffer.from(encoded, "base64").toString().split(":");
      if (pass === process.env.PASSWORD) return next();
    }
    res.set("WWW-Authenticate", 'Basic realm="Budget Tracker"');
    res.status(401).send("Unauthorized");
  });
}

app.use(express.json());
app.use(express.text({ type: "text/plain", limit: "5mb" }));

// ── API Routes ──

// Transactions
app.get("/api/transactions", (req, res) => {
  const month = req.query.month;
  if (!month) return res.status(400).json({ error: "month query param required" });
  const rows = stmts.getTransactions.all(month);
  res.json(rows);
});

app.get("/api/transactions/trends", (_req, res) => {
  const rows = db.prepare(
    "SELECT month, category, SUM(amount) as total FROM transactions WHERE type = 'expense' GROUP BY month, category ORDER BY month"
  ).all();
  res.json(rows);
});

app.get("/api/transactions/monthly-totals", (_req, res) => {
  const rows = db.prepare(
    "SELECT month, type, SUM(amount) as total FROM transactions GROUP BY month, type ORDER BY month"
  ).all();
  res.json(rows);
});

app.post("/api/transactions", (req, res) => {
  const { id, type, category, amount, description, date, month } = req.body;
  if (!id || !type || !category || amount == null || !date || !month) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  stmts.insertTransaction.run(id, type, category, amount, description || "", date, month);
  res.json({ ok: true });
});

app.patch("/api/transactions/:id", (req, res) => {
  const { type, category, amount } = req.body;
  if (!type || !category) return res.status(400).json({ error: "type and category required" });
  if (amount != null) {
    db.prepare("UPDATE transactions SET type = ?, category = ?, amount = ? WHERE id = ?").run(type, category, amount, req.params.id);
  } else {
    db.prepare("UPDATE transactions SET type = ?, category = ? WHERE id = ?").run(type, category, req.params.id);
  }
  res.json({ ok: true });
});

app.delete("/api/transactions/:id", (req, res) => {
  stmts.deleteTransaction.run(req.params.id);
  res.json({ ok: true });
});

// Goals
app.get("/api/goals", (_req, res) => {
  const row = stmts.getGoals.get();
  res.json({ monthlyBudget: row.monthly_budget, monthlySavings: row.monthly_savings });
});

app.put("/api/goals", (req, res) => {
  const { monthlyBudget, monthlySavings } = req.body;
  if (monthlyBudget == null || monthlySavings == null) {
    return res.status(400).json({ error: "monthlyBudget and monthlySavings required" });
  }
  stmts.updateGoals.run(monthlyBudget, monthlySavings);
  res.json({ ok: true });
});

// Settings
app.get("/api/settings/:key", (req, res) => {
  const row = stmts.getSetting.get(req.params.key);
  res.json({ value: row ? row.value : null });
});

app.put("/api/settings/:key", (req, res) => {
  const { value } = req.body;
  if (typeof value !== "string") {
    return res.status(400).json({ error: "value must be a string" });
  }
  stmts.putSetting.run(req.params.key, value);
  res.json({ ok: true });
});

// CSV Import — category rules and skip patterns loaded from env vars
let CATEGORY_RULES = [];
try { if (process.env.CATEGORY_RULES) CATEGORY_RULES = JSON.parse(process.env.CATEGORY_RULES); }
catch (e) { console.error("Failed to parse CATEGORY_RULES:", e.message); }

let SKIP_PATTERNS = [];
try { if (process.env.SKIP_PATTERNS) SKIP_PATTERNS = JSON.parse(process.env.SKIP_PATTERNS).map(s => new RegExp(s, "i")); }
catch (e) { console.error("Failed to parse SKIP_PATTERNS:", e.message); }

function categorize(description) {
  const upper = description.toUpperCase();
  if (SKIP_PATTERNS.some(p => p.test(description))) return null; // skip internal transfers
  if (/TRANSFER TO.*RENT/i.test(description)) return "Housing";
  if (/TRANSFER TO.*SAVING/i.test(description)) return "Savings";
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some(kw => upper.includes(kw.toUpperCase()))) return rule.category;
  }
  return "Other";
}

function hashId(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const importStmt = db.prepare(
  "INSERT OR IGNORE INTO transactions (id, type, category, amount, description, date, month) VALUES (?, ?, ?, ?, ?, ?, ?)"
);

app.post("/api/import/csv", (req, res) => {
  const text = typeof req.body === "string" ? req.body : "";
  if (!text.trim()) return res.status(400).json({ error: "Empty CSV" });

  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  let imported = 0;
  let skipped = 0;

  const run = db.transaction(() => {
    for (const line of lines) {
      const parts = line.split(",");
      if (parts.length < 3) { skipped++; continue; }

      const dateRaw = parts[0].trim().replace(/^"|"$/g, "");
      const amountRaw = parts[1].trim().replace(/^"|"$/g, "");
      const desc = parts[2].trim().replace(/^"|"$/g, "");

      const amount = parseFloat(amountRaw);
      if (isNaN(amount) || amount === 0) { skipped++; continue; }

      // DD/MM/YYYY → YYYY-MM-DD
      const dm = dateRaw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!dm) { skipped++; continue; }
      const isoDate = `${dm[3]}-${dm[2]}-${dm[1]}`;
      const month = `${dm[3]}-${dm[2]}`;

      if (SKIP_PATTERNS.some(p => p.test(desc))) { skipped++; continue; } // skip internal transfers
      const type = amount > 0 ? "income" : "expense";
      const absAmount = Math.abs(amount);
      const category = type === "income" ? "Income" : categorize(desc);
      if (category === null) { skipped++; continue; }
      const id = hashId(`${isoDate}|${amountRaw}|${desc}`);

      const result = importStmt.run(id, type, category, absAmount, desc, isoDate, month);
      if (result.changes > 0) imported++;
      else skipped++;
    }
  });

  run();
  res.json({ imported, skipped });
});

// Serve static frontend in production
if (existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get("*", (req, res) => {
    res.sendFile(join(DIST_DIR, "index.html"));
  });
}

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Budget tracker server running on http://0.0.0.0:${PORT}`);
  });
}

export { app, db };
