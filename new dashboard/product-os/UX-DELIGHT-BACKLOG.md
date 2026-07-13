# UX / Convenience / AI backlog — make it usable & not boring

> Synthesized from a 3-agent research swarm (2026-06-25): web research on Linear / Superhuman / Notion / Attio / Raycast (general usability + delight) and Close / Apollo / Outreach / Salesloft (outbound + AI), cross-checked against a read-only audit of our own code. **Everything here is pure front-end / app-code — no DB migration, no deploy decision — UNLESS marked 🔒 GATED.** Goal: the tool should feel fast and alive for people who live in it 8 hours a day.

Where 2+ agents independently surfaced the same thing, it's marked ⭐ (high confidence).

## Tier 1 — quick wins (S effort, do first)
- ⭐ **Density / compact mode toggle** — comfortable/compact row height (CSS var + localStorage). ~40% more rows; instantly "built for pros." *(general+code)*
- ⭐ **Actionable empty states** — replace bare "No results" with a next action ("No callbacks due — nice. View today's meetings →" / "Clear filters"). Turns dead-ends into momentum + teaches features. *(general+code)*
- ⭐ **Keyboard shortcut help overlay (press `?`)** + show shortcuts in menus/palette. Makes every other shortcut discoverable. *(general+code)*
- **Active-filter visual indicator** — highlight/badge filter controls that are currently applied (right now you can't tell at a glance). *(code)*
- **One-keystroke dispositions** — single keys (1–9) to log a call outcome + advance. Calling-team superpower. *(outbound)*
- **Lead freshness / quality chips** — "never contacted", "going cold", "hot streak" as small visual cues. *(outbound)*
- **Snooze-to-time presets everywhere** a record can be deferred (not just My Tasks). *(outbound)*

## Tier 2 — high impact (M effort)
- ⭐ **Optimistic updates + Undo toast** — apply status/disposition/assign instantly, show "Undo", roll back only on server reject. Removes the per-edit latency tax + fat-finger safety net. (Extends the existing Toast.) *(general+code)*
- ⭐ **"My Day" focus queue** — one prioritized home list ("3 callbacks due, 2 meetings today, 5 untouched") with one-key advance. Rules-based v1 (due date / status / last-touch) — no AI needed. *(general+outbound+code)*
- ⭐ **Saved Views as tabs** (personal v1) — name a filter+sort+columns+view-type combo; one-click "My open callbacks". Storable in the existing `user_view_pref` jsonb — no migration. *(general+code)* (Shareable/team views = 🔒 DEC-07.)
- **Command palette ACTIONS** — make Cmd-K *do* things ("Log a call", "Assign to me", "Go to Meetings", "Switch project"), not just search. *(general)*
- **Bulk sticky selection bar** — persistent bar with count + range-select (Shift) + progress on apply. *(general+code)*
- ⭐ **Tasteful micro-interactions/motion** — 150–200ms row enter/exit, drawer slide, save pulse. Restrained (Linear-style). Makes it feel alive. *(general+code)*
- **Meeting-prep card** — pre-call briefing (who, company, last touches, open questions). *(outbound)*
- **Inline "Schedule follow-up" quick-picker** on the disposition (Tomorrow / +3d / Next week). *(outbound)*
- **No-show / reschedule fast-path** on meetings (one click → mark no-show + auto-suggest re-book task). *(outbound)*
- **Proactive duplicate/merge suggestions** (not only manual merge). *(outbound)*
- **Recently-viewed + pin**, surfaced in Cmd-K. *(general+outbound)*

## Tier 3 — bigger bets (L effort)
- ⭐ **Keyboard-first list navigation** — j/k move focus, x select, Enter open, e edit, c call; focus auto-advances after an action (Linear/Superhuman feel). The single biggest "feels fast" change. *(general+outbound)*
- **Inline cell editing on the default table** — double-click → edit in place, Tab to next (spreadsheet ergonomics). *(general+code)*
- **Dark mode** (+ respect prefers-color-scheme) — big eye-comfort/morale win; migrate hard-coded colors to tokens. *(general)*
- **Snappy perceived performance** — skeletons everywhere, list virtualization for long lists, prefetch-on-hover. *(general)*
- **Call Mode (focus dialer queue)** — full-screen "work my list" that auto-advances. *(outbound)*

## 🔒 GATED — need a decision from you (not built without go)
- **AI: summarize a lead's history / draft a follow-up message / "suggest next action" chip** — genuinely useful, but needs an LLM API key + a cost decision (and is better with the embeddings/clean interaction log, ALT-352/359). *(outbound)* → propose as a decision.
- **Shareable/team Saved Views** — bundled with the per-project access model (DEC-07).
- **Create-form inline validation/autocomplete** — create is admin-only (ADR-21); low priority for outreach roles.

## Recommended build order
1. **ALT-373** (FE PII hardening — security, already queued).
2. **Tier-1 quick wins** (density, empty states, `?` help, active-filter badge) — cheap, immediately felt.
3. **Optimistic+Undo** and **"My Day" queue** — the two biggest daily-life improvements.
4. **Keyboard-first nav** + **command-palette actions** — the "feels fast" leap.
5. Decide the **AI** items with the owner (key + cost).
