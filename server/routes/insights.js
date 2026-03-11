import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db.js";

const router = Router();
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

router.get("/", async (req, res) => {
  if (!anthropic) return res.status(503).json({ error: "AI not configured" });

  // What is the point of this
  const month = req.query.month;
  if (!month) return res.status(400).json({ error: "month query param required" });

  const transactions = db.prepare(
    "SELECT type, category, amount, description, date, month FROM transactions ORDER BY date DESC LIMIT 200"
  ).all();

  const currentMonthTx = transactions.filter(t => t.month === month);

  const monthlyTotals = db.prepare(
    "SELECT month, type, SUM(amount) as total FROM transactions GROUP BY month, type ORDER BY month DESC LIMIT 24"
  ).all();

  const categoryTrends = db.prepare(
    "SELECT month, category, SUM(amount) as total FROM transactions WHERE type = 'expense' GROUP BY month, category ORDER BY month DESC LIMIT 120"
  ).all();

  const goals = db.prepare("SELECT monthly_budget, monthly_savings FROM goals LIMIT 1").get();

  const income = currentMonthTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expenses = currentMonthTx.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  const customQuestion = req.query.question || "Analyze my finances";

  const financialContext = `CURRENT MONTH (${month}):
Income: $${income.toFixed(2)} | Expenses: $${expenses.toFixed(2)} | Net: $${(income - expenses).toFixed(2)}

ALL RECENT TRANSACTIONS:
${transactions.map(t => `${t.date} | ${t.month} | ${t.type} | ${t.category} | $${t.amount.toFixed(2)} | ${t.description}`).join("\n")}

MONTHLY HISTORY (last 12 months):
${monthlyTotals.map(r => `${r.month}: ${r.type} $${r.total.toFixed(2)}`).join("\n")}

CATEGORY TRENDS:
${categoryTrends.map(r => `${r.month} ${r.category}: $${r.total.toFixed(2)}`).join("\n")}

GOALS: Monthly budget $${goals.monthly_budget}, Monthly savings target $${goals.monthly_savings}`;

  const prompt = `Here is my financial data:\n\n${financialContext}\n\nMy question: ${customQuestion}`;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  try {
    const stream = anthropic.messages.stream({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: `You are a personal financial analyst. The user will provide their financial data and ask a question. Answer using the data provided. Be specific with numbers. Use AUD currency. Keep it concise (under 500 words). Use **bold** for section headings.`,
      messages: [{ role: "user", content: prompt }],
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        res.write(`data: ${JSON.stringify({ type: "text", text: event.delta.text })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: "error", error: err.message })}\n\n`);
  }

  res.end();
});

export default router;
