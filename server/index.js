import express from "express";
import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

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

// Basic auth if PASSWORD is set
if (process.env.PASSWORD) {
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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Budget tracker server running on http://0.0.0.0:${PORT}`);
});
