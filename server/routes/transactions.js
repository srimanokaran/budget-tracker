import { Router } from "express";
import { db, stmts } from "../db.js";

const router = Router();

router.get("/", (req, res) => {
  const month = req.query.month;
  if (!month) return res.status(400).json({ error: "month query param required" });
  const rows = stmts.getTransactions.all(month);
  res.json(rows);
});

router.get("/trends", (_req, res) => {
  const rows = db.prepare(
    "SELECT month, category, SUM(amount) as total FROM transactions WHERE type = 'expense' GROUP BY month, category ORDER BY month"
  ).all();
  res.json(rows);
});

router.get("/monthly-totals", (_req, res) => {
  const rows = db.prepare(
    "SELECT month, type, SUM(amount) as total FROM transactions GROUP BY month, type ORDER BY month"
  ).all();
  res.json(rows);
});

router.post("/", (req, res) => {
  const { id, type, category, amount, description, date, month } = req.body;
  if (!id || !type || !category || amount == null || !date || !month) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  stmts.insertTransaction.run(id, type, category, amount, description || "", date, month);
  res.json({ ok: true });
});

router.patch("/:id", (req, res) => {
  const { type, category, amount } = req.body;
  if (!type || !category) return res.status(400).json({ error: "type and category required" });
  if (amount != null) {
    db.prepare("UPDATE transactions SET type = ?, category = ?, amount = ? WHERE id = ?").run(type, category, amount, req.params.id);
  } else {
    db.prepare("UPDATE transactions SET type = ?, category = ? WHERE id = ?").run(type, category, req.params.id);
  }
  res.json({ ok: true });
});

router.delete("/:id", (req, res) => {
  stmts.deleteTransaction.run(req.params.id);
  res.json({ ok: true });
});

export default router;
