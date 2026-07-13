# Odoo — API & MCP status (reference)

> Verified 2026-06-29 (web). Context: we cloned Odoo **read-only** as a *pattern reference* (`E:\reference code for crm\odoo`) to build our own Supabase CRM — we do **not** run an Odoo instance. This note records the integration surface in case a client runs Odoo, or we ever want to drive a live Odoo from an agent, or as a model for **AltLeads' own future API + MCP**.

## API — mature; fully open on self-hosted Community
Odoo exposes its **entire ORM** (every model incl. `crm.lead`, `res.partner`) over three protocols, all wrapping the same `search_read / create / write / unlink`:
- **XML-RPC** — classic, most docs (`/xmlrpc/2/common`, `/xmlrpc/2/object` → `execute_kw`). Verbose XML.
- **JSON-RPC** — **recommended**; what Odoo's web client uses (`/jsonrpc`). ~40–60% smaller payloads, 100% ORM coverage.
- **REST** — new in Odoo 17+, still **experimental** in 18; basic CRUD only.

⚠️ **Edition nuance:** on Odoo's *hosted SaaS* (odoo.com) external-API access is gated to paid/Custom plans. On **self-hosted Community** (the edition we cloned / would run) the external API is **fully available, no gating**. So for us there is no paywall.

## MCP — multiple working implementations (2026)
Third-party MCP servers wrap Odoo's API into Claude-callable tools (full CRUD via natural language, API-key auth, per-model permissions):
- **`ivnvxd/mcp-server-odoo`** — most-cited, active (Jun 2026), pip `mcp-server-odoo`.
- **Official Odoo "MCP Server" module** (apps.odoo.com) — server-side in Odoo + Python client.
- **MuK MCP Server** — native MCP embedded in Odoo.
- Others: `tuanle96/mcp-odoo`, `ridrisa/Odoo-MCP`.

## What it means for us (decision: note, don't act yet)
We don't need either now — the cloned source + `reference-blueprints/ODOO-BLUEPRINT.md` already give us the patterns. It becomes relevant only if:
1. **A client runs Odoo** → sync via **JSON-RPC** (or drop in `mcp-server-odoo`).
2. We want to **see a feature live** on a throwaway Odoo → the MCP lets an agent poke it (~30 min to wire against a Community instance).
3. As a **model for AltLeads' own API + MCP** (north-star "integrations" phase) — Odoo's surface + these MCP servers are a good template.

Sources: Odoo 18 External API docs; getknit.dev Odoo API guide (2026); github.com/ivnvxd/mcp-server-odoo; apps.odoo.com mcp_server + muk_mcp.
