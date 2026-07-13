# Tasks for Antigravity — small, safe, fully-guided front-end fixes

> ✅ **EXECUTED 2026-06-28** — all actionable tasks below were applied (Tasks 2–8, 10, 11) or were already done (Task 1) / no-op (Task 9). Don't re-run; kept for reference. Add NEW small tasks below the line if you want this used again.

> A queue of tiny, low-risk, **additive** UI tasks for a less-capable AI agent ("antigravity")
> to execute **independently and safely** when the senior agent is unavailable. Every task here
> was checked against the **real current code** (file paths and surrounding context verified on
> 2026-06-28). Each one is spelled out step-by-step so it is nearly impossible to get wrong.
>
> App: AltLeads CRM web (`new-code/web`, React 19 + Vite + TypeScript). Repo root:
> `c:\Users\pc\OneDrive - Amplior\Desktop\AL`.

---

## RULES FOR ANTIGRAVITY (read first, follow exactly)

1. **One task at a time.** Do not batch tasks. Finish a task completely before starting the next.
2. **After every task, run the build:**
   ```
   cd new-code/web
   npm run build
   ```
   It must finish **with no new errors**. (`npm run build` runs `tsc -b && vite build`.)
3. **If the build fails** and you cannot fix it with one obvious, in-scope edit, **REVERT your change
   for that task** (restore the file to how it was) and **skip the task**. Do not improvise a larger fix.
4. **Stay inside the task.** Only edit the file(s) named in the task, only the lines described.
   Do not refactor, reformat, rename, reorder imports, or "clean up" anything nearby.
5. **NEVER touch the forbidden list** (these are off-limits no matter what):
   - Anything about RLS, SQL, or DB migrations.
   - These files: `src/data/merge.ts`, `src/data/bulkActions.ts`, `src/data/assignment.ts`,
     and any data-fetching / pagination / write / upsert logic in `src/data/**` or `src/lib/leadsApi.ts`.
   - Auth, login, password, or `.credentials/`.
   - Build config (`vite.config.*`, `tsconfig*`, `package.json`).
   - No new database columns, no new API calls, no multi-file refactors.
6. **Do not commit.** Leave all changes in the working tree for the senior agent to review.
   Do not run `git commit`, `git push`, or any deploy.
7. **Pure-frontend, additive only.** You are adding small things (a tooltip, an aria-label, a clear
   button, a success toast). You are never changing how data is loaded, saved, or who can see it.
8. If a task's described code does **not** match what you find in the file, **stop and skip that task** —
   do not guess. Report it as "code did not match."

> Verification of line numbers: line numbers below were correct at authoring time but may drift if
> earlier edits change a file. Always locate the change by the **quoted code / element**, not by the
> line number alone.

---

## Task 1 — Show a success toast after an inline Grid-cell save (no ticket; from DATA-OPS §E)

**File(s):** `new-code/web/src/components/ui/EditableGrid.tsx`

**What & why:** When a user edits a cell inline in the Grid view, a successful save only flashes a tiny
green check icon (easy to miss in a dense grid). The error path already shows a toast; the success path
does not. Add a success toast so saves feel confirmed — matching the rest of the app.

**Exact steps:**
1. Open the file. Find the `commit` function inside `EditableCell` (it begins with
   `async function commit(next: string) {`).
2. Inside `commit`, find the **success branch** — the `else` block after `if (res.error) { … }`. It
   currently reads:
   ```js
   } else {
     setState('saved');
     if (savedTimer.current) clearTimeout(savedTimer.current);
     savedTimer.current = setTimeout(() => setState('idle'), 1500);
   }
   ```
3. Add **one line** as the first line inside that `else` block, immediately after the `{`:
   ```js
       toast.success('Saved');
   ```
   So it becomes:
   ```js
   } else {
     toast.success('Saved');
     setState('saved');
     if (savedTimer.current) clearTimeout(savedTimer.current);
     savedTimer.current = setTimeout(() => setState('idle'), 1500);
   }
   ```
4. `toast` is already available in this component (`const toast = useToast();` near the top of
   `EditableCell`) and `useToast` is already imported. Do **not** add new imports.

**Acceptance:**
- Run `cd new-code/web; npm run build` — it passes with no new errors.
- Eyeball: the only change is the single added `toast.success('Saved');` line inside the success branch.
  The error branch (`toast.error(res.error)`) is unchanged.

**Guardrails:** Do not change the save logic, the `setState` calls, the timers, or `col.onSave`. Do not
touch the read-only render path or the select/text editors. Only add the one toast line.

---

## Task 2 — Tooltip on the Meetings table "Company / Lead" name cell (no ticket; UX-AUDIT QW#1)

**File(s):** `new-code/web/src/pages/MeetingsPage.tsx`

**What & why:** In the Meetings **table** view, the company name is truncated with `truncate` +
`maxWidth: 200` but has no `title`, so a clipped company name can't be read on hover. (The Grid-view
version already has a `title` — this is only about the table column.) Add a hover tooltip.

**Exact steps:**
1. Find the `company` table column. It starts with `company: columnHelper.accessor('company', {` and its
   `cell` computes `const company = info.getValue() || info.row.original.leadName || info.row.original.name || '';`.
2. Inside that cell, find this line (the company **name** paragraph — it has **no** `title=` yet):
   ```jsx
   <p className="font-medium text-zinc-900 truncate" style={{ fontSize: 13, maxWidth: 200 }}>
   ```
   (Note: there is a *different*, later occurrence near the Grid view that already ends with
   `title={company || undefined}>`. **Do not** touch that one — only the one with **no** title.)
3. Add `title={company || undefined}` just before the closing `>`:
   ```jsx
   <p className="font-medium text-zinc-900 truncate" style={{ fontSize: 13, maxWidth: 200 }} title={company || undefined}>
   ```

**Acceptance:**
- Run `cd new-code/web; npm run build` — passes with no new errors.
- Eyeball: exactly one `<p>` gained `title={company || undefined}`; the inner text and the
  `Unlinked meeting` fallback are unchanged.

**Guardrails:** Do not change the value expression, the avatar, or the subtitle line (that's Task 3).
Do not edit the Grid-view cell that already has a `title`.

---

## Task 3 — Tooltip on the Meetings table "Company / Lead" subtitle cell (no ticket; UX-AUDIT QW#1)

**File(s):** `new-code/web/src/pages/MeetingsPage.tsx`

**What & why:** Same `company` table column as Task 2, second line (the grey subtitle showing
`leadName · city`) is also truncated with no `title`. Add a tooltip so the full subtitle is readable.

**Exact steps:**
1. In the same `company` table column cell, find the **subtitle** paragraph (directly below the name `<p>`):
   ```jsx
   <p className="text-zinc-400 truncate" style={{ fontSize: 11, maxWidth: 200 }}>
     {[info.row.original.leadName, info.row.original.city].filter(Boolean).join(' · ')}
   </p>
   ```
2. Change the opening tag to add a `title` built from the same array. Replace just the opening `<p ...>`
   tag with:
   ```jsx
   <p className="text-zinc-400 truncate" style={{ fontSize: 11, maxWidth: 200 }} title={[info.row.original.leadName, info.row.original.city].filter(Boolean).join(' · ') || undefined}>
   ```
   Leave the inner `{[...]join(' · ')}` expression and the closing `</p>` exactly as they are.

**Acceptance:**
- Run `cd new-code/web; npm run build` — passes with no new errors.
- Eyeball: the subtitle `<p>` now has a `title` whose content matches the displayed text; nothing else changed.

**Guardrails:** Only the subtitle `<p>` opening tag changes. Do not alter the join logic or the name line.
(Tasks 2 and 3 may be done together since they're the same cell — but still build once after each.)

---

## Task 4 — Tooltip on the Meetings table "Salesperson" cell (no ticket; UX-AUDIT QW#1)

**File(s):** `new-code/web/src/pages/MeetingsPage.tsx`

**What & why:** The Meetings **table** "Salesperson" column truncates the name with no `title`. Add a
hover tooltip so a long salesperson name is readable.

**Exact steps:**
1. Find the `salesperson` table column: it starts with `salesperson: columnHelper.accessor('salesperson', {`.
2. Its `cell` currently renders:
   ```jsx
   <span className="text-zinc-700 truncate" style={{ fontSize: 13 }}>
     {info.getValue() || <span className="text-zinc-300">—</span>}
   </span>
   ```
3. Add a `title` to the outer `<span>` using the cell value. Replace the opening `<span ...>` with:
   ```jsx
   <span className="text-zinc-700 truncate" style={{ fontSize: 13 }} title={(info.getValue() as string) || undefined}>
   ```
   Keep the inner `{info.getValue() || <span …>—</span>}` and the closing `</span>` unchanged.

**Acceptance:**
- Run `cd new-code/web; npm run build` — passes with no new errors.
- Eyeball: the salesperson `<span>` now has `title`; the dash fallback is unchanged.

**Guardrails:** There is a similar-looking Grid-view salesperson cell later in the same file that uses
`render: (r) => …`. **Do not** edit that one in this task. Only the `columnHelper.accessor('salesperson', …)`
table cell.

---

## Task 5 — Tooltip on the Wishlist Grid "Company" cell (no ticket; UX-AUDIT QW#1)

**File(s):** `new-code/web/src/pages/WishlistPage.tsx`

**What & why:** In the Wishlist Grid view, the company name is truncated (`truncate`) with no `title`, so a
clipped name can't be read on hover. Add a tooltip.

**Exact steps:**
1. Find the `company` column case: it begins with `return columnHelper.accessor('company', {` and computes
   `const name = info.getValue() || '';`.
2. Inside its cell, find:
   ```jsx
   <span className="font-medium text-zinc-900 truncate" style={{ fontSize: 13 }}>
     {name || <span className="text-zinc-400">—</span>}
   </span>
   ```
3. Add `title={name || undefined}` to the opening `<span>`:
   ```jsx
   <span className="font-medium text-zinc-900 truncate" style={{ fontSize: 13 }} title={name || undefined}>
   ```
   Keep the inner content and closing `</span>` unchanged.

**Acceptance:**
- Run `cd new-code/web; npm run build` — passes with no new errors.
- Eyeball: that one company `<span>` gained `title={name || undefined}`; nothing else changed.

**Guardrails:** Do not touch the `CompanyAvatar`, other columns, or any export/column logic.

---

## Task 6 — aria-label on the "Edit lead" icon link (no ticket; UX-AUDIT QW#8)

**File(s):** `new-code/web/src/components/lead/LeadInfoPanel.tsx`

**What & why:** The "Edit lead" control in the Lead Information section is an **icon-only** link (a
`<Pencil>` icon) with a `title` but no `aria-label`, so screen readers announce no name. Add an
`aria-label` (the visual `title` already exists; this adds the accessible name).

**Exact steps:**
1. Find the edit link inside the `action=` prop of the `Lead Information` `CollapsibleSection`. It reads:
   ```jsx
   <Link
     to={`/leads/${lead.lead_id}/edit`}
     className="flex items-center gap-1 text-zinc-400 hover:text-blue-600 transition-colors"
     style={{ fontSize: 12 }}
     title="Edit lead"
   >
     <Pencil size={13} />
   </Link>
   ```
2. Add an `aria-label="Edit lead"` attribute (right after the `title="Edit lead"` line):
   ```jsx
   <Link
     to={`/leads/${lead.lead_id}/edit`}
     className="flex items-center gap-1 text-zinc-400 hover:text-blue-600 transition-colors"
     style={{ fontSize: 12 }}
     title="Edit lead"
     aria-label="Edit lead"
   >
     <Pencil size={13} />
   </Link>
   ```

**Acceptance:**
- Run `cd new-code/web; npm run build` — passes with no new errors.
- Eyeball: the `<Link>` now has both `title="Edit lead"` and `aria-label="Edit lead"`; nothing else changed.

**Guardrails:** Do not change the `to=` route, the icon, the className, or any other panel field.

---

## Task 7 — Clear (×) button in the Admin → Users search box (no ticket; UX-AUDIT QW#6)

**File(s):** `new-code/web/src/components/admin/UsersTab.tsx`

**What & why:** The Users table search input has no clear button, so users must select-all + delete to
reset it. Add a small × button that appears when there's text and clears the field. (The Approvals page
already does this; we're matching that pattern.)

**Exact steps:**
1. At the top of the file, confirm `X` is imported from `lucide-react`. Look at the existing
   `import { … } from 'lucide-react';` line. **If `X` is not already in that list, add it** (e.g.
   `import { Search, X, … } from 'lucide-react';`). Do not add a second import line for lucide.
   (If unsure, you may instead render the literal character `×` in the button and skip importing `X` —
   see step 3 alternative.)
2. Find the search input. It is a controlled `<input>` with `value={search}` and
   `onChange={(e) => { setSearch(e.target.value); setPage(0); }}`, placeholder `"Search users..."`,
   wrapped in a `<div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>` that also
   contains a `<Search …>` icon.
3. Immediately **after** that `<input … />` (and still inside the same wrapping `<div>`, before its
   closing `</div>`), add a conditional clear button:
   ```jsx
   {search && (
     <button
       type="button"
       onClick={() => { setSearch(''); setPage(0); }}
       aria-label="Clear search"
       style={{
         position: 'absolute', right: 8, background: 'none', border: 'none',
         cursor: 'pointer', color: '#9CA3AF', padding: 2, display: 'inline-flex', lineHeight: 0,
       }}
     >
       <X size={14} />
     </button>
   )}
   ```
   **Alternative if you did not import `X`:** replace `<X size={14} />` with the text `×` and add
   `fontSize: 16` to the button style.
4. The input already has left padding for its icon (`paddingLeft: 30`). The × sits at `right: 8`; you do
   **not** need to change the input's styles.

**Acceptance:**
- Run `cd new-code/web; npm run build` — passes with no new errors.
- Eyeball: typing in the Users search shows an × on the right; clicking it empties the box and resets to
  page 0. With an empty box, no × is shown.

**Guardrails:** Do not change the search filtering logic, the table, or `setPage` usage elsewhere. The
button must reuse the existing `search`/`setSearch`/`setPage` — do not add new state.

---

## Task 8 — Clear (×) button in the global TopBar search box (no ticket; UX-AUDIT QW#6)

**File(s):** `new-code/web/src/components/ui/GlobalSearchBar.tsx`

**What & why:** The global search box (in the TopBar) can only be cleared via the Escape key. Add a visible
× button (appears when there's text) so mouse users can clear it too.

**Exact steps:**
1. Confirm `X` is imported from `lucide-react` at the top (the file already imports several lucide icons).
   If `X` is missing from that import list, add it. Do not create a second lucide import line.
2. Find the search input — a controlled `<input>` with `value={query}`,
   `onChange={(e) => { setQuery(e.target.value); setOpen(true); }}`, `placeholder="Search…"`, inside a flex
   `<div>` that begins with a `<Search size={14} …>` icon.
3. Immediately **after** that `<input … />`, and **before** the closing `</div>` of the flex container that
   holds the Search icon + input, add:
   ```jsx
   {query && (
     <button
       type="button"
       onClick={() => { setQuery(''); setOpen(false); }}
       aria-label="Clear search"
       style={{
         flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
         color: 'var(--color-gray-400)', padding: 0, display: 'inline-flex', lineHeight: 0,
       }}
     >
       <X size={14} />
     </button>
   )}
   ```
4. `query`, `setQuery`, and `setOpen` already exist in this component (used in the input's handlers).
   Reuse them — do not add new state.

**Acceptance:**
- Run `cd new-code/web; npm run build` — passes with no new errors.
- Eyeball: typing in the TopBar search shows an × inside the box; clicking it clears the text and closes the
  results panel. Empty box shows no ×.

**Guardrails:** Do not change the results panel, the keyboard handlers (`onKeyDown`), the debounce/index
logic, or the input's other props. Only add the conditional button.

---

## Task 9 — aria-label on the Toast viewport region is already present — DO NOT do anything here

> (Left intentionally as a no-op marker so the numbering stays stable if this list is edited. The toast
> system already has `aria-live`, `role="alert"`, and a labelled dismiss button. **Skip — nothing to change.**)
> If you reached this entry, move on to Task 10.

---

## Task 10 — Tooltip on the Meetings Grid "Salesperson" cell (no ticket; UX-AUDIT QW#1)

**File(s):** `new-code/web/src/pages/MeetingsPage.tsx`

**What & why:** In the Meetings **Grid** view (the spreadsheet-style EditableGrid), the "Salesperson"
column uses a custom `render`, which means the grid's automatic cell tooltip does not apply, and the name
truncates with no `title`. Add a tooltip on this render output.

**Exact steps:**
1. Find the Grid column object for salesperson (note: this is a plain object with `key`, `header`,
   `getValue`, and `render` — **not** a `columnHelper.accessor`). It looks like:
   ```jsx
   {
     key: 'salesperson',
     header: 'Salesperson',
     getValue: (r) => r.salesperson ?? '',
     render: (r) => (
       <span className="text-zinc-700 truncate" style={{ fontSize: 13 }}>
         {r.salesperson || <span className="text-zinc-300">—</span>}
       </span>
     ),
   },
   ```
2. Add `title={r.salesperson || undefined}` to the `<span>` inside `render`:
   ```jsx
       render: (r) => (
         <span className="text-zinc-700 truncate" style={{ fontSize: 13 }} title={r.salesperson || undefined}>
           {r.salesperson || <span className="text-zinc-300">—</span>}
         </span>
       ),
   ```

**Acceptance:**
- Run `cd new-code/web; npm run build` — passes with no new errors.
- Eyeball: the Grid salesperson cell now has a `title`; the dash fallback is unchanged.

**Guardrails:** This is the object-style Grid column (has `render`/`getValue`), distinct from the
`columnHelper.accessor('salesperson', …)` table column in Task 4. Make sure you edit the **Grid** one here
and the **table** one in Task 4 — they are different blocks. Do not change `getValue` or `key`/`header`.

---

## Task 11 — Friendlier placeholder on the Log-a-call notes field (no ticket; copy tweak)

**File(s):** `new-code/web/src/components/calls/LogCallModal.tsx`

**What & why:** Tiny copy improvement: the notes textarea placeholder is terse. Make the optional nature
and intent clearer. (Pure text; no behavior change.)

**Exact steps:**
1. Find the notes `<textarea>` in the modal body. It currently has:
   ```jsx
   <textarea
     value={notes}
     onChange={(e) => setNotes(e.target.value)}
     placeholder="What was discussed, next steps…"
     style={textareaStyle}
   />
   ```
2. Change **only** the `placeholder` string to:
   ```jsx
     placeholder="Optional — what was discussed, objections, and the next step…"
   ```
   Leave `value`, `onChange`, and `style` exactly as they are.

**Acceptance:**
- Run `cd new-code/web; npm run build` — passes with no new errors.
- Eyeball: the notes field placeholder text reads the new wording; nothing else in the modal changed.

**Guardrails:** Do not touch the save logic (`handleSave`), the duration/disposition fields, the toast
calls, or the `Field` label text. Only the one `placeholder` string.

---

## Done

When you've worked through the tasks above (skipping any whose code didn't match, and reverting any that
broke the build), stop. Do **not** commit or push. Leave everything in the working tree and report:
- which task numbers you completed,
- which you skipped and why (e.g. "code did not match", "build failed and revert was needed").

---

### Appendix — candidate items that were considered and deliberately LEFT OUT (for the senior agent)

These were evaluated against the live code and judged **not** safe/needed for an unsupervised junior agent:

- **"Add (required) text to form labels"** — *Already done.* `LeadFormPage`, `ContactFormPage`, and
  `CompanyFormPage` already render a red `*` on required fields (via their local `FieldGroup`/`Field`
  helpers). Nothing to add.
- **"Make email/phone clickable (mailto:/tel:)"** — *Already done.* `ContactPreview`, `CompanyPreview`,
  `LeadPreview`, `MeetingPreview`, and `LeadInfoPanel` already wrap emails in `mailto:` and phones in `tel:`,
  with `CopyButton`s. No plain-text email/phone left to fix.
- **"Restore the global keyboard focus ring"** — *Already done* in `src/index.css` (`:focus-visible` rules
  with a brand outline). Touching global CSS is also higher-risk than the additive tasks above.
- **"Remove the dev-era 'live Supabase data — read-only preview' banners"** — *Already removed.* No such
  banner text exists anymore.
- **"Distinguish 'no data' vs 'no filter match' empty states"** — *Already done* on the table views of
  Leads/Companies/Meetings/Wishlist (they branch on `hasActiveFilters` and show different `EmptyState` copy +
  a Clear-filters action). Not worth a junior touching.
- **"Add aria-labels to the Assign/Change-owner buttons"** (in the preview panels) — *Not a real gap.* Those
  buttons already contain **visible text** ("Change owner" / "Assign salesperson"), so they already have an
  accessible name. Adding aria-label would be redundant and risks masking the visible label.
- **Confirm-on-destructive-action / toast system / Cmd-K / error boundary / dirty-guards / multi-select
  filters** — *Already built and wired* (`ConfirmDialog`, `Toast`, `CommandPalette`, `ErrorBoundary`,
  `useUnsavedChanges`, `MultiSelectFilter`). Out of scope here.
- **LogCall duration "validate on blur instead of submit"** (DATA-OPS §E) — *Rejected as too involved* for a
  junior: it means adding new on-blur validation state and an error-display path, not a one-line additive edit.
- **Notification bell → wire to /notifications with unread badge** (UX-AUDIT QW#3) — *Rejected:* needs
  data-fetching for the unread count, which is outside the additive/pure-display rule.
- **Contacts 1000-row cap / Meetings 2000-row cap warning banners** (UX-AUDIT QW#13, DATA-OPS A3) — *Rejected:*
  these touch the data layer and truncation logic (`src/data/**`), which is forbidden for this queue.
