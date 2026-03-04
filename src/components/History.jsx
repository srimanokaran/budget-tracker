import { LIGHT, DARK, CATEGORIES, getStyles } from "../constants";
import { formatCurrency } from "../constants";

export default function History({ entries, dark, monthLabel, filterCategory, setFilterCategory, filterType, setFilterType, editingId, setEditingId, deleteEntry, reclassifyEntry }) {
  const t = dark ? DARK : LIGHT;
  const s = getStyles(dark);

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
}
