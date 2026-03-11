import { Router } from "express";
import { db } from "../db.js";

const router = Router();

let CATEGORY_RULES = [];
try { if (process.env.CATEGORY_RULES) CATEGORY_RULES = JSON.parse(process.env.CATEGORY_RULES); }
catch (e) { console.error("Failed to parse CATEGORY_RULES:", e.message); }

let SKIP_PATTERNS = [];
try { if (process.env.SKIP_PATTERNS) SKIP_PATTERNS = JSON.parse(process.env.SKIP_PATTERNS).map(s => new RegExp(s, "i")); }
catch (e) { console.error("Failed to parse SKIP_PATTERNS:", e.message); }

function categorize(description) {
  const upper = description.toUpperCase();
  if (SKIP_PATTERNS.some(p => p.test(description))) return null;
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

router.post("/csv", (req, res) => {
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

      const dm = dateRaw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!dm) { skipped++; continue; }
      const isoDate = `${dm[3]}-${dm[2]}-${dm[1]}`;
      const month = `${dm[3]}-${dm[2]}`;

      if (SKIP_PATTERNS.some(p => p.test(desc))) { skipped++; continue; }
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

export default router;
