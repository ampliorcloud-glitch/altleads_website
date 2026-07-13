# Automation Event Spine — Architecture & Roadmap

> **Status: v0 RAILS ONLY — no automations active.** The infrastructure (outbox
> table + worker skeleton + feature flag table) is laid. Zero behaviour changes to
> the running service. No handlers registered. Worker off by default.
>
> Companion docs: `docs/product/FOUNDATION-BUILD-PLAN.md` (Block 1 / Block 2),
> `PLATFORM-DISCOVERY.md` (§4 event-spine vision).
> Implementation: `new-code/migration/apply-event-outbox.cjs`,
> `new-code/notify-service/src/eventBus.js`.

---

## 1. Why an event spine?

Domain writes in AltLeads (reassign a lead, mark DNC, change stage) today produce
side-effects synchronously and in-process: insert a bell row here, fire an SMTP send
there, update a denorm field. This is fine for one-off notifications, but it has a
structural problem: **the domain write and the side-effect are coupled**. A slow SMTP
call makes the API response slow; a failed bell insert can silently roll back a user's
real action (or the reverse: the action lands but the notification doesn't); adding a
new automation means editing every hot-path handler.

The **transactional outbox pattern** breaks this coupling cleanly:

1. Domain write succeeds (e.g. `lead.stage_changed`).
2. In the same logical flow, a row is inserted into `event_outbox` — small, cheap,
   same service-role client, no extra network hop.
3. A background worker (running in the same process, off by default) polls the
   outbox, claims rows, dispatches them to registered handlers, and marks them done.
4. Side effects (bell, email, Slack, automation rule) live entirely in the worker —
   zero coupling to the hot path.

**Why a DB table and not an in-process queue?** Because a DB row survives a process
crash, a deploy, an OOM. An in-memory queue loses everything on restart. The outbox
is also observable: you can query `event_outbox` for pending/failed rows in a SQL
console without any special tooling.

---

## 2. The outbox table

```sql
public.event_outbox (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type     text        NOT NULL,     -- 'lead.stage_changed', 'lead.dnc_marked', …
  aggregate_type text        NOT NULL,     -- 'lead', 'contact', 'company', 'task'
  aggregate_id   bigint      NOT NULL,     -- PK of the affected entity
  payload        jsonb       NOT NULL DEFAULT '{}',
  actor_user_id  bigint,                  -- server-derived; NULL for system events
  created_at     timestamptz NOT NULL DEFAULT now(),
  processed_at   timestamptz,
  attempts       integer     NOT NULL DEFAULT 0,
  status         text        NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','processing','done','failed')),
  error          text
)
```

**RLS:** DENY ALL for `anon` + `authenticated`. Only the service-role client (which
bypasses RLS) may read or write. No app-tier user ever touches this table directly.

**Indexes:**

| Index | Purpose |
|---|---|
| `(status, created_at) WHERE status='pending'` | Primary worker poll query — extremely fast |
| `(aggregate_type, aggregate_id)` | Audit: all events for a given entity |
| `(actor_user_id) WHERE actor_user_id IS NOT NULL` | Who caused these events? |
| `(created_at) WHERE status='failed'` | Ops: drill into failed rows |

---

## 3. The feature_flag table

```sql
public.feature_flag (
  flag_name   text PRIMARY KEY,
  enabled     boolean NOT NULL DEFAULT false,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now()
)
```

This is the **canonical** flag table for the entire platform (Block 1, §0 of
`FOUNDATION-BUILD-PLAN.md`). Every other block reads it — **do NOT create a second
flag table**. RLS: authenticated users may SELECT (fail-closed reader); only ADMIN
may write.

Seeded flags (all `false` at migration time):

| Flag | Unlocks |
|---|---|
| `outbox_worker` | The event-outbox background worker (primary kill switch) |
| `outbox_email` | Route email side-effects through the outbox drain |
| `outbox_bell` | Route in-app bell inserts through the outbox drain |
| `event_spine_reads` | Read `fetchActivity`/`fetchCallLogs` from `public.event` (Block 2) |
| `metadata_registry` | Metadata-registry endpoints (Block 3) |
| `call_log_live` | Live call-log capture table (Block 4) |
| `api_v2` | Versioned `/api/v2/*` routes (Block 1-E) |
| `identity_resolution` | Identity-resolution enrichment pass (Block 5) |

Flip a flag: `UPDATE public.feature_flag SET enabled=true WHERE flag_name='outbox_worker';`
(admin role only, or via service-role in a migration/script).

---

## 4. emitEvent() — the write side

```js
const { emitEvent } = require('./src/eventBus');

// Call this INSIDE a write-gateway action handler, after the domain write succeeds.
await emitEvent(admin, {
  eventType:     'lead.stage_changed',
  aggregateType: 'lead',
  aggregateId:   leadId,
  payload:       { previousStage: 'Contacted', newStage: 'Won', note: 'confirmed budget' },
  actorUserId:   actor.userId,    // always server-derived, never from client
});
```

**Failure contract:** `emitEvent` is best-effort. If the insert fails (table missing,
network blip), it logs and returns — it never throws and never causes the surrounding
transaction to roll back. The domain write already landed.

**Where to call it:** The natural home is in the action handlers in
`new-code/notify-service/src/writeGateway.js`, immediately after each successful
`admin.from(…).update/insert`. The write-gateway already has the service-role client
and the server-derived actor, so no extra plumbing is needed. Example:

```js
// writeGateway.js — inside 'lead.reassign' handler, after the .update() succeeds:
await emitEvent(admin, {
  eventType:     'lead.reassigned',
  aggregateType: 'lead',
  aggregateId:   lead_report_id,
  payload:       { previousUserId: oldUserId, newUserId: new_user_id },
  actorUserId:   actor.userId,
});
```

ALT-431 (the write-gateway itself, already built) is precisely the right chokepoint:
every write that goes through it can emit an event with two lines.

---

## 5. Worker lifecycle

```
server.js start
  └─ startOutboxWorker(supabaseAdmin)   ← no-op unless ENABLE_OUTBOX_WORKER=true
       │
       ├── (off) process.env.ENABLE_OUTBOX_WORKER !== 'true'  → return, nothing starts
       │
       └── (on) starts a setInterval every OUTBOX_POLL_INTERVAL_MS (default 15 s)
                  │
                  └── safeRunWorkerTick(admin)
                        │ re-entrancy guard (workerInFlight flag)
                        └── runWorkerTick(admin)
                              1. SELECT pending rows ORDER BY created_at LIMIT CLAIM_BATCH_SIZE
                              2. For each row:
                                 a. UPDATE status='processing' WHERE status='pending' (atomic claim)
                                 b. Look up HANDLERS[event_type]
                                    → no handler: mark 'done', log warning
                                    → handler found: call handler(admin, row)
                                       ✓ success: mark 'done', set processed_at
                                       ✗ throws: attempts++
                                          attempts < MAX_ATTEMPTS → reset to 'pending' (retry)
                                          attempts ≥ MAX_ATTEMPTS → mark 'failed' (permanent)
```

**Environment variables:**

| Variable | Default | Effect |
|---|---|---|
| `ENABLE_OUTBOX_WORKER` | `(unset)` | Must be exactly `'true'` to start the worker |
| `OUTBOX_POLL_INTERVAL_MS` | `15000` | How often to poll for pending rows (ms) |
| `OUTBOX_MAX_ATTEMPTS` | `5` | Attempts before a row is permanently failed |
| `OUTBOX_BATCH_SIZE` | `20` | Max rows claimed per tick |

The worker uses the same service-role Supabase client (`getSupabaseAdmin()`) as the
rest of the notify-service. It runs in-process — no separate Node process, no OS
cron. One process, one tick at a time (re-entrancy guard mirrors the task scanner).

---

## 6. How to add a handler (v1 automation)

When the first real automation ships (e.g. "notify TL on stage=Won"), the pattern is:

1. **Register the event_type** in `emitEvent` call sites in `writeGateway.js` (or
   wherever the domain write happens). No schema change needed — `event_type` is free
   text.

2. **Write the handler** in a new file, e.g.
   `new-code/notify-service/src/handlers/leadStageChanged.js`:

   ```js
   'use strict';
   module.exports = async function handleLeadStageChanged(admin, row) {
     const { aggregate_id, payload, actor_user_id } = row;
     if (payload.newStage !== 'Won') return; // ignore other transitions
     // … look up TL, insert in_app_notification, send email …
   };
   ```

3. **Register it** in `eventBus.js` (or in a bootstrap file called from server.js):

   ```js
   const { HANDLERS } = require('./src/eventBus');
   HANDLERS['lead.stage_changed'] = require('./src/handlers/leadStageChanged');
   ```

4. **Flip the worker on** by setting `ENABLE_OUTBOX_WORKER=true` in the
   notify-service `.env` / Dokploy environment variables.

5. **Test on crm-test.altleads.com** before flipping on production.

That's it. No changes to existing routes, no schema changes, no web-app changes.

---

## 7. Relationship to ALT-431 (write-gateway)

`writeGateway.js` (ALT-431) is already the authoritative chokepoint for all domain
writes. It:
- Verifies the Supabase JWT
- Resolves the actor profile server-side (never trusts the client)
- Checks role/allow-list
- Dispatches to action handlers

This makes it the **ideal** place to call `emitEvent` — every actor, every action,
and the service-role admin client are already in scope. A future session adding a
handler needs only to:
1. Add the `await emitEvent(...)` call at the end of an existing action handler.
2. Register a worker handler for the new event_type.

---

## 8. Roadmap

| Phase | What | Status |
|---|---|---|
| v0 — Rails | `event_outbox` table, `feature_flag` table, `emitEvent()`, worker skeleton. Migration staged (not applied). Worker off by default. | **This deliverable** |
| v0.1 — Wire into gatekeeper | Add `await emitEvent(...)` calls to the 3 live action handlers in `writeGateway.js` (`lead.reassign`, `record.markDnc`, `record.setFeasibility`). | Next step after migration is applied |
| v1 — First automation | "Notify TL when a lead is Won": handler in `handlers/leadStageChanged.js`, register, flip `ENABLE_OUTBOX_WORKER=true` on crm-test, validate, ship to prod. | After v0.1 |
| v2 — Stage-gate UI | Admin screen to view pending/failed outbox rows + flag toggle UI (no SQL console needed). | After v1 |
| v3 — Rule engine | `automation_rule` table (`event_type`, `condition_jsonb`, `action_type`, `action_config`, `is_enabled`). Worker dispatches to a rule evaluator instead of hard-coded handlers. | After stable v1 |

---

*Doc created: 2026-06-28. Owner: Ankit (PM). Decisions: any new automation must be
flagged off at merge, enabled separately after crm-test validation.*
