/**
 * data-research/src/sidepanel.ts  —  Data Research extension panel
 *
 * The research / back-office team's tool.  Purpose: fill MISSING contact
 * details (full_name, designation, email, mobile_no, alt_mobile_no,
 * linkedin_url) contact-by-contact.
 *
 * VIEWS
 * ─────
 * QUEUE VIEW (default, non-LinkedIn tab)
 *   Lists open contact_research_request rows (pending + in_progress), newest
 *   first.  Each row shows requester name, when requested, target contact /
 *   LinkedIn slug, fields_needed, status.  Clicking a row opens DETAIL VIEW.
 *
 * DETAIL VIEW (per request / per contact)
 *   Shows ONLY the 6 contact-detail fields — full_name, designation, email,
 *   mobile_no, alt_mobile_no, linkedin_url — each clearly PRESENT or MISSING.
 *   Inline fill/edit form for all 6 fields.
 *   SAVE → updateContactDetails() + fulfillRequest() (mark done).
 *   MARK NOT FOUND → markNotFound().
 *   BACK → returns to queue.
 *   NO associated records (leads / tasks / activity / per-project status) —
 *   research team does not need them.
 *
 * PROFILE CONTEXT (active tab is a LinkedIn /in/ profile)
 *   Background service worker detects tab.url slug (NO content script / DOM
 *   reading — compliance).  Panel shows a banner: slug + CRM match.
 *   Clicking "Open details" opens DETAIL VIEW for that contact.
 *
 * DEFENSIVE throughout:
 *   42P01 → "backend not ready" (table missing)
 *   42501 → "permission — RESEARCH role/RLS not enabled yet"
 *   Never crash.
 */

import { signIn, signOut, getSessionAndProfile } from '@shared/auth';
import { findContactDup } from '@shared/rpc';
import { fetchContactDetail } from '@shared/contactData';
import { normalizeLinkedinSlug } from '@shared/normalizeLinkedin';
import { getSupabaseClient } from '@shared/supabaseClient';
import {
  listOpenRequests,
  fulfillRequest,
  markNotFound,
  updateContactDetails,
} from '@shared/researchRequests';
import type {
  BgMessage,
  UserProfile,
  ResearchRequest,
  ContactDetail,
} from '@shared/types';
import type { OpenRequestRow } from '@shared/researchRequests';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let currentProfile: UserProfile | null = null;
let currentSlug: string | null = null;    // slug from active LinkedIn tab (or null)
let detailContact: ContactDetail | null = null;
let detailRequest: OpenRequestRow | null = null;

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const loginSection  = $('login-section');
const emailInput    = $<HTMLInputElement>('email-input');
const passwordInput = $<HTMLInputElement>('password-input');
const loginBtn      = $<HTMLButtonElement>('login-btn');
const loginError    = $('login-error');
const pwToggle      = $<HTMLButtonElement>('pw-toggle');

const mainSection   = $('main-section');
const authStatus    = $('auth-status');
const signoutBtn    = $<HTMLButtonElement>('signout-btn');
const refreshBtn    = $<HTMLButtonElement>('refresh-btn');

const profileBanner = $('profile-banner');

const queueView     = $('queue-view');
const queueContent  = $('queue-content');

const detailView    = $('detail-view');
const detailContent = $('detail-content');
const backBtn       = $<HTMLButtonElement>('back-btn');

// ---------------------------------------------------------------------------
// View helpers
// ---------------------------------------------------------------------------

type TopView = 'login' | 'main';
type MainSubView = 'queue' | 'detail';

function showTopView(view: TopView) {
  loginSection.classList.toggle('hidden', view !== 'login');
  mainSection.classList.toggle('hidden',  view !== 'main');
}

function showMainSub(sub: MainSubView) {
  queueView.classList.toggle('hidden',  sub !== 'queue');
  detailView.classList.toggle('hidden', sub !== 'detail');
}

function setAuthUI(profile: UserProfile | null) {
  if (profile) {
    authStatus.textContent = profile.full_name ?? profile.role;
    signoutBtn.classList.remove('hidden');
    refreshBtn.classList.remove('hidden');
  } else {
    authStatus.textContent = '';
    signoutBtn.classList.add('hidden');
    refreshBtn.classList.add('hidden');
  }
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

loginBtn.addEventListener('click', async () => {
  const email    = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) { showLoginError('Please enter email and password.'); return; }

  loginBtn.disabled    = true;
  loginBtn.textContent = 'Signing in…';
  loginError.classList.add('hidden');

  const result = await signIn(email, password);
  loginBtn.disabled    = false;
  loginBtn.textContent = 'Sign in';

  if (!result.ok || !result.profile) {
    showLoginError(result.error ?? 'Sign-in failed.');
    return;
  }

  currentProfile = result.profile;
  setAuthUI(currentProfile);
  showTopView('main');
  showMainSub('queue');
  await loadQueue();
  queryCurrentTab();
});

// Allow Enter to submit from either field
emailInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') loginBtn.click(); });
passwordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') loginBtn.click(); });

// Show / hide password toggle
pwToggle.addEventListener('click', () => {
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';
  pwToggle.textContent = isPassword ? '🙈' : '👁';
});

function showLoginError(msg: string) {
  loginError.textContent = msg;
  loginError.classList.remove('hidden');
}

// ---------------------------------------------------------------------------
// Sign out
// ---------------------------------------------------------------------------

signoutBtn.addEventListener('click', async () => {
  await signOut();
  currentProfile = null;
  currentSlug    = null;
  setAuthUI(null);
  showTopView('login');
});

// ---------------------------------------------------------------------------
// Refresh queue
// ---------------------------------------------------------------------------

refreshBtn.addEventListener('click', async () => {
  showMainSub('queue');
  await loadQueue();
});

// ---------------------------------------------------------------------------
// Back from detail view
// ---------------------------------------------------------------------------

backBtn.addEventListener('click', async () => {
  detailContact = null;
  detailRequest = null;
  showMainSub('queue');
  await loadQueue();
});

// ---------------------------------------------------------------------------
// Resolve user_id → display name (cached)
// ---------------------------------------------------------------------------

const userNameCache = new Map<string, string>();

async function resolveUserName(userId: string | null): Promise<string> {
  if (!userId) return '—';
  if (userNameCache.has(userId)) return userNameCache.get(userId)!;

  const supabase = getSupabaseClient();

  const { data } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('user_id', parseInt(userId, 10))
    .maybeSingle();

  const name = (data as { full_name?: string | null } | null)?.full_name ?? `User ${userId}`;
  userNameCache.set(userId, name);
  return name;
}

// ---------------------------------------------------------------------------
// Research queue
// ---------------------------------------------------------------------------

async function loadQueue() {
  queueContent.innerHTML = spinner('Loading research queue…');

  const result = await listOpenRequests(50);

  if ('tag' in result) {
    if (result.tag === 'backend_not_ready') {
      console.warn('[AltLeads Research] Queue backend not ready (contact_research_request table missing)');
      queueContent.innerHTML = infoMsg("This feature isn't switched on yet — contact your admin.");
    } else if (result.tag === 'forbidden') {
      console.warn('[AltLeads Research] Queue forbidden (42501 / role not enabled)');
      queueContent.innerHTML = errorMsg("You don't have permission to view the queue yet — contact your admin.");
    } else {
      console.error('[AltLeads Research] Queue error:', (result as { tag: string; message?: string }).message);
      queueContent.innerHTML = errorMsg('Something went wrong loading the queue — please try again.');
    }
    return;
  }

  if (result.length === 0) {
    queueContent.innerHTML = infoMsg('No pending research requests — all caught up!');
    return;
  }

  // Resolve requester names, then render
  const enriched = await Promise.all(
    result.map(async (r) => ({
      ...r,
      requesterName: await resolveUserName(r.requested_by),
    }))
  );

  let html = `<div class="section-title">Open requests (${enriched.length})</div>`;
  enriched.forEach((r) => {
    const statusCls = r.status === 'in_progress' ? 'badge-orange' : 'badge-gray';
    const target    = r.linkedin_clean ?? r.linkedin_url
      ?? (r.contact_id ? `Contact #${r.contact_id}` : '—');
    const when = r.requested_at ? formatDate(r.requested_at) : '—';

    html += `
      <div class="queue-row" data-req="${r.request_id}">
        <div class="req-header">
          <span class="req-id">#${r.request_id}</span>
          <span class="badge ${statusCls}">${esc(r.status)}</span>
        </div>
        <div class="req-target">${esc(target)}</div>
        <div class="req-meta">
          ${esc(r.fields_needed ?? 'fields not specified')}
          &nbsp;·&nbsp;${esc(r.requesterName)}
          &nbsp;·&nbsp;${esc(when)}
        </div>
        ${r.notes ? `<div class="req-notes">${esc(r.notes)}</div>` : ''}
      </div>
    `;
  });

  queueContent.innerHTML = html;

  queueContent.querySelectorAll<HTMLElement>('.queue-row').forEach((el) => {
    el.addEventListener('click', () => {
      const reqId = parseInt(el.dataset['req'] ?? '0', 10);
      if (reqId) {
        const row = enriched.find(r => r.request_id === reqId) ?? null;
        openDetailByRequestRow(reqId, row);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Open detail view from a queue row
// ---------------------------------------------------------------------------

async function openDetailByRequestRow(requestId: number, row: OpenRequestRow | null) {
  showMainSub('detail');
  detailContent.innerHTML = spinner('Loading contact…');

  // If the row wasn't passed (e.g. called from banner), re-fetch it
  if (!row) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('contact_research_request')
      .select(
        'request_id, contact_id, company_id, linkedin_url, linkedin_clean, ' +
        'project_id, fields_needed, status, notes, requested_by, requested_at'
      )
      .eq('request_id', requestId)
      .maybeSingle();

    if (error || !data) {
      detailContent.innerHTML = errorMsg(
        error?.code === '42P01'
          ? 'Backend not ready (contact_research_request table not yet deployed).'
          : `Failed to load request: ${esc(error?.message ?? 'Not found')}`
      );
      return;
    }
    row = data as OpenRequestRow;
  }

  detailRequest = row;

  // Load the linked contact detail
  detailContact = row.contact_id
    ? await fetchContactDetail(row.contact_id)
    : null;

  renderDetailView();
}

// Open detail view directly from a LinkedIn profile match (no existing request)
async function openDetailByContact(contactId: number) {
  showMainSub('detail');
  detailContent.innerHTML = spinner('Loading contact…');
  detailRequest = null;
  detailContact = await fetchContactDetail(contactId);
  renderDetailView();
}

// ---------------------------------------------------------------------------
// Detail view renderer — CONTACT-DETAILS-ONLY (6 fields)
// ---------------------------------------------------------------------------

function renderDetailView() {
  const contact = detailContact;
  const req     = detailRequest;

  let html = '';

  // ---- Request summary (if opened from queue) ----
  if (req) {
    const statusCls = statusBadgeClass(req.status);
    const when      = req.requested_at ? formatDate(req.requested_at) : '—';
    html += `
      <div class="contact-card">
        <div class="card-header">
          Request #${req.request_id}
          <span class="badge ${statusCls}">${esc(req.status)}</span>
        </div>
        <div class="field-row">
          <span class="label">Requested by</span>
          <span class="value">${esc(req.requested_by ? `User ${req.requested_by}` : '—')}</span>
        </div>
        <div class="field-row">
          <span class="label">When</span>
          <span class="value">${esc(when)}</span>
        </div>
        <div class="field-row">
          <span class="label">Fields needed</span>
          <span class="value">${esc(req.fields_needed ?? '—')}</span>
        </div>
        ${req.notes ? `
        <div class="field-row">
          <span class="label">Notes</span>
          <span class="value">${esc(req.notes)}</span>
        </div>` : ''}
      </div>
    `;
  }

  // ---- No contact linked ----
  if (!contact) {
    html += `<div class="info-msg">No CRM contact linked to this request.</div>`;

    if (req && req.status !== 'done' && req.status !== 'not_found') {
      html += `
        <div class="btn-row">
          <button id="not-found-btn" class="btn-secondary">Mark not found</button>
        </div>
        <div id="fill-msg" style="display:none;"></div>
      `;
    }
    detailContent.innerHTML = html;
    wireDetailButtons(req, null);
    return;
  }

  // ---- Contact name + company header card ----
  html += `<div class="section-title">Contact details</div>`;
  html += `<div class="contact-card">`;
  html += `
    <div class="name">
      ${esc(contact.full_name)}
      <span class="badge badge-blue">In CRM</span>
    </div>
  `;
  if (contact.company_name) {
    html += `<div class="company">${esc(contact.company_name)}</div>`;
  }
  html += `</div>`;

  // ---- Field status grid (PRESENT / MISSING) for all 6 fields ----
  html += `<div class="contact-card">`;
  html += fieldStatusRow('Name',        contact.full_name);
  html += fieldStatusRow('Designation', contact.designation);
  html += fieldStatusRow('Email',       contact.email);
  html += fieldStatusRow('Mobile',      contact.mobile_no);
  html += fieldStatusRow('Alt mobile',  contact.alt_mobile_no);
  html += fieldStatusRow('LinkedIn',    contact.linkedin_url);
  html += `</div>`;

  // ---- Fill / edit form (shown unless request is already closed) ----
  const isClosed = req && (req.status === 'done' || req.status === 'not_found');

  if (!isClosed) {
    html += `<div class="section-title">Fill / edit details</div>`;
    html += `
      <div class="contact-card" id="fill-form">
        <div id="fill-msg" style="display:none;"></div>
        <div class="form-group">
          <label>Full name
            ${contact.full_name
              ? '<span class="filled-badge">present</span>'
              : '<span class="missing-badge">missing</span>'}
          </label>
          <input type="text" id="fill-name"
            value="${esc(contact.full_name ?? '')}"
            placeholder="Full name" class="fill-input" />
        </div>
        <div class="form-group">
          <label>Designation
            ${contact.designation
              ? '<span class="filled-badge">present</span>'
              : '<span class="missing-badge">missing</span>'}
          </label>
          <input type="text" id="fill-designation"
            value="${esc(contact.designation ?? '')}"
            placeholder="e.g. Head of Procurement" class="fill-input" />
        </div>
        <div class="form-group">
          <label>Email
            ${contact.email
              ? '<span class="filled-badge">present</span>'
              : '<span class="missing-badge">missing</span>'}
          </label>
          <input type="email" id="fill-email"
            value="${esc(contact.email ?? '')}"
            placeholder="work@company.com" class="fill-input" />
        </div>
        <div class="form-group">
          <label>Mobile
            ${contact.mobile_no
              ? '<span class="filled-badge">present</span>'
              : '<span class="missing-badge">missing</span>'}
          </label>
          <input type="tel" id="fill-mobile"
            value="${esc(contact.mobile_no ?? '')}"
            placeholder="+91 98765 43210" class="fill-input" />
        </div>
        <div class="form-group">
          <label>Alt mobile
            ${contact.alt_mobile_no
              ? '<span class="filled-badge">present</span>'
              : '<span class="missing-badge">missing</span>'}
          </label>
          <input type="tel" id="fill-alt-mobile"
            value="${esc(contact.alt_mobile_no ?? '')}"
            placeholder="+91 98765 43210" class="fill-input" />
        </div>
        <div class="form-group">
          <label>LinkedIn URL
            ${contact.linkedin_url
              ? '<span class="filled-badge">present</span>'
              : '<span class="missing-badge">missing</span>'}
          </label>
          <input type="url" id="fill-linkedin"
            value="${esc(contact.linkedin_url ?? (req?.linkedin_url ?? ''))}"
            placeholder="https://www.linkedin.com/in/slug" class="fill-input" />
        </div>
        <div class="btn-row">
          <button id="save-btn" class="btn-primary">Save${req ? ' &amp; mark done' : ''}</button>
          ${req ? '<button id="not-found-btn" class="btn-secondary">Mark not found</button>' : ''}
        </div>
      </div>
    `;
  } else {
    // Closed request — show final status
    html += `
      <div class="info-msg info-msg-green">
        This request is <strong>${esc(req!.status)}</strong>.
      </div>
    `;
  }

  detailContent.innerHTML = html;
  wireDetailButtons(req, contact);
}

// ---------------------------------------------------------------------------
// Wire save / not-found buttons
// ---------------------------------------------------------------------------

function wireDetailButtons(req: OpenRequestRow | null, contact: ContactDetail | null) {
  const saveBtn     = document.getElementById('save-btn')      as HTMLButtonElement | null;
  const notFoundBtn = document.getElementById('not-found-btn') as HTMLButtonElement | null;

  if (saveBtn && contact) {
    saveBtn.addEventListener('click', () => handleSave(req, contact));
  }
  if (notFoundBtn && req) {
    notFoundBtn.addEventListener('click', () => handleNotFound(req));
  }
}

// ---------------------------------------------------------------------------
// Save — write contact fields + optionally mark request done
// ---------------------------------------------------------------------------

async function handleSave(req: OpenRequestRow | null, contact: ContactDetail) {
  if (!currentProfile) return;

  const saveBtn = document.getElementById('save-btn') as HTMLButtonElement | null;
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }
  setFillMsg('');

  const nameVal      = (document.getElementById('fill-name')       as HTMLInputElement | null)?.value.trim() || null;
  const desigVal     = (document.getElementById('fill-designation') as HTMLInputElement | null)?.value.trim() || null;
  const emailVal     = (document.getElementById('fill-email')       as HTMLInputElement | null)?.value.trim() || null;
  const mobileVal    = (document.getElementById('fill-mobile')      as HTMLInputElement | null)?.value.trim() || null;
  const altMobileVal = (document.getElementById('fill-alt-mobile')  as HTMLInputElement | null)?.value.trim() || null;
  const liVal        = (document.getElementById('fill-linkedin')    as HTMLInputElement | null)?.value.trim() || null;

  const userId = String(currentProfile.user_id);

  // 1. Write contact fields (only pass non-empty values)
  const contactResult = await updateContactDetails(
    contact.contact_id,
    {
      full_name:     nameVal,
      designation:   desigVal,
      email:         emailVal,
      mobile_no:     mobileVal,
      alt_mobile_no: altMobileVal,
      linkedin_url:  liVal,
    },
    userId
  );

  if ('tag' in contactResult) {
    console.error('[AltLeads Research] updateContactDetails error:', contactResult);
    const msg = contactResult.tag === 'forbidden'
      ? "You don't have permission to edit contacts yet — contact your admin. The request was not changed."
      : contactResult.tag === 'backend_not_ready'
        ? "This feature isn't switched on yet — contact your admin."
        : 'Something went wrong saving the contact — please try again.';
    setFillMsg(msg, 'error');
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save' + (req ? ' & mark done' : ''); }
    return;
  }

  // 2. Mark the request done (if opened from a queue request)
  if (req) {
    const reqResult = await fulfillRequest(req.request_id, userId);
    if ('tag' in reqResult) {
      console.error('[AltLeads Research] fulfillRequest error:', reqResult);
      const msg = reqResult.tag === 'forbidden'
        ? "Details saved ✓ — but couldn't close the request (permission not yet set up). Please contact your admin."
        : reqResult.tag === 'backend_not_ready'
          ? "Details saved ✓ — but couldn't close the request (feature not switched on yet)."
          : "Details saved ✓ — but the request status couldn't be updated. Please try again.";
      setFillMsg(msg, 'error');
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save & mark done'; }
      return;
    }
    detailRequest = { ...req, status: 'done' };
  }

  // 3. Update local contact state and re-render with success confirmation
  detailContact = {
    ...contact,
    full_name:     nameVal     ?? contact.full_name,
    designation:   desigVal    ?? contact.designation,
    email:         emailVal    ?? contact.email,
    mobile_no:     mobileVal   ?? contact.mobile_no,
    alt_mobile_no: altMobileVal ?? contact.alt_mobile_no,
    linkedin_url:  liVal       ?? contact.linkedin_url,
    linkedin_clean: liVal
      ? (normalizeLinkedinSlug(liVal) ?? contact.linkedin_clean)
      : contact.linkedin_clean,
  };

  // Show "Saved ✓" banner at the top of detailContent before re-render
  detailContent.innerHTML = `<div class="save-success-banner">Saved ✓</div>` + detailContent.innerHTML;
  // Brief pause so the confirmation registers, then re-render the updated state
  await new Promise<void>((r) => setTimeout(r, 800));
  renderDetailView();
}

// ---------------------------------------------------------------------------
// Mark not found
// ---------------------------------------------------------------------------

async function handleNotFound(req: OpenRequestRow) {
  if (!currentProfile) return;

  const notFoundBtn = document.getElementById('not-found-btn') as HTMLButtonElement | null;
  if (notFoundBtn) { notFoundBtn.disabled = true; notFoundBtn.textContent = 'Saving…'; }

  const result = await markNotFound(req.request_id, String(currentProfile.user_id));

  if ('tag' in result) {
    console.error('[AltLeads Research] markNotFound error:', result);
    const msg = result.tag === 'forbidden'
      ? "You don't have permission to do this yet — contact your admin."
      : result.tag === 'backend_not_ready'
        ? "This feature isn't switched on yet — contact your admin."
        : 'Something went wrong — please try again.';
    setFillMsg(msg, 'error');
    if (notFoundBtn) { notFoundBtn.disabled = false; notFoundBtn.textContent = 'Mark not found'; }
    return;
  }

  detailRequest = { ...req, status: 'not_found' };
  renderDetailView();
}

function setFillMsg(msg: string, type: 'error' | 'info' | '' = '') {
  const el = document.getElementById('fill-msg');
  if (!el) return;
  el.textContent = msg;
  el.className   = type === 'error' ? 'msg-error' : type === 'info' ? 'msg-info' : '';
  el.style.display = msg ? 'block' : 'none';
}

// ---------------------------------------------------------------------------
// Profile banner (active tab = LinkedIn /in/ URL)
// ---------------------------------------------------------------------------

async function renderProfileBanner(slug: string) {
  profileBanner.classList.remove('hidden');

  let html = `
    <div class="profile-banner-inner">
      <span class="banner-slug">LinkedIn: <strong>${esc(slug)}</strong></span>
  `;

  try {
    const contact = await findContactDup(slug);
    if (contact) {
      html += `
        <span class="banner-match">${esc(contact.full_name)} @ ${esc(contact.company_name ?? '—')}</span>
        <button id="banner-open-btn" class="btn-raise"
          data-contact="${contact.contact_id}">Open details</button>
      `;
    } else {
      html += `<span class="banner-no-match">Not in CRM</span>`;
    }
  } catch {
    // Degrade silently
  }

  html += '</div>';
  profileBanner.innerHTML = html;

  const openBtn = document.getElementById('banner-open-btn') as HTMLButtonElement | null;
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      const cid = parseInt(openBtn.dataset['contact'] ?? '0', 10);
      if (cid) openDetailByContact(cid);
    });
  }
}

function clearProfileBanner() {
  profileBanner.classList.add('hidden');
  profileBanner.innerHTML = '';
}

// ---------------------------------------------------------------------------
// Background messages (URL watcher)
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message: BgMessage) => {
  if (!currentProfile) return;
  if (message.type === 'TAB_URL') {
    currentSlug = message.slug;
    renderProfileBanner(message.slug);
  } else if (message.type === 'TAB_IDLE') {
    currentSlug = null;
    clearProfileBanner();
  }
});

function queryCurrentTab() {
  chrome.runtime.sendMessage({ type: 'QUERY_CURRENT_TAB' }, (response: BgMessage | undefined) => {
    if (chrome.runtime.lastError || !response) return;
    if (response.type === 'TAB_URL') {
      currentSlug = response.slug;
      renderProfileBanner(response.slug);
    } else {
      clearProfileBanner();
    }
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
}

function spinner(label: string): string {
  return `
    <div style="text-align:center;padding:24px 12px;">
      <div class="spinner"></div>
      <p style="color:#888;font-size:12px;margin-top:8px;">${esc(label)}</p>
    </div>`;
}

function errorMsg(msg: string): string {
  return `<div class="msg-error">${esc(msg)}</div>`;
}

function infoMsg(msg: string): string {
  return `<div class="info-msg">${esc(msg)}</div>`;
}

function fieldStatusRow(label: string, value: string | null | undefined): string {
  const filled = !!(value && value.trim());
  return `
    <div class="field-row">
      <span class="label">${esc(label)}</span>
      <span class="value">
        ${filled
          ? `<span class="filled-badge">present</span> <span style="color:#374151;">${esc(value!)}</span>`
          : `<span class="missing-badge">missing</span>`}
      </span>
    </div>`;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'pending':     return 'badge-gray';
    case 'in_progress': return 'badge-orange';
    case 'done':        return 'badge-green';
    case 'not_found':   return 'badge-red';
    default:            return 'badge-gray';
  }
}

// Suppress unused type warning — ResearchRequest is used as a type import for consumers
void (null as unknown as ResearchRequest);

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

(async function boot() {
  const profile = await getSessionAndProfile();
  if (profile) {
    currentProfile = profile;
    setAuthUI(profile);
    showTopView('main');
    showMainSub('queue');
    await loadQueue();
    queryCurrentTab();
  } else {
    setAuthUI(null);
    showTopView('login');
    // Autofocus email field so user can start typing immediately
    emailInput.focus();
  }
})();
