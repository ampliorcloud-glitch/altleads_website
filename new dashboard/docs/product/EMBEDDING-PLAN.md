# AltLeads CRM — Embedding Plan (capture-from-now for RAG)

> **Status:** Plan only. No schema or code changes here. This is the concrete, table-by-table embeddings companion to **`docs/product/AI-PGVECTOR-PLAN.md`** (item **H**). That doc covers the whole RAG product (retrieval flow, Claude models, features); **this doc** narrows to one question: *what exactly do we embed, from which real columns, how, and when* — so the meaning-fingerprints accrue cheaply from day one and we never have to do an expensive, lossy backfill of history we failed to capture.
>
> **The cost asymmetry that drives this plan:** embedding-on-write is ~free and continuous (cents per month at our volume). Backfilling is a one-time, rate-limited, error-prone batch job — and any text we *never stored* (e.g. a disposition note typed and lost, a call outcome never logged) can **never** be embedded later. So the first move is not "build RAG" — it's "**start writing the embeddings now**, behind a flag, on the activity we already capture," so the corpus is ready the moment retrieval is allowed to ship.

---

## 1. WHY — the four things embeddings unlock

Embeddings convert free text into vectors so we can rank by *meaning*, not keywords. Four concrete business capabilities, each mapped to a real query pattern:

| # | Capability | The user-facing question | What embeddings do |
|---|---|---|---|
| 1 | **Reach-out suggestion per contact** | "What should I say / do next with this contact?" | Retrieve this contact's own interaction notes + dispositions + meeting feedback, plus *similar* prior accounts that converted, and hand them to Claude for a next-best-action. The retrieval is what makes the suggestion grounded in real history, not generic. |
| 2 | **Which 100 companies to target this month** | "Build me a target list for this month." | Embed a *seed* — the descriptions/notes of accounts that **converted** (stage = Meeting Successful) — then nearest-neighbour search the company corpus for look-alikes not yet worked. Rank by similarity to the "winning" profile + freshness + not-already-contacted. This is the **similar-accounts** engine pointed at prospecting. |
| 3 | **Semantic dedup / search** | "Find accounts that mentioned a budget freeze" / "is this company already in our DB under a different name?" | Keyword filters already handle exact `domain_clean` / `cin_number` dedup (see `cleanDomain()` in `companies.ts`). Embeddings add the *fuzzy* layer: near-duplicate companies with different spellings, and semantic search across every note. |
| 4 | **Similar accounts / "more like this"** | "Show me accounts like this one." | Same nearest-neighbour primitive as #2, but seeded from a single record on its detail page. Powers cross-sell, territory planning, and "who else fits this client's profile." |

All four ride **one** primitive: *embed text → nearest-neighbour search scoped to what the user may see → (optionally) Claude synthesizes*. Build the embedding pipeline once; point different seeds/prompts at it.

---

## 2. WHAT to embed — table-by-table, grounded in the REAL schema

The data model is verified from `new-code/web/src/data/*.ts` and `docs/amplior_backup.sql`. We embed **human-written free text** only; identifiers, enums, FKs, dates and money stay in SQL `WHERE` clauses (and in the embedding row's `metadata` for filtering).

### 2.1 Tier 1 — interaction / activity layer (HIGHEST value, embed FIRST)

This is the richest, fastest-growing, hardest-to-backfill text. It is also the layer most aligned with the **outreach-only north-star** (the team *updates* records — every update is a fresh note).

| Source | Real columns to embed | Text representation (what we actually embed) | Scope columns available |
|---|---|---|---|
| **`interaction`** (the unified activity store — written by `logCallInteraction()` / `appendInteraction()` / `logDisposition()`) | `disposition`, `note_text` | `"[<type> on <occurred_at> · <record_type> #<record_id>] Disposition: <disposition>. Note: <note_text>"` | `project_id`, `owner_user_id`, `created_by`, `record_type`, `record_id`, `occurred_at` |
| **`meeting_master`** — agenda + post-meeting writeup | `description` (agenda), `agent_feedback`, `reason` | One chunk per non-empty field, prefixed `"[Meeting <meeting_name> · <meeting_date>] Agenda/Feedback/Reason: <text>"` | resolve `project_id` + `owner_user_id` via `meeting_schedule → lead_report` (`user_id`, `lead_id → lead_master.project_id`) |
| **`feedback_answer`** — the post-meeting Q&A (the 7 sales-feedback questions) | `feed_ans` (joined to `feedback_question_master.feed_que`) | `"[Meeting feedback] Q: <feed_que> A: <feed_ans>"` — *include the question*, an answer alone is meaningless | via `meeting_id → meeting_schedule → lead_report` |
| **`pre_sales_answer`** — per-domain pre-sales qualification answers | `answer` (joined to `pre_sales_question.short_question`/`question`) | `"[Pre-sales] Q: <question> A: <answer>"` | via `report_id → lead_report` (`user_id`, `lead_id → project_id`) |

> **Note on `call_log`:** `callLogs.ts` is explicit that `public.call_log` is *staged and not applied in production* — live call dispositions land in **`interaction`**. So embed `interaction`, **not** `call_log`. If `call_log` is ever applied, fold it in the same way (its `note` field).

### 2.2 Tier 2 — descriptive / opportunity layer

| Source | Real columns | Text representation |
|---|---|---|
| **`lead_master`** opportunity text | `title`, `description`, `role_and_resp`, `area_of_interest` | `"Opportunity: <title>. <description>. Contact role: <role_and_resp>. Interest: <area_of_interest>."` |
| **`lead_report`** | `sales_intelligence`, `report_status` (free-text) | `"[Sales intelligence] <sales_intelligence>"` |
| **`company_master`** | `description` | `"[Company description] <description>"` (only when non-empty — most rows are blank today) |

### 2.3 Tier 3 — core records (embed a COMPOSED summary, one chunk, never split)

These have little free text but we still want them searchable for the "similar accounts / target-list" features. Compose one descriptive string per record from the meaningful fields and embed that. **Never `SELECT *`** — an allowlist of these columns only.

| Record | Composed string (the embedded text) | Source columns |
|---|---|---|
| **Company** | `"<company_name> — industry <industry>; city <city>; size <company_size>; turnover <turnover_band>; sector <sector>. <description>"` | `company_master` + `industry_master` + `city_master` + `turnover_master` + `company_sector` |
| **Contact** | `"<full_name> — <designation> at <company_name>; <city>. Role: <role_and_resp>."` | `contact_master` (+ joined company/city) |
| **Lead / deal** | `"<lead_name> (<lead_number>) at <company-or-client>; industry <industry>; <city>; source <source>; stage <stage>. <opportunity text from 2.2>."` | `lead_master` + `client_association` + lookups + latest `lead_report` stage |

### 2.4 NEVER embed (allowlist enforced)

- **Secrets:** the legacy plaintext `user_master.password` and its `_audit` copy; any token/API-key/password field. The embed job runs on a hard-coded **column allowlist**, never `SELECT *`.
- **PII for matching, not meaning:** raw `email`, `mobile_no`, `alt_mobile_no`, `linkedin_url` (these are exact-match dedup keys handled by `find_contact_dup` / `cleanDomain`, not semantic targets). They go in `metadata` if needed for filtering, not in the embedded text.
- **Structured/enum/numeric:** stage ids, status enums, all `*_id` FKs, dates, `value`/money — these are SQL filters and `metadata`, never embedded.

### 2.5 Rough corpus size & chunking

Volumes from the data layers (orders of magnitude; verify against live counts before backfill):

| Layer | Approx rows | Chunks | Notes |
|---|---|---|---|
| `interaction` (call/disposition/status notes) | growing, low thousands and climbing daily | ~1 each | the fast-growing layer; **this is why capture-now matters** |
| `meeting_master` text fields | ~600 meetings × up to 3 fields | ~1–3 each | |
| `feedback_answer` | ~1,400+ live rows (per `buildMeetingExportRows` comment) | 1 each | |
| `pre_sales_answer` | hundreds | 1 each | |
| leads / companies / contacts (composed) | ~600 leads, company + contact master | 1 each | |

**Chunking:** nearly everything is a short field → **one chunk, no splitting**. Only the rare long pasted transcript (a long `note_text` / `agent_feedback`) splits into ~500–800-token chunks with ~10–15% overlap on sentence boundaries, sharing `record_id` with a `chunk_index` in `metadata`. Prepend the light context prefix shown in the tables (so a chunk retrieved alone still says who/what it's about), but store the *clean* text in `chunk_text`.

---

## 3. HOW — pgvector, model, table, pipeline, retrieval, RLS

### 3.1 Provider & model choice

Anthropic's API generates text only — **Claude cannot make embeddings**. Use a dedicated embeddings provider; store vectors in Supabase pgvector.

| Option | Dims → column | Cost (approx, per 1M tokens) | When to pick |
|---|---|---|---|
| **Voyage AI `voyage-3` / `voyage-3.5`** *(recommended)* | 1024 → `vector(1024)` | ~$0.06–0.12 | Anthropic's officially recommended embeddings partner; strong retrieval quality; cheap. **Default.** |
| **Voyage `voyage-3-lite` / `voyage-3.5-lite`** | 512–1024 | ~$0.02 | For the highest-volume `interaction` text if we ever want to shave cost further. |
| **OpenAI `text-embedding-3-small`** | 1536 → `vector(1536)` | ~$0.02 | Alternative if a Voyage key is harder to procure; widely available. |
| **OpenAI `text-embedding-3-large`** | 3072 | ~$0.13 | Highest OpenAI quality; larger column, more storage/index cost. |

**Rule:** pin **one model + one dimension** for the whole `embeddings` table. Mixing models/dims makes distances meaningless. Keep `embedding_model` in `metadata` so a future switch is a deliberate full re-embed, not silent corruption. **The query must be embedded by the same model that embedded the content.** DDL below assumes `voyage-3` (1024).

### 3.2 Token & cost estimate (deliberately tiny)

Assume the full Tier 1–3 corpus is generous: ~10,000 chunks × ~150 tokens avg ≈ **1.5M tokens** of content.

- **One-time backfill:** 1.5M tokens × ~$0.08/1M ≈ **$0.12** (twelve cents). Round up wildly for re-runs/overlap → still **well under $1**.
- **Ongoing on-write:** new activity is the only cost. Even at a few thousand new notes/month (~0.5M tokens) → **a few cents/month**.
- **Query embedding:** each search embeds one short query (~20 tokens) → **negligible**.
- **Storage:** 10k × `vector(1024)` ≈ 10k × 4KB ≈ **~40 MB** + HNSW index — trivial in Supabase.

**Net:** embeddings are effectively free at our scale. The real cost in the AI roadmap is the *Claude generation* step (see AI-PGVECTOR-PLAN §3.4), not embeddings. So there is **no cost reason** to delay capture — only the privacy gate (§5).

### 3.3 The `embeddings` table (DDL — for reference; do not apply yet)

```sql
create extension if not exists vector;

create table public.embeddings (
  id            bigint generated always as identity primary key,
  record_type   text         not null,   -- 'interaction' | 'meeting_feedback' | 'meeting_text' |
                                          -- 'pre_sales' | 'lead' | 'company' | 'contact'
  record_id     bigint       not null,   -- PK of the source row (bigint — matches this schema)
  source_table  text         not null,   -- exact table the row came from (audit / re-embed)
  project_id    bigint,                  -- scope; nullable ONLY where source genuinely has none
  owner_user_id bigint,                  -- scope: the assigned user (lead_report.user_id / created_by)
  created_by    text,                    -- user_id-as-text (matches lead_master/interaction convention)
  chunk_text    text         not null,   -- the CLEAN text that was embedded
  embedding     vector(1024) not null,   -- voyage-3 = 1024
  metadata      jsonb        not null default '{}'::jsonb,
                                          -- { embedding_model, content_hash, chunk_index,
                                          --   source_updated_at, occurred_at, stage, ... }
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now(),
  unique (record_type, record_id, (metadata->>'chunk_index'))
);

create index embeddings_embedding_hnsw
  on public.embeddings using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

create index embeddings_scope on public.embeddings (project_id, owner_user_id);
create index embeddings_record on public.embeddings (record_type, record_id);
```

- **HNSW, not IVFFlat** — our corpus is small and *trickle-inserted* all day; HNSW handles incremental inserts with no training step or periodic rebuild. (Revisit only past ~1M rows — nowhere near for a single-org CRM.)
- **`content_hash` in `metadata`** is the dedup key: re-embed only when the embedded text actually changed; a status flip or reassignment that doesn't touch the text never costs an embed.
- **bigint keys** match this schema (`lead_id`, `meeting_id`, `interaction_id` are all bigint) — note this differs from the `uuid` placeholder in the older AI-PGVECTOR-PLAN DDL; **bigint is correct for these tables.**

### 3.4 Embed-on-write pipeline (capture from NOW)

```
 source write (interaction / meeting / feedback / lead / company / contact)
        │  AFTER INSERT/UPDATE trigger
        ▼
 embed_queue row (record_type, record_id, source_table)   ← cheap, in-transaction, no HTTP
        │  drained by a worker in the existing Node service (notify-service)
        ▼
 worker: load allowlisted text → compose string → content_hash
        │   if hash unchanged vs metadata → SKIP (no API call)
        ▼
 Voyage embed (batched, rate-limited)  →  upsert embeddings row(s)  (service-role key, server-side)
```

- **Trigger enqueues; it does NOT call the API.** The trigger only writes a queue row — never blocks the user's write on a third-party HTTP call.
- **Worker lives in the existing Node service** (`new-code/notify-service/server.js`, Node 22.x) — already deployed, already holds server-only secrets, already has an env path on Hostinger. Add a Voyage key + a drain endpoint/loop. No new infrastructure. (A Supabase Edge Function is a fine *later* alternative for event-driven embedding; start with Node to avoid spreading ops surface.)
- **Incremental:** `content_hash` gate means edits that don't change embedded text are free; on a real text change, delete the record's child chunks then re-insert.
- **Nightly reconciliation** (`pg_cron` → worker) re-enqueues any source row whose `updated_date`/hash drifted from its embedding — catches jobs dropped by a transient failure.

### 3.5 One-time backfill job

A standalone, **idempotent/resumable** script sibling to `new-code/migration/*` (same conventions):

- Pages every Tier 1–3 source with `.range()` (PostgREST 1000-row cap — the existing data layers already do this).
- Composes the same text strings as the on-write path (share the compose functions so backfill and live stay byte-identical).
- Embeds in **batches**, respecting Voyage rate limits; **skips rows already up-to-date** by `content_hash`.
- Logs `embedded / skipped / failed` counts, exactly like the existing migration appliers.
- Run **once, off-hours, after the index exists and after fine-grained RLS is verified** (§5). Scoped per project so a failure is resumable.

### 3.6 Retrieval / query patterns

All three capabilities are one SQL shape — vector order + scope `WHERE`, run under the **user's JWT** so RLS applies:

```sql
-- "similar accounts" / target-list / semantic search
select record_type, record_id, chunk_text,
       1 - (embedding <=> $1) as similarity     -- $1 = query/seed embedding
from public.embeddings
where ($2 is null or project_id = $2)            -- project scope
  and record_type = any($3)                      -- e.g. {'company'} for target lists
  -- RLS adds the owner/role predicate automatically
order by embedding <=> $1
limit 20;
```

- **Reach-out suggestion (per contact):** seed = embed a short prompt OR reuse the contact's own composed vector; retrieve top-k of that contact's `interaction`/`feedback` chunks + nearest *converted* leads → feed to Claude (Sonnet) for next-best-action.
- **Which-100-companies:** seed = centroid (or each) of *converted* leads' company vectors; nearest-neighbour over `record_type='company'`, exclude already-worked (`metadata`/SQL join), order by similarity, take 100.
- **Semantic search / dedup:** embed the query string; same scan; for dedup, also restrict to `record_type='company'` and surface high-similarity pairs.
- Tune recall at query time with `set hnsw.ef_search = 40;` (raise for accuracy, lower for speed). Cap top-k (5–20) so prompts and cost stay bounded.

### 3.7 RLS for vectors (the non-negotiable)

- Stamp `project_id` / `owner_user_id` / `created_by` on **every** embedding row at write time, copied from the source row. A row that can't be scoped is not inserted (or is inserted with a deliberately project-wide flag for genuinely org-wide records — **never** relax `project_id` silently).
- **RLS on `embeddings` mirrors its source table's policy** — keyed to the caller's claims (ADMIN all; managers team-scope; AGENT/SALES_PERSON restricted to their `created_by`/assigned `user_id`, per project), identical to the planned fine-grained model.
- **Reads go through the authenticated Supabase client (user JWT), never the service-role key** — so the same RLS that protects `lead_master`/`interaction` constrains the vector scan. The **write** job uses service-role (it must write the vector column); the **read/retrieval** path never does. Keep that boundary strict.
- App code still passes the scope predicate explicitly; RLS is the safety net so a buggy query can't turn the HNSW index into a cross-owner side-channel.

---

## 4. WHEN — phased, gated behind security/launch

Build the capture pipeline early (cheap, reversible) but **ship no retrieval feature until fine-grained RLS is verified.** Each phase is independently shippable and reversible (flag off, or drop the index/column).

- **Phase 0 — Capture-now (start ASAP, behind a flag, internal only).** Add the `vector` extension, the `embeddings` table + HNSW index, the `embed_queue`, the on-write triggers, and the Node worker — wired to **`interaction`** first (highest-value, fastest-growing). Embeddings begin accruing immediately so the corpus exists when retrieval is allowed. *No user-facing feature, no retrieval, so no privacy exposure beyond storing vectors of text the writer already owns.*
- **Phase 1 — Widen capture to all Tier 1–3 sources.** Add triggers + compose functions for `meeting_master`/`feedback_answer`/`pre_sales_answer`, then leads/companies/contacts. Still capture-only.
- **Phase 2 — Backfill (after fine-grained RLS is DONE + verified).** Run the idempotent backfill off-hours; re-verify that a non-admin JWT retrieves **only** permitted rows on real data. **This is the hard gate** — no retrieval feature ships before it.
- **Phase 3 — Retrieval features, behind a flag, ADMIN/internal first.** Light up in value/difficulty order: **semantic search** + **similar-accounts** (pure retrieval, no Claude) → **which-100-companies target list** → **per-contact reach-out suggestion** (retrieval + Claude). Watch cost and scoping.
- **Phase 4 — Roll out to all roles + passive intelligence.** Only after Phase 3 confirms scoping holds under fine-grained RLS. Add async/cached lead-scoring + sentiment. Optionally move embedding to a trigger-driven Edge Function if the Node path ever bottlenecks.

> **Hard gate (restating AI-PGVECTOR-PLAN §5):** Phase 0–1 *capture* may start early because it stores only vectors of text the writer already owns and exposes nothing. But **no retrieval/AI feature and no backfill of cross-owner data ships until fine-grained per-role RLS is finished and adversarially verified** (roadmap item **G**). Retrieval privacy *relies entirely* on those policies.

---

## 5. Referenced files
- AI/RAG product plan (this doc's parent): `docs/product/AI-PGVECTOR-PLAN.md`
- Activity store + writers (embed first): `new-code/web/src/data/activityTimeline.ts`, `new-code/web/src/data/callLogs.ts`, `new-code/web/src/data/contacts.ts` (`logCallInteraction`)
- Meetings + feedback + pre-sales: `new-code/web/src/data/meetings.ts`
- Leads / companies / contacts (composed-record sources + dedup): `new-code/web/src/data/realLeads.ts`, `new-code/web/src/data/companies.ts` (`cleanDomain`), `new-code/web/src/data/contacts.ts`
- Legacy schema (column names/volumes): `docs/amplior_backup.sql`
- Embedding/worker runtime: `new-code/notify-service/server.js`
- Backfill script home (sibling): `new-code/migration/`
</content>
</invoke>
