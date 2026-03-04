import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ReferenceLine } from "recharts";
import { LIGHT, DARK, CATEGORIES, MONTHS, formatCurrency, getStyles } from "../constants";

export default function Trends({ trendsData, trendsCategories, trendsCatFilter, setTrendsCatFilter, trendsMonthFilter, setTrendsMonthFilter, dark }) {
  const t = dark ? DARK : LIGHT;
  const s = getStyles(dark);

  return (
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
  );
}
