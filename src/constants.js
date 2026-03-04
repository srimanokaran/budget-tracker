export const LIGHT = {
  bg: "#faf9f7", card: "#fff", text: "#1a1a1a", textSecondary: "#999",
  textTertiary: "#aaa", textMuted: "#bbb", textFaint: "#ccc",
  border: "#f5f4f2", inputBg: "#faf9f7", inputBorder: "#eee",
  tabBg: "#f0eeeb", progressBg: "#f0eeeb", cardShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.02)",
  tooltipShadow: "0 4px 20px rgba(0,0,0,0.08)", gridStroke: "#f0eeeb",
  catBtnBg: "#fff", catBtnBorder: "#f0eeeb", catBtnText: "#888",
  inactiveBtn: "#f0eeeb", inactiveBtnText: "#666", deleteBtnColor: "#ddd",
  statsText: "#888", strongText: "#1a1a1a",
};

export const DARK = {
  bg: "#111113", card: "#1c1c1f", text: "#e8e8ea", textSecondary: "#777",
  textTertiary: "#666", textMuted: "#555", textFaint: "#444",
  border: "#2a2a2d", inputBg: "#18181b", inputBorder: "#333",
  tabBg: "#1c1c1f", progressBg: "#2a2a2d", cardShadow: "0 1px 3px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.15)",
  tooltipShadow: "0 4px 20px rgba(0,0,0,0.3)", gridStroke: "#2a2a2d",
  catBtnBg: "#1c1c1f", catBtnBorder: "#2a2a2d", catBtnText: "#999",
  inactiveBtn: "#2a2a2d", inactiveBtnText: "#aaa", deleteBtnColor: "#444",
  statsText: "#999", strongText: "#e8e8ea",
};

export const CATEGORIES = [
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

export const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export const INCOME_COLORS = ["#1b998b", "#16a085", "#2ecc71", "#27ae60", "#0f9b8e", "#3498db", "#1abc9c", "#45b7d1"];

export function formatCurrency(n) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n);
}

export async function apiFetch(url, options) {
  const res = await fetch(url, options);
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  return res;
}

export function getStyles(dark) {
  const t = dark ? DARK : LIGHT;
  return {
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
}
