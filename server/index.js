import express from "express";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { db } from "./db.js";
import { setupAuth } from "./auth.js";
import transactionsRouter from "./routes/transactions.js";
import goalsRouter from "./routes/goals.js";
import settingsRouter from "./routes/settings.js";
import importRouter from "./routes/import.js";
import insightsRouter from "./routes/insights.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const DIST_DIR = join(__dirname, "..", "dist");

const app = express();
app.set("trust proxy", 1);

// Auth (must be before routes)
setupAuth(app);

// Body parsing
app.use(express.json());
app.use(express.text({ type: "text/plain", limit: "5mb" }));

// API routes
app.use("/api/transactions", transactionsRouter);
app.use("/api/goals", goalsRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/import", importRouter);
app.use("/api/insights", insightsRouter);

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
