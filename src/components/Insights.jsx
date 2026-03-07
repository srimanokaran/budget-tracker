import { LIGHT, DARK, getStyles } from "../constants";

export default function Insights({ currentMonth, monthLabel, dark, insightsState, setInsightsState }) {
  const t = dark ? DARK : LIGHT;
  const s = getStyles(dark);

  const { text, loading, error, question } = insightsState;
  const update = (patch) => setInsightsState(prev => ({ ...prev, ...patch }));

  const streamResponse = async (url) => {
    update({ text: "", error: null, loading: true });

    try {
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

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
              accumulated += data.text;
              setInsightsState(prev => ({ ...prev, text: accumulated }));
            } else if (data.type === "error") {
              throw new Error(data.error);
            }
          } catch (e) {
            if (e.message !== "Unexpected end of JSON input") throw e;
          }
        }
      }

      update({ loading: false });
    } catch (e) {
      update({ error: e.message, loading: false });
    }
  };

  const askQuestion = () => {
    const q = question.trim();
    if (!q) return;
    update({ question: "" });
    streamResponse(`/api/insights?month=${encodeURIComponent(currentMonth)}&question=${encodeURIComponent(q)}`);
  };

  return (
    <div>
      <div style={s.card}>
        <p style={s.sectionTitle}>AI Financial Insights</p>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={question}
            onChange={e => update({ question: e.target.value })}
            onKeyDown={e => e.key === "Enter" && !loading && askQuestion()}
            placeholder="e.g. Analyze my spending, How can I save more?"
            disabled={loading}
            style={{ ...s.input, flex: 1, opacity: loading ? 0.6 : 1 }}
          />
          <button
            onClick={askQuestion}
            disabled={!question.trim() || loading}
            style={{
              ...s.btn(!!question.trim() && !loading),
              width: "auto",
              padding: "14px 20px",
              opacity: question.trim() && !loading ? 1 : 0.5,
              cursor: question.trim() && !loading ? "pointer" : "not-allowed",
            }}
          >
            {loading ? "..." : "Ask"}
          </button>
        </div>
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
