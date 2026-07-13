'use strict';

/**
 * gen-build-info.cjs — stamp the build so /health can report exactly which
 * commit + build time is LIVE (the permanent answer to "is prod loaded with my
 * push?"). Runs as the FIRST step of the root `build` script, so it executes
 * inside Hostinger's git checkout.
 *
 * Git is best-effort: if `git` isn't on PATH at build time, `commit` falls back
 * to a deploy env var, then 'unknown' — but `builtAt` is ALWAYS captured, so the
 * stamp is never empty. Output (build-info.json) is gitignored and read once at
 * server boot.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.join(__dirname, '..', '..');

function tryGit(args) {
  try {
    const out = execSync(`git ${args}`, {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    return out || null;
  } catch {
    return null;
  }
}

const info = {
  commit:
    tryGit('rev-parse --short HEAD') ||
    process.env.SOURCE_COMMIT ||
    process.env.GIT_COMMIT ||
    'unknown',
  commitFull: tryGit('rev-parse HEAD'),
  branch: tryGit('rev-parse --abbrev-ref HEAD'),
  builtAt: new Date().toISOString(),
  node: process.version,
};

const outPath = path.join(__dirname, 'build-info.json');
fs.writeFileSync(outPath, JSON.stringify(info, null, 2) + '\n');
console.log(`[build-info] ${info.commit} @ ${info.builtAt} -> ${outPath}`);
