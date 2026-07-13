# How to Push to Production (self-serve)

> So you never have to wait on Claude to deploy. Pushing to `main` **auto-deploys to production** (crm.altleads.com on Hostinger). Only push when you're ready for it to go live.

## The one command
Open a terminal in the repo folder (`...\Desktop\AL`) and run:

```bash
git push altleads clean-main:main
```

That's it. This pushes your local branch `clean-main` to the remote `main`, which triggers Hostinger to rebuild and deploy. (Local branch = `clean-main`; production branch = `main`; remote name = `altleads`.)

## Before you push — see exactly what will go live
```bash
git log --oneline altleads/main..HEAD
```
This lists every commit that is on your machine but NOT yet in production — i.e. exactly what this push will deploy. If the list looks right, push.

(Optional) see which files changed:
```bash
git diff --stat altleads/main..HEAD
```

## After you push — confirm production actually loaded the new code
Wait ~1–3 minutes for Hostinger to build, then run:
```bash
curl https://crm.altleads.com/health
```
The response includes a `build` block showing the live commit hash + build time. Match the commit to the top of your `git log` — if it matches, the new code is live. If it still shows the old commit, the build is either still running or failed (give it another minute, then re-check).

## If something looks wrong after deploy
You can roll production back to the previous good commit. **Ask Claude to do this** (it's reversible but easy to get wrong by hand). For reference, the safe pattern is to push the last-known-good commit hash back to `main`. Don't force-push or reset without a second pair of eyes.

## Rules (from CLAUDE.md)
- **Deploys are manual.** Nothing reaches production unless you run the push command above.
- Never commit secrets — they live in the gitignored `.credentials/` folder.
- Database migrations (files in `new-code/migration/`) are **NOT** run by a push — they're applied separately and deliberately. A push only deploys the app code. So anything "staged" (like the atomic-merge RPC) stays inert until its migration is applied on purpose.

## Quick reference
| I want to… | Command |
|---|---|
| See what will deploy | `git log --oneline altleads/main..HEAD` |
| Push to production | `git push altleads clean-main:main` |
| Verify it's live | `curl https://crm.altleads.com/health` |
