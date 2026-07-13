# AltLeads CRM API — First-Party Integration Layer (ALT-491)

> Captured 2026-07-02 from Ankit's correction: **"Not Supabase API — CRM API. Another connector won't ask for a Supabase API, they'd ask for the CRM API."** This doc is the spec of record; ALT-491 tracks the build. Status: **PLANNED** (slotted after launch gates: assignment-RLS apply + gateway validation).

## 1. The principle (why not "just use Supabase")
Supabase PostgREST is our **internal implementation detail** — it speaks in raw table names (`lead_report`, `company_master`), exposes our schema, and its contract changes whenever we migrate. An external connector (Zapier/Make, a client's system, a partner tool, our own Chrome extension or mobile app, an AI/MCP agent) must instead get a **first-party, branded, stable API**:

- **Our domain:** `https://crm.altleads.com/api/v1/...` — never a `*.supabase.co` URL.
- **Our objects:** `Lead`, `Company`, `Contact`, `Meeting`, `Task`, `Activity` with friendly field names — never raw tables/columns.
- **Our auth:** per-connector **API keys** (later OAuth) issued/revoked from the Admin panel — never our anon/service keys.
- **Our contract:** versioned (`/v1`), documented, backward-compatible — internal schema can change freely behind it.

## 2. Architecture (thin layer, nothing new to host)
notify-service (Express, already deployed same-origin at crm.altleads.com) gains an `api/v1` router:

```
Connector ──api key──▶ /api/v1/* (notify-service)
                         │  auth: api_key table (hashed) → scope + acts-as user
                         │  mapping: domain object ⇄ table columns (one file)
                         ├─ reads:  service-role client + explicit scope filters
                         └─ writes: REUSE the write-gateway handlers (role allow-list,
                                    actor integrity, import engine) — one write path
```

Key design points:
- **One write path.** API writes go through the same gateway handlers as UI writes — allow-lists, audit stamping, undo batches all inherited for free.
- **Acts-as identity.** Every key maps to a CRM user (or a dedicated "integration" user), so RLS-equivalent scoping + audit (`created_by`) stay truthful.
- **Mapping layer is the contract.** A single `apiSchema.js` declares object→table + field→column + which fields are writable; PostgREST-style leakage is impossible.
- **Rate limiting + request log.** express-rate-limit (already a dependency) + an `api_request_log` table (who, what, when, status) — consistent with the capture-everything posture (pairs with email_log/reassignment_log).

## 3. Endpoints (v1 MVP)
| Method | Path | Notes |
|---|---|---|
| GET | /api/v1/leads · /leads/:id | filter: project, assigned_to, stage, updated_since |
| POST/PATCH | /api/v1/leads | via gateway (create=admin-scope keys only) |
| GET | /api/v1/companies · /contacts · /meetings (+/:id) | same shape |
| POST | /api/v1/leads/:id/activities | log a call/disposition |
| POST | /api/v1/meetings | schedule |
| GET | /api/v1/ping · /api/v1/schema | health + machine-readable object schema |

Admin: `api_key` table (name, hashed key, acts_as_user_id, scopes[], is_active, last_used) + a small Admin-panel tab to issue/revoke.

## 4. MCP server = a CRM-API client
The MCP server (AI agents operating the CRM, incl. me) is a **thin wrapper over this CRM API** — one tool per endpoint group. It gets the same key auth, same scopes, same audit. Build order is therefore: CRM API v1 → MCP server (fast follow, ~1 session).

## 5. Effort & sequencing
- **v1 MVP** (leads/companies/contacts/meetings read + gateway-routed writes + api_key auth + request log): **~1–2 sessions**, dark until mounted; zero prod impact before that.
- **MCP server:** +1 session after v1.
- **Later:** OAuth for third parties, webhooks (pairs with ALT-390 automation events), per-scope field visibility.
- **Gate:** after assignment-RLS apply + gateway validation (both authorized, in flight).

## 6. Explicitly NOT the plan
- Handing any connector a Supabase URL/key of any kind.
- Auto-exposing all tables (PostgREST-style) — only the declared object schema.
