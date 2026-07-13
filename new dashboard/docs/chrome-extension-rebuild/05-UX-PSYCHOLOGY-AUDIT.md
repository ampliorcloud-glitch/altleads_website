# 05 — UX / Psychology Audit of the Two AltLeads Chrome Extensions

> Senior product-UX review with a behavioral-psychology lens, walking the EXACT journey of a real outreach **agent** (Ext 1 — `contact-viewer`) and a **research-team** user (Ext 2 — `data-research`). Every finding points to something actually in the final code (a hex, a label, a loading state, a delay, a layout choice), not generic advice.
>
> Scope reviewed: `contact-viewer/src/{sidepanel.html,sidepanel.ts,background.ts}`, `data-research/src/{sidepanel.html,sidepanel.ts,background.ts}`, both `manifest.json` + `README.md`, `shared/{auth.ts,supabaseClient.ts,contactData.ts,researchRequests.ts,rpc.ts}`, and docs `03-LINKEDIN-MINI-CRM-FLOW.md`, `04-PHASE-1-BUILD-PLAN.md`, `DESIGN-SYSTEM.md`, `USER-STORIES-AND-FLOWS.md`.

---

## (a) TL;DR for the owner (plain language)

The two extensions are **solid, safe, and genuinely well-built** — the code is defensive, never crashes, and the visual design is clean and consistent between the two tools. But the owner's instinct is right: the friction is in the small things, and they cluster in three places.

1. **The login page is the weakest first impression.** It auto-focuses nothing (the agent has to click before typing), there is **no "show password" eye**, **no "forgot password" link** (and admins bulk-create most logins, so people *will* forget), the password box only submits on Enter when the cursor is in the password field (Enter in the email field does nothing), and a wrong password shows a raw, technical Supabase error like "Invalid login credentials" with no recovery path. For a non-technical team logging in for the first time, this is the moment most likely to generate a "the extension is broken" support ticket.

2. **The wait feels uncertain.** When the agent lands on a LinkedIn profile, the panel shows a spinning circle and the words "Looking up contact…". A spinner that just spins reads as "frozen / maybe stuck" the longer it runs; and because the data loads in **six sequential database trips** (detail, then leads, then status, then activity, then tasks, then the research-request check), a slow network makes the agent stare at a spinner with no sense of progress.

3. **The disabled buttons quietly frustrate.** The agent's main "do something" buttons in two key states are **greyed-out and unclickable** — the "Request this company" button always (it says "coming soon"), and there's a grey "details hidden — not your record" line with no way forward. Showing someone a button they can't press, repeatedly, teaches them to stop looking. The research extension is in better shape, but its save flow gives no clear "Saved!" moment — the form just quietly re-renders.

None of this is a launch-blocker, but fixing the top 10 quick wins below (mostly an afternoon of work) would noticeably change how *trustworthy and alive* the tools feel to the person using them all day.

---

## (b) Findings by journey step

### Step 1 — Install + first run (before login)

| Step | Friction (what the user feels) | Psychology | Fix | Sev |
|---|---|---|---|---|
| Install / icons | `manifest.json` references `icons/icon16/32/48/128.png` but both READMEs note **placeholder icon files are not included**. A missing toolbar icon shows a generic grey puzzle piece — the agent can't find "their" tool among other extensions. | **Von Restorff / recognition-over-recall** — a distinct branded icon is how the user re-finds the tool; a grey default makes it invisible. | Ship the four PNG icons (navy `#0a2540` "A" mark) before any rollout. | P1 |
| First panel open | On a non-LinkedIn tab the agent sees the idle state: a 🔍 emoji + "Navigate to a LinkedIn profile (/in/…) to look up the contact in AltLeads CRM." This is good, but it appears *after* login, so a first-time user who opens the panel on (say) Gmail first sees only the login form with zero context about what the tool is for. | **Jakob's law / first-run orientation** — users expect a one-line "what is this" before being asked to authenticate. | The login `msg-info` says only "Sign in with your AltLeads CRM account." Add one line: "See your CRM contact while you browse LinkedIn." | P3 |
| `tabs` permission warning | Install shows Chrome's "read your browsing history" warning (documented, unavoidable with URL-only detection). Nothing in-product explains it, so a cautious agent may refuse to install. | **Loss aversion / trust** — an unexplained scary permission triggers refusal. | Add a one-line note to the README/rollout email: "This only reads the address bar to detect LinkedIn — it never reads the page." (The code confirms this: `background.ts` only reads `tab.url`.) | P3 |

### Step 2 — The LOGIN page (Ext 1 + Ext 2; near-identical markup)

| Step | Friction | Psychology | Fix | Sev |
|---|---|---|---|---|
| Autofocus | Neither login form calls `.focus()` on the email input on boot. The agent must **click** the field before typing. | **Doherty threshold / friction-at-first-keystroke** — every extra click before the primary action raises perceived effort. | `emailInput.focus()` in the `boot()` else-branch when showing login. | P2 |
| Enter-to-submit is half-wired | `passwordInput.addEventListener('keydown', Enter → loginBtn.click())` exists, but the **email input has no such handler**. Pressing Enter after typing the email does nothing — feels dead. | **Jakob's law** — Enter submits forms everywhere; a form that ignores it feels broken. | Wrap fields in a real `<form>` with `submit` handler, or add the same Enter handler to `emailInput`. | P2 |
| No show-password toggle | `type="password"` with placeholder `••••••••` and **no reveal eye**. On a narrow side panel, typos are invisible; combined with raw error messages, the agent can't tell if they mistyped or genuinely forgot. | **Recognition-over-recall / error prevention** — letting users *see* what they typed prevents the failure rather than punishing it. | Add an eye toggle that flips `type` between `password`/`text`. | P1 |
| No "forgot password" | There is **no forgot-password link anywhere**. Per CLAUDE.md, only ~1 of 111 users had a login and admin bulk-provisions them — so first login with a temp password and forgotten passwords are the *norm*, not the edge. The agent hits a dead end. | **Loss aversion / control** — a locked-out user with no self-serve path feels helpless and escalates. | Add "Forgot password?" linking to the CRM reset flow (notify-service already has reset endpoints per CLAUDE.md §3). | P1 |
| Raw error wording | On wrong password, `signIn()` returns Supabase's `error.message` verbatim → the agent sees **"Invalid login credentials"** (technical, terse) in the red `msg-error` box. Worse, "Signed in but CRM profile not found. Contact your admin." can appear even after correct credentials. | **Peak-end rule / blame framing** — a cold system-error at the very first interaction colors the whole tool as unfriendly. | Map common errors to human copy: "Email or password is incorrect. Try again or reset your password." Keep the profile-missing case but soften it. | P2 |
| Button feedback is text-only | On submit, `loginBtn.textContent = 'Signing in…'` and `disabled = true`. Good that it's disabled — but there's **no spinner**, and if the network stalls, "Signing in…" sits indefinitely with no timeout/cue. | **Doherty threshold / perceived wait** — past ~1s users want a *moving* signal, not static text. | Add the existing `.spinner` inline in the button, or a subtle progress shimmer. | P3 |
| Error placement (Ext 1) | `#login-error` renders **below** the Sign-in button (`<button>` then `<div id="login-error">`). Eye flow is top-down; an error under the button is easy to miss, so the agent re-clicks a disabled-looking button. | **Banner blindness / proximity** — errors belong adjacent to the field or above the action, in the user's gaze path. | Move the error above the button, or inline under the relevant field. | P2 |
| Brand mismatch / trust | Topbar is `#0a2540` (dark navy) with accent `#5b9cf6`; the **CRM web brand is `brand-blue #1A7EE8`** with login frame 021 (per DESIGN-SYSTEM.md). The extension's navy + the off-brand light-blue accent don't match what the agent sees daily at `crm.altleads.com`. | **Jakob's law / familiarity & trust** — a login that doesn't *look* like the system it claims to belong to subtly lowers trust at the highest-stakes screen. | Align the accent/primary to `#1A7EE8` (or consciously adopt navy as the extension sub-brand and document it). | P2 |
| Placeholder-as-hint only | Labels are present (good), but the masked-dots password placeholder `••••••••` carries no value and the email placeholder `you@amplior.com` is the only example. Minor. | **Recognition-over-recall** — fine here; labels do the work. | No change needed; noted for balance. | P3 |

### Step 3 — Opening the panel + the WAIT (Ext 1)

| Step | Friction | Psychology | Fix | Sev |
|---|---|---|---|---|
| Spinner, not skeleton | `lookupAndRender()` calls `showView('loading')` → a spinning circle + "Looking up contact…". A blank spinner gives **no sense of how long** or what's coming. | **Perceived vs actual wait / Zeigarnik** — a skeleton of the card-to-come reads as "almost there"; a bare spinner reads as "stuck". | Replace with a skeleton contact card (greyed name/company/field rows). | P2 |
| Six sequential round-trips | `renderContactCard()` `await`s in series: `fetchContactDetail` → `fetchContactLeads` → `fetchContactStatus` → `fetchActivityFeed` → `fetchTasks` → `getOpenRequestForContact`. The card only appears after **all six** resolve. On a slow link this multiplies the wait. | **Doherty threshold (<400ms)** — total latency is the sum of all six; nothing renders progressively. | `Promise.all()` the independent fetches (they don't depend on each other), or render the header instantly from the match result and stream the sections in. | P1 |
| No instant header | The match result (`find_contact_dup`) already returns `full_name` + `company_name` *before* the detail fetches — yet the panel waits for everything before showing anything. | **Sub-400ms feedback** — showing the name+company instantly (then filling detail) would make the panel feel alive. | Render the header card immediately on match, then hydrate sections. | P2 |
| SPA debounce absent | Doc §2.8 specifies a **300–500ms debounce** on `chrome.tabs.onUpdated` to coalesce LinkedIn's burst of URL events. `background.ts` has **no debounce** — rapid profile→profile clicks fire multiple `lookupAndRender` calls, and a slower earlier response can overwrite a newer one (race). | **Perceived stability** — flicker / wrong-card-then-right-card erodes trust in correctness. | Debounce `processTabUrl` ~400ms; guard `lookupAndRender` against stale slugs (compare to `currentSlug` on resolve). | P2 |

### Step 4 — The matched OWNED contact card (Ext 1)

| Step | Friction | Psychology | Fix | Sev |
|---|---|---|---|---|
| "In CRM" badge is ambiguous | Owned contacts get a **green** "In CRM" badge; non-owned get a **grey** "In CRM" badge — same text, different color. The agent can't tell from the words whether this is *their* record. | **Color affect + recognition** — same label/different color forces the user to decode color silently; high cognitive load. | Make the labels distinct: green "Yours" / grey "Team-owned" (or add a one-word owner cue). | P2 |
| Click-to-reveal discoverability | Masked PII uses `text-decoration: underline dotted` + `cursor:pointer` + `title="Click to reveal"`. The dotted underline is subtle; on first use agents often don't realize the masked value is *clickable*. | **Affordance / recognition-over-recall** — a dotted underline isn't a universally-read "click me." | Add a tiny inline 👁 / "reveal" affordance, or reveal-on-row-hover with a visible cue. | P3 |
| Reveal is one-way + per-field | `wireMaskReveal` uses `{ once: true }` and removes the masked class — once revealed it **can't be re-masked**, and each field must be clicked individually. An agent on a call who wants the phone *and* email clicks twice; can't hide again if someone walks by. | **Loss aversion / privacy control** — no re-mask removes the user's sense of control over exposed PII. | Add a single "Reveal all / Hide all" toggle at the card level; keep per-field too. | P3 |
| Designation can vanish | The header only renders `designation` if `detail?.designation` is truthy; when missing, the line silently disappears, so the card height jumps between contacts. | **Perceived stability** — layout that reflows per record feels jittery. | Reserve the line ("Designation: —") for consistent rhythm. | P3 |
| LinkedIn shown back to the agent | The owned card renders the full `linkedin_url` as a link — but the agent **is already on that LinkedIn page**. It's redundant noise in a narrow panel. | **Cognitive load / signal-to-noise** — showing the user what they're already looking at wastes scarce vertical space. | De-emphasize or drop LinkedIn on the owned card (or collapse under "more"). | P3 |
| "In short" can get long | Owned card renders header + contact details + research request + leads(3) + tasks(3) + activity(3) + CRM link — in a ~360px-wide panel this scrolls a lot. The promised "in short" preview becomes a long scroll. | **Hick's law / cognitive load** — too much at once slows the scan for the one thing they need (usually the phone or status). | Prioritize: phone/email/status above the fold; collapse leads/tasks/activity behind expanders. | P2 |

### Step 5 — Request / Re-request contact details (Ext 1, owned card)

| Step | Friction | Psychology | Fix | Sev |
|---|---|---|---|---|
| Missing-fields framing is good but quiet | When fields are missing, it shows "Missing: **email, mobile**" in blue `#1d4ed8` and a "Request contact details" button — clear. When nothing is missing the button reads "Request re-verification" — slightly jargon-y. | **Recognition-over-recall** — "re-verification" is internal language. | "Re-check these details" reads more human. | P3 |
| No confirm / no undo on request | Clicking "Request contact details" fires `createResearchRequest` immediately; on success the section is **replaced** with "Requested ✓ — pending with research team" and there is **no undo / cancel**. An accidental click is irreversible from the panel. | **Loss aversion / error recovery** — irreversible actions without undo make users hesitant to click at all. | Keep the optimistic success (good!) but add a small "Undo" for ~5s, or a "Cancel request" affordance. | P3 |
| Optimistic but inconsistent | The success state is **optimistic** (renders "pending" before/independent of server echo) which is great for snappiness — but the *error* path on re-request can leave the button stuck on "Requesting…" in some branches if the DOM section was already swapped. | **Doherty threshold / trust** — a button stuck mid-action reads as a hang. | Ensure every error branch restores button label+enabled state (the create path does; audit the re-request fallback). | P2 |
| Re-request safety unclear | The "Re-request" secondary button doesn't explain what it does — does it spam the research team? Re-requesting appends a note and resets status to pending. The agent can't see that it's safe/idempotent. | **Loss aversion** — fear of "bothering people" suppresses legitimate re-requests. | Add micro-copy: "Bumps your existing request — won't create a duplicate." | P3 |
| Success uses ✓ but no green moment | Success text is green `#16a34a` "Requested ✓" — good — but it's small (11px) and replaces the section without animation, so it can be missed. | **Peak-end rule** — the completion moment is the emotional peak; make it land. | Brief highlight/fade-in on the success block. | P3 |

### Step 6 — The MASKED non-owned card + disabled "Request company" (Ext 1)

| Step | Friction | Psychology | Fix | Sev |
|---|---|---|---|---|
| Permanently disabled primary button | `renderNonOwnedCard` always renders `<button class="btn-request" disabled>Request this company</button>` (grey `#6b7280`, `cursor:not-allowed`) with note "Approval flow coming soon. Contact your Team Lead." The agent's only action on this card is a **button they can never press**. | **Loss aversion + learned helplessness** — repeatedly showing an un-pressable primary action teaches the user to ignore the card entirely. | Until ALT-283 ships, replace the dead button with an *active* "Copy company name to message your TL" or a `mailto:`/CRM-deep-link that actually does something now. | P1 |
| "Coming soon" repeats | Every non-owned profile shows the same "coming soon (ALT-283)" — the agent sees an internal ticket code (`ALT-283`) in the `title` tooltip. | **Banner blindness** — repeated identical dead messaging gets tuned out; ticket codes leak internal jargon to end users. | Drop "ALT-283" from user-facing text; vary/soften the message. | P3 |
| "details hidden — not your record" dead-ends | The non-owned card shows "Hidden — not your record" in pale grey `#d1d5db` (`hidden-notice`). It states a limitation with no path forward (the path — request — is the disabled button above). | **Loss aversion / control** — being told "no" with no door is the most frustrating UI moment. | Pair with the (now-active) request affordance so "hidden" implies "…until you request access." | P2 |
| DNC handling is good | When DNC, the button note shows ⚠️ "This company is marked **Do Not Contact**" and a red badge — strong, correct loss-aversion framing that prevents a wasted/risky outreach. | **Color semantics (red = stop)** — correctly applied. | None — keep. (Listed under "what's good".) | — |

### Step 7 — The NO-MATCH empty state (Ext 1)

| Step | Friction | Psychology | Fix | Sev |
|---|---|---|---|---|
| Empty state reads cleanly | 📭 emoji + "No CRM contact found for this LinkedIn profile." + grey sub-line "The profile may not be in the CRM yet, or the LinkedIn URL is not saved against any contact." This is a **clean answer, not a failure** — well done. | **Peak-end / framing** — explains *why* (not just "nothing"), avoiding a "broken" read. | None needed; minor: the doc anticipates a **high** no-match rate (sparse `linkedin_clean`), so this state is seen often — keep it reassuring. | — |
| Error vs no-match collision risk | `showView('error', …)` renders into `#error-state` which uses the **same red `msg-error` styling** as login errors, with copy "Could not reach the CRM — …. Check your connection or try again." Fine, but a transient JWT-expiry shows red alarm where the doc's "serve last-good, never alarm" principle would prefer calmer copy. | **Color affect** — red = something's wrong/your fault; network blips don't warrant alarm-red. | Use a calmer info tone for recoverable network errors; reserve red for true failures. | P3 |

### Step 8 — Ext 2 (data-research): queue + fill form

| Step | Friction | Psychology | Fix | Sev |
|---|---|---|---|---|
| Queue scannability | Rows show `#id` + status badge + target (LinkedIn slug or "Contact #id") + a single meta line cramming `fields_needed · requesterName · date`. Who/when/what are **run together** in one 11px grey line — hard to scan at a glance. | **Hick's law / chunking** — three facts in one undifferentiated line slows triage. | Separate "who" and "when" visually (e.g. requester bold, date right-aligned); the existing `req-meta` could split into two rows. | P2 |
| Status color logic inverted-ish | In the queue, `in_progress` → **orange** (`badge-orange`) and `pending` → **grey**. Intuitively "in progress" (being handled) feels calmer than "pending" (waiting on me). Orange (warning/amber) on the *already-being-worked* item misdirects attention. | **Color affect / Von Restorff** — the attention-grabbing color should mark the item needing action (pending), not the one in hand. | Consider grey for in_progress, blue/amber for pending — or document the intent. | P3 |
| Date is absolute, not relative | Queue uses `formatDate` → "5 Jun 2026". The agent extension has a nice `formatRelativeDate` ("2 days ago") but the research queue **doesn't use it**, so "how stale is this request" takes mental math. | **Cognitive load / recognition** — "3 days ago" is instantly graspable; a date requires calculation. | Reuse `formatRelativeDate` in the queue rows. | P3 |
| Requester name loads in two passes | `loadQueue` first renders, then `resolveUserName` does an extra `profiles` query **per row** (cached, but N queries on first load). On a 50-row queue that's up to 50 round-trips before names appear; meanwhile the detail view shows only "User 42" (raw id), never the resolved name. | **Doherty threshold / consistency** — names popping in late + raw "User 42" in detail feels unfinished. | Batch-resolve names in one `.in('user_id', [...])` query; reuse the cache in the detail view instead of "User {id}". | P2 |
| Save gives no clear "Saved!" moment | `handleSave` writes, then sets `detailContact` and calls `renderDetailView()` — the form **silently re-renders** with PRESENT badges flipped. There's no toast, no "Saved ✓" banner. The big emotional payoff of completing a row is missing. | **Peak-end rule** — the save is the whole job; with no confirmation the work feels like it didn't "count." | Show a green `info-msg-green` "Saved — request marked done ✓" before/with the re-render. | P1 |
| "Save & mark done" double meaning | The primary button is "Save & mark done" (HTML-entity `&amp;` renders fine). It does two things in one click — write fields *and* close the request — but if the field write succeeds and the status update fails, the message "Contact saved, but permission denied on updating the request status" is confusing (did it work?). | **Cognitive load / partial-success ambiguity** — compound actions with partial failure are hard to reason about. | Keep the compound action, but on partial success show explicit state: "Details saved ✓ — but couldn't close the request (will retry)." | P2 |
| Empty queue is delightful | Zero requests → "No pending research requests — all caught up!" in info-blue. Positive, human framing. | **Peak-end / positive reinforcement** — correctly rewards an empty queue. | None — keep. | — |
| Banner match latency | The LinkedIn profile banner calls `findContactDup(slug)` inline and shows "LinkedIn: slug" first, then the match — but on no match it **degrades silently** (catch block does nothing), leaving "Not in CRM" only if the try succeeded. A thrown error shows just the slug with no match/no-match resolution. | **Zeigarnik / uncertainty** — an unresolved banner (slug but no verdict) leaves the user hanging. | In the `catch`, render an explicit "Couldn't check CRM" state rather than nothing. | P3 |
| No Enter-to-save in fill form | The fill form has 6 inputs but no Enter-to-submit and no keyboard save. A research user filling many rows must mouse to the Save button every time. | **Doherty / efficiency for power users** — repetitive mousing slows a high-volume task. | Add Cmd/Ctrl+Enter to save; consider tab order ending on Save. | P3 |

### Step 9 — Cross-cutting (both extensions)

| Step | Friction | Psychology | Fix | Sev |
|---|---|---|---|---|
| Contrast on muted greys | Several states use `#9ca3af` / `#d1d5db` text on `#f8f9fa`/white (`field-row .label`, `value.empty`, `hidden-notice`, `rr-muted`). `#d1d5db` on white is **~1.5:1 contrast** — well below WCAG AA (4.5:1). Older agents / poor monitors will struggle. | **Accessibility / legibility** — sub-AA text excludes some users and fatigues all. | Darken empty/hidden text to at least `#6b7280` (gray-500). | P2 |
| Degraded states read informative, not broken — mostly | "Research queue not set up yet.", "Backend not ready — ask the CRM team to apply REQUEST 3 (…ALT-282 R3)", "Permission denied — your role cannot view research requests yet. Contact your admin (REQUEST 5 / RESEARCH role)." These **leak internal ticket/role codes** to end users. | **Banner blindness / jargon** — "REQUEST 3", "42501", "RESEARCH role" mean nothing to the user and read as broken-internal. | Strip ticket codes from user copy; keep them in `console`. User sees: "This feature isn't switched on yet — your admin has been notified." | P2 |
| No global "signed in as" reassurance beyond name | Topbar shows `full_name` (or role) + Sign out. Good. But there's no avatar/role pill like the CRM topbar (DESIGN-SYSTEM §Top Bar: avatar + name + role label). Minor identity-trust gap. | **Jakob's law / familiarity** — matching the CRM's identity treatment reinforces "same system." | Add the role label under/next to the name. | P3 |
| Microcopy tone is mostly warm | "all caught up!", "Looking up contact…", emoji empty states — friendly and on-brand. Undercut only by the raw error strings and ticket codes noted above. | **Peak-end / tone consistency** — one cold string poisons an otherwise warm flow. | Sweep all user-facing strings for tone + jargon. | P3 |
| Sign-out is near-invisible | `#signout-btn` is `rgba(255,255,255,0.5)` (50% white) on navy — very low contrast, easy to fat-finger next to the project selector, and there's **no confirm**. | **Fitts's law / error prevention** — a low-visibility destructive-ish action placed by the selector invites mis-clicks. | Raise contrast on hover only (it does), but also separate it from the selector and consider a confirm. | P3 |
| Project selector on owned card only | The selector (Ext 1) drives everything per-project, but it sits in the navy topbar as a small `rgba(255,255,255,0.08)` select that's easy to overlook; changing it silently re-runs the whole lookup. | **Recognition / feedback** — a low-salience control with a big effect can confuse ("why did the card change?"). | Make the selector more legible; show a tiny "Scoped to: <project>" cue on the card. | P3 |

---

## (c) Top 10 quick wins (ordered by impact ÷ effort)

1. **Autofocus the email field on login** + add Enter-to-submit on the email input (wrap in a `<form>`). *One-line each; removes the very first friction.* (P2, trivial)
2. **Add "Forgot password?" + a show-password eye to login.** *Directly prevents the most likely first-day lockout/support ticket given admin bulk-provisioning.* (P1, small)
3. **Humanize login error copy** — map "Invalid login credentials" → "Email or password is incorrect. Try again or reset your password," and move the error **above** the button. (P2, small)
4. **`Promise.all()` the six contact fetches** (they're independent) and render the **header instantly** from the match result. *Biggest perceived-speed win.* (P1, small)
5. **Show a "Saved ✓" green confirmation in the research fill form** before re-render. *Restores the missing payoff of the core task.* (P1, trivial)
6. **Replace the always-disabled "Request this company" button** with an action that works today (copy company / deep-link to TL), and drop "ALT-283" from user text. (P1, small)
7. **Strip internal codes** ("REQUEST 3/5", "42501", "ALT-…", "RESEARCH role") from all user-facing degraded/error strings; keep them in `console`. (P2, small)
8. **Swap the loading spinner for a skeleton card** + add the documented **~400ms debounce** on tab-URL changes (with a stale-slug guard). (P2, medium)
9. **Use `formatRelativeDate` + split who/when in the research queue rows**, and batch-resolve requester names in one query (and show the name, not "User 42", in detail). (P2, medium)
10. **Darken sub-AA muted text** (`#d1d5db`/`#9ca3af`) to ≥ `#6b7280`, and ship the four toolbar **icons**. (P2, trivial)

---

## (d) Deep dive — the LOGIN page (owner flagged this specifically)

The login is the agent's **first and highest-stakes** interaction; per the peak-end rule and Jakob's law it disproportionately sets trust. The current form (identical in both extensions, `sidepanel.html` lines ~397–410 / ~373–386) is clean but has **seven concrete gaps**, each tied to a psychological cost:

1. **No autofocus (Doherty threshold).** `boot()` shows the login view but never focuses `#email-input`. The user must click before typing — a small but literally-first point of friction. *Fix: `emailInput.focus()` when rendering login.*

2. **Enter only works from the password field (Jakob's law).** `passwordInput` has an Enter→click handler; `emailInput` does not. A user who types their email and hits Enter gets **nothing**. *Fix: a real `<form>` with an `onsubmit`, or mirror the handler onto the email input.*

3. **No show-password toggle (recognition-over-recall / error prevention).** With `••••••••` masking and no eye, a typo is invisible. In a ~360px panel with no "forgot" path, an invisible typo is indistinguishable from a forgotten password — the user can't self-diagnose. *Fix: eye toggle flipping `input.type`.*

4. **No "forgot password" (loss aversion / control).** This is the most consequential gap. CLAUDE.md §3: only ~1 of 111 users had a login and **admin bulk-provisions** them — so users arrive with temp passwords they'll forget. With no reset link, a forgotten password is a **hard dead end** inside the extension; the agent must leave, find an admin, and wait. notify-service already exposes reset endpoints. *Fix: "Forgot password?" link to the reset flow.*

5. **Raw, technical error wording (peak-end rule).** `signIn` surfaces Supabase's `error.message` verbatim. The user sees "Invalid login credentials" — cold, and offering no next step. The success-but-no-profile branch ("Signed in but CRM profile not found. Contact your admin.") can also appear after *correct* credentials, which is alarming. *Fix: map the 2–3 common errors to warm, actionable copy; keep console detail for support.*

6. **Error sits below the button + alarm-red (banner blindness / color affect).** `#login-error` renders **after** `#login-btn`, outside the top-down gaze path, in full red `#b91c1c` on `#fef2f2`. Users re-click the (re-enabled) button without noticing the message. *Fix: move the error above the button; reserve full red for genuine auth failure.*

7. **Off-brand visuals at the trust-critical screen (Jakob's law / familiarity).** The login lives under a `#0a2540` navy bar with a `#5b9cf6` accent, while the CRM the agent logs into daily is `brand-blue #1A7EE8` (DESIGN-SYSTEM frame 021). A login that doesn't visually match its parent system subtly signals "third-party / less trustworthy." *Fix: align the accent to the CRM blue, or deliberately adopt + document navy as the extension sub-brand.*

**What the login already does right (for balance):** real labels above fields (not placeholder-only), correct `autocomplete="email"` / `current-password` (so password managers work), input `type=email`/`password`, a disabled + "Signing in…" button state (prevents double-submit), a one-line orienting `msg-info`, and a clean focus ring (`border-color:#0a2540`). The bones are good — it needs the recovery affordances and warmer error handling.

---

## (e) What's already good (balance)

- **Genuinely defensive — never crashes.** Every data helper returns `null`/`[]` on error; research helpers classify `42P01`→backend-not-ready, `42501`→forbidden, and the UI always renders *something*. This is the hardest part to get right and it's done well.
- **Consistent design language across both tools.** Same `#0a2540` topbar, same card/badge/field-row system, same spinner, same `esc()` XSS-safe rendering — the two extensions feel like one product family.
- **Strong security posture as UX trust.** Anon key only, user JWT + RLS, no service-role, no page injection, URL-only detection (`background.ts` reads only `tab.url`). The "we never touch the LinkedIn page" promise is real in code — a real trust asset if surfaced to users.
- **DNC handling is excellent.** Red badge + ⚠️ "Do Not Contact" + disabled request — correct color semantics and loss-aversion framing that actively prevents a costly mistake.
- **No-match empty state is reassuring,** not a failure: 📭 + a plain-language reason. Given the doc's expected high no-match rate, this is exactly right.
- **Optimistic success on the request flow** ("Requested ✓ — pending with research team") makes the agent's action feel instant.
- **Warm microcopy in the happy paths** — "all caught up!", "Looking up contact…", emoji states — gives the tools personality.
- **Click-to-reveal masking** correctly implements the launch decision (partial mask + click-reveal) — privacy-respecting by default.
- **Research detail view is focused** — exactly the 6 fields, PRESENT/MISSING badges, no irrelevant leads/tasks/activity — matching the research user's actual job (good cognitive-load discipline).

---

*Authored as a code-grounded review; every finding references actual markup, CSS hex values, function names, or copy strings in the files listed at the top. Severities: P1 = fix before rollout, P2 = fix soon after, P3 = polish.*
