# Budget Tracker

A personal budget tracking app built with React + Vite and a Node.js/SQLite backend, deployed on Fly.io.

## Local Development

```bash
npm install
npm run dev
```

The backend server (with API and SQLite database):

```bash
cd server
npm install
node index.js
```

## Deployment (Fly.io)

### Prerequisites

Install the Fly CLI: https://fly.io/docs/flyctl/install/

```bash
fly auth login
```

### First-time Setup

```bash
# Create the app (already done — app name is in fly.toml)
fly launch

# Create a persistent volume for the SQLite database
fly volumes create budget_data --region syd --size 1
```

### Secrets

Set required secrets (these are encrypted and injected as environment variables):

```bash
# Google OAuth (required for authentication)
fly secrets set GOOGLE_CLIENT_ID="your-google-client-id"
fly secrets set GOOGLE_CLIENT_SECRET="your-google-client-secret"
fly secrets set ALLOWED_EMAIL="your@email.com"
fly secrets set SESSION_SECRET="a-random-secret-string"
```

Optional secrets:

```bash
# Simple password auth (alternative to Google OAuth)
fly secrets set PASSWORD="your-password"

# Custom CSV import rules (JSON arrays)
fly secrets set CATEGORY_RULES='[{"pattern":"woolworths","category":"Groceries"}]'
fly secrets set SKIP_PATTERNS='["internal transfer"]'
```

To view current secrets (names only, not values):

```bash
fly secrets list
```

### Deploy

```bash
fly deploy
```

### Useful Commands

```bash
# View app status
fly status

# View logs
fly logs

# SSH into the running machine
fly ssh console

# Open the app in browser
fly open

# Scale memory/CPU
fly scale memory 512

# Check volume usage
fly volumes list
```

### Infrastructure Overview

| Resource | Config |
|---|---|
| App name | `sri-budget-tracker` |
| Region | `syd` (Sydney) |
| Internal port | `3000` |
| Volume | `budget_data` mounted at `/app/data` |
| Database | SQLite, stored on the persistent volume |
| Container | Node 20 Alpine, multi-stage Docker build |

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Yes* | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes* | Google OAuth client secret |
| `ALLOWED_EMAIL` | Yes* | Email allowed to log in |
| `SESSION_SECRET` | Yes* | Session encryption key |
| `PASSWORD` | No | Simple password auth (alternative to OAuth) |
| `CATEGORY_RULES` | No | JSON array of `{pattern, category}` for CSV import |
| `SKIP_PATTERNS` | No | JSON array of regex patterns to skip during import |
| `DATA_DIR` | No | Database directory (default: `/app/data`) |
| `PORT` | No | Server port (default: `3000`) |

\* Required when using Google OAuth. If using password auth instead, only `PASSWORD` is needed.
