# AltLeads Chrome Extensions — Build Conventions

> For the two extension agents building on top of this foundation.
> The baseline build is GREEN as of 2026-06-22.

---

## Workspace layout

```
new-code/extensions/
  shared/               ← TypeScript modules shared by BOTH extensions
    types.ts            ← all shared interfaces / message types
    normalizeLinkedin.ts← normalizeLinkedinSlug() — the slug normalizer
    supabaseClient.ts   ← singleton Supabase client (chrome.storage session)
    auth.ts             ← signIn / signOut / getSessionAndProfile / role helpers
    rpc.ts              ← findContactDup() + findContactForPanel() with fallback
    contactData.ts      ← read helpers: contact, leads, status, activity, tasks, projects
  contact-viewer/       ← Extension 1: "AltLeads CRM on LinkedIn"
    manifest.json       ← MV3 manifest (static; copied into dist/ by Vite plugin)
    .env                ← VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
    vite.config.ts      ← multi-entry Vite build
    tsconfig.json       ← TS config with @shared/* path alias
    package.json
    src/
      background.ts     ← MV3 service worker (tab URL watcher)
      sidepanel.ts      ← side panel controller
      sidepanel.html    ← side panel HTML (entry point; copied to dist/)
    dist/               ← build output (loadable unpacked extension)
  data-research/        ← Extension 2: "AltLeads Data Research"
    (same structure as contact-viewer/)
  BUILD-CONVENTIONS.md  ← this file
```

---

## Build tooling

**Plain Vite 5 + TypeScript 5.6. No @crxjs.**

@crxjs/vite-plugin 2.x is incompatible with Vite 5 (peer-dep gap).  We use a manual multi-entry Vite build instead.  A tiny `copyStaticAssets` Vite plugin (defined inline in `vite.config.ts`) copies `manifest.json` and `sidepanel.html` into `dist/` after the rollup bundle is written.

---

## Build command

From either extension folder:

```bash
npm install          # one-time (independent node_modules per extension)
npm run build        # vite build → dist/
npm run dev          # vite build --watch
npm run typecheck    # tsc --noEmit (separate from build)
```

The `build` script is `vite build` only (tsc is not run as a pre-step because tsc cannot resolve `@supabase/supabase-js` from the shared/ folder without a workspace setup; Vite's bundler resolves it correctly from the extension's node_modules).  Run `npm run typecheck` separately for type safety.

---

## Adding a new extension

Copy `contact-viewer/` to a new folder (e.g. `my-extension/`), then:
1. Update `manifest.json` (name, description, permissions).
2. Update `package.json` (name field).
3. Update `.env` (same Supabase URL+key; or a different project if needed).
4. `npm install && npm run build`.

---

## Importing shared code

Use the `@shared/*` alias in both TypeScript and Vite:

```ts
import { normalizeLinkedinSlug } from '@shared/normalizeLinkedin';
import { getSupabaseClient }     from '@shared/supabaseClient';
import { signIn, loadProfile }   from '@shared/auth';
import { findContactForPanel }   from '@shared/rpc';
import { fetchContactDetail }    from '@shared/contactData';
import type { UserProfile }      from '@shared/types';
```

The alias is defined in `vite.config.ts` (`resolve.alias`) and `tsconfig.json` (`paths`).  Vite resolves `@supabase/supabase-js` from the extension's own `node_modules` even when the importing file lives in `../shared/` — this works because of `resolve.dedupe: ['@supabase/supabase-js']` in `vite.config.ts`.

---

## Environment variables

Each extension has its own `.env` at the extension root (not shared/).  Vite reads it because `envDir: '.'` is set in `vite.config.ts`.

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://puvozfhypqbwbmbhrhcr.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | (the public anon key — safe to ship) |

**Never add the service-role key.** It is only used server-side in `new-code/notify-service/`.

---

## Manifest shape (non-negotiable)

```jsonc
{
  "manifest_version": 3,
  "permissions": ["sidePanel", "tabs", "storage"],
  "host_permissions": ["https://puvozfhypqbwbmbhrhcr.supabase.co/*"],
  "background": { "service_worker": "background.js", "type": "module" },
  "side_panel":  { "default_path": "sidepanel.html" }
  // NO content_scripts. NO scripting permission.
  // NO linkedin.com host permission.
}
```

`background.js` and `sidepanel.js` are produced by Vite from `src/background.ts` and `src/sidepanel.ts` with `entryFileNames: '[name].js'` (flat, no hash) so the manifest's static paths resolve correctly.

---

## Hard compliance rules (must never be broken)

1. NO content scripts. NO page injection. NO reading the LinkedIn page DOM.
2. The ONLY LinkedIn input is `tab.url`, read by the background service worker via `chrome.tabs.onUpdated` / `chrome.tabs.onActivated` / `chrome.tabs.query`. Never `window.location`, never `document`.
3. All UI in the Chrome MV3 `side_panel`. No injected / floating / shadow-DOM UI.
4. Permissions exactly `["sidePanel","tabs","storage"]`. No `"scripting"`, no `"activeTab"`, no `"linkedin.com"` host permission.
5. Auth: `supabase.auth.signInWithPassword` only. Session in `chrome.storage`. No service-role key. No "skip login" / dev backdoors.
6. Phase 1 is READ-ONLY for contact data. No writes to `contact_master` / `contact_project_status` / `interaction` until ALT-152 is fixed and validated with a real non-admin agent login.

---

## Vite config pattern (copy this for new extensions)

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync } from 'fs';

function copyStaticAssets() {
  return {
    name: 'copy-static-assets',
    closeBundle() {
      mkdirSync('dist', { recursive: true });
      copyFileSync('manifest.json', 'dist/manifest.json');
      try { copyFileSync('src/sidepanel.html', 'dist/sidepanel.html'); } catch {}
      // copy icons if present...
    },
  };
}

export default defineConfig({
  root: '.',
  envDir: '.',
  resolve: {
    alias: { '@shared': resolve(__dirname, '../shared') },
    dedupe: ['@supabase/supabase-js'],    // ← required for shared/ imports to work
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background.ts'),
        sidepanel:  resolve(__dirname, 'src/sidepanel.ts'),
      },
      output: {
        entryFileNames: '[name].js',     // flat — manifest references background.js / sidepanel.js
        chunkFileNames: 'chunks/[name]-[hash].js',
        format: 'es',                    // MV3 service workers are ES modules
      },
    },
  },
  plugins: [copyStaticAssets()],
});
```

---

## Loadable extension checklist (dist/ must contain)

- `manifest.json` (copied from root)
- `background.js` (ES module, `type: module` in manifest)
- `sidepanel.html` + `sidepanel.js`
- `icons/` (optional for dev; required for Chrome Web Store)
