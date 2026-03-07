import { useState } from "react";
import { LIGHT, DARK, getStyles } from "../constants";

export default function Insights({ currentMonth, monthLabel, dark }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const t = dark ? DARK : LIGHT;
  const s = getStyles(dark);

  const analyze = async () => {
    setText("");
    setError(null);
    setLoading(true);
    setDone(false);

    try {
      const res = await fetch(`/api/insights?month=${encodeURIComponent(currentMonth)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "text") {
              setText(prev => prev + data.text);
            } else if (data.type === "error") {
              throw new Error(data.error);
            }
          } catch (e) {
            if (e.message !== "Unexpected end of JSON input") throw e;
          }
        }
      }

      setDone(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={s.card}>
        <p style={s.sectionTitle}>AI Financial Insights</p>
        <p style={{ fontSize: 13, color: t.textSecondary, marginBottom: 16, lineHeight: 1.5 }}>
          Get AI-powered analysis of your spending patterns, budget adherence, and personalised recommendations for {monthLabel}.
        </p>
        <button
          onClick={analyze}
          disabled={loading}
          style={{
            ...s.btn(!loading),
            opacity: loading ? 0.6 : 1,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Analyzing..." : done ? "Re-analyze" : "Analyze My Finances"}
        </button>
      </div>

      {error && (
        <div style={{ ...s.card, borderLeft: "3px solid #e94560" }}>
          <p style={{ fontSize: 13, color: "#e94560", fontWeight: 600, margin: 0 }}>{error}</p>
        </div>
      )}

      {text && (
        <div style={s.card}>
          <div style={{ fontSize: 14, color: t.text, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
            {text.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
              if (part.startsWith("**") && part.endsWith("**")) {
                return <strong key={i} style={{ color: t.strongText }}>{part.slice(2, -2)}</strong>;
              }
              return part;
            })}
            {loading && <span style={{ animation: "blink 1s step-end infinite", color: t.textSecondary }}>|</span>}
          </div>
          <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>
        </div>
      )}
    </div>
  );
}
