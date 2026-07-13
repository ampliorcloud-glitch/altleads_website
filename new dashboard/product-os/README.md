# product-os — start here

This folder is the **operating system for the Amplior CRM product**. If you are a new Claude (or a new teammate) picking this up cold, **start here** — it is the fastest, lowest-token way to know what to do.

## Read order (stop as soon as you can act)
1. **[OPERATING-MODEL.md](OPERATING-MODEL.md)** — how we work: the resume protocol, the sub-agent team, the build loop, the guardrails. *Read the Resume Protocol section first.*
1b. **[GOALS.md](GOALS.md)** — the single goal definition: north-star, the current **Internal Launch Readiness** milestone (measurable exit criteria), and the non-dependent backlog (what moves goals without owner approval).
2. **[PRODUCT-BRIEF.md](PRODUCT-BRIEF.md)** — what the product is, who uses it, the constraints, the revenue lens.
3. **`../docs/Amplior-Review-Hub.xlsx`** — the ONE place for everything waiting on the owner (Decisions Needed) and built-but-unreviewed work (Awaiting Review). Check this before building so you build *around* what's blocked.
4. **`../docs/AltLeads-Backlog-Tracker.xlsx`** — full ticket state. Source of truth for "what exists."
5. **`../REBUILD_LOG.md`** — newest Session Log entry for the latest narrative.

## The two trackers (kept current; regenerate after changes)
| Tracker | What it holds | Regenerate with |
|---|---|---|
| `docs/AltLeads-Backlog-Tracker.xlsx` | Every ticket (ALT-###), status, priority, notes | `node new-code/web/scripts/gen-backlog-tracker.cjs` |
| `docs/Amplior-Review-Hub.xlsx` | Decisions needed · Awaiting review · Risks — everything **for the owner** in one place | `node new-code/web/scripts/gen-review-tracker.cjs` |

## The rules that never bend (full list in OPERATING-MODEL §5)
- **Manual deploy** — push only on the owner's explicit "push."
- **No prod DB / RLS / destructive change** without owner sign-off + throwaway-login validation.
- **Never commit secrets.** Capture every decision in docs + tracker immediately.

## Why this exists
The owner's frustration was real: *the agent forgets, the rep should remember.* This folder + the two trackers are that durable memory. Update them as you work — they are how the next session (or the next teammate) starts at full speed instead of re-deriving everything.
