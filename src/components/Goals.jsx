import { LIGHT, DARK, formatCurrency, getStyles } from "../constants";

export default function Goals({ goals, editGoals, setEditGoals, saveGoals, dark }) {
  const t = dark ? DARK : LIGHT;
  const s = getStyles(dark);

  return (
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
  );
}
