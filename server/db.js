import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || join(__dirname, "data");

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(join(DATA_DIR, "budget.db"));
db.pragma("journal_mode = WAL");

// Create tables
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

const goalsRow = db.prepare("SELECT COUNT(*) as cnt FROM goals").get();
if (goalsRow.cnt === 0) {
  db.prepare("INSERT INTO goals (monthly_budget, monthly_savings) VALUES (6000, 2000)").run();
}

// KV → Relational Migration
const kvExists = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='kv'"
).get();

if (kvExists) {
  console.log("Migrating KV data to relational tables...");
  const migrate = db.transaction(() => {
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

    const themeKV = db.prepare("SELECT value FROM kv WHERE key = ?").get("budget-tracker-theme");
    if (themeKV?.value) {
      db.prepare(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('theme', ?)"
      ).run(themeKV.value);
      console.log("  Migrated theme setting");
    }

    db.exec("DROP TABLE kv");
    console.log("  Dropped kv table. Migration complete.");
  });
  migrate();
}

// Prepared statements
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

export { db, stmts };
