import { Router } from "express";
import { stmts } from "../db.js";

const router = Router();

router.get("/:key", (req, res) => {
  const row = stmts.getSetting.get(req.params.key);
  res.json({ value: row ? row.value : null });
});

router.put("/:key", (req, res) => {
  const { value } = req.body;
  if (typeof value !== "string") {
    return res.status(400).json({ error: "value must be a string" });
  }
  stmts.putSetting.run(req.params.key, value);
  res.json({ ok: true });
});

export default router;
