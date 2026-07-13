#!/usr/bin/env node
/**
 * gen-conversation-log.cjs — durable, human-readable archive of EVERY chat.
 *
 * WHY: Claude Code compaction summarizes old turns and the in-app history can
 * feel "lost". Ankit asked for one place that always holds his past messages +
 * Claude's responses, kept current, so nothing he asked before is forgotten.
 *
 * WHAT: reads every top-level session transcript (.jsonl) for THIS project from
 * ~/.claude/projects/<encoded-cwd>/, extracts the real conversation (user asks +
 * assistant replies — drops tool-call noise, thinking, system reminders, and
 * local-command wrappers), scrubs anything that looks like a secret, and writes
 * docs/CONVERSATION-LOG.md (newest session last, chronological within a session).
 *
 * The log is GITIGNORED (old chats contain pasted tokens/passwords) — it lives
 * locally only, like the transcripts and .credentials/ do.
 *
 * RUN:   node new-code/web/scripts/gen-conversation-log.cjs
 * AUTO:  a SessionStart hook (.claude/settings.local.json) runs it each session.
 *
 * Env/args:
 *   CLAUDE_PROJECT_DIR  repo root (defaults to process.cwd())
 *   --full              include FULL assistant replies (default: truncates them
 *                       to keep the file skimmable; user messages are always full)
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');

const REPO_ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const FULL = process.argv.includes('--full');
const ASSISTANT_CAP = FULL ? Infinity : 1200; // chars of each assistant reply kept

// Claude Code encodes the cwd into the projects-dir name by replacing every
// non-alphanumeric char with '-'. e.g. c:\Users\pc\...\AL -> c--Users-pc-...-AL
function encodeProjectDir(absPath) {
  return absPath.replace(/[^A-Za-z0-9]/g, '-');
}

const PROJECTS_DIR = path.join(
  os.homedir(), '.claude', 'projects', encodeProjectDir(REPO_ROOT),
);
const OUT_FILE = path.join(REPO_ROOT, 'docs', 'CONVERSATION-LOG.md');

// ---- secret scrubbing (best-effort; the file is gitignored regardless) ------
const SECRET_PATTERNS = [
  [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[REDACTED-JWT]'],
  [/dop_v1_[a-f0-9]{40,}/gi, '[REDACTED-DO-TOKEN]'],
  [/sbp_[a-f0-9]{40,}/gi, '[REDACTED-SUPABASE-TOKEN]'],
  [/gh[pousr]_[A-Za-z0-9]{30,}/g, '[REDACTED-GH-TOKEN]'],
  [/sk-[A-Za-z0-9_-]{20,}/g, '[REDACTED-API-KEY]'],
  [/AKIA[0-9A-Z]{16}/g, '[REDACTED-AWS-KEY]'],
  // "password: xxxx" / "app password is abcd efgh ijkl mnop"
  [/((?:app\s+)?password\s*(?:is|=|:)\s*)([^\s,;]{6,})/gi, '$1[REDACTED]'],
  [/((?:token|secret|api[_-]?key|service[_-]?role[_-]?key)\s*(?:is|=|:)\s*)([^\s,;]{12,})/gi, '$1[REDACTED]'],
];
function scrub(text) {
  let t = text;
  for (const [re, rep] of SECRET_PATTERNS) t = t.replace(re, rep);
  return t;
}

// ---- pull the readable text out of one transcript message --------------------
function extractText(message) {
  if (!message || !message.role) return null;
  const c = message.content;
  let text = '';
  if (typeof c === 'string') text = c;
  else if (Array.isArray(c)) {
    for (const b of c) {
      if (b && b.type === 'text' && typeof b.text === 'string') text += b.text + '\n';
      // skip tool_use / tool_result / thinking / images
    }
  }
  return text.trim();
}

// noise we never want in the log
function isNoise(role, text) {
  if (!text) return true;
  if (role === 'user') {
    // local-command wrappers, hook output, system reminders, bare tool-result echoes
    if (/^<(local-command|command-name|command-message|command-args|bash-|system-reminder|user-prompt-submit|task-notification|local-command-)/.test(text)) return true;
    if (/^Caveat: The messages below were generated/.test(text)) return true;
    if (text === '[Request interrupted by user]' || text === '(no content)') return true;
  }
  return false;
}

function fmtTime(iso) {
  if (!iso) return '';
  // keep it readable & stable; the raw ISO is fine for an engineer
  return iso.replace('T', ' ').replace(/\.\d+Z?$/, '').replace('Z', '') + ' UTC';
}

async function readSession(file) {
  const msgs = [];
  let firstTs = null;
  const rl = readline.createInterface({
    input: fs.createReadStream(file, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    if (!firstTs && o.timestamp) firstTs = o.timestamp;
    const text = extractText(o.message);
    const role = o.message && o.message.role;
    if (isNoise(role, text)) continue;
    msgs.push({ role, text: scrub(text), ts: o.timestamp || '' });
  }
  return { msgs, firstTs };
}

(async () => {
  if (!fs.existsSync(PROJECTS_DIR)) {
    console.error('No transcripts dir found at:', PROJECTS_DIR);
    process.exit(0);
  }
  const files = fs.readdirSync(PROJECTS_DIR)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => ({ f, full: path.join(PROJECTS_DIR, f), mtime: fs.statSync(path.join(PROJECTS_DIR, f)).mtimeMs }))
    .sort((a, b) => a.mtime - b.mtime); // oldest session first

  const out = [];
  out.push('# Conversation Log — every chat, kept durable\n');
  out.push('> Auto-generated by `new-code/web/scripts/gen-conversation-log.cjs` (re-run by a SessionStart hook).');
  out.push('> Your messages in full + Claude\'s replies (assistant replies truncated unless built with `--full`).');
  out.push('> **Gitignored / local-only** — old chats contain pasted secrets. Do not commit or share.');
  out.push('> Newest session is at the BOTTOM. Within a session, oldest message first.\n');

  let totalUser = 0, totalAsst = 0;
  const sessionLines = [];
  for (let i = 0; i < files.length; i++) {
    const { f, full } = files[i];
    const { msgs, firstTs } = await readSession(full);
    if (!msgs.length) continue;
    const id = f.replace('.jsonl', '');
    sessionLines.push(`\n---\n\n## Session ${i + 1} — \`${id.slice(0, 8)}\`  ·  started ${fmtTime(firstTs)}\n`);
    for (const m of msgs) {
      if (m.role === 'user') {
        totalUser++;
        sessionLines.push(`\n### 🧑 Ankit — ${fmtTime(m.ts)}\n\n${m.text}\n`);
      } else if (m.role === 'assistant') {
        totalAsst++;
        let body = m.text;
        if (body.length > ASSISTANT_CAP) {
          body = body.slice(0, ASSISTANT_CAP).trimEnd() + `\n\n_…[reply truncated — ${m.text.length - ASSISTANT_CAP} more chars; rebuild with --full for everything]_`;
        }
        sessionLines.push(`\n### 🤖 Claude — ${fmtTime(m.ts)}\n\n${body}\n`);
      }
    }
  }

  out.push(`**${files.length} sessions · ${totalUser} of your messages · ${totalAsst} replies.** Last rebuilt: ${new Date().toISOString().replace('T', ' ').replace(/\..+/, '')} UTC\n`);
  out.push(...sessionLines);

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, out.join('\n'), 'utf8');
  const kb = (fs.statSync(OUT_FILE).size / 1024).toFixed(0);
  console.log(`Wrote ${OUT_FILE}`);
  console.log(`Sessions: ${files.length} · your messages: ${totalUser} · replies: ${totalAsst} · ${kb} KB`);
})();
