import { LIGHT, DARK, CATEGORIES, getStyles } from "../constants";

export default function AddEntry({ form, setForm, onSubmit, dark }) {
  const t = dark ? DARK : LIGHT;
  const s = getStyles(dark);

  return (
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

      <button onClick={onSubmit} style={s.btn(true)}>Add Entry</button>
    </div>
  );
}
