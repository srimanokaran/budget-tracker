import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { LIGHT, DARK, CATEGORIES, MONTHS, INCOME_COLORS, formatCurrency, getStyles } from "../constants";

export default function Dashboard({ entries, goals, currentMonth, dark, setFilterCategory, setFilterType, setView }) {
  const t = dark ? DARK : LIGHT;
  const s = getStyles(dark);

  const income = entries.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0);
  const expenses = entries.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);
  const balance = income - expenses;
  const savingsRate = income > 0 ? ((balance) / income * 100) : 0;

  const budgetProgress = goals.monthlyBudget > 0 ? Math.min((expenses / goals.monthlyBudget) * 100, 100) : 0;
  const savingsProgress = goals.monthlySavings > 0 ? Math.min((Math.max(balance, 0) / goals.monthlySavings) * 100, 100) : 0;

  const expenseByCategory = CATEGORIES.map(c => ({
    name: c.name,
    value: entries.filter(e => e.type === "expense" && e.category === c.name).reduce((s, e) => s + e.amount, 0),
    color: c.color,
    icon: c.icon,
  })).filter(c => c.value > 0);

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

  const [y, m] = currentMonth.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const dailyData = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dayIncome = entries.filter(e => e.type === "income" && e.date.startsWith(dayStr)).reduce((s, e) => s + e.amount, 0);
    const dayExpenses = entries.filter(e => e.type === "expense" && e.date.startsWith(dayStr)).reduce((s, e) => s + e.amount, 0);
    dailyData.push({ day: d, income: dayIncome, expenses: dayExpenses });
  }

  const monthLabel = `${MONTHS[m - 1]} ${y}`;

  return (
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
  );
}
