# Amplior CRM — One-Page Product Brief

> Concise context for any teammate (human or sub-agent). Read this before acting; don't re-read the big docs unless you need a specific detail.

## What it is
An **in-house B2B outreach CRM** (TypeScript + React 19/Vite + Supabase) replacing a vendor's Java/MySQL system. Live at **crm.altleads.com** (one Node app on Hostinger, manual git deploy).

## Who uses it
**Amplior** — a B2B lead-generation / appointment-setting agency. Its calling team dials prospects, qualifies them, and books meetings for client companies (e.g. HungerBox). ~111 internal users.
Roles: **Admin, Team Lead, Agent (caller), Sales Head, Sales Person, QC.**

## The core job-to-be-done
- **Agents do OUTREACH and UPDATE records** — call outcomes, status, notes, dispositions, feedback. They do **not** create data (admin bulk-imports it).
- **Sales** attends the meetings Amplior scheduled (they don't outreach).
- **Clients** see a portal (meetings, feedback, recordings per project settings).
- North-star: an **ecosystem** (CRM web + Chrome extension + mobile) that captures everything → powers an AI "superpower" (semantic search, similar-accounts, who-to-target).

## Where we are
Built and live. Internal launch is gated on (a) owner decisions and (b) the **ownership/write-path blocker** — records were bulk-migrated so `created_by` ≠ the real assignee; RLS keyed on the wrong column. Fix the canonical-assignee model first.

**Priority order:** (1) internal reachout → (2) client/sales portal → (3) Chrome extension → (4) market-mapping → (5) AI.

## Non-negotiable constraints
- **Manual deploy.** Commit locally; push to prod ONLY on the owner's explicit "push" (evenings 6pm+/weekends).
- **No DB / RLS / prod-facing change** without owner sign-off + a throwaway-login validation.
- **Never commit secrets** (gitignored `.credentials/`).
- **Ankit = Product Manager** (your primary collaborator — directs the product, makes product/eng decisions). **Mohit = CEO** (business owner, non-technical, *not* building the product — escalate only genuine business-level calls to him). "The owner" in these docs = Ankit (PM) unless it's a business-level decision.
- Capture every decision/requirement in docs immediately — chat is lost; docs + trackers are the durable memory.

## Revenue lens (why this matters)
Today the CRM is internal tooling, but the value compounds three ways: it makes the calling team faster/more accountable (margin), the **client portal** + monthly feedback reports justify and grow client retainers (revenue + retention), and a clean, role-correct, AI-augmented system is **productizable** for other lead-gen agencies later. Evaluate every feature against: *does it win a meeting, retain a client, or save an operator real time?*
