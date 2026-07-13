# Amplior / Altleads CRM — Rebuild

A clean rebuild of the Amplior / Altleads CRM, a B2B field-sales CRM (leads, meetings,
wishlist, notifications, admin). The original was built by an outsourced vendor and left in a
poor state; this repo replaces it with a maintainable, owner-manageable system on a modern,
serverless stack — keeping the real production data (65 tables, ~108k rows) and all six user
roles (Admin, Team Lead, Sales Head, Sales Person, Agent, QC).

## Folder map

| Folder | What's in it |
|---|---|
| `old-code/` | The original vendor codebases (Java backend, React web, React Native mobile, an abandoned rebuild). **Read-only reference** — the spec we rebuild from. |
| `new-code/` | Everything new: the rebuilt web app, the data migration, and (later) mobile fixes. |
| `docs/` | All project documents — architecture, user stories, the FRS, the product docs (`docs/product/`), and reference exports. |
| `.credentials/` | Gitignored secrets vault (tokens, keys, DB creds). Never committed. |

## Where to start

- **Current status & full story:** [`REBUILD_LOG.md`](REBUILD_LOG.md) — the master log; read it first.
- **Product docs (what/why/who):** [`docs/product/INDEX.md`](docs/product/INDEX.md) — index of the PRD, backlog, roadmap, roles, data dictionary, and more.
- **Technical overview:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — plain-language guide to the new setup.

## Tech stack (locked, owner-approved)

TypeScript everywhere · **Supabase** (Postgres database + Auth + Storage) · **React + Vite** ·
**Tailwind + shadcn/ui** · **TanStack Table** (replaces paid AG Grid Enterprise) ·
**Netlify Functions** for server logic · **React Native** (repair the existing mobile app) ·
hosted on **Netlify** with GitHub auto-deploy. No Java, no MySQL, no self-managed server.
