import { useState, useEffect, useCallback } from "react";
import { LIGHT, DARK, MONTHS, apiFetch } from "./constants";
import Dashboard from "./components/Dashboard";
import AddEntry from "./components/AddEntry";
import History from "./components/History";
import Trends from "./components/Trends";
import Goals from "./components/Goals";
import Insights from "./components/Insights";

function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
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
  const [insightsState, setInsightsState] = useState({ text: "", loading: false, error: null, question: "" });

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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching data on month change
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

  const balance = entries.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0)
    - entries.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);

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
    tab: (active) => ({
      flex: 1, padding: "12px 0", border: "none", borderRadius: 12,
      background: active ? (dark ? "#e8e8ea" : "#1a1a1a") : "transparent",
      color: active ? (dark ? "#111113" : "#fff") : t.textSecondary,
      fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase",
      cursor: "pointer", transition: "all 0.2s",
    }),
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
        {[["dashboard","Overview"],["add","+ Add"],["history","History"],["trends","Trends"],["goals","Goals"],["insights","AI"]].map(([v, label]) => (
          <button key={v} style={s.tab(view === v)} onClick={() => { setView(v); if (v !== "history") { setFilterCategory(null); setFilterType(null); } if (v === "goals") setEditGoals({...goals}); if (v === "trends") loadTrends(); }}>
            {label}
          </button>
        ))}
      </div>

      {view === "dashboard" && (
        <Dashboard entries={entries} goals={goals} currentMonth={currentMonth} dark={dark}
          setFilterCategory={setFilterCategory} setFilterType={setFilterType} setView={setView} />
      )}

      {view === "add" && (
        <AddEntry form={form} setForm={setForm} onSubmit={addEntry} dark={dark} />
      )}

      {view === "history" && (
        <History entries={entries} dark={dark} monthLabel={monthLabel}
          filterCategory={filterCategory} setFilterCategory={setFilterCategory}
          filterType={filterType} setFilterType={setFilterType}
          editingId={editingId} setEditingId={setEditingId}
          deleteEntry={deleteEntry} reclassifyEntry={reclassifyEntry} />
      )}

      {view === "trends" && (
        <Trends trendsData={trendsData} trendsCategories={trendsCategories}
          trendsCatFilter={trendsCatFilter} setTrendsCatFilter={setTrendsCatFilter}
          trendsMonthFilter={trendsMonthFilter} setTrendsMonthFilter={setTrendsMonthFilter}
          dark={dark} />
      )}

      {view === "goals" && (
        <Goals goals={goals} editGoals={editGoals} setEditGoals={setEditGoals}
          saveGoals={saveGoals} dark={dark} />
      )}

      {view === "insights" && (
        <Insights currentMonth={currentMonth} monthLabel={monthLabel} dark={dark}
          insightsState={insightsState} setInsightsState={setInsightsState} />
      )}
    </div>
  );
}
