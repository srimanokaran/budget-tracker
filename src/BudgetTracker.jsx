import { useState, useEffect, useCallback } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ReferenceLine } from "recharts";

const LIGHT = {
  bg: "#faf9f7", card: "#fff", text: "#1a1a1a", textSecondary: "#999",
  textTertiary: "#aaa", textMuted: "#bbb", textFaint: "#ccc",
  border: "#f5f4f2", inputBg: "#faf9f7", inputBorder: "#eee",
  tabBg: "#f0eeeb", progressBg: "#f0eeeb", cardShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.02)",
  tooltipShadow: "0 4px 20px rgba(0,0,0,0.08)", gridStroke: "#f0eeeb",
  catBtnBg: "#fff", catBtnBorder: "#f0eeeb", catBtnText: "#888",
  inactiveBtn: "#f0eeeb", inactiveBtnText: "#666", deleteBtnColor: "#ddd",
  statsText: "#888", strongText: "#1a1a1a",
};

const DARK = {
  bg: "#111113", card: "#1c1c1f", text: "#e8e8ea", textSecondary: "#777",
  textTertiary: "#666", textMuted: "#555", textFaint: "#444",
  border: "#2a2a2d", inputBg: "#18181b", inputBorder: "#333",
  tabBg: "#1c1c1f", progressBg: "#2a2a2d", cardShadow: "0 1px 3px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.15)",
  tooltipShadow: "0 4px 20px rgba(0,0,0,0.3)", gridStroke: "#2a2a2d",
  catBtnBg: "#1c1c1f", catBtnBorder: "#2a2a2d", catBtnText: "#999",
  inactiveBtn: "#2a2a2d", inactiveBtnText: "#aaa", deleteBtnColor: "#444",
  statsText: "#999", strongText: "#e8e8ea",
};

async function apiFetch(url, options) {
  const res = await fetch(url, options);
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  return res;
}

const CATEGORIES = [
  { name: "Housing", color: "#7c83ff", icon: "🏠" },
  { name: "Groceries", color: "#4ade80", icon: "🛒" },
  { name: "Eating Out", color: "#e94560", icon: "🍔" },
  { name: "Transport", color: "#38bdf8", icon: "🚗" },
  { name: "Subscriptions", color: "#a78bfa", icon: "🔄" },
  { name: "Entertainment", color: "#f59e0b", icon: "🎬" },
  { name: "Shopping", color: "#f472b6", icon: "🛍" },
  { name: "Health", color: "#34d399", icon: "💊" },
  { name: "Savings", color: "#1b998b", icon: "💰" },
  { name: "Other", color: "#94a3b8", icon: "📦" },
];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatCurrency(n) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n);
}

const defaultGoals = { monthlySavings: 2000, monthlyBudget: 6000 };

export default function BudgetTracker() {
  const [entries, setEntries] = useState([]);
  const [goals, setGoals] = useState(defaultGoals);
  const [currentMonth, setCurrentMonth] = useState(getMonthKey());
  const [view, setView] = useState("dashboard");
  const [form, setForm] = useState({ type: "expense", category: "Eating Out", amount: "", description: "" });
  const [loaded, setLoaded] = useState(false);
  const [editGoals, setEditGoals] = useState(null);
  const [fadeIn, setFadeIn] = useState(false);
  const [filterCategory, setFilterCategory] = useState(null);
  const [filterType, setFilterType] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [trendsData, setTrendsData] = useState([]);
  const [trendsCategories, setTrendsCategories] = useState(new Set());
  const [trendsCatFilter, setTrendsCatFilter] = useState(new Set());
  const [trendsMonthFilter, setTrendsMonthFilter] = useState(new Set());
  const [dark, setDark] = useState(false);

  // Load transactions for the current month
  const loadMonth = useCallback(async (month) => {
    try {
      const res = await apiFetch(`/api/transactions?month=${encodeURIComponent(month)}`);
      const rows = await res.json();
      setEntries(rows);
    } catch {}
  }, []);

  const loadTrends = useCallback(async () => {
    try {
      const [trendRes, totalsRes] = await Promise.all([
        apiFetch("/api/transactions/trends"),
        apiFetch("/api/transactions/monthly-totals"),
      ]);
      const rows = await trendRes.json();
      const totalsRows = await totalsRes.json();

      // Build income/expense totals per month
      const monthTotals = {};
      for (const r of totalsRows) {
        if (!monthTotals[r.month]) monthTotals[r.month] = { income: 0, expense: 0 };
        if (r.type === "income") monthTotals[r.month].income += r.total;
        else if (r.type === "expense") monthTotals[r.month].expense += r.total;
      }

      const months = {};
      const cats = new Set();
      for (const r of rows) {
        if (!months[r.month]) months[r.month] = { month: r.month };
        months[r.month][r.category] = r.total;
        cats.add(r.category);
      }

      // Add savings rate to each month
      for (const [month, data] of Object.entries(months)) {
        const t = monthTotals[month];
        if (t && t.income > 0) {
          data["Savings Rate"] = Math.round(((t.income - t.expense) / t.income) * 100);
        } else {
          data["Savings Rate"] = 0;
        }
      }

      const sorted = Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
      setTrendsData(sorted);
      setTrendsCategories(cats);
      setTrendsCatFilter(prev => prev.size === 0 ? cats : prev);
      setTrendsMonthFilter(prev => prev.size === 0 ? new Set(sorted.map(d => d.month)) : prev);
    } catch {}
  }, []);

  // Initial load
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/api/goals");
        const g = await res.json();
        if (g) setGoals(g);
      } catch {}
      try {
        const res = await apiFetch("/api/settings/theme");
        const { value } = await res.json();
        if (value === "dark") setDark(true);
      } catch {}
      await loadMonth(currentMonth);
      setLoaded(true);
      setTimeout(() => setFadeIn(true), 50);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reload when month changes
  useEffect(() => {
    if (loaded) loadMonth(currentMonth);
  }, [currentMonth, loaded, loadMonth]);

  useEffect(() => {
    document.body.style.background = dark ? DARK.bg : LIGHT.bg;
  }, [dark]);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    apiFetch("/api/settings/theme", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: next ? "dark" : "light" }),
    });
  };

  const income = entries.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0);
  const expenses = entries.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);
  const balance = income - expenses;
  const savingsRate = income > 0 ? ((balance) / income * 100) : 0;

  const expenseByCategory = CATEGORIES.map(c => ({
    name: c.name,
    value: entries.filter(e => e.type === "expense" && e.category === c.name).reduce((s, e) => s + e.amount, 0),
    color: c.color,
    icon: c.icon,
  })).filter(c => c.value > 0);

  const INCOME_COLORS = ["#1b998b", "#16a085", "#2ecc71", "#27ae60", "#0f9b8e", "#3498db", "#1abc9c", "#45b7d1"];
  const incomeBySource = (() => {
    const map = {};
    entries.filter(e => e.type === "income").forEach(e => {
      const key = e.description || "Other Income";
      map[key] = (map[key] || 0) + e.amount;
    });
    return Object.entries(map)
      .map(([name, value], i) => ({ name, value, color: INCOME_COLORS[i % INCOME_COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  })();

  // Daily spending for current month
  const [y, m] = currentMonth.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const dailyData = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dayIncome = entries.filter(e => e.type === "income" && e.date.startsWith(dayStr)).reduce((s, e) => s + e.amount, 0);
    const dayExpenses = entries.filter(e => e.type === "expense" && e.date.startsWith(dayStr)).reduce((s, e) => s + e.amount, 0);
    dailyData.push({ day: d, income: dayIncome, expenses: dayExpenses });
  }

  const addEntry = async () => {
    if (!form.amount || isNaN(Number(form.amount))) return;
    const entry = {
      id: Date.now(),
      type: form.type,
      category: form.type === "income" ? "Income" : form.category,
      amount: Number(form.amount),
      description: form.description,
      date: new Date().toISOString(),
      month: currentMonth,
    };
    try {
      await apiFetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      setEntries(prev => [entry, ...prev]);
    } catch {}
    setForm({ type: "expense", category: "Eating Out", amount: "", description: "" });
    setView("dashboard");
  };

  const deleteEntry = async (id) => {
    try {
      await apiFetch(`/api/transactions/${id}`, { method: "DELETE" });
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch {}
  };

  const reclassifyEntry = async (id, newType, category) => {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    // When reclassifying income→expense, negate amount (reimbursement reduces expenses)
    // When reclassifying expense→income, make amount positive
    let newAmount = entry.amount;
    if (entry.type === "income" && newType === "expense") newAmount = -Math.abs(entry.amount);
    else if (entry.type === "expense" && newType === "income") newAmount = Math.abs(entry.amount);
    try {
      await apiFetch(`/api/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: newType, category, amount: newAmount }),
      });
      setEntries(prev => prev.map(e => e.id === id ? { ...e, type: newType, category, amount: newAmount } : e));
      setEditingId(null);
    } catch {}
  };

  const saveGoals = async () => {
    if (editGoals) {
      try {
        await apiFetch("/api/goals", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editGoals),
        });
        setGoals(editGoals);
      } catch {}
      setEditGoals(null);
      setView("dashboard");
    }
  };

  const handleCsvImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const res = await apiFetch("/api/import/csv", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: text,
      });
      const { imported, skipped } = await res.json();
      alert(`Imported ${imported} transactions${skipped ? `, ${skipped} skipped` : ""}`);
      loadMonth(currentMonth);
    } catch {
      alert("Import failed");
    }
    e.target.value = "";
  };

  const budgetProgress = goals.monthlyBudget > 0 ? Math.min((expenses / goals.monthlyBudget) * 100, 100) : 0;
  const savingsProgress = goals.monthlySavings > 0 ? Math.min((Math.max(balance, 0) / goals.monthlySavings) * 100, 100) : 0;

  const navigateMonth = (dir) => {
    const [y, m] = currentMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + dir);
    setCurrentMonth(getMonthKey(d));
  };

  const monthLabel = (() => {
    const [y, m] = currentMonth.split("-").map(Number);
    return `${MONTHS[m - 1]} ${y}`;
  })();

  const t = dark ? DARK : LIGHT;

  if (!loaded) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: t.bg, fontFamily: "'DM Sans', sans-serif" }}>
        <p style={{ color: t.textSecondary, fontSize: 14, letterSpacing: 2, textTransform: "uppercase" }}>Loading...</p>
      </div>
    );
  }

  const s = {
    root: {
      fontFamily: "'DM Sans', sans-serif",
      background: t.bg,
      minHeight: "100vh",
      color: t.text,
      opacity: fadeIn ? 1 : 0,
      transition: "opacity 0.5s ease, background 0.3s ease, color 0.3s ease",
      maxWidth: 800,
      margin: "0 auto",
      padding: "24px 16px 100px",
    },
    header: {
      display: "flex", justifyContent: "space-between", alignItems: "center",
      marginBottom: 28,
    },
    title: {
      fontSize: 11, fontWeight: 700, letterSpacing: 3.5, textTransform: "uppercase", color: t.textSecondary, margin: 0,
    },
    monthNav: {
      display: "flex", alignItems: "center", gap: 16, marginBottom: 32,
    },
    monthBtn: {
      background: "none", border: "none", fontSize: 18, cursor: "pointer", color: t.textSecondary, padding: 4,
    },
    monthLabel: {
      fontSize: 22, fontWeight: 700, letterSpacing: -0.5, color: t.text, minWidth: 120, textAlign: "center",
    },
    card: {
      background: t.card, borderRadius: 16, padding: "20px 22px", marginBottom: 16,
      boxShadow: t.cardShadow,
    },
    statRow: {
      display: "flex", justifyContent: "space-between", gap: 12,
    },
    stat: {
      flex: 1, textAlign: "center",
    },
    statLabel: {
      fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: t.textTertiary, marginBottom: 6,
    },
    statValue: (color) => ({
      fontSize: 22, fontWeight: 800, color: color || t.text, letterSpacing: -0.5,
    }),
    sectionTitle: {
      fontSize: 10, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", color: t.textMuted, marginBottom: 14, marginTop: 8,
    },
    progressBar: (pct, color) => ({
      height: 8, borderRadius: 8, background: t.progressBg,
      position: "relative", overflow: "hidden", marginTop: 8, marginBottom: 4,
    }),
    progressFill: (pct, color) => ({
      height: "100%", borderRadius: 8,
      background: color,
      width: `${Math.min(pct, 100)}%`,
      transition: "width 0.8s cubic-bezier(0.22,1,0.36,1)",
    }),
    tab: (active) => ({
      flex: 1, padding: "12px 0", border: "none", borderRadius: 12,
      background: active ? (dark ? "#e8e8ea" : "#1a1a1a") : "transparent",
      color: active ? (dark ? "#111113" : "#fff") : t.textSecondary,
      fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase",
      cursor: "pointer", transition: "all 0.2s",
    }),
    input: {
      width: "100%", boxSizing: "border-box", padding: "14px 16px", border: `2px solid ${t.inputBorder}`, borderRadius: 12,
      fontSize: 15, fontFamily: "'DM Sans', sans-serif", outline: "none", background: t.inputBg,
      color: t.text, transition: "border-color 0.2s",
    },
    btn: (primary) => ({
      width: "100%", padding: "15px 0", border: "none", borderRadius: 14,
      background: primary ? (dark ? "#e8e8ea" : "#1a1a1a") : t.inactiveBtn,
      color: primary ? (dark ? "#111113" : "#fff") : t.inactiveBtnText,
      fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase",
      cursor: "pointer", transition: "all 0.15s",
    }),
    entryRow: {
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "14px 0", borderBottom: `1px solid ${t.border}`,
    },
  };

  return (
    <div style={s.root}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={s.header}>
        <p style={s.title}>Budget Tracker</p>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input type="file" accept=".csv" id="csv-upload" style={{ display: "none" }} onChange={handleCsvImport} />
          <button onClick={() => document.getElementById("csv-upload").click()} style={{
            background: "none", border: `1px solid ${t.inputBorder}`, fontSize: 11, cursor: "pointer",
            padding: "6px 10px", borderRadius: 8, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
            color: t.textSecondary, fontFamily: "'DM Sans', sans-serif", transition: "color 0.2s",
          }}>Import CSV</button>
          <button onClick={toggleDark} style={{
            background: "none", border: "none", fontSize: 18, cursor: "pointer", padding: 4,
            color: t.textSecondary, transition: "color 0.2s",
          }}>{dark ? "☀️" : "🌙"}</button>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: balance >= 0 ? "#1b998b" : "#e94560" }} />
        </div>
      </div>

      {/* Month Navigation */}
      <div style={s.monthNav}>
        <button style={s.monthBtn} onClick={() => navigateMonth(-1)}>←</button>
        <span style={s.monthLabel}>{monthLabel}</span>
        <button style={s.monthBtn} onClick={() => navigateMonth(1)}>→</button>
      </div>

      {/* Tab Bar */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24, background: t.tabBg, borderRadius: 14, padding: 4 }}>
        {[["dashboard","Overview"],["add","+ Add"],["history","History"],["trends","Trends"],["goals","Goals"]].map(([v, label]) => (
          <button key={v} style={s.tab(view === v)} onClick={() => { setView(v); if (v !== "history") { setFilterCategory(null); setFilterType(null); } if (v === "goals") setEditGoals({...goals}); if (v === "trends") loadTrends(); }}>
            {label}
          </button>
        ))}
      </div>

      {/* =================== DASHBOARD =================== */}
      {view === "dashboard" && (
        <div>
          {/* Summary Stats */}
          <div style={s.card}>
            <div style={s.statRow}>
              <div style={s.stat}>
                <div style={s.statLabel}>Income</div>
                <div style={s.statValue("#1b998b")}>{formatCurrency(income)}</div>
              </div>
              <div style={s.stat}>
                <div style={s.statLabel}>Expenses</div>
                <div style={s.statValue("#e94560")}>{formatCurrency(expenses)}</div>
              </div>
              <div style={s.stat}>
                <div style={s.statLabel}>Balance</div>
                <div style={s.statValue(balance >= 0 ? t.text : "#e94560")}>{formatCurrency(balance)}</div>
              </div>
            </div>
          </div>

          {/* Goal Progress */}
          <div style={s.card}>
            <div style={s.sectionTitle}>Goal Progress</div>
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                <span>Budget Used</span>
                <span style={{ color: budgetProgress >= 90 ? "#e94560" : t.textSecondary }}>{formatCurrency(expenses)} / {formatCurrency(goals.monthlyBudget)}</span>
              </div>
              <div style={s.progressBar(budgetProgress, budgetProgress >= 90 ? "#e94560" : t.text)}>
                <div style={s.progressFill(budgetProgress, budgetProgress >= 90 ? "#e94560" : t.text)} />
              </div>
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>{Math.round(budgetProgress)}% of budget</div>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                <span>Savings Goal</span>
                <span style={{ color: "#1b998b" }}>{formatCurrency(Math.max(balance, 0))} / {formatCurrency(goals.monthlySavings)}</span>
              </div>
              <div style={s.progressBar(savingsProgress, "#1b998b")}>
                <div style={s.progressFill(savingsProgress, "#1b998b")} />
              </div>
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>{Math.round(savingsProgress)}% of savings target</div>
            </div>
          </div>

          {/* Spending Breakdown */}
          {expenseByCategory.length > 0 && (
            <div style={s.card}>
              <div style={s.sectionTitle}>Spending Breakdown</div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 140, height: 140, flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={expenseByCategory} dataKey="value" cx="50%" cy="50%" innerRadius={38} outerRadius={65} paddingAngle={2} strokeWidth={0}>
                        {expenseByCategory.map((c, i) => <Cell key={i} fill={c.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ flex: 1, fontSize: 12 }}>
                  {expenseByCategory.sort((a, b) => b.value - a.value).map((c, i) => (
                    <div key={i} onClick={() => { setFilterCategory(c.name); setFilterType(null); setView("history"); }} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", cursor: "pointer", borderRadius: 6, transition: "background 0.15s" }}
                      onMouseEnter={ev => ev.currentTarget.style.background = t.tabBg}
                      onMouseLeave={ev => ev.currentTarget.style.background = "transparent"}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: c.color, flexShrink: 0 }} />
                        <span style={{ color: t.inactiveBtnText }}>{c.icon} {c.name}</span>
                      </div>
                      <span style={{ fontWeight: 700 }}>{formatCurrency(c.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Income Sources */}
          {incomeBySource.length > 0 && (
            <div style={s.card}>
              <div style={s.sectionTitle}>Income Sources</div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 140, height: 140, flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={incomeBySource} dataKey="value" cx="50%" cy="50%" innerRadius={38} outerRadius={65} paddingAngle={2} strokeWidth={0}>
                        {incomeBySource.map((c, i) => <Cell key={i} fill={c.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ flex: 1, fontSize: 12 }}>
                  {incomeBySource.map((c, i) => (
                    <div key={i} onClick={() => { setFilterType("income"); setFilterCategory(null); setView("history"); }} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", cursor: "pointer", borderRadius: 6, transition: "background 0.15s" }}
                      onMouseEnter={ev => ev.currentTarget.style.background = t.tabBg}
                      onMouseLeave={ev => ev.currentTarget.style.background = "transparent"}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: c.color, flexShrink: 0 }} />
                        <span style={{ color: t.inactiveBtnText, fontSize: 11 }}>{c.name}</span>
                      </div>
                      <span style={{ fontWeight: 700, color: "#1b998b" }}>{formatCurrency(c.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Daily Spending */}
          <div style={s.card}>
            <div style={s.sectionTitle}>Daily — {monthLabel}</div>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData} barGap={1}>
                  <CartesianGrid strokeDasharray="3 3" stroke={t.gridStroke} vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 9, fill: t.textTertiary }} axisLine={false} tickLine={false} interval={4} />
                  <YAxis tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: "none", boxShadow: t.tooltipShadow, fontSize: 12, background: t.card, color: t.text }}
                    labelFormatter={d => `${monthLabel.split(" ")[0]} ${d}`}
                    formatter={(v) => formatCurrency(v)}
                  />
                  <Bar dataKey="income" fill="#1b998b" radius={[3,3,0,0]} />
                  <Bar dataKey="expenses" fill="#e94560" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 8, fontSize: 11, color: t.textTertiary }}>
              <span>● <span style={{ color: "#1b998b" }}>Income</span></span>
              <span>● <span style={{ color: "#e94560" }}>Expenses</span></span>
            </div>
          </div>

          {/* Savings Rate */}
          <div style={s.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={s.sectionTitle}>Savings Rate</div>
                <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1, color: savingsRate >= 20 ? "#1b998b" : savingsRate >= 0 ? "#e07c24" : "#e94560" }}>
                  {savingsRate.toFixed(1)}%
                </div>
              </div>
              <div style={{ fontSize: 11, color: t.textMuted, textAlign: "right", maxWidth: 160, lineHeight: 1.5 }}>
                {savingsRate >= 30 ? "Excellent! Well above target" : savingsRate >= 20 ? "Great, on track" : savingsRate >= 0 ? "Room for improvement" : "Spending exceeds income"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================== ADD ENTRY =================== */}
      {view === "add" && (
        <div style={s.card}>
          <div style={s.sectionTitle}>New Entry</div>

          {/* Type Toggle */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {["income", "expense"].map(tp => (
              <button key={tp} onClick={() => setForm(f => ({ ...f, type: tp }))} style={{
                flex: 1, padding: "12px 0", borderRadius: 10, border: "none",
                background: form.type === tp ? (tp === "income" ? "#1b998b" : "#e94560") : t.inactiveBtn,
                color: form.type === tp ? "#fff" : t.textSecondary,
                fontSize: 13, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer",
                transition: "all 0.2s",
              }}>
                {tp === "income" ? "💵 Income" : "💸 Expense"}
              </button>
            ))}
          </div>

          {/* Category */}
          {form.type === "expense" && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: t.textMuted, display: "block", marginBottom: 8 }}>Category</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {CATEGORIES.map(c => (
                  <button key={c.name} onClick={() => setForm(f => ({ ...f, category: c.name }))} style={{
                    padding: "10px 6px", borderRadius: 10, border: form.category === c.name ? `2px solid ${c.color}` : `2px solid ${t.catBtnBorder}`,
                    background: form.category === c.name ? c.color + "12" : t.catBtnBg,
                    fontSize: 11, fontWeight: 600, cursor: "pointer", textAlign: "center",
                    color: form.category === c.name ? c.color : t.catBtnText,
                    transition: "all 0.15s",
                  }}>
                    {c.icon}<br/>{c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Amount */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: t.textMuted, display: "block", marginBottom: 8 }}>Amount (AUD)</label>
            <input
              type="number"
              placeholder="0"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              style={{ ...s.input, fontSize: 24, fontWeight: 800, textAlign: "center" }}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: t.textMuted, display: "block", marginBottom: 8 }}>Description (optional)</label>
            <input
              type="text"
              placeholder="What was this for?"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              style={s.input}
            />
          </div>

          <button onClick={addEntry} style={s.btn(true)}>Add Entry</button>
        </div>
      )}

      {/* =================== HISTORY =================== */}
      {view === "history" && (() => {
        const filtered = entries.filter(e => {
          if (filterCategory && e.category !== filterCategory) return false;
          if (filterType && e.type !== filterType) return false;
          return true;
        });
        const filterLabel = filterType === "income" ? `Income — ${monthLabel}` : filterCategory ? `${filterCategory} — ${monthLabel}` : `Transactions — ${monthLabel}`;
        const hasFilter = filterCategory || filterType;
        return (
        <div style={s.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={s.sectionTitle}>{filterLabel}</div>
            {hasFilter && (
              <button onClick={() => { setFilterCategory(null); setFilterType(null); }} style={{
                background: "none", border: `1px solid ${t.inputBorder}`, fontSize: 10, cursor: "pointer",
                padding: "4px 8px", borderRadius: 6, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
                color: t.textSecondary, fontFamily: "'DM Sans', sans-serif",
              }}>Clear filter</button>
            )}
          </div>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: t.textFaint, fontSize: 13 }}>
              {hasFilter ? `No ${filterType === "income" ? "income" : filterCategory} transactions this month` : "No entries yet this month"}
            </div>
          ) : (
            filtered.map(e => (
              <div key={e.id}>
                <div style={s.entryRow}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {e.type === "income" ? "💵" : CATEGORIES.find(c => c.name === e.category)?.icon || "📦"}{" "}
                      {e.description || e.category}
                    </div>
                    <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
                      {e.category} · {new Date(e.date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: 15, color: e.type === "income" ? "#1b998b" : e.amount < 0 ? "#1b998b" : "#e94560" }}>
                      {e.type === "income" ? "+" : e.amount < 0 ? "+" : "−"}{formatCurrency(Math.abs(e.amount))}
                    </span>
                    <button onClick={() => setEditingId(editingId === e.id ? null : e.id)} style={{
                      background: "none", border: "none", color: editingId === e.id ? (dark ? "#e8e8ea" : "#1a1a1a") : t.deleteBtnColor, cursor: "pointer", fontSize: 13, padding: 4,
                      transition: "color 0.15s",
                    }}>
                      ✏️
                    </button>
                    <button onClick={() => deleteEntry(e.id)} style={{
                      background: "none", border: "none", color: t.deleteBtnColor, cursor: "pointer", fontSize: 16, padding: 4,
                      transition: "color 0.15s",
                    }} onMouseEnter={ev => ev.target.style.color = "#e94560"} onMouseLeave={ev => ev.target.style.color = t.deleteBtnColor}>
                      ×
                    </button>
                  </div>
                </div>
                {editingId === e.id && (
                  <div style={{ padding: "8px 0 12px", borderBottom: `1px solid ${t.border}` }}>
                    <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                      {["income", "expense"].map(tp => (
                        <button key={tp} onClick={() => {
                          if (tp === "income") reclassifyEntry(e.id, "income", "Income");
                        }} style={{
                          padding: "6px 12px", borderRadius: 8, border: "none", fontSize: 11, fontWeight: 700,
                          letterSpacing: 1, textTransform: "uppercase", cursor: "pointer",
                          background: e.type === tp ? (tp === "income" ? "#1b998b" : "#e94560") : t.inactiveBtn,
                          color: e.type === tp ? "#fff" : t.textSecondary,
                        }}>
                          {tp}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                      {CATEGORIES.map(c => (
                        <button key={c.name} onClick={() => reclassifyEntry(e.id, "expense", c.name)} style={{
                          padding: "8px 4px", borderRadius: 8,
                          border: e.type === "expense" && e.category === c.name ? `2px solid ${c.color}` : `2px solid ${t.catBtnBorder}`,
                          background: e.type === "expense" && e.category === c.name ? c.color + "12" : t.catBtnBg,
                          fontSize: 10, fontWeight: 600, cursor: "pointer", textAlign: "center",
                          color: e.type === "expense" && e.category === c.name ? c.color : t.catBtnText,
                        }}>
                          {c.icon} {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        );
      })()}

      {/* =================== TRENDS =================== */}
      {view === "trends" && (
        <div style={s.card}>
          <div style={s.sectionTitle}>Monthly Spending by Category</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {(() => {
              const allSelected = CATEGORIES.filter(c => trendsCategories.has(c.name)).every(c => trendsCatFilter.has(c.name));
              return (
                <button onClick={() => setTrendsCatFilter(allSelected ? new Set() : new Set(trendsCategories))} style={{
                  padding: "5px 10px", borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: "pointer",
                  border: `2px solid ${t.catBtnBorder}`,
                  background: t.catBtnBg,
                  color: t.catBtnText,
                }}>
                  {allSelected ? "None" : "All"}
                </button>
              );
            })()}
            {CATEGORIES.filter(c => trendsCategories.has(c.name)).map(c => {
              const active = trendsCatFilter.has(c.name);
              return (
                <button key={c.name} onClick={() => setTrendsCatFilter(prev => {
                  const next = new Set(prev);
                  if (active) next.delete(c.name); else next.add(c.name);
                  return next;
                })} style={{
                  padding: "5px 10px", borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: "pointer",
                  border: active ? `2px solid ${c.color}` : `2px solid ${t.catBtnBorder}`,
                  background: active ? c.color + "20" : t.catBtnBg,
                  color: active ? c.color : t.catBtnText,
                }}>
                  {c.icon} {c.name}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {(() => {
              const allMonths = new Set(trendsData.map(d => d.month));
              const allSelected = trendsData.every(d => trendsMonthFilter.has(d.month));
              return (
                <button onClick={() => setTrendsMonthFilter(allSelected ? new Set() : allMonths)} style={{
                  padding: "5px 10px", borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: "pointer",
                  border: `2px solid ${t.catBtnBorder}`,
                  background: t.catBtnBg,
                  color: t.catBtnText,
                }}>
                  {allSelected ? "None" : "All"}
                </button>
              );
            })()}
            {trendsData.map(d => {
              const active = trendsMonthFilter.has(d.month);
              const [y, mo] = d.month.split("-");
              const label = `${MONTHS[Number(mo) - 1]} ${y.slice(2)}`;
              return (
                <button key={d.month} onClick={() => setTrendsMonthFilter(prev => {
                  const next = new Set(prev);
                  if (active) next.delete(d.month); else next.add(d.month);
                  return next;
                })} style={{
                  padding: "5px 10px", borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: "pointer",
                  border: active ? `2px solid ${dark ? "#e8e8ea" : "#1a1a1a"}` : `2px solid ${t.catBtnBorder}`,
                  background: active ? (dark ? "#e8e8ea20" : "#1a1a1a12") : t.catBtnBg,
                  color: active ? t.text : t.catBtnText,
                }}>
                  {label}
                </button>
              );
            })}
          </div>
          {trendsData.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: t.textFaint, fontSize: 13 }}>
              No data yet
            </div>
          ) : (
            <div style={{ height: "60vh" }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendsData.filter(d => trendsMonthFilter.has(d.month))}>
                  <CartesianGrid yAxisId="right" vertical={false} stroke={dark ? "#999" : "#888"} strokeWidth={1} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: t.text, fontWeight: 600 }} axisLine={false} tickLine={false}
                    tickFormatter={m => { const [y, mo] = m.split("-"); return `${MONTHS[Number(mo) - 1]} ${y.slice(2)}`; }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 12, fill: t.text, fontWeight: 600 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: t.text, fontWeight: 600 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} />
                  <ReferenceLine yAxisId="right" y={0} stroke="#e94560" strokeWidth={2} label={{ value: "0%", position: "right", fill: "#e94560", fontSize: 10, fontWeight: 700 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: "none", boxShadow: t.tooltipShadow, fontSize: 12, background: t.card, color: t.text }}
                    labelFormatter={m => { const [y, mo] = m.split("-"); return `${MONTHS[Number(mo) - 1]} ${y}`; }}
                    formatter={(v, name) => name === "Savings Rate" ? `${v}%` : formatCurrency(v)}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  {CATEGORIES.filter(c => trendsCategories.has(c.name) && trendsCatFilter.has(c.name)).map(c => (
                    <Line key={c.name} yAxisId="left" type="monotone" dataKey={c.name} stroke={c.color} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  ))}
                  <Line yAxisId="right" type="monotone" dataKey="Savings Rate" stroke="#1b998b" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* =================== GOALS =================== */}
      {view === "goals" && (
        <div style={s.card}>
          <div style={s.sectionTitle}>Monthly Goals</div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: t.textMuted, display: "block", marginBottom: 8 }}>Monthly Budget Limit (AUD)</label>
            <input
              type="number"
              value={editGoals?.monthlyBudget ?? goals.monthlyBudget}
              onChange={e => setEditGoals(g => ({ ...g, monthlyBudget: Number(e.target.value) }))}
              style={s.input}
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: t.textMuted, display: "block", marginBottom: 8 }}>Monthly Savings Target (AUD)</label>
            <input
              type="number"
              value={editGoals?.monthlySavings ?? goals.monthlySavings}
              onChange={e => setEditGoals(g => ({ ...g, monthlySavings: Number(e.target.value) }))}
              style={s.input}
            />
          </div>
          <button onClick={saveGoals} style={s.btn(true)}>Save Goals</button>

          <div style={{ marginTop: 32 }}>
            <div style={s.sectionTitle}>Quick Stats</div>
            <div style={{ fontSize: 13, color: t.statsText, lineHeight: 2 }}>
              <div>Annual income needed for savings goal: <strong style={{ color: t.strongText }}>{formatCurrency((goals.monthlyBudget + goals.monthlySavings) * 12)}</strong></div>
              <div>Daily spending allowance: <strong style={{ color: t.strongText }}>{formatCurrency(goals.monthlyBudget / 30)}</strong></div>
              <div>Weekly spending allowance: <strong style={{ color: t.strongText }}>{formatCurrency(goals.monthlyBudget / 4.33)}</strong></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
