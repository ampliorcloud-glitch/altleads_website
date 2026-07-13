# AltLeads CRM — AI / pgvector Plan

> **Status:** Plan only. This is roadmap item **H** — the *last* major item, gated behind web go-live and security hardening (fine-grained RLS). No embedding of real data and no AI feature ships until those gates are cleared. See §5.

---

## 1. Executive summary (plain language for the owner)

Today, every note, call log, disposition, and comment in AltLeads lives in the database as text you can only find if you remember the exact words. The AI layer changes that. It lets you and your team **ask questions about your accounts in plain English and get answers in seconds** — answers built from your own activity history, not from the open internet.

Two technologies do this together:

- **Embeddings** turn your written notes into a kind of "meaning fingerprint" so the system can find related activity even when the words don't match. Search for *"accounts that mentioned a budget freeze"* and it surfaces the right accounts even if a rep wrote *"they paused spend until Q3."* This is **semantic search** — search by meaning, not keywords.
- **RAG** (Retrieval-Augmented Generation) is the pattern of: find the most relevant notes for your question (**retrieve**), then have Claude read only those notes and write the answer (**generate**). Because Claude only ever sees the handful of notes we hand it — and only notes the asking user is already allowed to see — answers are grounded in your real data and stay inside each user's permissions.

**What this gives the business:**

- **Ask about an account and get the story instantly.** "What's going on with Acme?" returns a short narrative — where it stands, recent activity, what's open — instead of you scrolling through months of notes.
- **Smarter, faster follow-ups.** A "next best action" suggestion ("send the proposal — they asked twice and went quiet") so reps spend time acting, not deciding what to do.
- **Spot momentum and risk without reading everything.** Lead scores (Hot / Warm / Cold) and sentiment markers ("this account is cooling off") surface from the notes automatically.
- **Manager visibility.** A "what did my team do this week" digest, scoped to exactly what that manager is allowed to see.

**On the models — so the record is accurate:**

- **Claude writes the answers.** We use three Claude models and pick the cheapest one that does each job well: **Claude Haiku 4.5** (cheap/fast, for routine high-volume work like sentiment and scoring), **Claude Sonnet 4.6** (the workhorse, for summaries and next-best-action), and **Claude Opus 4.8** (the most capable, reserved for the hardest multi-account reasoning).
- **Claude does not make embeddings.** Anthropic's API only generates text — it has no embeddings endpoint. So for the "meaning fingerprints" we use a **dedicated embeddings provider, Voyage AI** (the partner Anthropic itself recommends), and store the results in our existing Supabase database using its **pgvector** extension. One provider for embeddings, one (Claude) for writing answers.

**Cost posture:** the whole capability is designed to be near-zero ongoing cost — we embed text once when it's written (not on every page view), cache results, and read the cache for free. Cost scales with *new writing*, not with how often people read or how big the database gets.

---

## 2. Data & embedding strategy

### 2.1 What we embed

Embed the unstructured, human-written text where meaning matters — not the structured columns we already filter with plain SQL.

**Tier 1 — interaction / activity layer (highest value):**
- Activity & interaction notes (call notes, meeting notes, free-text logs)
- Dispositions / outcomes and disposition comments
- Per-project notes attached to a contact or company (the running commentary a rep keeps inside a specific project)

**Tier 2 — descriptive layer:**
- Contact per-project description & comments
- Company per-project description & comments

**Tier 3 — core records (embed a composed summary, not raw rows):**
- Lead, contact, and company core records — concatenate the meaningful fields into one descriptive string (e.g. `"<name> — <title> at <company>; industry <x>; <city/region>; tags: …"`) and embed that. Pure identifiers, foreign keys, enums, dates, and numerics are **not** embedded — they live in `metadata` and are queried with normal `WHERE` clauses.

**Never embed:** emails/phones/IDs, status enums, timestamps, money fields — and, critically, **secrets**: the known legacy plaintext `user_master.password` column and its `_audit` copy, plus any password/token/API-key fields. The embedding job runs on an **allowlist** of text columns, never `SELECT *`.

### 2.2 Chunking strategy

- **Short fields** (most notes, dispositions, descriptions, comments — under ~500 tokens): embed as a single chunk. No splitting.
- **Long free-text** (rare long notes / pasted transcripts): split into ~500–800 token chunks with ~10–15% overlap, on sentence/paragraph boundaries (never mid-sentence). Each chunk becomes its own `embeddings` row sharing the same `record_id` and a `chunk_index` in `metadata`.
- **Core records:** one composed string → one chunk. Never split.
- Prepend a light context prefix to each chunk before embedding (e.g. `"[Company: Acme | Project: Q3 Outbound] "`) so a chunk retrieved in isolation still carries who/what it belongs to. Store the *clean* text in `chunk_text`; be consistent about whether the embedded text is the clean or prefixed version.

### 2.3 Provider & dimensions

**Anthropic has no native embeddings API** — the Messages API is the only Claude surface, and Claude cannot produce vectors. Use a dedicated embeddings provider and store the vectors in Supabase pgvector:

- **Recommended: Voyage AI** — the embeddings provider Anthropic officially recommends. `voyage-3` outputs **1024-dim** vectors → `vector(1024)`. `voyage-3-lite` is a cheaper/faster option for high-volume activity text.
- **Alternative: OpenAI `text-embedding-3-small` (1536-dim)** → `vector(1536)`, or `text-embedding-3-large` (3072-dim).

Pin **one model + one dimension per table** — mixing dimensions or models in one column makes distances meaningless. Keep an `embedding_model` value in `metadata` so a future switch is a deliberate re-embed, not silent corruption. **The same model that embeds stored content must embed the query** — never mix. The DDL below assumes `voyage-3` (1024).

### 2.4 pgvector schema (DDL)

```sql
create extension if not exists vector;

create table public.embeddings (
  id            bigint generated always as identity primary key,
  record_type   text         not null,        -- 'activity_note' | 'disposition' |
                                               -- 'contact_project_note' | 'company_project_note' |
                                               -- 'lead' | 'contact' | 'company'
  record_id     uuid         not null,         -- FK to the source row
  project_id    uuid         not null,         -- scope (see §2.6) — NOT NULL on purpose
  owner_user_id uuid         not null,         -- scope (see §2.6)
  chunk_text    text         not null,         -- the text that was embedded (clean)
  embedding     vector(1024) not null,         -- voyage-3 = 1024 dims
  metadata      jsonb        not null default '{}'::jsonb,  -- chunk_index, embedding_model, content_hash, source_updated_at, tags, …
  created_at    timestamptz  not null default now()
);

-- ANN index for cosine similarity (voyage/openai vectors → cosine)
create index embeddings_embedding_hnsw
  on public.embeddings
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- Scope + dedup filters that run alongside the vector search
create index embeddings_project_owner
  on public.embeddings (project_id, owner_user_id);
create index embeddings_record
  on public.embeddings (record_type, record_id);
```

**Index choice — HNSW, not IVFFlat.** Our corpus is small and *incremental* — a few hundred leads, ~600 meetings, plus a growing interaction log, with new rows arriving a handful at a time all day. IVFFlat assumes a large, relatively static dataset you periodically reindex; at our row counts its clustering isn't even well-trained and recall suffers, and it must be rebuilt as data drifts. HNSW handles trickle inserts gracefully, needs no per-row tuning, no training step, and its only downsides (build time and memory) are irrelevant at our scale. **Decision rule:** stay on HNSW unless embedded rows ever pass ~1M *and* build cost becomes a problem — we are nowhere near that for a single-org CRM. Match `*_ops` to the distance you query with (`vector_cosine_ops` ↔ `<=>`); tune recall at query time with `set hnsw.ef_search = 40;` (raise for accuracy, lower for speed).

### 2.5 When to embed

**Primary — on write, asynchronously.** A trigger (`AFTER INSERT/UPDATE`) on each source table enqueues a job; a worker drains the queue, calls Voyage, then upserts the `embeddings` row(s). Do **not** call the embedding API synchronously inside the trigger — that would block the write and couple the transaction to a third-party HTTP call.

**Incremental, not re-embed-everything.** Store a **content hash** (or `source_updated_at`) in `metadata`. Re-embed only when the embedded text actually changed — trivial edits (status flips, reassignments) never trigger a re-embed because the embedded text didn't change. Delete child chunks before re-inserting on update.

**Secondary — nightly reconciliation.** A scheduled sweep (`pg_cron` → worker) catches rows whose source changed but whose embedding job was dropped by a transient failure. This is reconciliation, not the main path.

**One-time backfill.** A standalone, **idempotent/resumable** script pages through existing Tier 1–3 rows (respecting the PostgREST 1000-row cap with `.range()`, as prior migration work already had to), embeds in **batches** (respecting Voyage rate limits), writes vectors + content hash, and **skips rows already up to date**. Run once, off-hours, against the live DB after the index exists, scoped per project so a failure is resumable. Log counts (embedded / skipped / failed) the way the existing migration reports do. After backfill, the on-write path keeps everything current — no recurring batch job needed.

### 2.6 Scoping — RAG must never cross projects or owners

This is a hard requirement, enforced at two layers, and it is the foundation of the whole privacy model (§4).

1. **Carry scope on every row.** `project_id` and `owner_user_id` are stamped at write time from the source record and are `NOT NULL`. A row that can't be scoped is never inserted.
2. **Filter inside the query, every time.** Retrieval always applies the scope predicate together with the vector search — pgvector combines the `WHERE` with the ANN scan:

```sql
select id, record_type, record_id, chunk_text,
       1 - (embedding <=> $1) as similarity   -- $1 = query embedding
from public.embeddings
where project_id = $2                          -- never crosses projects
  and owner_user_id = $3                       -- never crosses owners
order by embedding <=> $1
limit 8;
```

3. **Belt-and-suspenders: Supabase RLS.** Row Level Security on `embeddings` mirrors its source table's policy — keying `project_id` / `owner_user_id` to the caller's claims — so even a buggy query can't leak across tenants/owners. Application code still passes scope explicitly; RLS is the safety net, not the primary filter. (If some records are project-wide rather than per-owner, relax the *owner* predicate only for those `record_type`s — **never** relax `project_id`.)

---

## 3. Retrieval & features (phased)

Every feature is the same underlying machine: **embed the query → retrieve top-k scoped chunks → synthesize with Claude.** We build that machine once and point different prompts at it.

### 3.1 The RAG flow

```
                    ┌─────────────────────────────────────────────┐
   User question ──▶│ 1. Embed the query (Voyage embedding model)  │
                    └───────────────────┬─────────────────────────┘
                                        │ query vector
                    ┌───────────────────▼─────────────────────────┐
                    │ 2. pgvector similarity search                │
                    │    SCOPED by the app's visibility rules      │
                    │    (WHERE = projects/owners this user may     │
                    │     see) + recency / entity-type filters     │
                    └───────────────────┬─────────────────────────┘
                                        │ top-k chunks (activity, notes,
                                        │ meetings, composed records)
                    ┌───────────────────▼─────────────────────────┐
                    │ 3. Claude synthesizes the answer             │
                    │    (model chosen per feature — see §3.4)     │
                    └───────────────────┬─────────────────────────┘
                                        │
                                   Answer + citations back to the UI
```

- **Step 1 — Embed the query.** Voyage turns the short query into a vector. Only the query is embedded at request time; all stored content was embedded once at write time.
- **Step 2 — Scoped similarity search.** This is the critical security step. Retrieval reuses the *exact same visibility rules the app already enforces* — there is **one source of truth** for "can this user see this row," and retrieval calls it rather than re-implementing it. Scoping happens *before* anything reaches Claude, so the model physically never sees out-of-scope data. Cheap pre-filters (entity type, recency window, account/contact id) ride alongside the visibility predicate.
- **Step 3 — Claude synthesizes.** Retrieved chunks go to Claude with a task-specific prompt; Claude answers *only* from the supplied chunks and cites which activity each claim came from.

### 3.2 The feature wishlist, mapped

| Feature | The user asks | What it does |
|---|---|---|
| **Account summary** | "What's the story with this account?" | One-paragraph narrative: where it stands, recent activity, open items, momentum. |
| **Next-best-action** | "What should I do next here?" | A concrete recommended next step (call, follow-up, send proposal) with the reason. |
| **Lead scoring** | (passive badge) | A 0–100 score + tier (Hot / Warm / Cold) estimating likelihood to convert. |
| **Sentiment** | (passive inline) | Per-activity and rolled-up sentiment (positive / neutral / negative / at-risk). |
| **Semantic search** | "Find accounts that mentioned a budget freeze" | Search across activity by meaning, ranked, with the matching snippet highlighted. |
| **Team activity digest** | "What did my team do this week?" | A synthesized weekly summary, scoped to what the manager may see. |

### 3.3 Where derived values get stored

- **Embeddings:** written on activity create/update, stored in pgvector; backfilled once.
- **Derived values (score, sentiment):** computed asynchronously (off the request path) and cached on the record so badges render instantly with **no live LLM call**. Recompute on new activity. Keep the LLM doing the fuzzy part (extraction) and the math in code, so scores are explainable and cheap.
- **Summaries / digests:** generated on demand, optionally cached for a short TTL so repeat opens are free. Cache keyed on the source row + content hash, invalidated when the row changes.

### 3.4 Which Claude model for which job

Pick the cheapest model that does the job well; reserve the expensive model for genuinely hard synthesis. All three share the same Messages API. (Pricing per 1M tokens, input / output — verified against the current model catalog.)

| Model | Model ID | Input / Output | Context | Use it for |
|---|---|---|---|---|
| **Claude Haiku 4.5** | `claude-haiku-4-5` | $1 / $5 | 200K | High-volume, routine, structured calls: **per-activity sentiment**, **lead-score feature extraction**, embedding-time tagging, classification. Runs on every activity — must be cheap and fast. |
| **Claude Sonnet 4.6** | `claude-sonnet-4-6` | $3 / $15 | 1M | **The default.** Account/contact summaries, next-best-action, weekly team digests. Strong synthesis at sensible cost — carries most of the product. |
| **Claude Opus 4.8** | `claude-opus-4-8` | $5 / $25 | 1M | The hardest synthesis only: multi-account reasoning, "why is this deal stalling across these 6 threads," cross-entity narratives over large retrieved context. Highest quality, highest cost — use deliberately, not by default. |

**Guidance:**
- **Start everything on Sonnet 4.6.** Move a feature down to **Haiku** only after confirming it's a routine call Haiku handles well (sentiment, scoring inputs). Promote a feature up to **Opus 4.8** only when you can see Sonnet falling short on real data.
- Use **prompt caching** on the stable parts of each prompt (instructions + schema are identical across calls; only the retrieved chunks vary) to cut cost materially on the summary and digest features.
- **Cap retrieval:** top-k (K = 5–10) with a similarity threshold, so prompts stay short and token cost stays bounded regardless of corpus size.

### 3.5 In-CRM UX surfaces

- **Account-summary panel** — on the Company and Contact detail pages: a compact card with the narrative summary, a next-best-action line, the lead-score badge, a "regenerate" affordance, and inline citations (each claim links to the source activity). The flagship surface; built first.
- **Semantic search box** — global natural-language search ("accounts that mentioned a budget freeze") returning ranked records with the matching snippet highlighted. Scoped to the user's visibility exactly like every other retrieval; complementary to existing keyword filters.
- **Lead-score badges** — Hot / Warm / Cold + number pills on list rows, the wishlist, and detail headers. Rendered from the cached score (no live LLM call); hover shows the top 2–3 factors.
- **Sentiment indicators** — subtle per-activity markers in the timeline and a rolled-up account sentiment trend ("this account is cooling off") without the user reading every note.
- **Team digest** — a "This week" view and/or an emailed weekly summary, running the digest prompt over the manager's visible team activity.

---

## 4. Cost / ops / privacy + rollout posture

### 4.1 Keeping cost low

The feature is designed for near-zero ongoing cost. Levers, in priority order:

1. **Only embed text that matters** (§2.1) — never `SELECT *`; structured filtering stays in SQL/PostgREST.
2. **Incremental embedding** (§2.5) — embed once, re-embed only when the content hash changes.
3. **Cheap embedding model** — Voyage `voyage-3` / `voyage-3-lite`; embeddings are already the cheap part of the stack.
4. **Haiku for routine generation, escalate only when needed** (§3.4) — route by task, never default to expensive.
5. **Cache aggressively** — embedding cache (content-hash) so we never pay to embed the same text twice; answer/result cache for summaries and "similar leads," invalidated on row change. Repeated opens of the same detail page cost nothing.
6. **Cap retrieval** (§3.4) — bounded top-k keeps prompts short.

**Net effect:** cost scales with *new writing*, not with reads, page views, or corpus size.

### 4.2 Privacy (the gating concern)

This CRM holds real customer/sales data and has legacy plaintext-password columns. Rules:

- **Retrieval inherits the app's visibility model — no wider.** Vector results are scoped to exactly the same per-project + ownership boundary the user sees in the UI: filter on `project_id` and on `created_by = the user's user_id` for owner-scoped roles (AGENT / SALES_PERSON), with ADMIN/managers seeing the wider set — identical to the planned fine-grained RLS model. A vector index must never become a side-channel that returns snippets from leads a user can't open.
- **Enforce at the database, via RLS — not only in app code.** Run similarity queries through the **authenticated Supabase client (user's JWT)** so the same RLS policies that protect `lead_master` / `interaction` constrain the vector search. Combine vector ordering with the normal `WHERE`/RLS filter. **Do not run retrieval with the service-role key** (it bypasses RLS). The `embeddings` table carries the same `project_id` / `created_by` columns onto each row and gets RLS mirroring its source table, so an HNSW scan can't leak across tenants/owners.
- **Never embed secrets or credentials.** Allowlist of text columns only; explicitly exclude `user_master.password`, its `_audit` copy, and any token/API-key/PII fields. Same for what we send to the LLM — retrieved snippets are visibility-filtered first.
- **Minimise what leaves Supabase.** Only allowlisted text goes to the embedding/LLM provider — no raw rows, no unnecessary internal IDs, no full tables. Keep all provider API keys server-side, never in the React bundle / `VITE_*`.
- **Write vs read boundary:** the embedding *write* job uses the service-role key server-side (it must write the vector column); all *read/retrieval* goes through the user's authenticated client under RLS. Keep that boundary strict.

### 4.3 Ops — where it runs, and backfill

**Where embedding & generation run:** in the **existing Node service** — the Express app already deployed to Hostinger as the combined web + notify service (`new-code/notify-service/server.js`, Node 22.x), not new infrastructure. It already runs server-side, already holds server-only secrets safely, and already has a deploy + env-var path on Hostinger. Adding a Voyage key, a Claude key, and a couple of endpoints there is the lowest-overhead option and keeps provider keys out of the browser.

- **Recommended split:** keep synchronous/on-write embedding and all generation (Claude calls) in the Node service to start. A **Supabase Edge Function** is the reasonable alternative specifically for *event-driven* embedding (DB trigger on insert/update → function embeds just that row) — it sits close to the DB and scales to zero, at the cost of a second runtime/deploy target and another place to manage secrets. Start with Node to avoid spreading ops surface; add the Edge Function later only if the on-write path becomes a bottleneck.
- **Backfill script:** a standalone, idempotent/resumable script sibling to the existing `new-code/migration/*` scripts (see §2.5). Run once, off-hours, rate-limited; log embedded/skipped/failed counts.

---

## 5. Phased rollout — explicitly AFTER web go-live + security hardening

This is the **last** roadmap item (item **H**), with two hard prerequisites that must already be **DONE**:

1. **Web app go-live is complete and stable.** (The app is already live at crm.altleads.com — so AI work does not block, and is not blocked by, the core product shipping.)
2. **Security hardening — fine-grained per-role RLS — is finished and verified.** Current state is RLS *baseline* (authenticated-only, on all 69/70 tables). The planned **fine-grained per-role policies** (ADMIN all; managers team-scope; AGENT/SALES_PERSON restricted to `created_by = own user_id`, per-project) and the IDOR audit (roadmap item **G**) **must land and be adversarially verified first.** Reason: retrieval privacy in §4.2 *relies entirely* on those policies being correct. Building vector retrieval on top of loose RLS would bake the leak in.

> **Hard gate:** No embedding of real data and no retrieval feature ships until fine-grained RLS is verified.

### Ordered phases

Build the retrieval machine once, then light up features in order of value and difficulty. Each phase is independently shippable and reversible (feature flag off, or drop the index/column), so AI can be paused at any point without affecting the live CRM.

- **Phase A — Schema & index (no data yet).** Add the `vector` extension, the `embeddings` table, RLS mirroring its source tables, and the HNSW index. Pure DDL — ships with the security-hardening pass or just after it. No cost, no privacy exposure (no vectors yet).

- **Phase B — Embedding pipeline, one source table.** Wire the on-write embedding path in the Node service for a single high-value table (`interaction`). Cheap embedding model + content-hash cache. Verify writes and RLS scoping on that one table before widening.

- **Phase C — Backfill.** Run the idempotent backfill for that table, off-hours, rate-limited. Confirm row counts and that retrieval under a non-admin JWT returns **only** permitted rows (privacy gate re-verified on real data).

- **Phase D — First read feature, behind a flag, on Haiku.** Ship one user-visible feature (e.g. "similar leads" or a lead-history summary) to ADMIN/internal users only, via a feature flag, generating with Haiku and capped top-k. Watch cost and output quality. (Then bring up the flagship **Account summary** on Sonnet 4.6 and **Semantic search** on the same retrieval path — these two prove embedding, scoped retrieval, and synthesis end to end.)

- **Phase E — Widen sources + roll out to all roles.** Extend embedding to lead / meeting / wishlist notes (Tier 1–3), then enable features for all roles — only after Phase D confirms both the privacy scoping (under fine-grained RLS) and the cost profile hold. Add the passive-intelligence layer here: **lead scoring** (Haiku extraction + code scoring) and **sentiment** (Haiku per-activity, rolled up), both async/cached so they never touch the request path.

- **Phase F — Proactive + heavy synthesis (optional / later).** **Next-best-action** in the summary panel (Sonnet 4.6, reusing the retrieved context) and the **"what did my team do this week"** digest (Sonnet 4.6, scoped to the manager's visible team). Selectively promote any feature to **Opus 4.8** where real-world output quality demands it. Optionally move embedding to a **trigger-driven Supabase Edge Function** if the Node on-write path becomes a bottleneck — optimisation only, not required for launch.

**The non-negotiable in every phase:** retrieval is scoped by the app's existing visibility rules before any data reaches Claude.

---

### Referenced files
- Node service (embedding + generation runtime): `c:\Users\pc\OneDrive - Amplior\Desktop\AL\new-code\notify-service\server.js`
- Migration scripts (sibling location for the backfill script): `c:\Users\pc\OneDrive - Amplior\Desktop\AL\new-code\migration\`

---

## Parking Lot — Future AI ideas (captured, NOT scheduled)

> Captured from Ankit 2026-06-30. These are **parked** — they depend on (a) the AI layer (this doc) being live and (b) the **calling tool being integrated** so we ingest call recordings + transcripts. Do not start until both gates are cleared. Tracked as **ALT-494**.

### ALT-494 — Call-coaching Learning Module (closed-loop, self-improving)
**One-liner:** A learning loop that listens to real calls, scores them against the persona/ICP, generates better opening "hooks," logs every attempt + outcome, and over time recommends the best-performing approach for *lookalike* personas.

**The loop Ankit described:**
1. **Generate N hooks** (≈5) — candidate opening lines / angles for a call.
2. **Analyse the same call recordings in real time** against those hooks — what landed, what didn't.
3. **Score against the Persona / ICP** — was the approach right for *this* type of buyer (industry, role, size, prior signals)?
4. **Iterate** — "give again": produce refined hooks, and **log every attempt + result every time** (the training signal).
5. **Train** — as logs accumulate, the model learns which hooks/approaches convert for which persona.
6. **Generalise** — start surfacing the best approaches automatically for **lookalike personas** (similar ICP profiles).

**What it needs first (hard dependencies):**
- **Calling-tool integration** → call recordings + transcripts flowing into the CRM (recording URL already exists on `meeting_master.call_recording`; need live capture + transcription).
- **AI layer live** (embeddings + RAG from this doc) → persona/ICP vectors + semantic matching of "lookalike" personas.
- **An outcome signal** → tie each call/hook to a result (meeting booked / qualified / won) so the loop has something to optimise toward.
- **A logging spine** → every hook shown, chosen, and its outcome stored (the "save every log & learn every time" requirement) — likely a `call_coaching_log` table + the activity/interaction history.

**Shape (rough, for when it's scheduled):** ICP/persona model → hook generator (Claude) → real-time call analysis (transcript + recording) → ICP-fit + hook-effectiveness scoring → `call_coaching_log` → periodic training/aggregation → "recommended hooks for this persona" surfaced to the rep before/during the call. A reinforcement-style feedback loop, grounded in the team's own call history.

**Why parked:** No value (and no training data) until calls are actually captured and the AI layer exists. Revisit when the calling tool is integrated.
