# Amplior Notify Service — Combined Server

This Node/Express server does two things:

1. **Email API** — sends branded HTML emails for Amplior CRM events via Gmail SMTP.
2. **Serves the React web app** — after `npm run build`, the built `web/dist/` files are served as static assets with SPA fallback, so the whole product ships as a single Node.js app.

---

## Directory layout

```
new-code/
  notify-service/   ← THIS server (entry point: server.js)
  web/              ← React + Vite frontend (built to web/dist/)
```

---

## Local development

### Option A — combined (mirrors production)

```bash
# 1. Build the web app once
cd new-code/notify-service
npm run build       # runs: cd ../web && npm install && npm run build

# 2. Start the combined server
npm start           # → http://localhost:8787 serves both the app and the API
```

### Option B — split (faster for frontend iteration)

```bash
# Terminal 1 — notify service
cd new-code/notify-service
npm start           # → http://localhost:8787

# Terminal 2 — Vite dev server
cd new-code/web
VITE_NOTIFY_URL=http://localhost:8787 npm run dev   # → http://localhost:5173
```

In Option B, set `VITE_NOTIFY_URL=http://localhost:8787` in `new-code/web/.env.local` and
set `ALLOWED_ORIGIN=http://localhost:5173` in `new-code/notify-service/.env`.

---

## Environment variables

Copy `.env.example` → `.env` and fill in values. **Never commit `.env`.**

| Variable | Required | Description | Example |
|---|---|---|---|
| `GMAIL_USER` | Yes | Gmail address used as sender | `amplior.ankits@gmail.com` |
| `GMAIL_APP_PASSWORD` | Yes | Gmail App Password (16-char) | `xxxx xxxx xxxx xxxx` |
| `PORT` | No | Port to listen on (default: 8787) | `8787` |
| `ALLOWED_ORIGIN` | No | CORS allowed origin — only needed for split dev setup | `http://localhost:5173` |

---

## API

### GET /health
Returns `{ ok: true, service: "amplior-notify", ts: "<ISO timestamp>" }`.

### POST /notify
```json
{ "event": "lead_assigned", "to": "user@example.com", "data": { "leadName": "...", "company": "...", "assignedByName": "..." } }
```
Returns `{ "ok": true, "id": "<messageId>" }` or `{ "ok": false, "error": "..." }`.

### Supported events
| Event | Required `data` fields |
|---|---|
| `lead_assigned` | `leadName`, `company`, `assignedByName` |
| `lead_reassigned` | `leadName`, `company`, `assignedByName` |
| `meeting_scheduled` | `leadName`, `meetingDate`, `meetingTime`, `mode` |
| `approval_requested` | `leadName`, `leadNumber`, `agentName` |
| `approval_approved` | `leadName`, `leadNumber`, `approvedByName` |
| `approval_rejected` | `leadName`, `leadNumber`, `reason`, `rejectedByName` |

---

## Deploy to Hostinger Node.js App

### Hostinger hPanel configuration

| Setting | Value |
|---|---|
| **Node.js version** | 18 (or higher) |
| **Application root** | `new-code/notify-service` |
| **Startup file** | `server.js` |
| **Build command** | `npm run build` |
| **Start command** | `npm start` (or `node server.js`) |

### Environment variables to set in hPanel

| Variable | Value |
|---|---|
| `GMAIL_USER` | your Gmail address |
| `GMAIL_APP_PASSWORD` | your Gmail App Password |
| `PORT` | (leave unset — Hostinger injects this automatically) |
| `ALLOWED_ORIGIN` | (leave unset — not needed when serving from same origin) |

### Deployment steps

1. In hPanel → **Node.js** → create a new Node.js app.
2. Set **Application root** to `new-code/notify-service` and **Startup file** to `server.js`.
3. Upload the full repo (or push via Git). Exclude `node_modules/` and `.env`.
4. Set the environment variables above in hPanel.
5. In hPanel terminal, run `npm run build` to install web deps and build the React app into `web/dist/`.
6. Run `npm install` inside `new-code/notify-service` to install server deps.
7. Start/restart the Node.js app.
8. Visit your Hostinger app URL — it should load the React web app and all API routes work at the same origin.

### How same-origin works

- The Express server now serves `../web/dist/` as static files.
- Any GET not matching `/health` or `/notify` returns `index.html` (SPA fallback).
- The web app makes API calls to `/notify` (relative URL), which hits the same Express server — no CORS or cross-origin configuration needed in production.
