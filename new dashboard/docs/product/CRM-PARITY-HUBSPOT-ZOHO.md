# CRM Parity — what HubSpot & Zoho do that we don't (yet)

> Grounded in **real schema**, not guesses. Pulled live from Amplior's own HubSpot
> portal (hubId `9264506`, na2, INR) via the HubSpot MCP on 2026-06-27, plus Zoho's
> published data model. Companion: [BULK-OPS-AUDIT.md](./BULK-OPS-AUDIT.md).

## First — "what the hell is an *object*?" (the thing you asked about)

In HubSpot/Zoho/Salesforce the **entire CRM is built on "objects."** An **object** is a
*type of thing you store records of.* HubSpot's standard objects are **Contacts,
Companies, Deals, Tickets** (+ Activities). Each **record** (one contact, one deal) is
an instance of an object, and every object has typed **properties** (fields).

Three concepts ride on top of objects — and they're exactly what makes those CRMs feel
powerful and what we're missing:

1. **Properties** — typed, admin-defined fields (dropdown, date, number, calculated/rollup,
   required, validated). An admin adds a field **without code**. *(We have fixed DB columns; adding a field = a migration + code.)*
2. **Associations** — typed, **labeled** many-to-many links between objects. Live proof from
   your portal: contacts↔companies came back with labels **`Primary`** and **`Billing Contact`**
   (plus a default link). So one contact can be tied to several companies with *roles*.
   *(We have hard-coded foreign keys — e.g. `lead_report.user_id` — not a flexible graph.)*
3. **Custom objects** — you can define **brand-new** object types (e.g. "Cafeteria Site",
   "Contract"). Your portal has none yet (`get-schemas` → empty) **but the capability is the moat**:
   the data model bends to the business instead of the business bending to the schema.

## The single biggest gap: there is no **Deal / Pipeline / value** object

Live record from your HubSpot: deal **"Alembic Pharmaceuticals Limited"**, `pipeline:"default"`,
`dealstage:"16262505"`, with `amount` + `closedate` fields. **Deals are a first-class object that
move through pipeline stages and carry a money value + close date + forecast.**

**We have none of this.** We have *leads with a status*. For a company whose #2 priority is a
**Sales Portal**, this is the gap that matters most: no pipeline board by value, no weighted
forecast, no win/loss, no "₹ in stage," no quota. Everything sales asks of a CRM starts here.

## Parity matrix — them vs us

| Capability | HubSpot / Zoho | AltLeads today | Gap | Priority |
|---|---|---|---|---|
| **Deals + Pipelines** | Deal object, multiple pipelines, stages, amount, close date, **weighted forecast**, win/loss | Leads + status only | **No value/pipeline/forecast object** | 🔴 P0 (sales portal) |
| **Custom fields (no-code)** | Admin adds any property to any object | Fixed columns; field = migration | No self-serve fields | 🟠 P1 |
| **Custom objects** | Define new object types | 4 fixed entities | Schema can't bend to business | 🟡 P2 |
| **Typed/labeled associations** | Primary company, billing contact, deal↔contact roles, N:N | Hard-coded FKs | No relationship graph/roles | 🟠 P1 |
| **Activities timeline** | Calls/emails/meetings/notes/tasks as first-class engagements on every record | `interaction` log + call logs | Partial — verify richness, unify timeline | 🟠 P1 |
| **Lists / segments** | Active (dynamic, auto-updating) + static lists | Saved filter views (personal) | No dynamic auto-updating segments | 🟡 P2 |
| **Workflows / automation** | Triggered automation (assign, email, task, stage-change) | None (manual) | No automation engine | 🟡 P2 (post-launch) |
| **Bulk import/edit engine** | Mapping wizard, dedup, upsert, partial-success | ❌ (see BULK-OPS-AUDIT) | Foundational for a data team | 🔴 P0 |
| **Duplicate management** | Auto-surface + 1-click merge | Dead code | Unreachable | 🟠 P1 |
| **Reporting / dashboards** | Custom report builder, pipeline/forecast dashboards | Basic | No pipeline/forecast analytics | 🟠 P1 (sales portal) |
| **Record ID on export** | "Record ID" / "<Module> Id" column = import key | ✅ **shipped 2026-06-27** | — | done |
| **Properties: validation/required/calculated** | Yes | No | No field-level rules/rollups | 🟡 P2 |
| **Audit / activity history per record** | Full property-change history | `updated_by`/`updated_date` only | No change history timeline | 🟡 P2 |

## What this means for us (recommended sequence)

The honest read: we don't need to *become* HubSpot. We need the **few objects/concepts that
unlock our roadmap**, in priority order — most are independent of the launch-blocker decisions:

1. **Deals + Pipeline object** (🔴) — the foundation of the **Sales Portal** (priority #2). This is
   net-new schema + UI; **does not depend** on the ownership/RLS fix. The biggest single lever.
2. **Bulk import/edit engine** (🔴) — see BULK-OPS-AUDIT #1; built *with* the ownership fix (DEC-03).
3. **No-code custom fields** (🟠) — a `custom_field` + `custom_field_value` table + admin UI. Lets the
   business add fields without us shipping code. Independent of decisions.
4. **Unified activity timeline + typed associations** (🟠) — make calls/emails/meetings/notes first-class
   on every record; add labeled links (primary company, billing contact). Mostly independent.
5. **Duplicate management** (🟠) — wire the existing (dead) merge code + a duplicate-finder.
6. **Dynamic lists, workflows/automation, report builder** (🟡) — post-launch; high value for retention.

> **Strategic decisions for Ankit** (logged to the Review Hub): (a) Do we adopt a **Deals/Pipeline**
> object now to anchor the Sales Portal? (b) Do we invest in a **no-code custom-field** model, or keep
> fixed columns through launch? Both are roadmap-shaping, not blockers.

## Note on method
HubSpot facts above are from live MCP calls (`get-user-details`, `get-schemas`,
`get-association-definitions contacts→companies`, `list-objects deals`). Zoho facts are from its
published module/field model (no Zoho MCP connected). Where inferred, it's marked. No schema was
guessed from our side — we read theirs.
