'use strict';
/**
 * emailSending.js — ALT-503/506 Phase 1 (ADR-35): domain-authenticated
 * per-user sending with per-project sending domains.
 *
 * Model (benchmark: HubSpot unlimited authenticated domains / Odoo
 * from_filter-per-domain): admin registers domains in sending_domain, each
 * carries its required DNS records (SPF/DKIM/DMARC) as jsonb; verification
 * resolves live DNS and flips the row to 'verified'; each project picks one
 * verified domain (project_email_setting); a user's From address is their
 * email local-part on the project's domain (sending_alias overrides).
 *
 * Relay: set EMAIL_SMTP_HOST/PORT/USER/PASS to a transactional relay
 * (Brevo / SES / Mailgun ...) that permits any From on authenticated domains.
 * Without it we FALL BACK to the existing Gmail transporter — Gmail forces its
 * own From, so we send as "<Full Name> · Amplior CRM <GMAIL_USER>" with
 * Reply-To = the user, and tell the caller relay:'fallback'. Real per-user
 * From therefore activates the moment the relay env vars are set — no code
 * change, no redeploy of anything else.
 *
 * Endpoints (all POST/GET — matches the service's CORS method list):
 *   GET  /api/email/domains                      requireAuth   list registry + project settings
 *   POST /api/email/domains                      requireAdmin  { domain } → row with template DNS records
 *   POST /api/email/domains/:id/records          requireAdmin  { dns_records } paste provider values
 *   POST /api/email/domains/:id/verify           requireAdmin  live DNS check, updates statuses
 *   POST /api/email/project-setting              requireAdmin  { project_id, domain_id|null }
 *   POST /api/email/send                         requireAuth   { to, subject, html|text, project_id?, lead_id?, contact_id? }
 */

const dns = require('dns').promises;
const nodemailer = require('nodemailer');

const FALLBACK_DOMAIN = process.env.EMAIL_FALLBACK_DOMAIN || 'amplior.com';
const SPF_INCLUDE = process.env.EMAIL_SPF_INCLUDE || ''; // e.g. spf.brevo.com — set with the relay

/* Relay transporter (lazy). Present only when EMAIL_SMTP_HOST is configured. */
let relayTransport = null;
function getRelayTransport() {
  if (relayTransport) return relayTransport;
  const host = process.env.EMAIL_SMTP_HOST;
  if (!host) return null;
  relayTransport = nodemailer.createTransport({
    host,
    port: parseInt(process.env.EMAIL_SMTP_PORT || '587', 10),
    secure: process.env.EMAIL_SMTP_SECURE === 'true',
    auth: process.env.EMAIL_SMTP_USER
      ? { user: process.env.EMAIL_SMTP_USER, pass: process.env.EMAIL_SMTP_PASS }
      : undefined,
  });
  return relayTransport;
}

/* Template DNS records for a newly added domain. DKIM host/value arrive from
   the relay provider later — stored as placeholders until pasted in. */
function templateRecords(domain) {
  return [
    { purpose: 'spf',   type: 'TXT', host: domain,
      value: SPF_INCLUDE ? `v=spf1 include:${SPF_INCLUDE} ~all` : 'v=spf1 include:<relay-provider> ~all',
      verified: false },
    { purpose: 'dkim',  type: 'TXT', host: `<selector>._domainkey.${domain}`,
      value: '<paste the DKIM record from the relay provider>', verified: false },
    { purpose: 'dmarc', type: 'TXT', host: `_dmarc.${domain}`,
      value: `v=DMARC1; p=none; rua=mailto:postmaster@${domain}`, verified: false },
  ];
}

function isPlaceholder(rec) {
  return String(rec.value || '').includes('<') || String(rec.host || '').includes('<');
}

/* Verify one record against live DNS. Pragmatic matching: SPF/DMARC pass on
   their protocol tag being present at the right host; DKIM (and any pasted
   exact value) passes on substring match of the expected value. */
async function verifyRecord(rec) {
  if (isPlaceholder(rec)) return { ...rec, verified: false, seen: 'placeholder — paste real value first' };
  try {
    let seen = [];
    if (rec.type === 'CNAME') {
      seen = await dns.resolveCname(rec.host);
    } else {
      seen = (await dns.resolveTxt(rec.host)).map((parts) => parts.join(''));
    }
    const needle =
      rec.purpose === 'spf'   ? 'v=spf1' :
      rec.purpose === 'dmarc' ? 'v=DMARC1' : String(rec.value);
    const hit = seen.find((v) => v.includes(needle));
    // For SPF, additionally require our relay include when one is configured.
    const spfOk = rec.purpose !== 'spf' || !SPF_INCLUDE || (hit && hit.includes(SPF_INCLUDE));
    return { ...rec, verified: Boolean(hit) && spfOk, seen: seen.slice(0, 3).join(' | ').slice(0, 500) };
  } catch (e) {
    return { ...rec, verified: false, seen: `lookup failed: ${e.code || e.message}` };
  }
}

function mount(app, getSupabaseAdmin, { requireAuth, requireAdmin, getTransporter, GMAIL_USER, logEmail }) {

  /* Strict numeric route param — Supabase would otherwise coerce/error deep
     inside a query; fail fast at the edge instead. */
  function numParam(res, raw) {
    const n = Number(raw);
    if (!Number.isInteger(n) || n <= 0) { res.status(400).json({ error: 'invalid id' }); return null; }
    return n;
  }

  /* ── list registry (+ project settings + aliases) ─────────────── */
  app.get('/api/email/domains', requireAuth, async (_req, res) => {
    const admin = getSupabaseAdmin();
    if (!admin) return res.status(503).json({ error: 'service not configured' });
    const [{ data: domains }, { data: settings }, { data: aliases }] = await Promise.all([
      admin.from('sending_domain').select('*').order('domain_id'),
      admin.from('project_email_setting').select('*'),
      admin.from('sending_alias').select('*'),
    ]);
    res.json({ ok: true, domains: domains || [], settings: settings || [], aliases: aliases || [],
               relay: getRelayTransport() ? 'configured' : 'fallback', fallback_domain: FALLBACK_DOMAIN });
  });

  /* ── add a domain ─────────────────────────────────────────────── */
  app.post('/api/email/domains', requireAdmin, async (req, res) => {
    const admin = getSupabaseAdmin();
    const domain = String(req.body?.domain || '').trim().toLowerCase();
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
      return res.status(400).json({ error: 'invalid domain' });
    }
    // Ladder (board entry 6): who hosts this domain's mailboxes — decides
    // which connector users are offered. 'relay' = no real mailboxes.
    const provider = ['google', 'microsoft', 'relay'].includes(req.body?.provider)
      ? req.body.provider : 'relay';
    const { data, error } = await admin.from('sending_domain')
      .insert({ domain, provider, dns_records: templateRecords(domain), created_by: req.actorUserId })
      .select().single();
    if (error) return res.status(error.code === '23505' ? 409 : 500).json({ error: error.message });
    res.json({ ok: true, domain: data });
  });

  /* ── paste/replace a domain's DNS records ─────────────────────── */
  app.post('/api/email/domains/:id/records', requireAdmin, async (req, res) => {
    const admin = getSupabaseAdmin();
    const domainId = numParam(res, req.params.id);
    if (domainId == null) return;
    const recs = req.body?.dns_records;
    if (!Array.isArray(recs) || recs.length > 12 || recs.some((r) => !r.host || !r.value || !r.purpose)) {
      return res.status(400).json({ error: 'dns_records must be [{purpose, type, host, value}] (max 12)' });
    }
    const cleaned = recs.map((r) => ({
      purpose: String(r.purpose), type: r.type === 'CNAME' ? 'CNAME' : 'TXT',
      host: String(r.host).trim().slice(0, 255), value: String(r.value).trim().slice(0, 2048), verified: false,
    }));
    const { data, error } = await admin.from('sending_domain')
      .update({ dns_records: cleaned, status: 'pending', updated_at: new Date().toISOString() })
      .eq('domain_id', domainId).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true, domain: data });
  });

  /* ── verify a domain against live DNS ─────────────────────────── */
  app.post('/api/email/domains/:id/verify', requireAdmin, async (req, res) => {
    const admin = getSupabaseAdmin();
    const domainId = numParam(res, req.params.id);
    if (domainId == null) return;
    const { data: row, error } = await admin.from('sending_domain')
      .select('*').eq('domain_id', domainId).single();
    if (error || !row) return res.status(404).json({ error: 'domain not found' });
    const checked = await Promise.all((row.dns_records || []).map(verifyRecord));
    const allOk = checked.length > 0 && checked.every((r) => r.verified);
    const status = allOk ? 'verified' : 'pending';
    const { data: updated, error: uErr } = await admin.from('sending_domain')
      .update({ dns_records: checked, status,
                verified_at: allOk ? new Date().toISOString() : row.verified_at,
                updated_at: new Date().toISOString() })
      .eq('domain_id', row.domain_id).select().single();
    if (uErr) return res.status(500).json({ error: uErr.message });
    res.json({ ok: true, domain: updated, verified: allOk });
  });

  /* ── set (or clear) a project's sending domain ────────────────── */
  app.post('/api/email/project-setting', requireAdmin, async (req, res) => {
    const admin = getSupabaseAdmin();
    const projectId = Number(req.body?.project_id);
    const domainId = req.body?.domain_id == null ? null : Number(req.body.domain_id);
    if (!Number.isFinite(projectId)) return res.status(400).json({ error: 'project_id required' });
    if (domainId == null) {
      const { error } = await admin.from('project_email_setting').delete().eq('project_id', projectId);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ ok: true, cleared: true });
    }
    const { data: dom } = await admin.from('sending_domain')
      .select('domain_id,status').eq('domain_id', domainId).single();
    if (!dom) return res.status(404).json({ error: 'domain not found' });
    if (dom.status !== 'verified') return res.status(409).json({ error: 'domain not verified — verify DNS first' });
    const { error } = await admin.from('project_email_setting')
      .upsert({ project_id: projectId, domain_id: domainId,
                updated_by: req.actorUserId, updated_at: new Date().toISOString() });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });

  /* ── set / clear a per-user alias override (3b; default is 3a auto) ── */
  app.post('/api/email/alias', requireAdmin, async (req, res) => {
    const admin = getSupabaseAdmin();
    const userId = Number(req.body?.user_id);
    const domainId = Number(req.body?.domain_id);
    const alias = req.body?.alias == null ? null : String(req.body.alias).trim().toLowerCase();
    if (!Number.isFinite(userId) || !Number.isFinite(domainId)) {
      return res.status(400).json({ error: 'user_id and domain_id required' });
    }
    if (alias === null || alias === '') {
      const { error } = await admin.from('sending_alias')
        .delete().eq('user_id', userId).eq('domain_id', domainId);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ ok: true, cleared: true });
    }
    if (!/^[a-z0-9._-]+$/.test(alias)) {
      return res.status(400).json({ error: 'alias may only contain letters, numbers, dot, dash, underscore' });
    }
    const { error } = await admin.from('sending_alias')
      .upsert({ user_id: userId, domain_id: domainId, alias,
                display_name: req.body?.display_name ? String(req.body.display_name) : null },
              { onConflict: 'user_id,domain_id' });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });

  /* ── record email feed + admin log (ALT-510) ──────────────────── */
  /**
   * GET /api/email/log?lead_id=|contact_id=|company_id=&limit=
   * With a record filter: any authenticated user (their record pages).
   * Without one: FULL log — admins only.
   */
  app.get('/api/email/log', requireAuth, async (req, res) => {
    const admin = getSupabaseAdmin();
    const { lead_id, contact_id, company_id } = req.query;
    const limit = Math.min(parseInt(req.query.limit || '50', 10) || 50, 200);
    let q = admin.from('email_log')
      .select('id, sent_to, email_type, subject, status, error, message_id, lead_id, contact_id, company_id, actor, created_date')
      .order('created_date', { ascending: false })
      .limit(limit);
    if (lead_id) q = q.eq('lead_id', Number(lead_id));
    else if (contact_id) q = q.eq('contact_id', Number(contact_id));
    else if (company_id) q = q.eq('company_id', Number(company_id));
    else {
      const { data: prof } = await admin.from('profiles').select('role').eq('id', req.actorUserId).single();
      if (!prof || prof.role !== 'ADMIN') return res.status(403).json({ error: 'full log is admin only' });
    }
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true, emails: data || [] });
  });

  /* ── email templates (ALT-509) ─────────────────────────────────── */
  /* GET: global + caller's personal templates. */
  app.get('/api/email/templates', requireAuth, async (req, res) => {
    const admin = getSupabaseAdmin();
    const { data: prof } = await admin.from('profiles').select('user_id').eq('id', req.actorUserId).single();
    const { data, error } = await admin.from('email_template')
      .select('*').eq('is_active', true)
      .or(`scope.eq.global,owner_user_id.eq.${prof?.user_id ?? -1}`)
      .order('scope').order('name');
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true, templates: data || [] });
  });

  /* POST { action: 'create'|'update'|'delete', template } — personal for
     anyone (owned); global requires admin. */
  app.post('/api/email/templates', requireAuth, async (req, res) => {
    const admin = getSupabaseAdmin();
    const { action, template } = req.body || {};
    if (!['create', 'update', 'delete'].includes(action) || !template) {
      return res.status(400).json({ error: 'action (create|update|delete) and template required' });
    }
    const { data: prof } = await admin.from('profiles')
      .select('user_id, role').eq('id', req.actorUserId).single();
    if (!prof) return res.status(403).json({ error: 'no profile' });
    const isAdminRole = prof.role === 'ADMIN';
    const scope = template.scope === 'global' ? 'global' : 'personal';
    if (scope === 'global' && !isAdminRole) return res.status(403).json({ error: 'global templates are admin only' });

    if (action === 'create') {
      const { data, error } = await admin.from('email_template').insert({
        name: String(template.name || '').slice(0, 120) || 'Untitled',
        subject: String(template.subject || '').slice(0, 500),
        body: String(template.body || '').slice(0, 65536),
        scope,
        owner_user_id: scope === 'personal' ? prof.user_id : null,
        created_by: req.actorUserId,
      }).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ ok: true, template: data });
    }

    /* update/delete: must own it (personal) or be admin */
    const { data: row } = await admin.from('email_template')
      .select('template_id, scope, owner_user_id').eq('template_id', template.template_id).single();
    if (!row) return res.status(404).json({ error: 'template not found' });
    const owns = row.scope === 'personal' && row.owner_user_id === prof.user_id;
    if (!owns && !isAdminRole) return res.status(403).json({ error: 'not your template' });

    if (action === 'delete') {
      const { error } = await admin.from('email_template')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('template_id', row.template_id);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ ok: true });
    }
    const { data, error } = await admin.from('email_template').update({
      name: String(template.name || '').slice(0, 120) || 'Untitled',
      subject: String(template.subject || '').slice(0, 500),
      body: String(template.body || '').slice(0, 65536),
      updated_at: new Date().toISOString(),
    }).eq('template_id', row.template_id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true, template: data });
  });

  /* ── send an email as the logged-in user ──────────────────────── */
  app.post('/api/email/send', requireAuth, async (req, res) => {
    const admin = getSupabaseAdmin();
    const { to, subject, html, text, project_id, lead_id, contact_id, company_id, attachments } = req.body || {};
    const recipient = String(to || '').trim();
    if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(recipient)) {
      return res.status(400).json({ error: 'to must be a single valid email address' });
    }
    if (!subject || (!html && !text)) return res.status(400).json({ error: 'subject and html or text required' });
    if ((html && String(html).length > 262144) || (text && String(text).length > 262144)) {
      return res.status(400).json({ error: 'message body too large (256KB max)' });
    }

    /* ALT-509: attachments [{filename, content(base64), contentType}] —
       max 5 files / 7MB total (decoded). Bytes are sent, not stored;
       names+sizes land in email_log.attachments (audit trail). */
    let mailAttachments = [];
    let attachmentMeta = null;
    if (attachments != null) {
      if (!Array.isArray(attachments) || attachments.length > 5) {
        return res.status(400).json({ error: 'attachments: max 5 files' });
      }
      let total = 0;
      for (const a of attachments) {
        if (!a?.filename || !a?.content) return res.status(400).json({ error: 'each attachment needs filename + content (base64)' });
        const size = Math.floor(String(a.content).length * 0.75); // decoded estimate
        total += size;
        if (total > 7 * 1024 * 1024) return res.status(400).json({ error: 'attachments too large — max 7MB total' });
        mailAttachments.push({
          filename: String(a.filename).slice(0, 200),
          content: String(a.content),
          encoding: 'base64',
          ...(a.contentType ? { contentType: String(a.contentType) } : {}),
        });
      }
      attachmentMeta = mailAttachments.map((a, i) => ({
        filename: a.filename,
        size: Math.floor(String(attachments[i].content).length * 0.75),
        contentType: a.contentType ?? null,
      }));
    }

    /* ALT-512 slice 1: per-user daily cap — one careless sender must not be
       able to torch the domain's reputation. Counted from email_log (sent
       user_send rows by this actor since local midnight). Env-tunable. */
    const DAILY_CAP = parseInt(process.env.EMAIL_USER_DAILY_CAP || '200', 10);
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const { count: sentToday } = await admin.from('email_log')
      .select('id', { count: 'exact', head: true })
      .eq('actor', req.actorUserId).eq('email_type', 'user_send').eq('status', 'sent')
      .gte('created_date', dayStart.toISOString());
    if ((sentToday ?? 0) >= DAILY_CAP) {
      return res.status(429).json({ error: `daily send limit reached (${DAILY_CAP}/day) — protects deliverability; ask an admin if you need more` });
    }

    /* who is sending — profile (email + numeric user_id) + full name */
    const { data: prof } = await admin.from('profiles')
      .select('user_id, email').eq('id', req.actorUserId).single();
    if (!prof?.email) return res.status(403).json({ error: 'no profile email for sender' });
    const { data: um } = await admin.from('user_master')
      .select('full_name').eq('user_id', prof.user_id).maybeSingle();
    const displayName = um?.full_name || prof.email.split('@')[0];

    /* which domain — project setting → fallback domain; must be verified */
    let domainRow = null;
    if (project_id != null) {
      const { data: setting } = await admin.from('project_email_setting')
        .select('domain_id').eq('project_id', Number(project_id)).maybeSingle();
      if (setting) {
        const { data } = await admin.from('sending_domain')
          .select('*').eq('domain_id', setting.domain_id).single();
        domainRow = data;
      }
    }
    if (!domainRow) {
      const { data } = await admin.from('sending_domain')
        .select('*').eq('domain', FALLBACK_DOMAIN).maybeSingle();
      domainRow = data;
    }

    /* alias — explicit override, else the user's email local-part */
    let alias = prof.email.split('@')[0];
    if (domainRow) {
      const { data: ov } = await admin.from('sending_alias')
        .select('alias, display_name').eq('user_id', prof.user_id)
        .eq('domain_id', domainRow.domain_id).maybeSingle();
      if (ov?.alias) alias = ov.alias;
    }

    /* ── Routing ladder (board entry 6) ──────────────────────────
       Rung 1: user's CONNECTED MAILBOX for this domain (Graph/Gmail API)
               — sends land in their real Sent folder; per-user reputation.
               Delivery arrives with ALT-519 (Google) / ALT-520 (Microsoft);
               until then an active connection falls through to rung 2.
       Rung 2: org relay (EMAIL_SMTP_*) on a VERIFIED domain — From = alias.
       Rung 3: system mailbox fallback, Reply-To the user (always works). */
    let connection = null;
    if (domainRow) {
      const { data: conn } = await admin.from('user_mailbox_connection')
        .select('connection_id, provider, mailbox_email, status')
        .eq('user_id', prof.user_id).eq('domain_id', domainRow.domain_id)
        .eq('status', 'active').maybeSingle();
      connection = conn ?? null;
    }
    // TODO(ALT-519/520): when connection && provider transport exists, send via
    // Gmail API / Microsoft Graph here and return { relay: 'mailbox' }.

    const relay = getRelayTransport();
    const canSendAsUser = relay && domainRow && domainRow.status === 'verified';
    const transport = relay || getTransporter();
    if (!transport) return res.status(503).json({ error: 'no mail transport configured' });

    const fromAddress = canSendAsUser ? `${alias}@${domainRow.domain}` : GMAIL_USER;
    const mail = {
      from: canSendAsUser ? `"${displayName}" <${fromAddress}>`
                          : `"${displayName} · Amplior CRM" <${GMAIL_USER}>`,
      to: recipient,
      replyTo: `"${displayName}" <${prof.email}>`,
      subject: String(subject).slice(0, 500),
      ...(html ? { html } : {}), ...(text ? { text } : {}),
      ...(mailAttachments.length ? { attachments: mailAttachments } : {}),
    };

    try {
      const info = await transport.sendMail(mail);
      logEmail({ to: recipient, type: 'user_send', subject: mail.subject, status: 'sent',
                 messageId: info.messageId, leadId: lead_id ?? null, contactId: contact_id ?? null,
                 companyId: company_id ?? null, attachments: attachmentMeta, actor: req.actorUserId });
      res.json({ ok: true, id: info.messageId, from: fromAddress,
                 relay: canSendAsUser ? 'domain' : 'fallback',
                 ...(connection ? { mailbox_pending: connection.provider } : {}) });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[email/send] failed:', msg);
      logEmail({ to: recipient, type: 'user_send', subject: mail.subject, status: 'failed',
                 error: msg, leadId: lead_id ?? null, contactId: contact_id ?? null,
                 companyId: company_id ?? null, attachments: attachmentMeta, actor: req.actorUserId });
      res.status(500).json({ error: 'Email send failed' });
    }
  });
}

module.exports = { mount };
