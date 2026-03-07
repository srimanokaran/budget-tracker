# Plan: Add AI Financial Insights

## Context
Add a new "Insights" tab that uses Claude Haiku 4.5 to analyse spending patterns, budget adherence, and provide actionable advice. Triggered on-demand (user clicks a button), streams the response in real-time. Estimated cost: ~$0.004/request.

## Step 1: Install Anthropic SDK

- `cd server && npm install @anthropic-ai/sdk`

## Step 2: Add `/api/insights` SSE endpoint in `server/index.js`

Insert after CSV import endpoint, before static file serving.

- Import `Anthropic` from SDK at top of file
- Init client conditionally: `const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({...}) : null`
- `GET /api/insights?month=YYYY-MM` endpoint that:
  1. Gathers context: current month transactions, monthly totals (last 12 months), category trends, goals
  2. Builds a structured text prompt with the data
  3. Streams response via SSE (`text/event-stream`) using `anthropic.messages.stream()`
  4. Each text delta sent as `data: {"type":"text","text":"..."}`, ends with `{"type":"done"}`
- Model: `claude-haiku-4-5-20250401`, max_tokens: 1024
- System prompt: personal financial analyst, structured sections (health summary, spending patterns, budget adherence, category insights, savings, recommendations), under 500 words, AUD currency
- Cap transactions at 50 in prompt, historical data at 12 months

## Step 3: Create `src/components/Insights.jsx`

- Props: `currentMonth`, `monthLabel`, `dark`
- Local state: `text`, `loading`, `error`
- "Analyze My Finances" button triggers fetch
- Uses `fetch()` with streaming `ReadableStream` reader (NOT `EventSource` — because `EventSource` can't send Authorization headers, which breaks basic auth locally)
- Parses SSE lines from the stream, appends text chunks
- Blinking cursor while streaming
- Error card with red accent on failure
- Button text: "Analyzing..." → "Re-analyze" after completion
- Follows existing theme patterns (`getStyles(dark)`, `DARK`/`LIGHT`)

## Step 4: Wire into `BudgetTracker.jsx`

- Import `Insights` component
- Add `["insights", "✨ AI"]` to the tab bar array (after Goals)
- Add view render block: `{view === "insights" && <Insights ... />}`
- No new parent state needed — all insights state is local to component

## Step 5: Deploy

- `fly secrets set ANTHROPIC_API_KEY=sk-ant-...`
- No changes to fly.toml or Dockerfile needed

## Files Modified/Created
| File | Action |
|---|---|
| `server/package.json` | EDIT — add `@anthropic-ai/sdk` |
| `server/index.js` | EDIT — import SDK, init client, add `/api/insights` endpoint |
| `src/components/Insights.jsx` | NEW — streaming AI analysis component |
| `src/BudgetTracker.jsx` | EDIT — add tab + view render |

## Verification
1. `cd server && npm test` — existing tests still pass
2. `npm test` — frontend tests still pass
3. `npm run build` — builds without errors
4. Start server locally with `ANTHROPIC_API_KEY` set, click Insights tab, click Analyze — streaming response appears
