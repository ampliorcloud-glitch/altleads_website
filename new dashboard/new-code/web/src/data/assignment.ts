/**
 * assignment.ts — reassign / change-owner write helpers (ALT-288 / ALT-152).
 *
 * The owner of a LEAD (and, by derivation, its MEETINGS) is the assigned
 * salesperson `lead_report.user_id` — NOT `lead_master.created_by` (that is the
 * internal owner; see CLAUDE.md §3). Reassignment therefore rewrites
 * `lead_report.user_id`. Company/contact reassignment lives in projectStatus.ts
 * (per-project `owner_user_id`).
 *
 * These helpers mirror the proven wishlist `assignWishlist` flow: numeric-actor
 * guard → owner-column UPDATE (+ audit) → fire-and-forget email + in-app notify
 * to the new owner. They are HARMLESS before the ALT-152 RLS lands (they write a
 * column the current blanket policy already allows) and correctly surface a
 * friendly message once the RLS denies a non-manager (42501 / 0 rows).
 */
import { supabase } from '../lib/supabase';
import { notify, notifyInApp, resolveUserEmailAndName } from '../lib/notify';
import { humanizeWriteError } from '../lib/writeError';
import type { UserOption } from './wishlist';
import type { BulkProgress } from './bulkActions';

/* ── guards / helpers ────────────────────────────────────────────────────── */

/** Audit-field guard: actor must be the current user's numeric user_id (as text). */
function assertNumericActor(actor: string): { error: string } | null {
  if (!actor || isNaN(Number(actor))) {
    return { error: 'Your user profile is still loading. Please try again in a moment.' };
  }
  return null;
}

function mapWriteError(error: { code?: string; message: string }): string {
  if (error.code === '42501') {
    return 'You can only reassign records you manage (ask an admin or a team lead).';
  }
  // Missing-table / schema-cache (42P01 / PGRST205) and anything else → friendly.
  return humanizeWriteError(error) ?? error.message;
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * Fire-and-forget notification to the NEW owner — email (lead_reassigned /
 * lead_assigned template) + in-app bell. Never throws, never blocks the write.
 */
function fireOwnerNotify(p: {
  recipientUserId: number;
  actor: string;
  isReassign: boolean;
  recordName?: string;
  company?: string;
  route: string;
  entityWord: string; // 'lead' | 'company' | 'contact'
  lead_id?: number;
  meeting_id?: number;
  /** Optional free-text reason typed by the actor; appended to the note/email. */
  reason?: string;
}): void {
  if (!p.recipientUserId || p.recipientUserId <= 0) return;
  void (async () => {
    try {
      const { email } = await resolveUserEmailAndName(supabase, p.recipientUserId);
      const actorInfo = await resolveUserEmailAndName(supabase, Number(p.actor));
      const name = p.recordName || `#${p.lead_id ?? p.meeting_id ?? ''}`;
      const reason = p.reason?.trim();
      const reasonSuffix = reason ? ` — Reason: ${reason}` : '';
      if (email) {
        await notify(p.isReassign ? 'lead_reassigned' : 'lead_assigned', email, {
          leadName: name,
          company: p.company ?? '',
          assignedByName: actorInfo.name || p.actor,
          reason: reason ?? '',
        });
      }
      await notifyInApp(supabase, p.recipientUserId, {
        status: p.isReassign ? `${cap(p.entityWord)} Reassigned` : `${cap(p.entityWord)} Assigned`,
        notif_descr: p.isReassign
          ? `A ${p.entityWord} has been reassigned to you: "${name}"${reasonSuffix}`
          : `A new ${p.entityWord} has been assigned to you: "${name}"${reasonSuffix}`,
        route: p.route,
        lead_id: p.lead_id,
        meeting_id: p.meeting_id,
        actor: p.actor,
      });
    } catch {
      /* non-fatal — never block reassignment */
    }
  })();
}

/* ── eligible-owner lookup ───────────────────────────────────────────────── */

/**
 * People a lead/meeting can be reassigned to: project_user AGENT/TEAM_LEAD tags
 * UNION everyone already holding a lead_report assignment (the real in-use
 * population — most assignees aren't role-tagged) UNION the current owner (so
 * the pre-selected value never vanishes). Names resolved with NO `enabled`
 * filter so a disabled current owner stays labelled. Returns sorted UserOption[].
 */
export async function fetchAssignableUsers(currentOwnerId?: number | null): Promise<UserOption[]> {
  const [roleRes, assignedRes] = await Promise.all([
    supabase
      .from('project_user')
      .select('user_id')
      .in('role_name', ['AGENT', 'TEAM_LEAD'])
      .is('deleted_date', null),
    supabase.from('lead_report').select('user_id').is('deleted_date', null).limit(5000),
  ]);

  const ids = new Set<number>();
  ((roleRes.data ?? []) as { user_id: number | null }[]).forEach((r) => {
    if (r.user_id != null) ids.add(r.user_id);
  });
  ((assignedRes.data ?? []) as { user_id: number | null }[]).forEach((r) => {
    if (r.user_id != null) ids.add(r.user_id);
  });
  if (currentOwnerId != null) ids.add(currentOwnerId);

  const all = [...ids];
  if (all.length === 0) return [];

  const { data: users } = await supabase
    .from('user_master')
    .select('user_id, full_name')
    .in('user_id', all);

  const map = new Map<number, string>();
  ((users ?? []) as { user_id: number; full_name: string | null }[]).forEach((u) =>
    map.set(u.user_id, (u.full_name ?? '').trim()),
  );

  return all
    .map((id) => ({ id, label: map.get(id) || `User #${id}` }))
    .filter((o) => o.label)
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Resolve a single user's display label (full_name, or "User #id" fallback). */
export async function fetchUserLabel(userId: number | null | undefined): Promise<string> {
  if (userId == null) return '';
  const { data } = await supabase
    .from('user_master')
    .select('full_name')
    .eq('user_id', userId)
    .maybeSingle();
  return ((data as { full_name: string | null } | null)?.full_name ?? '').trim() || `User #${userId}`;
}

/* ── lead / meeting reassignment ─────────────────────────────────────────── */

/** Raw owner write on lead_report (all active report rows for the lead). */
async function writeLeadOwner(
  leadId: number,
  newUserId: number,
  actor: string,
  source: 'single' | 'bulk' | 'departing' = 'single',
): Promise<{ error?: string; affected: number }> {
  const now = new Date().toISOString();

  // ALT-498: capture the OLD owner(s) before overwriting, for the journal below.
  const { data: before } = await supabase
    .from('lead_report')
    .select('report_id, user_id')
    .eq('lead_id', leadId)
    .is('deleted_date', null);

  const { data, error } = await supabase
    .from('lead_report')
    .update({ user_id: newUserId, updated_by: actor, updated_date: now })
    .eq('lead_id', leadId)
    .is('deleted_date', null)
    .select('report_id');
  if (error) return { error: mapWriteError(error), affected: 0 };
  const affected = (data as unknown[] | null)?.length ?? 0;

  // ALT-498: durable old→new journal. Tolerant until apply-comms-capture.cjs
  // creates reassignment_log — a missing table must never fail the reassign.
  if (affected > 0) {
    try {
      const rows = ((before ?? []) as { report_id: number; user_id: number | null }[]).map((b) => ({
        report_id: b.report_id,
        lead_id: leadId,
        old_user_id: b.user_id,
        new_user_id: newUserId,
        actor,
        source,
      }));
      if (rows.length > 0) {
        const { error: jErr } = await supabase.from('reassignment_log').insert(rows);
        if (jErr) console.warn('[assignment] reassignment_log skipped:', jErr.message);
      }
    } catch (e) {
      console.warn('[assignment] reassignment_log skipped:', e instanceof Error ? e.message : e);
    }
  }
  return { affected };
}

export async function reassignLead(input: {
  leadId: number;
  newUserId: number;
  actor: string;
  leadName?: string;
  company?: string;
  isReassign?: boolean;
  reason?: string;
}): Promise<{ error: string } | null> {
  const actorErr = assertNumericActor(input.actor);
  if (actorErr) return actorErr;

  const res = await writeLeadOwner(input.leadId, input.newUserId, input.actor);
  if (res.error) return { error: res.error };
  if (res.affected === 0) {
    return { error: "Couldn't reassign this lead — it has no active report row, or you don't have permission." };
  }

  fireOwnerNotify({
    recipientUserId: input.newUserId,
    actor: input.actor,
    isReassign: input.isReassign ?? true,
    recordName: input.leadName,
    company: input.company,
    route: `/leads/${input.leadId}`,
    entityWord: 'lead',
    lead_id: input.leadId,
    reason: input.reason,
  });
  return null;
}

/** Resolve the lead behind a meeting via meeting_schedule.report_id → lead_report.lead_id. */
export async function fetchMeetingLeadId(meetingId: number): Promise<number | null> {
  const { data: ms } = await supabase
    .from('meeting_schedule')
    .select('report_id')
    .eq('meeting_id', meetingId)
    .not('report_id', 'is', null)
    .limit(1)
    .maybeSingle();
  const reportId = (ms as { report_id: number | null } | null)?.report_id ?? null;
  if (reportId == null) return null;
  const { data: lr } = await supabase
    .from('lead_report')
    .select('lead_id')
    .eq('report_id', reportId)
    .maybeSingle();
  return (lr as { lead_id: number | null } | null)?.lead_id ?? null;
}

/**
 * Reassign a meeting by reassigning its underlying lead (meetings have no owner
 * column — owner derives from the lead). Pass leadId if already known to skip a
 * lookup. Per OD-5 this moves the whole lead, not just the meeting.
 */
export async function reassignMeeting(input: {
  meetingId: number;
  leadId?: number | null;
  newUserId: number;
  actor: string;
  meetingName?: string;
  company?: string;
  isReassign?: boolean;
  reason?: string;
}): Promise<{ error: string } | null> {
  const actorErr = assertNumericActor(input.actor);
  if (actorErr) return actorErr;

  let leadId = input.leadId ?? null;
  if (leadId == null) leadId = await fetchMeetingLeadId(input.meetingId);
  if (leadId == null) {
    return { error: "Couldn't find the lead behind this meeting, so it can't be reassigned." };
  }

  const res = await writeLeadOwner(leadId, input.newUserId, input.actor);
  if (res.error) return { error: res.error };
  if (res.affected === 0) {
    return { error: "Couldn't reassign — the lead has no active report row, or you don't have permission." };
  }

  fireOwnerNotify({
    recipientUserId: input.newUserId,
    actor: input.actor,
    isReassign: input.isReassign ?? true,
    recordName: input.meetingName,
    company: input.company,
    route: `/leads/${leadId}`,
    entityWord: 'lead',
    lead_id: leadId,
    meeting_id: input.meetingId,
    reason: input.reason,
  });
  return null;
}

/**
 * Bulk reassign N leads to one new owner. RLS is checked per row; returns a
 * summary so the caller can toast partial success. Fires ONE summary
 * notification to the new owner (not one per lead).
 */
export async function reassignLeadsBulk(
  leadIds: number[],
  newUserId: number,
  actor: string,
  opts?: BulkProgress,
): Promise<{ ok: number; failed: number; error: string | null }> {
  const actorErr = assertNumericActor(actor);
  if (actorErr) return { ok: 0, failed: leadIds.length, error: actorErr.error };

  let ok = 0;
  let failed = 0;
  let firstErr: string | null = null;
  const total = leadIds.length;
  for (const id of leadIds) {
    if (opts?.signal?.aborted) break;
    const res = await writeLeadOwner(id, newUserId, actor, 'bulk');
    if (res.error || res.affected === 0) {
      failed += 1;
      if (!firstErr) firstErr = res.error ?? null;
    } else {
      ok += 1;
    }
    opts?.onProgress?.(ok + failed, total);
  }

  if (ok > 0) {
    fireOwnerNotify({
      recipientUserId: newUserId,
      actor,
      isReassign: true,
      recordName: `${ok} lead${ok === 1 ? '' : 's'}`,
      route: '/leads',
      entityWord: 'lead',
    });
  }

  return {
    ok,
    failed,
    error:
      failed > 0
        ? firstErr ?? `${failed} could not be reassigned (no permission or no active report row).`
        : null,
  };
}

/* ── company / contact reassignment (per-project owner_user_id) ──────────── */

/**
 * Set the per-project owner of a COMPANY (company_project_status.owner_user_id).
 * Upserts on (company_id, project_id) — the status row may not exist yet for this
 * project. The owner_user_id column already exists (was dormant); this is the
 * first writer. Reassigning to someone else passes RLS only for admin/manager
 * (WITH CHECK on the new owner_user_id).
 */
export async function reassignCompany(input: {
  companyId: number;
  projectId: number;
  newUserId: number;
  actor: string;
  companyName?: string;
  isReassign?: boolean;
  reason?: string;
}): Promise<{ error: string } | null> {
  const actorErr = assertNumericActor(input.actor);
  if (actorErr) return actorErr;

  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from('company_project_status')
    .select('company_id')
    .eq('company_id', input.companyId)
    .eq('project_id', input.projectId)
    .maybeSingle();

  const row: Record<string, unknown> = {
    company_id: input.companyId,
    project_id: input.projectId,
    owner_user_id: input.newUserId,
    updated_by: input.actor,
    updated_date: now,
  };
  if (!existing) {
    row.created_by = input.actor;
    row.created_date = now;
  }

  const { error } = await supabase
    .from('company_project_status')
    .upsert(row, { onConflict: 'company_id,project_id' });
  if (error) return { error: mapWriteError(error) };

  // Cascade: assigning a company also assigns ALL its contacts (in this project)
  // to the same owner — assigning a company assigns its people too (Ankit, 2026-06-22).
  await cascadeCompanyContacts(input.companyId, input.projectId, input.newUserId, input.actor);

  fireOwnerNotify({
    recipientUserId: input.newUserId,
    actor: input.actor,
    isReassign: input.isReassign ?? false,
    recordName: input.companyName,
    route: `/companies/${input.companyId}`,
    entityWord: 'company',
    reason: input.reason,
  });
  return null;
}

/**
 * Set the per-project owner of a CONTACT (contact_project_status.owner_user_id).
 * Upserts on (contact_id, project_id). Same authorization model as reassignCompany.
 */
export async function reassignContact(input: {
  contactId: number;
  projectId: number;
  newUserId: number;
  actor: string;
  contactName?: string;
  isReassign?: boolean;
  reason?: string;
}): Promise<{ error: string } | null> {
  const actorErr = assertNumericActor(input.actor);
  if (actorErr) return actorErr;

  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from('contact_project_status')
    .select('contact_id')
    .eq('contact_id', input.contactId)
    .eq('project_id', input.projectId)
    .maybeSingle();

  const row: Record<string, unknown> = {
    contact_id: input.contactId,
    project_id: input.projectId,
    owner_user_id: input.newUserId,
    updated_by: input.actor,
    updated_date: now,
  };
  if (!existing) {
    row.created_by = input.actor;
    row.created_date = now;
  }

  const { error } = await supabase
    .from('contact_project_status')
    .upsert(row, { onConflict: 'contact_id,project_id' });
  if (error) return { error: mapWriteError(error) };

  fireOwnerNotify({
    recipientUserId: input.newUserId,
    actor: input.actor,
    isReassign: input.isReassign ?? false,
    recordName: input.contactName,
    route: `/contacts/${input.contactId}`,
    entityWord: 'contact',
    reason: input.reason,
  });
  return null;
}

/* ── bulk reassignment (one summary notify per new owner) ────────────────── */

/** Upsert owner_user_id on a per-project status row (company/contact). */
async function upsertOwner(
  table: 'company_project_status' | 'contact_project_status',
  idCol: 'company_id' | 'contact_id',
  recordId: number,
  projectId: number,
  newUserId: number,
  actor: string,
): Promise<{ error?: string }> {
  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from(table)
    .select(idCol)
    .eq(idCol, recordId)
    .eq('project_id', projectId)
    .maybeSingle();
  const row: Record<string, unknown> = {
    [idCol]: recordId,
    project_id: projectId,
    owner_user_id: newUserId,
    updated_by: actor,
    updated_date: now,
  };
  if (!existing) {
    row.created_by = actor;
    row.created_date = now;
  }
  const { error } = await supabase.from(table).upsert(row, { onConflict: `${idCol},project_id` });
  return { error: error ? mapWriteError(error) : undefined };
}

/**
 * Cascade a company's owner onto every contact of that company (in one project).
 * Returns the number of contacts (re)assigned. Best-effort per contact.
 */
async function cascadeCompanyContacts(
  companyId: number,
  projectId: number,
  newUserId: number,
  actor: string,
): Promise<number> {
  const { data: contacts } = await supabase
    .from('contact_master')
    .select('contact_id')
    .eq('company_id', companyId);
  let n = 0;
  for (const c of (contacts ?? []) as { contact_id: number }[]) {
    const res = await upsertOwner('contact_project_status', 'contact_id', c.contact_id, projectId, newUserId, actor);
    if (!res.error) n += 1;
  }
  return n;
}

type BulkResult = { ok: number; failed: number; error: string | null };

function summarize(ok: number, failed: number, firstErr: string | null): BulkResult {
  return {
    ok,
    failed,
    error: failed > 0 ? firstErr ?? `${failed} could not be reassigned (no permission).` : null,
  };
}

export async function reassignMeetingsBulk(
  meetingIds: number[],
  newUserId: number,
  actor: string,
  opts?: BulkProgress,
): Promise<BulkResult> {
  const actorErr = assertNumericActor(actor);
  if (actorErr) return { ok: 0, failed: meetingIds.length, error: actorErr.error };
  let ok = 0, failed = 0;
  let firstErr: string | null = null;
  const total = meetingIds.length;
  for (const mId of meetingIds) {
    if (opts?.signal?.aborted) break;
    const leadId = await fetchMeetingLeadId(mId);
    if (leadId == null) { failed += 1; if (!firstErr) firstErr = 'Some meetings have no linked lead.'; opts?.onProgress?.(ok + failed, total); continue; }
    const res = await writeLeadOwner(leadId, newUserId, actor);
    if (res.error || res.affected === 0) { failed += 1; if (!firstErr) firstErr = res.error ?? null; }
    else ok += 1;
    opts?.onProgress?.(ok + failed, total);
  }
  if (ok > 0) {
    fireOwnerNotify({
      recipientUserId: newUserId, actor, isReassign: true,
      recordName: `${ok} meeting${ok === 1 ? '' : 's'}`, route: '/meetings', entityWord: 'lead',
    });
  }
  return summarize(ok, failed, firstErr);
}

export async function reassignCompaniesBulk(
  companyIds: number[],
  projectId: number,
  newUserId: number,
  actor: string,
  opts?: BulkProgress,
): Promise<BulkResult> {
  const actorErr = assertNumericActor(actor);
  if (actorErr) return { ok: 0, failed: companyIds.length, error: actorErr.error };
  let ok = 0, failed = 0;
  let firstErr: string | null = null;
  const total = companyIds.length;
  for (const cId of companyIds) {
    if (opts?.signal?.aborted) break;
    const res = await upsertOwner('company_project_status', 'company_id', cId, projectId, newUserId, actor);
    if (res.error) { failed += 1; if (!firstErr) firstErr = res.error; }
    else { ok += 1; await cascadeCompanyContacts(cId, projectId, newUserId, actor); }
    opts?.onProgress?.(ok + failed, total);
  }
  if (ok > 0) {
    fireOwnerNotify({
      recipientUserId: newUserId, actor, isReassign: true,
      recordName: `${ok} compan${ok === 1 ? 'y' : 'ies'}`, route: '/companies', entityWord: 'company',
    });
  }
  return summarize(ok, failed, firstErr);
}

export async function reassignContactsBulk(
  contactIds: number[],
  projectId: number,
  newUserId: number,
  actor: string,
  opts?: BulkProgress,
): Promise<BulkResult> {
  const actorErr = assertNumericActor(actor);
  if (actorErr) return { ok: 0, failed: contactIds.length, error: actorErr.error };
  let ok = 0, failed = 0;
  let firstErr: string | null = null;
  const total = contactIds.length;
  for (const cId of contactIds) {
    if (opts?.signal?.aborted) break;
    const res = await upsertOwner('contact_project_status', 'contact_id', cId, projectId, newUserId, actor);
    if (res.error) { failed += 1; if (!firstErr) firstErr = res.error; }
    else ok += 1;
    opts?.onProgress?.(ok + failed, total);
  }
  if (ok > 0) {
    fireOwnerNotify({
      recipientUserId: newUserId, actor, isReassign: true,
      recordName: `${ok} contact${ok === 1 ? '' : 's'}`, route: '/contacts', entityWord: 'contact',
    });
  }
  return summarize(ok, failed, firstErr);
}

/* ── ALT-443: Record-count helpers + departing-user orchestration ──────────── */

/**
 * Count records owned by a user across all three modules.
 * Leads: lead_report.user_id (active rows).
 * Companies: company_project_status.owner_user_id (across all projects).
 * Contacts: contact_project_status.owner_user_id (across all projects).
 * Read-only; no RLS restriction on counts for admins.
 */
export async function countOwnedRecords(
  userId: number,
): Promise<{ leads: number; contacts: number; companies: number; error: string | null }> {
  const [leadsRes, companiesRes, contactsRes] = await Promise.all([
    supabase
      .from('lead_report')
      .select('report_id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('deleted_date', null),
    supabase
      .from('company_project_status')
      .select('company_id', { count: 'exact', head: true })
      .eq('owner_user_id', userId),
    supabase
      .from('contact_project_status')
      .select('contact_id', { count: 'exact', head: true })
      .eq('owner_user_id', userId),
  ]);

  const firstErr =
    leadsRes.error?.message ?? companiesRes.error?.message ?? contactsRes.error?.message ?? null;

  return {
    leads: leadsRes.count ?? 0,
    companies: companiesRes.count ?? 0,
    contacts: contactsRes.count ?? 0,
    error: firstErr,
  };
}

/**
 * Fetch all lead IDs owned by a user (via lead_report.user_id, active rows).
 */
export async function fetchOwnedLeadIds(userId: number): Promise<number[]> {
  const { data } = await supabase
    .from('lead_report')
    .select('lead_id')
    .eq('user_id', userId)
    .is('deleted_date', null);
  return ((data ?? []) as { lead_id: number }[]).map((r) => r.lead_id);
}

/**
 * Fetch all company_project_status rows owned by a user, returning {company_id, project_id}.
 */
export async function fetchOwnedCompanyRows(
  userId: number,
): Promise<{ company_id: number; project_id: number }[]> {
  const { data } = await supabase
    .from('company_project_status')
    .select('company_id, project_id')
    .eq('owner_user_id', userId);
  return (data ?? []) as { company_id: number; project_id: number }[];
}

/**
 * Fetch all contact_project_status rows owned by a user, returning {contact_id, project_id}.
 */
export async function fetchOwnedContactRows(
  userId: number,
): Promise<{ contact_id: number; project_id: number }[]> {
  const { data } = await supabase
    .from('contact_project_status')
    .select('contact_id, project_id')
    .eq('owner_user_id', userId);
  return (data ?? []) as { contact_id: number; project_id: number }[];
}
