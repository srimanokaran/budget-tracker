import { Router } from "express";
import { stmts } from "../db.js";

const router = Router();

router.get("/", (_req, res) => {
  const row = stmts.getGoals.get();
  res.json({ monthlyBudget: row.monthly_budget, monthlySavings: row.monthly_savings });
});

router.put("/", (req, res) => {
  const { monthlyBudget, monthlySavings } = req.body;
  if (monthlyBudget == null || monthlySavings == null) {
    return res.status(400).json({ error: "monthlyBudget and monthlySavings required" });
  }
  stmts.updateGoals.run(monthlyBudget, monthlySavings);
  res.json({ ok: true });
});

export default router;
