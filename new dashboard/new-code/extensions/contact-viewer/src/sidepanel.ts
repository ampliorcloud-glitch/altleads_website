/**
 * contact-viewer/src/sidepanel.ts  —  Side panel UI controller
 *
 * Manages the side panel lifecycle:
 *  - Check auth on load; show login form or contact view.
 *  - Handle login/sign-out.
 *  - Receive LinkedIn slug from background worker.
 *  - Look up contact via RPC and render the contact card.
 *
 * Phase 1 is READ-ONLY.  No writes to contact_master / contact_project_status /
 * interaction until ALT-152 is fixed and validated with a real non-admin agent login.
 *
 * This file uses plain DOM manipulation (no framework) to keep the bundle small
 * and the extension fast.
 */

import { getSupabaseClient } from '@shared/supabaseClient';
import { signIn, signOut, getSessionAndProfile, setSelectedProject, getSelectedProject } from '@shared/auth';
import { findContactForPanel } from '@shared/rpc';
import {
  fetchContactDetail,
  fetchContactLeads,
  fetchContactStatus,
  fetchContactStatusWithOwner,
  fetchActivityFeed,
  fetchTasks,
  fetchProjects,
  resolveUserName,
  fetchCompanyContacts,
} from '@shared/contactData';
import type { BgMessage, UserProfile, ContactPanelResult, ResearchRequestResult, ContactProjectStatusWithOwner } from '@shared/types';
import {
  getOpenRequestForContact,
  createResearchRequest,
  reRequest,
} from '@shared/researchRequests';

// Suppress unused import warning — getSupabaseClient is referenced indirectly via shared modules
void getSupabaseClient;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let currentProfile: UserProfile | null = null;
let currentSlug: string | null = null;
let currentProjectId: number | null = null;

// ---------------------------------------------------------------------------
// DOM refs (asserted non-null — HTML guarantees they exist)
// ---------------------------------------------------------------------------

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const loginForm     = $('login-form');
const emailInput    = $<HTMLInputElement>('email-input');
const passwordInput = $<HTMLInputElement>('password-input');
const loginBtn      = $<HTMLButtonElement>('login-btn');
const loginError    = $('login-error');
const pwToggle      = $<HTMLButtonElement>('pw-toggle');

const idleState     = $('idle-state');
const loadingState  = $('loading-state');
const noMatchState  = $('no-match-state');
const contactCard   = $('contact-card');
const errorState    = $('error-state');

const authStatus    = $('auth-status');
const signoutBtn    = $('signout-btn');
const projectSel    = $<HTMLSelectElement>('project-selector');

// ---------------------------------------------------------------------------
// Show / hide helpers
// ---------------------------------------------------------------------------

type ContentView = 'login' | 'idle' | 'loading' | 'no-match' | 'contact' | 'error';

function showView(view: ContentView, msg?: string) {
  loginForm.classList.toggle('hidden', view !== 'login');
  idleState.classList.toggle('hidden', view !== 'idle');
  loadingState.classList.toggle('hidden', view !== 'loading');
  noMatchState.classList.toggle('hidden', view !== 'no-match');
  contactCard.classList.toggle('hidden', view !== 'contact');
  errorState.classList.toggle('hidden', view !== 'error');

  if (view === 'error' && msg) {
    errorState.textContent = msg;
  }
}

// ---------------------------------------------------------------------------
// Auth UI
// ---------------------------------------------------------------------------

function setAuthUI(profile: UserProfile | null) {
  if (profile) {
    authStatus.textContent = profile.full_name ?? profile.role;
    signoutBtn.classList.remove('hidden');
    projectSel.classList.remove('hidden');
  } else {
    authStatus.textContent = '';
    signoutBtn.classList.add('hidden');
    projectSel.classList.add('hidden');
  }
}

// ---------------------------------------------------------------------------
// Project selector
// ---------------------------------------------------------------------------

async function loadProjects() {
  const projects = await fetchProjects();
  projectSel.innerHTML = '<option value="">Select project…</option>';
  projects.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = String(p.project_id);
    opt.textContent = p.project_name;
    projectSel.appendChild(opt);
  });

  // Restore saved selection
  const saved = await getSelectedProject();
  if (saved) {
    projectSel.value = String(saved);
    currentProjectId = saved;
  } else if (projects.length === 1) {
    projectSel.value = String(projects[0].project_id);
    currentProjectId = projects[0].project_id;
    await setSelectedProject(projects[0].project_id);
  }
}

projectSel.addEventListener('change', async () => {
  const val = parseInt(projectSel.value, 10);
  if (!isNaN(val)) {
    currentProjectId = val;
    await setSelectedProject(val);
    // Re-render if we have a current slug
    if (currentSlug) await lookupAndRender(currentSlug);
  }
});

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

loginBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) {
    showLoginError('Please enter your email and password.');
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = 'Signing in…';
  loginError.classList.add('hidden');

  const result = await signIn(email, password);

  loginBtn.disabled = false;
  loginBtn.textContent = 'Sign in';

  if (!result.ok || !result.profile) {
    showLoginError(result.error ?? 'Sign-in failed.');
    return;
  }

  currentProfile = result.profile;
  setAuthUI(currentProfile);
  await loadProjects();
  showView('idle');
  // Query the background for the current tab state
  queryCurrentTab();
});

// Allow Enter key to submit from either field
emailInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginBtn.click();
});
passwordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginBtn.click();
});

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
  currentSlug = null;
  setAuthUI(null);
  showView('login');
});

// ---------------------------------------------------------------------------
// Receive messages from the background worker
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message: BgMessage) => {
  if (!currentProfile) return; // not logged in — ignore tab messages

  if (message.type === 'TAB_URL') {
    currentSlug = message.slug;
    lookupAndRender(message.slug);
  } else if (message.type === 'TAB_IDLE') {
    currentSlug = null;
    showView('idle');
  }
});

/** Ask the background for the current tab state (called on panel open). */
function queryCurrentTab() {
  chrome.runtime.sendMessage({ type: 'QUERY_CURRENT_TAB' }, (response: BgMessage | undefined) => {
    if (chrome.runtime.lastError || !response) return;
    if (response.type === 'TAB_URL') {
      currentSlug = response.slug;
      lookupAndRender(response.slug);
    } else {
      showView('idle');
    }
  });
}

// ---------------------------------------------------------------------------
// Contact lookup + render
// ---------------------------------------------------------------------------

async function lookupAndRender(slug: string) {
  if (!currentProfile) return;

  showView('loading');

  try {
    const result = await findContactForPanel(slug, currentProjectId);

    if (!result) {
      showView('no-match');
      return;
    }

    await renderContactCard(result);
    showView('contact');
  } catch (err: unknown) {
    console.error('[AltLeads Panel] lookupAndRender error:', err);
    showView('error', "Couldn't load the contact — check your connection and try again.");
  }
}

// ---------------------------------------------------------------------------
// Contact card rendering
// ---------------------------------------------------------------------------

async function renderContactCard(result: ContactPanelResult) {
  // Render the header immediately (name + company already known from match result)
  // so the panel feels alive while background fetches complete.
  const isDNCEarly =
    result.contact_status === 'do_not_contact' ||
    result.company_status === 'do_not_contact' ||
    result.company_status === 'DNC' ||
    (result.company_status?.toLowerCase().includes('do not contact') ?? false);

  contactCard.innerHTML = `
    <div class="contact-card">
      <div class="name">
        ${esc(result.full_name)}
        ${isDNCEarly
          ? '<span class="badge badge-red">DO NOT CONTACT</span>'
          : '<span class="badge badge-gray">In CRM</span>'
        }
      </div>
      <div class="company">${esc(result.company_name ?? '—')}</div>
    </div>
    <div class="skeleton-card">
      <div class="skeleton-line field"></div>
      <div class="skeleton-line field-short"></div>
      <div class="skeleton-line field"></div>
    </div>
  `;
  showView('contact');

  // Parallelize all independent fetches (none depend on each other).
  // fetchContactDetail and getOpenRequestForContact run unconditionally —
  // canView is derived from the detail response itself (see below).
  const [detail, leads, statusWithOwner, activities, tasks, openRequest] = await Promise.all([
    fetchContactDetail(result.contact_id),
    fetchContactLeads(result.contact_id),
    currentProjectId ? fetchContactStatusWithOwner(result.contact_id, currentProjectId) : Promise.resolve(null),
    fetchActivityFeed(result.contact_id, 15),
    fetchTasks(result.contact_id),
    getOpenRequestForContact(result.contact_id),
  ]);

  // fetchContactStatus is still used by the non-owned card path (it doesn't need owner_user_id)
  // so derive a compatible shape from the extended result.
  const status = statusWithOwner
    ? { contact_id: statusWithOwner.contact_id, project_id: statusWithOwner.project_id,
        contact_status: statusWithOwner.contact_status, description: statusWithOwner.description,
        comments: statusWithOwner.comments, updated_date: statusWithOwner.updated_date }
    : null;

  // Compute effective "can view" — the RPC flag may be false when the RPC
  // isn't deployed yet (fallback path hard-codes false).  Derive it from real
  // signals instead: admin role, numeric owner match, or unmasked PII returned
  // by contact_master_masked (which already unmasks server-side for admin /
  // owner / manager / QC).
  const isAdmin = String(currentProfile?.role ?? '').toUpperCase() === 'ADMIN';
  const isOwner =
    detail?.created_by != null &&
    currentProfile?.user_id != null &&
    String(detail.created_by) === String(currentProfile.user_id);
  const hasPii = !!(detail?.email || detail?.mobile_no || detail?.linkedin_url);
  const canView = result.can_view_details || isAdmin || isOwner || hasPii;

  // Fetch colleagues + owner name in parallel (both are cheap, independent lookups).
  // Colleagues need company_id from detail; owner name needs owner_user_id from statusWithOwner.
  const companyId = detail?.company_id ?? result.company_id;
  const [colleagues, ownerName] = await Promise.all([
    companyId ? fetchCompanyContacts(companyId) : Promise.resolve([]),
    resolveUserName(statusWithOwner?.owner_user_id ?? null),
  ]);

  // Determine DNC from both contact_status and company_status
  const isDNC =
    result.contact_status === 'do_not_contact' ||
    result.company_status === 'do_not_contact' ||
    result.company_status === 'DNC' ||
    (result.company_status?.toLowerCase().includes('do not contact') ?? false);

  // ---- HEADER ----
  let html = `
    <div class="contact-card">
      <div class="name">
        ${esc(result.full_name)}
        ${isDNC
          ? '<span class="badge badge-red">DO NOT CONTACT</span>'
          : canView
            ? '<span class="badge badge-green">In CRM</span>'
            : '<span class="badge badge-gray">In CRM</span>'
        }
      </div>
      ${detail?.designation ? `<div class="designation">${esc(detail.designation)}</div>` : ''}
      <div class="company">${esc(result.company_name ?? '—')}</div>
    </div>
  `;

  // ---- OWNED CARD (canView = true — admin / owner / manager / QC) ----
  if (canView) {
    html += renderOwnedCard(result, detail, statusWithOwner, ownerName, isAdmin);
    // Research request section — compute missing detail fields
    const missingFields = computeMissingFields(result, detail);
    html += renderResearchRequestSection(result.contact_id, openRequest, missingFields);
    html += renderLeads(leads);
    html += renderColleagues(colleagues, result.contact_id, result.company_name, companyId);
    html += renderTasks(tasks);
    html += renderActivity(activities);
  }
  // ---- NON-OWNED CARD (canView = false — genuine other-owner record) ----
  else {
    html += renderNonOwnedCard(result, isDNC, status);
  }

  // ---- LINK TO FULL CRM ----
  html += `
    <div class="crm-link">
      <a href="https://crm.altleads.com/contacts/${result.contact_id}"
         target="_blank">
        Open full record in AltLeads CRM →
      </a>
    </div>
  `;

  contactCard.innerHTML = html;

  // Wire up click-to-reveal for masked PII fields (owned card only)
  if (canView) {
    wireMaskReveal(contactCard);
    // Wire up research request buttons
    wireResearchRequestButtons(result, detail);
  }
}

// ---------------------------------------------------------------------------
// Owned card renderer
// ---------------------------------------------------------------------------

function renderOwnedCard(
  result: ContactPanelResult,
  detail: Awaited<ReturnType<typeof fetchContactDetail>>,
  statusWithOwner: Awaited<ReturnType<typeof fetchContactStatusWithOwner>>,
  ownerName: string,
  isAdmin: boolean
): string {
  let html = '';

  // Contact details section
  html += `<div class="section-title">Contact details</div>`;

  // Designation (not in header — show as first field)
  const designation = detail?.designation;
  if (designation) {
    html += `
      <div class="field-row">
        <span class="label">Designation</span>
        <span class="value">${esc(designation)}</span>
      </div>
    `;
  } else {
    html += emptyFieldRow('Designation');
  }

  // Company
  const companyName = detail?.company_name ?? result.company_name;
  if (companyName) {
    html += `
      <div class="field-row">
        <span class="label">Company</span>
        <span class="value">${esc(companyName)}</span>
      </div>
    `;
  } else {
    html += emptyFieldRow('Company');
  }

  // City
  const cityName = detail?.city_name;
  if (cityName) {
    html += `
      <div class="field-row">
        <span class="label">City</span>
        <span class="value">${esc(cityName)}</span>
      </div>
    `;
  } else {
    html += emptyFieldRow('City');
  }

  // Email — unmasked for admin, partial mask + click-to-reveal for others
  const email = detail?.email ?? result.email;
  if (email) {
    if (isAdmin) {
      html += `
        <div class="field-row">
          <span class="label">Email</span>
          <span class="value">${esc(email)}</span>
        </div>
      `;
    } else {
      html += maskedFieldRow('Email', email, maskEmail(email));
    }
  } else {
    html += emptyFieldRow('Email');
  }

  // Mobile — unmasked for admin, partial mask + click-to-reveal for others
  const mobile = detail?.mobile_no ?? result.mobile_no;
  if (mobile) {
    if (isAdmin) {
      html += `
        <div class="field-row">
          <span class="label">Mobile</span>
          <span class="value">${esc(mobile)}</span>
        </div>
      `;
    } else {
      html += maskedFieldRow('Mobile', mobile, maskPhone(mobile));
    }
  } else {
    html += emptyFieldRow('Mobile');
  }

  // Alt mobile — unmasked for admin, partial mask + click-to-reveal for others
  if (detail?.alt_mobile_no) {
    if (isAdmin) {
      html += `
        <div class="field-row">
          <span class="label">Alt mobile</span>
          <span class="value">${esc(detail.alt_mobile_no)}</span>
        </div>
      `;
    } else {
      html += maskedFieldRow('Alt mobile', detail.alt_mobile_no, maskPhone(detail.alt_mobile_no));
    }
  }

  // LinkedIn (always a plain link — not masked regardless of role)
  const linkedin = detail?.linkedin_url ?? result.linkedin_url;
  if (linkedin) {
    html += `
      <div class="field-row">
        <span class="label">LinkedIn</span>
        <span class="value">
          <a href="${esc(linkedin)}" target="_blank" style="color:#1d4ed8;word-break:break-all;">${esc(linkedin)}</a>
        </span>
      </div>
    `;
  }

  // Per-project status — mirrors the CRM's project status panel (read-only)
  if (currentProjectId) {
    html += `<div class="section-title">Project status</div>`;

    // Owner (this project) — resolved display name
    html += `
      <div class="field-row">
        <span class="label">Owner</span>
        <span class="value">${esc(ownerName || 'Unassigned')}</span>
      </div>
    `;

    // Contact Status badge (red if do_not_contact, blue otherwise)
    const contactStatus = statusWithOwner?.contact_status ?? result.contact_status;
    if (contactStatus) {
      const isDNC2 = contactStatus === 'do_not_contact';
      const cls = isDNC2 ? 'badge-red' : 'badge-blue';
      html += `
        <div class="field-row">
          <span class="label">Status</span>
          <span class="value"><span class="badge ${cls}">${esc(contactStatus)}</span></span>
        </div>
      `;
    } else {
      html += `
        <div class="field-row">
          <span class="label">Status</span>
          <span class="value empty">—</span>
        </div>
      `;
    }

    // Description
    if (statusWithOwner?.description) {
      html += `
        <div class="field-row">
          <span class="label">Description</span>
          <span class="value">${esc(statusWithOwner.description)}</span>
        </div>
      `;
    }

    // Comments
    if (statusWithOwner?.comments) {
      html += `
        <div class="field-row">
          <span class="label">Comments</span>
          <span class="value">${esc(statusWithOwner.comments)}</span>
        </div>
      `;
    }
  }

  if (result.last_activity_at) {
    html += `
      <div class="field-row">
        <span class="label">Last activity</span>
        <span class="value">${esc(formatDate(result.last_activity_at))}</span>
      </div>
    `;
  }

  return html;
}

// ---------------------------------------------------------------------------
// Non-owned card renderer
// ---------------------------------------------------------------------------

function renderNonOwnedCard(
  result: ContactPanelResult,
  isDNC: boolean,
  status: Awaited<ReturnType<typeof fetchContactStatus>>
): string {
  let html = `<div class="section-title">Account overview</div>`;

  // Owner info (who owns this contact in the selected project)
  html += `
    <div class="field-row">
      <span class="label">Owner</span>
      <span class="value">${esc(result.owner_name ?? 'Unknown')}</span>
    </div>
  `;

  // Company status — MUST show DNC clearly
  const companyStatus = result.company_status;
  if (companyStatus) {
    const cls = isDNC ? 'badge-red' : 'badge-blue';
    html += `
      <div class="field-row">
        <span class="label">Co. status</span>
        <span class="value"><span class="badge ${cls}">${esc(companyStatus)}</span></span>
      </div>
    `;
  }

  // Contact status (per project, if available from result)
  const contactStatus = status?.contact_status ?? result.contact_status;
  if (contactStatus) {
    const cls = contactStatus === 'do_not_contact' ? 'badge-red' : 'badge-gray';
    html += `
      <div class="field-row">
        <span class="label">Contact status</span>
        <span class="value"><span class="badge ${cls}">${esc(contactStatus)}</span></span>
      </div>
    `;
  }

  // Last activity date
  if (result.last_activity_at) {
    html += `
      <div class="field-row">
        <span class="label">Last activity</span>
        <span class="value">${esc(formatDate(result.last_activity_at))}</span>
      </div>
    `;
  }

  // Hidden details notice
  html += `
    <div class="field-row">
      <span class="label">Details</span>
      <span class="value hidden-notice">Hidden — not your record</span>
    </div>
  `;

  // "Request this company" button (disabled — workflow not built yet; intentional owner decision)
  const dncNote = isDNC
    ? ' — DNC companies cannot be requested'
    : ' — request flow coming soon';

  html += `
    <div class="request-section">
      <button
        class="btn-request"
        disabled
        title="Request this company${dncNote}"
      >
        Request this company
      </button>
      <div class="request-note">
        ${isDNC
          ? '⚠️ This company is marked <strong>Do Not Contact</strong>.'
          : 'Approval flow coming soon. Contact your Team Lead to request this company.'
        }
      </div>
    </div>
  `;

  return html;
}

// ---------------------------------------------------------------------------
// Leads / tasks / activity sub-renderers
// ---------------------------------------------------------------------------

function renderLeads(leads: Awaited<ReturnType<typeof fetchContactLeads>>): string {
  const count = leads.length;
  let html = `<div class="section-title">Leads${count > 0 ? ` (${count})` : ''}</div>`;

  if (count === 0) {
    html += `<div class="empty-section">No leads linked to this contact yet.</div>`;
    return html;
  }

  // Show all leads (not capped) — CRM shows all; side panel is narrow but still readable
  leads.forEach((l) => {
    const stage = l.lead_stage ?? l.lead_status ?? 'unknown';
    html += `
      <div class="field-row">
        <span class="label">#${l.lead_id}</span>
        <span class="value">
          <span class="badge badge-blue">${esc(stage)}</span>
          ${l.company_name ? ` <span style="color:#6b7280;">${esc(l.company_name)}</span>` : ''}
        </span>
      </div>
    `;
  });
  return html;
}

function renderColleagues(
  colleagues: Awaited<ReturnType<typeof fetchCompanyContacts>>,
  currentContactId: number,
  companyName: string | null,
  companyId: number | null
): string {
  if (!companyId) return '';

  // Exclude the current contact from the list
  const others = colleagues.filter((c) => c.contact_id !== currentContactId);
  const headerLabel = companyName
    ? `Colleagues · ${esc(companyName)} (${others.length})`
    : `Colleagues (${others.length})`;

  let html = `<div class="section-title">${headerLabel}</div>`;

  if (others.length === 0) {
    html += `<div class="empty-section">No other contacts at this company.</div>`;
    return html;
  }

  others.forEach((c) => {
    html += `
      <div class="field-row">
        <span class="label" style="width:auto;flex:1;min-width:0;">${esc(c.full_name)}</span>
        ${c.designation
          ? `<span class="value" style="color:#6b7280;flex-shrink:0;max-width:50%;text-align:right;">${esc(c.designation)}</span>`
          : ''
        }
      </div>
    `;
  });
  return html;
}

function renderTasks(tasks: Awaited<ReturnType<typeof fetchTasks>>): string {
  if (tasks.length === 0) return '';

  let html = `<div class="section-title">Open tasks (${tasks.length})</div>`;
  tasks.slice(0, 3).forEach((t) => {
    html += `
      <div class="field-row">
        <span class="label">${t.due_at ? formatDate(t.due_at) : 'No due date'}</span>
        <span class="value">${esc(t.title)}</span>
      </div>
    `;
  });
  return html;
}

function renderActivity(activities: Awaited<ReturnType<typeof fetchActivityFeed>>): string {
  let html = `<div class="section-title">Activity Timeline</div>`;

  if (activities.length === 0) {
    html += `<div class="empty-section">No activity recorded yet.</div>`;
    return html;
  }

  // Group by calendar date (most-recent-first — activities are already ordered DESC)
  let lastDateLabel = '';
  activities.forEach((a) => {
    const dateLabel = formatDateShort(a.occurred_at);
    if (dateLabel !== lastDateLabel) {
      html += `<div class="activity-date-group">${esc(dateLabel)}</div>`;
      lastDateLabel = dateLabel;
    }

    const typeLabel = a.type === 'call' ? 'Call' : a.type === 'status_change' ? 'Status change' : esc(a.type);
    html += `
      <div class="activity-item">
        <div class="activity-header">
          <span class="type">${typeLabel}</span>
          ${a.disposition ? `<span class="badge badge-gray">${esc(a.disposition)}</span>` : ''}
          <span class="time">${formatTime(a.occurred_at)}</span>
        </div>
        ${a.note_text ? `<div class="note">${esc(a.note_text)}</div>` : ''}
      </div>
    `;
  });
  return html;
}

// ---------------------------------------------------------------------------
// Research request section — owned card only
// ---------------------------------------------------------------------------

/** The detail fields we track for "missing" detection. */
const DETAIL_FIELDS = ['email', 'mobile_no', 'linkedin_url', 'designation'] as const;
type DetailField = typeof DETAIL_FIELDS[number];

/**
 * Compute which detail fields are absent from the contact so we can label
 * the request clearly (e.g. "Missing: email, mobile").
 */
function computeMissingFields(
  result: ContactPanelResult,
  detail: Awaited<ReturnType<typeof fetchContactDetail>>
): DetailField[] {
  const email      = detail?.email ?? result.email;
  const mobileNo   = detail?.mobile_no ?? result.mobile_no;
  const linkedinUrl = detail?.linkedin_url ?? result.linkedin_url;
  const designation = detail?.designation ?? null;

  const missing: DetailField[] = [];
  if (!email)       missing.push('email');
  if (!mobileNo)    missing.push('mobile_no');
  if (!linkedinUrl) missing.push('linkedin_url');
  if (!designation) missing.push('designation');
  return missing;
}

/**
 * Render the "Contact details" research-request section for an owned card.
 *
 * States:
 *  open request  → "Requested <relative date> · <status>" + Re-request button
 *  no open req   → "Request contact details" button (or re-verification if nothing is missing)
 *  backend_not_ready → muted "Research queue not set up yet" note
 *  error         → muted "Could not check request status" note
 */
function renderResearchRequestSection(
  contactId: number,
  openRequest: Awaited<ReturnType<typeof getOpenRequestForContact>>,
  missingFields: DetailField[]
): string {
  const missingLabel = missingFields.length > 0
    ? missingFields.map((f) => f === 'mobile_no' ? 'mobile' : f === 'linkedin_url' ? 'LinkedIn' : f).join(', ')
    : null;

  let html = `<div class="section-title">Research request</div>`;
  html += `<div id="research-request-section" class="research-request-box" data-contact-id="${contactId}">`;

  // Error / degraded states
  if (openRequest && 'tag' in openRequest) {
    const r = openRequest as ResearchRequestResult;
    if (r.tag === 'backend_not_ready') {
      html += `<div class="rr-note rr-muted">This feature isn't switched on yet.</div>`;
    } else if (r.tag === 'forbidden') {
      html += `<div class="rr-note rr-muted">You don't have permission to do this yet.</div>`;
    } else {
      html += `<div class="rr-note rr-muted">Something went wrong — please try again.</div>`;
    }
    html += `</div>`;
    return html;
  }

  if (openRequest && !('tag' in openRequest)) {
    // Open request exists
    const relDate = formatRelativeDate(openRequest.requested_at);
    const statusLabel = openRequest.status === 'in_progress' ? 'in progress' : openRequest.status;
    html += `
      <div class="rr-status">
        Requested ${esc(relDate)} &middot; <span class="rr-badge rr-badge-${esc(openRequest.status)}">${esc(statusLabel)}</span>
      </div>
    `;
    if (openRequest.fields_needed) {
      html += `<div class="rr-fields">Fields: ${esc(openRequest.fields_needed)}</div>`;
    }
    html += `
      <button id="rr-rerequest-btn" class="btn-rr-secondary">
        Re-request
      </button>
    `;
  } else {
    // No open request
    if (missingLabel) {
      html += `<div class="rr-missing">Missing: <strong>${esc(missingLabel)}</strong></div>`;
    }
    const btnLabel = missingFields.length === 0 ? 'Request re-verification' : 'Request contact details';
    html += `
      <button id="rr-request-btn" class="btn-rr-primary">
        ${btnLabel}
      </button>
    `;
  }

  html += `<div id="rr-feedback" class="rr-feedback hidden"></div>`;
  html += `</div>`;
  return html;
}

/**
 * Wire click handlers for the research request / re-request buttons.
 * Called after contactCard.innerHTML is set.
 */
function wireResearchRequestButtons(
  result: ContactPanelResult,
  detail: Awaited<ReturnType<typeof fetchContactDetail>>
) {
  if (!currentProfile) return;

  const requestedBy = String(currentProfile.user_id);
  const contactId   = result.contact_id;

  // "Request contact details" button
  const requestBtn = document.getElementById('rr-request-btn') as HTMLButtonElement | null;
  if (requestBtn) {
    requestBtn.addEventListener('click', async () => {
      if (!requestBtn) return;
      requestBtn.disabled = true;
      requestBtn.textContent = 'Requesting…';
      setRRFeedback('');

      const missingFields = computeMissingFields(result, detail);
      const fieldsNeeded = missingFields.length > 0
        ? missingFields.join(',')
        : 'email,mobile_no,linkedin_url,designation';

      const res = await createResearchRequest({
        contactId,
        companyId:    result.company_id,
        linkedinUrl:  result.linkedin_url ?? (detail?.linkedin_url ?? null),
        linkedinClean: detail?.linkedin_clean ?? null,
        projectId:    currentProjectId,
        fieldsNeeded,
        requestedBy,
      });

      if ('tag' in res) {
        requestBtn.disabled = false;
        requestBtn.textContent = 'Request contact details';
        const r = res as ResearchRequestResult;
        if (r.tag === 'backend_not_ready') {
          setRRFeedback("This feature isn't switched on yet.", 'error');
        } else if (r.tag === 'forbidden') {
          setRRFeedback("You don't have permission to do this yet.", 'error');
        } else {
          setRRFeedback('Something went wrong — please try again.', 'error');
        }
      } else {
        // Success — replace button area with success state
        const section = document.getElementById('research-request-section');
        if (section) {
          section.innerHTML = `
            <div class="rr-status">
              Requested just now &middot; <span class="rr-badge rr-badge-pending">pending</span>
            </div>
            <div class="rr-fields">Fields: ${esc(fieldsNeeded)}</div>
            <div class="rr-success">Requested ✓ — pending with research team</div>
          `;
        }
      }
    });
  }

  // "Re-request" button
  const rerequestBtn = document.getElementById('rr-rerequest-btn') as HTMLButtonElement | null;
  if (rerequestBtn) {
    rerequestBtn.addEventListener('click', async () => {
      rerequestBtn.disabled = true;
      rerequestBtn.textContent = 'Requesting…';
      setRRFeedback('');

      // Get current open request id from the DOM (we stored contactId on the section)
      const openReq = await getOpenRequestForContact(contactId);

      if (!openReq || 'tag' in openReq) {
        // No open request — fall back to creating a new one
        const missingFields = computeMissingFields(result, detail);
        const fieldsNeeded = missingFields.length > 0
          ? missingFields.join(',')
          : 'email,mobile_no,linkedin_url,designation';

        const res = await createResearchRequest({
          contactId,
          companyId:    result.company_id,
          linkedinUrl:  result.linkedin_url ?? (detail?.linkedin_url ?? null),
          linkedinClean: detail?.linkedin_clean ?? null,
          projectId:    currentProjectId,
          fieldsNeeded,
          requestedBy,
        });

        if ('tag' in res) {
          rerequestBtn.disabled = false;
          rerequestBtn.textContent = 'Re-request';
          setRRFeedback('Something went wrong — please try again.', 'error');
        } else {
          const section = document.getElementById('research-request-section');
          if (section) {
            section.innerHTML = `
              <div class="rr-status">
                Requested just now &middot; <span class="rr-badge rr-badge-pending">pending</span>
              </div>
              <div class="rr-success">Requested ✓ — pending with research team</div>
            `;
          }
        }
        return;
      }

      const res = await reRequest(openReq.request_id, requestedBy);
      if ('tag' in res) {
        rerequestBtn.disabled = false;
        rerequestBtn.textContent = 'Re-request';
        const r = res as ResearchRequestResult;
        if (r.tag === 'backend_not_ready') {
          setRRFeedback("This feature isn't switched on yet.", 'error');
        } else if (r.tag === 'forbidden') {
          setRRFeedback("You don't have permission to do this yet.", 'error');
        } else {
          setRRFeedback('Something went wrong — please try again.', 'error');
        }
      } else {
        const section = document.getElementById('research-request-section');
        if (section) {
          section.innerHTML = `
            <div class="rr-status">
              Re-requested just now &middot; <span class="rr-badge rr-badge-pending">pending</span>
            </div>
            <div class="rr-success">Requested ✓ — pending with research team</div>
          `;
        }
      }
    });
  }
}

/** Set the feedback text below the button. */
function setRRFeedback(msg: string, type: 'success' | 'error' | '' = '') {
  const el = document.getElementById('rr-feedback');
  if (!el) return;
  el.textContent = msg;
  el.className = 'rr-feedback';
  if (type === 'error') el.classList.add('rr-feedback-error');
  if (type === 'success') el.classList.add('rr-feedback-success');
  el.classList.toggle('hidden', !msg);
}

// ---------------------------------------------------------------------------
// Partial mask + click-to-reveal
// ---------------------------------------------------------------------------

/**
 * Wire up click handlers for all elements with data-full-value.
 * On click, replaces the masked text with the full value.
 */
function wireMaskReveal(container: HTMLElement) {
  container.querySelectorAll<HTMLElement>('[data-full-value]').forEach((el) => {
    el.style.cursor = 'pointer';
    el.title = 'Click to reveal';
    el.addEventListener('click', function handleReveal() {
      const full = el.getAttribute('data-full-value') ?? '';
      el.textContent = full;
      el.removeAttribute('data-full-value');
      el.title = '';
      el.style.cursor = '';
      el.classList.remove('masked');
    }, { once: true });
  });
}

/**
 * Render a field row with masked display + click-to-reveal for owned PII.
 */
function maskedFieldRow(label: string, fullValue: string, maskedValue: string): string {
  return `
    <div class="field-row">
      <span class="label">${esc(label)}</span>
      <span class="value masked" data-full-value="${esc(fullValue)}">${esc(maskedValue)}</span>
    </div>
  `;
}

/**
 * Render a field row showing a genuinely empty value (not hidden/masked).
 */
function emptyFieldRow(label: string): string {
  return `
    <div class="field-row">
      <span class="label">${esc(label)}</span>
      <span class="value empty">—</span>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Masking helpers (partial reveal)
// ---------------------------------------------------------------------------

/** e.g. "john.doe@example.com" → "jo*****@example.com" */
function maskEmail(email: string): string {
  const atIdx = email.indexOf('@');
  if (atIdx < 0) return email.substring(0, 3) + '***';
  const local = email.substring(0, atIdx);
  const domain = email.substring(atIdx);
  const visible = local.substring(0, Math.min(2, local.length));
  return visible + '*'.repeat(Math.max(3, local.length - visible.length)) + domain;
}

/** e.g. "+91 98765 43210" → "+91 9876 ****10" */
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 5) return phone; // too short to mask meaningfully
  const prefix = phone.substring(0, Math.max(1, phone.length - 4));
  return prefix.replace(/\d(?=.*\d{2})/g, '*') + phone.substring(phone.length - 2);
}

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

/** HTML-escape a string to prevent XSS in innerHTML. */
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
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

/** Short date label for activity group headers, e.g. "22 Jun 2026". */
function formatDateShort(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso.substring(0, 10);
  }
}

/** Time-only label for activity entries within a day group, e.g. "3:42 PM". */
function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return '';
  }
}

/**
 * Format an ISO date string as a human-friendly relative label
 * (e.g. "2 days ago", "just now", "5 Jun 2026").
 */
function formatRelativeDate(iso: string): string {
  try {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 2)  return 'just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24)   return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7)    return `${diffD} day${diffD === 1 ? '' : 's'} ago`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Boot: check session, then show the right view
// ---------------------------------------------------------------------------

(async function boot() {
  const profile = await getSessionAndProfile();

  if (profile) {
    currentProfile = profile;
    setAuthUI(profile);
    await loadProjects();
    showView('idle');
    queryCurrentTab();
  } else {
    setAuthUI(null);
    showView('login');
    // Autofocus email field so user can start typing immediately
    emailInput.focus();
  }
})();
