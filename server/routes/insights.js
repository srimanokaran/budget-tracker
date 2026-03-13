import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { db, stmts } from "../db.js";

const router = Router();
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

const tools = [
  {
    name: "get_month_transactions",
    description: "Fetch detailed transactions for a specific month. Use this to get transaction details when the user asks about a specific month's spending, needs to see individual transactions, or when you need transaction IDs for recategorization. The monthly summary in your context already has totals — only call this when you need line-item detail.",
    input_schema: {
      type: "object",
      properties: {
        month: { type: "string", description: "Month in YYYY-MM format" },
      },
      required: ["month"],
    },
  },
  {
    name: "create_transaction",
    description: "Create a new transaction (expense or income) in the user's budget. Use this when the user asks to add, log, or record a transaction.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["expense", "income"], description: "Transaction type" },
        category: { type: "string", description: "Category (e.g. Groceries, Eating Out, Housing, Transport, Subscriptions, Entertainment, Shopping, Health, Savings, Other, Income)" },
        amount: { type: "number", description: "Amount in AUD (positive number)" },
        description: { type: "string", description: "Brief description" },
        date: { type: "string", description: "ISO date string (YYYY-MM-DD)" },
      },
      required: ["type", "category", "amount", "description", "date"],
    },
  },
  {
    name: "update_goals",
    description: "Update the user's monthly budget and/or savings targets. Use when they ask to set or change their budget or savings goal.",
    input_schema: {
      type: "object",
      properties: {
        monthlyBudget: { type: "number", description: "Monthly budget target in AUD" },
        monthlySavings: { type: "number", description: "Monthly savings target in AUD" },
      },
    },
  },
  {
    name: "recategorize_transaction",
    description: "Change the category of an existing transaction by its ID. Use when the user asks to recategorize or move a transaction. Call get_month_transactions first to find the ID.",
    input_schema: {
      type: "object",
      properties: {
        transactionId: { type: "number", description: "The transaction ID" },
        newCategory: { type: "string", description: "The new category name" },
      },
      required: ["transactionId", "newCategory"],
    },
  },
];

function executeTool(name, input) {
  switch (name) {
    case "get_month_transactions": {
      const txs = db.prepare(
        "SELECT rowid, type, category, amount, description, date FROM transactions WHERE month = ? ORDER BY date DESC"
      ).all(input.month);
      const catSummary = db.prepare(
        "SELECT category, SUM(amount) as total, COUNT(*) as count FROM transactions WHERE month = ? AND type = 'expense' GROUP BY category ORDER BY total DESC"
      ).all(input.month);
      return {
        success: true,
        month: input.month,
        transactions: txs.map(t => `[ID:${t.rowid}] ${t.date} | ${t.type} | ${t.category} | $${t.amount.toFixed(2)} | ${t.description}`),
        categorySummary: catSummary.map(r => `${r.category}: $${r.total.toFixed(2)} (${r.count})`),
      };
    }
    case "create_transaction": {
      const { type, category, amount, description, date } = input;
      const month = date.slice(0, 7);
      const id = Date.now();
      stmts.insertTransaction.run(id, type, category, Math.abs(amount), description, date, month);
      return { success: true, id, message: `Created ${type}: $${Math.abs(amount).toFixed(2)} ${category} - ${description}` };
    }
    case "update_goals": {
      const current = stmts.getGoals.get();
      const budget = input.monthlyBudget ?? current.monthly_budget;
      const savings = input.monthlySavings ?? current.monthly_savings;
      stmts.updateGoals.run(budget, savings);
      return { success: true, message: `Updated goals: budget $${budget.toFixed(2)}, savings $${savings.toFixed(2)}` };
    }
    case "recategorize_transaction": {
      const { transactionId, newCategory } = input;
      const tx = db.prepare("SELECT * FROM transactions WHERE id = ?").get(transactionId);
      if (!tx) return { success: false, message: `Transaction ${transactionId} not found` };
      db.prepare("UPDATE transactions SET category = ? WHERE id = ?").run(newCategory, transactionId);
      return { success: true, message: `Recategorized transaction ${transactionId} to ${newCategory}` };
    }
    default:
      return { success: false, message: `Unknown tool: ${name}` };
  }
}

router.post("/", async (req, res) => {
  if (!anthropic) return res.status(503).json({ error: "AI not configured" });

  const { month, messages } = req.body;
  if (!month) return res.status(400).json({ error: "month required" });
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array required" });
  }

  // Compact monthly totals only — detailed transactions fetched on demand via tool
  const monthlyTotals = db.prepare(
    "SELECT month, type, SUM(amount) as total FROM transactions GROUP BY month, type ORDER BY month DESC LIMIT 12"
  ).all();

  const goals = db.prepare("SELECT monthly_budget, monthly_savings FROM goals LIMIT 1").get();

  const financialContext = `MONTHLY SUMMARY:
${monthlyTotals.map(r => `${r.month}: ${r.type} $${r.total.toFixed(2)}`).join("\n")}

GOALS: Budget $${goals.monthly_budget}/mo, Savings target $${goals.monthly_savings}/mo
Today: ${new Date().toISOString().slice(0, 10)} | Viewing: ${month}`;

  // Static system instructions (cacheable) separate from dynamic financial data
  const systemMessages = [
    {
      type: "text",
      text: `You are a concise personal financial analyst. Use AUD. Be specific with numbers. Keep responses under 300 words. Use **bold** for headings.
You have a monthly summary in your context. For detailed transaction data, use get_month_transactions with the relevant month.
When asked to add/create/log a transaction, use create_transaction.
When asked to set/change budget or savings goals, use update_goals.
When asked to recategorize a transaction, first use get_month_transactions to find the ID, then use recategorize_transaction.
After using a tool, briefly confirm what was done.`,
      cache_control: { type: "ephemeral" },
    },
    {
      type: "text",
      text: financialContext,
    },
  ];

  // Filter messages to only include role and content (strip toolUse etc from frontend)
  const apiMessages = messages.map(m => ({ role: m.role, content: m.content }));

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    let currentMessages = [...apiMessages];
    let continueLoop = true;

    while (continueLoop) {
      continueLoop = false;

      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: systemMessages,
        tools,
        messages: currentMessages,
      });

      // Process response content blocks
      for (const block of response.content) {
        if (block.type === "text") {
          send({ type: "text", text: block.text });
        } else if (block.type === "tool_use") {
          send({ type: "tool_use", name: block.name, input: block.input });

          const result = executeTool(block.name, block.input);
          send({ type: "tool_result", name: block.name, result });

          // Append assistant response and tool result for continuation
          currentMessages.push({ role: "assistant", content: response.content });
          currentMessages.push({
            role: "user",
            content: [{ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) }],
          });

          continueLoop = true;
          break; // Process one tool at a time, then loop back
        }
      }
    }

    send({ type: "done" });
  } catch (err) {
    send({ type: "error", error: err.message });
  }

  res.end();
});

export default router;
