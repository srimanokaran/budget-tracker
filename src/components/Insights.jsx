import { useRef, useEffect } from "react";
import { LIGHT, DARK, getStyles } from "../constants";

export default function Insights({ currentMonth, monthLabel, dark, insightsState, setInsightsState, refreshData }) {
  const t = dark ? DARK : LIGHT;
  const s = getStyles(dark);
  const chatEndRef = useRef(null);

  const { messages, loading, error, question } = insightsState;
  const update = (patch) => setInsightsState(prev => ({ ...prev, ...patch }));

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const streamResponse = async (allMessages) => {
    update({ error: null, loading: true });

    // Build API messages (only role + content for the API)
    const apiMessages = allMessages
      .filter(m => m.role === "user" || (m.role === "assistant" && m.content))
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: currentMonth, messages: apiMessages }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedText = "";
      let toolActions = [];
      let didUseTool = false;

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
              accumulatedText += data.text;
              setInsightsState(prev => {
                const msgs = [...prev.messages];
                const last = msgs[msgs.length - 1];
                if (last && last.role === "assistant" && !last.done) {
                  msgs[msgs.length - 1] = { ...last, content: accumulatedText, toolActions: [...toolActions] };
                } else {
                  msgs.push({ role: "assistant", content: accumulatedText, toolActions: [...toolActions], done: false });
                }
                return { ...prev, messages: msgs };
              });
            } else if (data.type === "tool_use") {
              if (data.name !== "get_month_transactions") didUseTool = true;
              toolActions.push({ type: "tool_use", name: data.name, input: data.input });
              setInsightsState(prev => {
                const msgs = [...prev.messages];
                const last = msgs[msgs.length - 1];
                if (last && last.role === "assistant" && !last.done) {
                  msgs[msgs.length - 1] = { ...last, content: accumulatedText, toolActions: [...toolActions] };
                } else {
                  msgs.push({ role: "assistant", content: accumulatedText, toolActions: [...toolActions], done: false });
                }
                return { ...prev, messages: msgs };
              });
              // Reset accumulated text for post-tool response
              accumulatedText = "";
            } else if (data.type === "tool_result") {
              toolActions.push({ type: "tool_result", name: data.name, result: data.result });
              setInsightsState(prev => {
                const msgs = [...prev.messages];
                const last = msgs[msgs.length - 1];
                if (last && last.role === "assistant" && !last.done) {
                  msgs[msgs.length - 1] = { ...last, toolActions: [...toolActions] };
                }
                return { ...prev, messages: msgs };
              });
            } else if (data.type === "error") {
              throw new Error(data.error);
            }
          } catch (e) {
            if (e.message !== "Unexpected end of JSON input") throw e;
          }
        }
      }

      // Mark the assistant message as done
      setInsightsState(prev => {
        const msgs = [...prev.messages];
        const last = msgs[msgs.length - 1];
        if (last && last.role === "assistant") {
          msgs[msgs.length - 1] = { ...last, content: accumulatedText, toolActions: [...toolActions], done: true };
        }
        return { ...prev, messages: msgs, loading: false };
      });

      if (didUseTool && refreshData) refreshData();
    } catch (e) {
      update({ error: e.message, loading: false });
    }
  };

  const askQuestion = () => {
    const q = question.trim();
    if (!q) return;
    const newMessages = [...messages, { role: "user", content: q }];
    update({ question: "", messages: newMessages });
    streamResponse(newMessages);
  };

  const clearChat = () => {
    update({ messages: [], error: null });
  };

  const renderBold = (text) => {
    if (!text) return null;
    return text.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} style={{ color: t.strongText }}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const isReadOnlyTool = (name) => name === "get_month_transactions";

  const toolLabel = (action) => {
    if (action.type === "tool_use") {
      const labels = {
        get_month_transactions: `Looking up ${action.input?.month || "month"}...`,
        create_transaction: "Creating transaction...",
        update_goals: "Updating goals...",
        recategorize_transaction: "Recategorizing...",
      };
      return labels[action.name] || `Running ${action.name}...`;
    }
    if (action.type === "tool_result") {
      if (isReadOnlyTool(action.name)) return `Loaded ${action.result?.month || "data"}`;
      return action.result?.message || "Done";
    }
    return "";
  };

  const toolIcon = (action) => {
    if (action.type === "tool_use") return "\u2699";
    if (action.type === "tool_result") return action.result?.success ? "\u2713" : "\u2717";
    return "";
  };

  return (
    <div>
      <div style={s.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <p style={{ ...s.sectionTitle, margin: 0 }}>AI Financial Assistant</p>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              style={{
                background: "none", border: `1px solid ${t.inputBorder}`, borderRadius: 8,
                fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
                color: t.textSecondary, padding: "4px 10px", cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Chat messages */}
        <div style={{
          maxHeight: 420, overflowY: "auto", marginBottom: 12,
          display: messages.length ? "block" : "none",
        }}>
          {messages.map((msg, i) => (
            <div key={i} style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              marginBottom: 10,
            }}>
              <div style={{
                maxWidth: "85%",
                padding: "10px 14px",
                borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                background: msg.role === "user"
                  ? (dark ? "#333" : "#1a1a1a")
                  : (dark ? "#1c1c1f" : "#f0eeeb"),
                color: msg.role === "user"
                  ? "#fff"
                  : t.text,
                fontSize: 14,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}>
                {msg.role === "assistant" ? (
                  <>
                    {msg.toolActions?.map((action, j) => (
                      <div key={j} style={{
                        padding: "6px 10px",
                        marginBottom: 8,
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        background: action.type === "tool_result"
                          ? (action.result?.success ? (dark ? "#1b3a2d" : "#e6f9f0") : (dark ? "#3a1b1b" : "#fde8ec"))
                          : (dark ? "#2a2a2d" : "#e8e8ea"),
                        color: action.type === "tool_result"
                          ? (action.result?.success ? "#1b998b" : "#e94560")
                          : t.textSecondary,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}>
                        <span style={{ fontSize: 14 }}>{toolIcon(action)}</span>
                        {toolLabel(action)}
                      </div>
                    ))}
                    {renderBold(msg.content)}
                    {loading && i === messages.length - 1 && !msg.done && (
                      <span style={{ animation: "blink 1s step-end infinite", color: t.textSecondary }}>|</span>
                    )}
                  </>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={question}
            onChange={e => update({ question: e.target.value })}
            onKeyDown={e => e.key === "Enter" && !loading && askQuestion()}
            placeholder={messages.length ? "Follow up..." : "e.g. Analyze my spending, Add a $50 grocery expense"}
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

      <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>
    </div>
  );
}
