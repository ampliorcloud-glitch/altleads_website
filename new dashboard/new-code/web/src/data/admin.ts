/**
 * Admin panel data layer — real Supabase reads + writes.
 *
 * Tables used:
 *   user_master(user_id pk identity, full_name, email, enabled, designation_id, audit cols)
 *   user_role(user_id+role_id composite pk, audit cols) -> role_master(role_id, name)
 *   role_master(role_id, name, priority, is_web)
 *   project(project_id pk identity, project_name, enabled, client_assoc_id, audit cols)
 *   project_user(project_user_id pk identity, project_id, user_id, role_name, audit cols)
 *   client_association(client_assoc_id pk identity, client_name, full_name, email,
 *      mobile_number, enabled, cin_number, location, website, industry_id, domain_id,
 *      address_id, country_code_id, audit cols)
 *   source_master(source_id pk identity, source_name, audit cols)
 *   industry_master(industry_id, industry_name, short_industry_name)
 *   designation_master(designation_id pk identity, designation_name, audit cols)
 *   domain_master(domain_id, domain_name)
 *
 * Notes:
 *   - audit columns created_by / updated_by store the acting user's user_id as text (e.g. "1").
 *   - soft-deletes use deleted_date / deleted_by; all reads filter deleted_date is null.
 *   - RLS is off in this preview; the authenticated client reads/writes all tables.
 */

import { supabase } from '../lib/supabase';
import { humanizeWriteError } from '../lib/writeError';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface RoleRow {
  role_id: number;
  name: string;
  priority: number | null;
  is_web: boolean | null;
}

export interface AdminUser {
  user_id: number;
  full_name: string;
  email: string;
  enabled: boolean;
  designation_id: number | null;
  designation: string;
  roleIds: number[];
  roleNames: string[];
}

export interface AdminProject {
  project_id: number;
  project_name: string;
  enabled: boolean;
  client_assoc_id: number | null;
  clientName: string;
  members: ProjectMember[];
}

export interface ProjectMember {
  project_user_id: number;
  user_id: number;
  full_name: string;
  role_name: string;
}

export interface AdminClient {
  client_assoc_id: number;
  client_name: string;
  full_name: string;
  email: string;
  mobile_number: string;
  enabled: boolean;
  cin_number: string;
  location: string | null;
  website: string | null;
  industry_id: number | null;
  domain_id: number | null;
  industryName: string;
  domainName: string;
  address_id: number | null;
  country_code_id: number | null;
}

export interface RefRow {
  id: number;
  name: string;
}

export interface LookupOption {
  id: number;
  name: string;
}

/* ------------------------------------------------------------------ */
/*  Internal row shapes                                                */
/* ------------------------------------------------------------------ */

interface UserMasterRow {
  user_id: number;
  full_name: string | null;
  email: string | null;
  enabled: boolean;
  designation_id: number | null;
}
interface UserRoleRow { user_id: number; role_id: number; }
interface ProjectRow { project_id: number; project_name: string; enabled: boolean; client_assoc_id: number | null; }
interface ProjectUserRow { project_user_id: number; project_id: number; user_id: number; role_name: string; }
interface ClientRow {
  client_assoc_id: number;
  client_name: string;
  full_name: string;
  email: string;
  mobile_number: string;
  enabled: boolean;
  cin_number: string;
  location: string | null;
  website: string | null;
  industry_id: number | null;
  domain_id: number | null;
  address_id: number | null;
  country_code_id: number | null;
}

/* ------------------------------------------------------------------ */
/*  Shared lookups                                                     */
/* ------------------------------------------------------------------ */

export interface AdminLookups {
  roles: RoleRow[];
  designations: LookupOption[];
  industries: LookupOption[];
  domains: LookupOption[];
  projectRoleNames: string[];
}

/** Role names assignable to a user within a project (project_user.role_name). */
export const PROJECT_ROLE_NAMES = ['SALES_HEAD', 'TEAM_LEAD', 'SALES_PERSON', 'AGENT'];

export async function fetchLookups(): Promise<AdminLookups> {
  const [rolesRes, desigRes, indRes, domRes] = await Promise.all([
    supabase.from('role_master').select('role_id, name, priority, is_web').is('deleted_date', null).order('priority', { ascending: true, nullsFirst: false }),
    supabase.from('designation_master').select('designation_id, designation_name').is('deleted_date', null).order('designation_name'),
    supabase.from('industry_master').select('industry_id, industry_name').is('deleted_date', null).order('industry_name'),
    supabase.from('domain_master').select('domain_id, domain_name').is('deleted_date', null).order('domain_name'),
  ]);

  const roles = ((rolesRes.data ?? []) as unknown as RoleRow[]);
  const designations = ((desigRes.data ?? []) as unknown as { designation_id: number; designation_name: string }[])
    .map((d) => ({ id: d.designation_id, name: (d.designation_name ?? '').trim() }));
  const industries = ((indRes.data ?? []) as unknown as { industry_id: number; industry_name: string }[])
    .map((i) => ({ id: i.industry_id, name: i.industry_name }));
  const domains = ((domRes.data ?? []) as unknown as { domain_id: number; domain_name: string }[])
    .map((d) => ({ id: d.domain_id, name: d.domain_name }));

  return { roles, designations, industries, domains, projectRoleNames: PROJECT_ROLE_NAMES };
}

/* ------------------------------------------------------------------ */
/*  Users                                                              */
/* ------------------------------------------------------------------ */

export async function fetchUsers(roles: RoleRow[]): Promise<{ users: AdminUser[]; error: string | null }> {
  const { data: usersRaw, error } = await supabase
    .from('user_master')
    .select('user_id, full_name, email, enabled, designation_id')
    .is('deleted_date', null)
    .order('user_id', { ascending: false });

  if (error) return { users: [], error: error.message };

  const users = (usersRaw ?? []) as unknown as UserMasterRow[];

  const { data: rolesRaw } = await supabase
    .from('user_role')
    .select('user_id, role_id')
    .is('deleted_date', null);
  const userRoles = (rolesRaw ?? []) as unknown as UserRoleRow[];

  const { data: desigRaw } = await supabase
    .from('designation_master')
    .select('designation_id, designation_name')
    .is('deleted_date', null);
  const desigMap = new Map<number, string>();
  ((desigRaw ?? []) as unknown as { designation_id: number; designation_name: string }[])
    .forEach((d) => desigMap.set(d.designation_id, (d.designation_name ?? '').trim()));

  const roleNameMap = new Map<number, string>();
  roles.forEach((r) => roleNameMap.set(r.role_id, r.name));

  const rolesByUser = new Map<number, number[]>();
  userRoles.forEach((ur) => {
    const arr = rolesByUser.get(ur.user_id) ?? [];
    arr.push(ur.role_id);
    rolesByUser.set(ur.user_id, arr);
  });

  const mapped: AdminUser[] = users.map((u) => {
    const roleIds = rolesByUser.get(u.user_id) ?? [];
    return {
      user_id: u.user_id,
      full_name: u.full_name ?? '',
      email: u.email ?? '',
      enabled: u.enabled,
      designation_id: u.designation_id,
      designation: u.designation_id ? (desigMap.get(u.designation_id) ?? '') : '',
      roleIds,
      roleNames: roleIds.map((id) => roleNameMap.get(id) ?? '').filter(Boolean),
    };
  });

  return { users: mapped, error: null };
}

export async function setUserEnabled(userId: number, enabled: boolean, actorId: string): Promise<string | null> {
  const { error } = await supabase
    .from('user_master')
    .update({ enabled, updated_by: actorId, updated_date: new Date().toISOString() })
    .eq('user_id', userId);
  return error ? humanizeWriteError(error) : null;
}

/**
 * Add a single (user_id, role_id) assignment without touching the user's other
 * roles. The user_role PK is (user_id, role_id) and rows are soft-deleted, so a
 * previously-removed assignment must be REVIVED (clear deleted_* + restamp) to
 * avoid a duplicate-key violation; only a truly-absent pair is inserted fresh.
 */
async function addUserRole(userId: number, roleId: number, actorId: string): Promise<string | null> {
  const nowIso = new Date().toISOString();

  // Is there ANY existing row for this (user_id, role_id) — active or soft-deleted?
  const { data: existingRaw, error: selErr } = await supabase
    .from('user_role')
    .select('user_id, role_id, deleted_date')
    .eq('user_id', userId)
    .eq('role_id', roleId)
    .limit(1);
  if (selErr) return selErr.message;

  const existing = ((existingRaw ?? []) as unknown as { deleted_date: string | null }[])[0];

  if (existing) {
    // Already active — nothing to do.
    if (existing.deleted_date == null) return null;
    // Revive the soft-deleted assignment in place (respects the composite PK).
    const { error: revErr } = await supabase
      .from('user_role')
      .update({ deleted_by: null, deleted_date: null, updated_by: actorId, updated_date: nowIso })
      .eq('user_id', userId)
      .eq('role_id', roleId);
    return revErr?.message ?? null;
  }

  const { error: insErr } = await supabase
    .from('user_role')
    .insert({
      user_id: userId,
      role_id: roleId,
      created_by: actorId,
      created_date: nowIso,
    });
  return insErr?.message ?? null;
}

/** Soft-delete a single active (user_id, role_id) assignment (audited, scoped). */
async function removeUserRole(userId: number, roleId: number, actorId: string): Promise<string | null> {
  const { error } = await supabase
    .from('user_role')
    .update({ deleted_by: actorId, deleted_date: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('role_id', roleId)
    .is('deleted_date', null);
  return error ? humanizeWriteError(error) : null;
}

/**
 * Set the user's COMPLETE set of active roles to `nextRoleIds`, preserving every
 * role the admin kept and only writing the delta:
 *   - roles in next but not current  -> add (revive-or-insert)
 *   - roles in current but not next  -> soft-delete (audited)
 * Other users' rows are never touched. Multi-role users no longer lose roles.
 */
export async function setUserRoles(userId: number, nextRoleIds: number[], actorId: string): Promise<string | null> {
  // Read the user's current ACTIVE roles fresh so the diff is authoritative.
  const { data: currentRaw, error: curErr } = await supabase
    .from('user_role')
    .select('role_id')
    .eq('user_id', userId)
    .is('deleted_date', null);
  if (curErr) return curErr.message;

  const current = new Set(((currentRaw ?? []) as unknown as { role_id: number }[]).map((r) => r.role_id));
  const next = new Set(nextRoleIds);

  const toAdd = [...next].filter((id) => !current.has(id));
  const toRemove = [...current].filter((id) => !next.has(id));

  for (const roleId of toAdd) {
    const err = await addUserRole(userId, roleId, actorId);
    if (err) return err;
  }
  for (const roleId of toRemove) {
    const err = await removeUserRole(userId, roleId, actorId);
    if (err) return err;
  }
  return null;
}

/**
 * Backward-compatible single-role setter — now NON-destructive. Ensures the given
 * role is present without removing the user's other roles. Prefer `setUserRoles`
 * for the full multi-role editor.
 */
export async function setUserRole(userId: number, roleId: number, actorId: string): Promise<string | null> {
  return addUserRole(userId, roleId, actorId);
}

/* ------------------------------------------------------------------ */
/*  Projects                                                           */
/* ------------------------------------------------------------------ */

export async function fetchProjects(): Promise<{ projects: AdminProject[]; error: string | null }> {
  const { data: projRaw, error } = await supabase
    .from('project')
    .select('project_id, project_name, enabled, client_assoc_id')
    .is('deleted_date', null)
    .order('project_id', { ascending: false });
  if (error) return { projects: [], error: error.message };

  const projects = (projRaw ?? []) as unknown as ProjectRow[];

  const { data: puRaw } = await supabase
    .from('project_user')
    .select('project_user_id, project_id, user_id, role_name')
    .is('deleted_date', null);
  const projectUsers = (puRaw ?? []) as unknown as ProjectUserRow[];

  const { data: clientsRaw } = await supabase
    .from('client_association')
    .select('client_assoc_id, client_name')
    .is('deleted_date', null);
  const clientMap = new Map<number, string>();
  ((clientsRaw ?? []) as unknown as { client_assoc_id: number; client_name: string }[])
    .forEach((c) => clientMap.set(c.client_assoc_id, c.client_name));

  const { data: usersRaw } = await supabase
    .from('user_master')
    .select('user_id, full_name')
    .is('deleted_date', null);
  const userMap = new Map<number, string>();
  ((usersRaw ?? []) as unknown as { user_id: number; full_name: string | null }[])
    .forEach((u) => userMap.set(u.user_id, u.full_name ?? ''));

  const membersByProject = new Map<number, ProjectMember[]>();
  projectUsers.forEach((pu) => {
    const arr = membersByProject.get(pu.project_id) ?? [];
    arr.push({
      project_user_id: pu.project_user_id,
      user_id: pu.user_id,
      full_name: userMap.get(pu.user_id) ?? `User #${pu.user_id}`,
      role_name: pu.role_name,
    });
    membersByProject.set(pu.project_id, arr);
  });

  const mapped: AdminProject[] = projects.map((p) => ({
    project_id: p.project_id,
    project_name: p.project_name,
    enabled: p.enabled,
    client_assoc_id: p.client_assoc_id,
    clientName: p.client_assoc_id ? (clientMap.get(p.client_assoc_id) ?? '') : '',
    members: (membersByProject.get(p.project_id) ?? []).sort((a, b) => a.full_name.localeCompare(b.full_name)),
  }));

  return { projects: mapped, error: null };
}

export async function createProject(
  projectName: string,
  clientAssocId: number,
  actorId: string
): Promise<string | null> {
  const { error } = await supabase.from('project').insert({
    project_name: projectName,
    client_assoc_id: clientAssocId,
    enabled: true,
    created_by: actorId,
    created_date: new Date().toISOString(),
  });
  return error ? humanizeWriteError(error) : null;
}

export async function setProjectEnabled(projectId: number, enabled: boolean, actorId: string): Promise<string | null> {
  const { error } = await supabase
    .from('project')
    .update({ enabled, updated_by: actorId, updated_date: new Date().toISOString() })
    .eq('project_id', projectId);
  return error ? humanizeWriteError(error) : null;
}

export async function assignUserToProject(
  projectId: number,
  userId: number,
  roleName: string,
  actorId: string
): Promise<string | null> {
  // project_user has no UNIQUE(project_id, user_id); guard against duplicate
  // active assignments so the same user can't be added to a project twice.
  const { data: existingRaw, error: chkErr } = await supabase
    .from('project_user')
    .select('project_user_id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .is('deleted_date', null)
    .limit(1);
  if (chkErr) return chkErr.message;
  if ((existingRaw ?? []).length > 0) return 'This user is already assigned to the project.';

  const { error } = await supabase.from('project_user').insert({
    project_id: projectId,
    user_id: userId,
    role_name: roleName,
    created_by: actorId,
    created_date: new Date().toISOString(),
  });
  return error ? humanizeWriteError(error) : null;
}

export async function unassignProjectUser(projectUserId: number, actorId: string): Promise<string | null> {
  const { error } = await supabase
    .from('project_user')
    .update({ deleted_by: actorId, deleted_date: new Date().toISOString() })
    .eq('project_user_id', projectUserId);
  return error ? humanizeWriteError(error) : null;
}

/** Minimal project shape used by the global Project Switcher / project-scope context. */
export interface MyProject {
  project_id: number;
  project_name: string;
}

/**
 * Projects the given user may scope the app to, for the global Project Switcher.
 *   - ADMIN sees every ENABLED project.
 *   - everyone else sees the ENABLED projects they're assigned to via project_user.
 * Returns enabled projects only, sorted by name. Soft-deleted rows are excluded.
 * THROWS on a query error so the caller can tell a real failure (network/RLS)
 * apart from a genuine empty result — the ProjectProvider must NOT treat a
 * transient error as "this user has no projects" and wipe their saved scope
 * (review ALT-273B M4). A genuine no-access still returns [].
 */
export async function fetchMyProjects(
  userId: number | null,
  isAdmin: boolean,
): Promise<MyProject[]> {
  const { data: projRaw, error } = await supabase
    .from('project')
    .select('project_id, project_name, enabled')
    .eq('enabled', true)
    .is('deleted_date', null)
    .order('project_name', { ascending: true });
  if (error) throw new Error(error.message);
  if (!projRaw) return [];

  const allEnabled = (projRaw as unknown as { project_id: number; project_name: string }[]).map(
    (p) => ({ project_id: p.project_id, project_name: p.project_name }),
  );

  if (isAdmin) return allEnabled;
  if (userId == null) return [];

  const { data: puRaw, error: puErr } = await supabase
    .from('project_user')
    .select('project_id')
    .eq('user_id', userId)
    .is('deleted_date', null);
  if (puErr) throw new Error(puErr.message);
  if (!puRaw) return [];

  const myIds = new Set(
    (puRaw as unknown as { project_id: number }[]).map((r) => r.project_id),
  );
  return allEnabled.filter((p) => myIds.has(p.project_id));
}

/* ------------------------------------------------------------------ */
/*  Clients                                                            */
/* ------------------------------------------------------------------ */

export async function fetchClients(): Promise<{ clients: AdminClient[]; error: string | null }> {
  const { data: clientsRaw, error } = await supabase
    .from('client_association')
    .select('client_assoc_id, client_name, full_name, email, mobile_number, enabled, cin_number, location, website, industry_id, domain_id, address_id, country_code_id')
    .is('deleted_date', null)
    .order('client_assoc_id', { ascending: false });
  if (error) return { clients: [], error: error.message };

  const clients = (clientsRaw ?? []) as unknown as ClientRow[];

  const { data: indRaw } = await supabase.from('industry_master').select('industry_id, industry_name').is('deleted_date', null);
  const indMap = new Map<number, string>();
  ((indRaw ?? []) as unknown as { industry_id: number; industry_name: string }[]).forEach((i) => indMap.set(i.industry_id, i.industry_name));

  const { data: domRaw } = await supabase.from('domain_master').select('domain_id, domain_name').is('deleted_date', null);
  const domMap = new Map<number, string>();
  ((domRaw ?? []) as unknown as { domain_id: number; domain_name: string }[]).forEach((d) => domMap.set(d.domain_id, d.domain_name));

  const mapped: AdminClient[] = clients.map((c) => ({
    client_assoc_id: c.client_assoc_id,
    client_name: c.client_name,
    full_name: c.full_name,
    email: c.email,
    mobile_number: c.mobile_number,
    enabled: c.enabled,
    cin_number: c.cin_number,
    location: c.location,
    website: c.website,
    industry_id: c.industry_id,
    domain_id: c.domain_id,
    industryName: c.industry_id ? (indMap.get(c.industry_id) ?? '') : '',
    domainName: c.domain_id ? (domMap.get(c.domain_id) ?? '') : '',
    address_id: c.address_id,
    country_code_id: c.country_code_id,
  }));

  return { clients: mapped, error: null };
}

export async function setClientEnabled(
  clientAssocId: number,
  enabled: boolean,
  actorId: string
): Promise<string | null> {
  const { error } = await supabase
    .from('client_association')
    .update({ enabled, updated_by: actorId, updated_date: new Date().toISOString() })
    .eq('client_assoc_id', clientAssocId);
  return error ? humanizeWriteError(error) : null;
}

export interface ClientEditInput {
  client_name: string;
  full_name: string;
  email: string;
  mobile_number: string;
  cin_number: string;
  location: string;
  website: string;
  industry_id: number;
  domain_id: number;
  enabled: boolean;
}

/**
 * Pre-check the UNIQUE(email) and UNIQUE(cin_number) constraints on
 * client_association against active rows, returning a friendly field error
 * before we hit a raw Postgres 23505. `excludeId` skips the row being edited.
 */
async function checkClientUniqueness(
  email: string,
  cin: string,
  excludeId: number | null
): Promise<string | null> {
  const trimmedEmail = email.trim();
  const trimmedCin = cin.trim();

  if (trimmedEmail) {
    let q = supabase
      .from('client_association')
      .select('client_assoc_id')
      .is('deleted_date', null)
      .eq('email', trimmedEmail);
    if (excludeId != null) q = q.neq('client_assoc_id', excludeId);
    const { data, error } = await q.limit(1);
    if (error) return error.message;
    if ((data ?? []).length > 0) return 'A client with this email already exists.';
  }

  if (trimmedCin) {
    let q = supabase
      .from('client_association')
      .select('client_assoc_id')
      .is('deleted_date', null)
      .eq('cin_number', trimmedCin);
    if (excludeId != null) q = q.neq('client_assoc_id', excludeId);
    const { data, error } = await q.limit(1);
    if (error) return error.message;
    if ((data ?? []).length > 0) return 'A client with this CIN number already exists.';
  }

  return null;
}

/** Map a Postgres unique-violation (23505) to readable copy; pass others through. */
function friendlyWriteError(error: { code?: string; message: string } | null): string | null {
  if (!error) return null;
  if (error.code === '23505') {
    if (/email/i.test(error.message)) return 'A client with this email already exists.';
    if (/cin/i.test(error.message)) return 'A client with this CIN number already exists.';
    return 'A record with these details already exists.';
  }
  // RLS / missing-table / schema-cache (42501 / 42P01 / PGRST205) → friendly line.
  return humanizeWriteError(error);
}

export async function updateClient(
  clientAssocId: number,
  input: ClientEditInput,
  actorId: string
): Promise<string | null> {
  const dupErr = await checkClientUniqueness(input.email, input.cin_number, clientAssocId);
  if (dupErr) return dupErr;

  const { error } = await supabase
    .from('client_association')
    .update({
      client_name: input.client_name,
      full_name: input.full_name,
      email: input.email,
      mobile_number: input.mobile_number,
      cin_number: input.cin_number,
      location: input.location || null,
      website: input.website || null,
      industry_id: input.industry_id,
      domain_id: input.domain_id,
      enabled: input.enabled,
      updated_by: actorId,
      updated_date: new Date().toISOString(),
    })
    .eq('client_assoc_id', clientAssocId);
  return friendlyWriteError(error);
}

/**
 * Create a new client. A fresh address_master row is inserted (city_id null —
 * the client form doesn't capture a city yet; ALT-434 tracks exposing it) so
 * every client gets its own address record instead of borrowing a foreign one.
 * country_code_id is hardcoded to 1 (always India in this DB — no semantic change).
 *
 * TODO(ALT-434): expose city / address fields in the client form so the address
 * row can be populated at creation time.
 */
export async function createClient(input: ClientEditInput, actorId: string): Promise<string | null> {
  const dupErr = await checkClientUniqueness(input.email, input.cin_number, null);
  if (dupErr) return dupErr;

  // Insert a fresh address_master row for this client.
  // city_id is nullable (schema-confirmed) — left null until the form captures it.
  const { data: addrData, error: addrErr } = await supabase
    .from('address_master')
    .insert({
      city_id: null,
      created_by: actorId,
      created_date: new Date().toISOString(),
    })
    .select('address_id')
    .single();
  if (addrErr || !addrData) {
    return friendlyWriteError(addrErr) ?? 'Failed to create address record for client.';
  }
  const addressId = (addrData as unknown as { address_id: number }).address_id;

  const { error } = await supabase.from('client_association').insert({
    client_name: input.client_name,
    full_name: input.full_name,
    email: input.email,
    mobile_number: input.mobile_number,
    cin_number: input.cin_number,
    location: input.location || null,
    website: input.website || null,
    industry_id: input.industry_id,
    domain_id: input.domain_id,
    enabled: input.enabled,
    address_id: addressId,
    country_code_id: 1,
    created_by: actorId,
    created_date: new Date().toISOString(),
  });
  return friendlyWriteError(error);
}

/* ------------------------------------------------------------------ */
/*  Reference data                                                     */
/* ------------------------------------------------------------------ */

export async function fetchReferenceData(): Promise<{
  sources: RefRow[];
  industries: RefRow[];
  designations: RefRow[];
  domains: RefRow[];
  error: string | null;
}> {
  const [srcRes, indRes, desigRes, domRes] = await Promise.all([
    supabase.from('source_master').select('source_id, source_name').is('deleted_date', null).order('source_name'),
    supabase.from('industry_master').select('industry_id, industry_name').is('deleted_date', null).order('industry_name'),
    supabase.from('designation_master').select('designation_id, designation_name').is('deleted_date', null).order('designation_name'),
    supabase.from('domain_master').select('domain_id, domain_name').is('deleted_date', null).order('domain_name'),
  ]);

  const firstError = srcRes.error ?? indRes.error ?? desigRes.error ?? domRes.error ?? null;

  return {
    sources: ((srcRes.data ?? []) as unknown as { source_id: number; source_name: string }[]).map((s) => ({ id: s.source_id, name: s.source_name })),
    industries: ((indRes.data ?? []) as unknown as { industry_id: number; industry_name: string }[]).map((i) => ({ id: i.industry_id, name: i.industry_name })),
    designations: ((desigRes.data ?? []) as unknown as { designation_id: number; designation_name: string }[]).map((d) => ({ id: d.designation_id, name: (d.designation_name ?? '').trim() })),
    domains: ((domRes.data ?? []) as unknown as { domain_id: number; domain_name: string }[]).map((d) => ({ id: d.domain_id, name: d.domain_name })),
    error: firstError?.message ?? null,
  };
}

export async function addSource(name: string, actorId: string): Promise<string | null> {
  const { error } = await supabase.from('source_master').insert({
    source_name: name,
    created_by: actorId,
    created_date: new Date().toISOString(),
  });
  return error ? humanizeWriteError(error) : null;
}

export async function addDesignation(name: string, actorId: string): Promise<string | null> {
  const { error } = await supabase.from('designation_master').insert({
    designation_name: name,
    created_by: actorId,
    created_date: new Date().toISOString(),
  });
  return error ? humanizeWriteError(error) : null;
}

export async function addDomain(name: string, actorId: string): Promise<string | null> {
  const { error } = await supabase.from('domain_master').insert({
    domain_name: name,
    created_by: actorId,
    created_date: new Date().toISOString(),
  });
  return error ? humanizeWriteError(error) : null;
}

/* Edit existing reference-data rows. Writes are admin-gated by RLS (is_admin());
   a non-admin gets a Postgres 42501 which is surfaced as the error string. */
export async function updateSource(id: number, name: string, actorId: string): Promise<string | null> {
  const { error } = await supabase
    .from('source_master')
    .update({ source_name: name, updated_by: actorId, updated_date: new Date().toISOString() })
    .eq('source_id', id);
  return error ? humanizeWriteError(error) : null;
}

export async function updateDesignation(id: number, name: string, actorId: string): Promise<string | null> {
  const { error } = await supabase
    .from('designation_master')
    .update({ designation_name: name, updated_by: actorId, updated_date: new Date().toISOString() })
    .eq('designation_id', id);
  return error ? humanizeWriteError(error) : null;
}

export async function updateDomain(id: number, name: string, actorId: string): Promise<string | null> {
  const { error } = await supabase
    .from('domain_master')
    .update({ domain_name: name, updated_by: actorId, updated_date: new Date().toISOString() })
    .eq('domain_id', id);
  return error ? humanizeWriteError(error) : null;
}

/* ------------------------------------------------------------------ */
/*  Create User (via notify-service backend — uses service-role key)  */
/* ------------------------------------------------------------------ */

export async function createUser(input: {
  full_name: string;
  email: string;
  role_id: number;
  mobile_number?: string;
  created_by?: string | number;
}): Promise<{ ok: boolean; user_id: number; tempPassword: string }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error('Not authenticated: please log in before creating a user.');

  const base = (import.meta as any).env?.VITE_NOTIFY_URL || '';
  const res = await fetch(`${base}/api/users/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create user');
  return data as { ok: boolean; user_id: number; tempPassword: string };
}

export async function resetUserPassword(
  userId: number
): Promise<{ ok: boolean; tempPassword: string; created: boolean }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error('Not authenticated: please log in before resetting a password.');

  const base = (import.meta as any).env?.VITE_NOTIFY_URL || '';
  const res = await fetch(`${base}/api/users/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ user_id: userId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to reset password');
  return data as { ok: boolean; tempPassword: string; created: boolean };
}

/* ------------------------------------------------------------------ */
/*  Pre-Sales Questions admin                                          */
/* ------------------------------------------------------------------ */

export interface PreSalesQuestionAdmin {
  pre_sa_que_id: number;
  question: string;
  short_question: string;
  domain_id: number | null;
  domain_name: string;
  /** is_active column; defaults to true if the column doesn't exist yet (graceful). */
  is_active: boolean;
  is_discussion: boolean;
}

/**
 * Fetch all non-deleted pre-sales questions with their domain name.
 * Returns rows sorted by domain_id then pre_sa_que_id.
 *
 * NOTE: The `is_active` column may not exist in the live DB yet — it needs
 * an ALTER TABLE migration (see DESIGN §4b). Until the column exists the
 * select will fail; the function returns an empty list + surfaces the error
 * so the admin sees a clear message rather than a JS crash.
 */
export async function fetchPreSalesQuestionsAdmin(): Promise<{
  questions: PreSalesQuestionAdmin[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('pre_sales_question')
    .select('pre_sa_que_id, question, short_question, domain_id, is_active')
    .is('deleted_date', null)
    .order('domain_id', { ascending: true, nullsFirst: false })
    .order('pre_sa_que_id', { ascending: true });

  if (error) return { questions: [], error: error.message };

  const rows = (data ?? []) as {
    pre_sa_que_id: number;
    question: string | null;
    short_question: string | null;
    domain_id: number | null;
    is_active: boolean | null;
  }[];

  // Fetch domains for name resolution
  const { data: domData } = await supabase
    .from('domain_master')
    .select('domain_id, domain_name')
    .is('deleted_date', null);
  const domMap = new Map<number, string>();
  ((domData ?? []) as { domain_id: number; domain_name: string }[]).forEach((d) =>
    domMap.set(d.domain_id, d.domain_name)
  );

  const questions: PreSalesQuestionAdmin[] = rows.map((r) => ({
    pre_sa_que_id: r.pre_sa_que_id,
    question: r.question ?? '',
    short_question: r.short_question ?? '',
    domain_id: r.domain_id ?? null,
    domain_name: r.domain_id ? (domMap.get(r.domain_id) ?? '') : '(No domain)',
    // Treat null as true so old rows (before the column was added) show as active.
    is_active: r.is_active ?? true,
    is_discussion: (r.short_question ?? '').trim().toLowerCase() === 'discussion',
  }));

  return { questions, error: null };
}

/** Add a new pre-sales question for a domain. */
export async function addPreSalesQuestion(input: {
  domain_id: number;
  short_question: string;
  question: string;
  actorId: string;
}): Promise<string | null> {
  const now = new Date().toISOString();
  const { error } = await supabase.from('pre_sales_question').insert({
    domain_id: input.domain_id,
    short_question: input.short_question.trim(),
    question: input.question.trim(),
    is_active: true,
    created_by: input.actorId,
    created_date: now,
  });
  return error ? humanizeWriteError(error) : null;
}

/** Edit the label / full text / domain of an existing question. */
export async function updatePreSalesQuestion(input: {
  pre_sa_que_id: number;
  short_question: string;
  question: string;
  domain_id: number;
  actorId: string;
}): Promise<string | null> {
  const { error } = await supabase
    .from('pre_sales_question')
    .update({
      short_question: input.short_question.trim(),
      question: input.question.trim(),
      domain_id: input.domain_id,
      updated_by: input.actorId,
      updated_date: new Date().toISOString(),
    })
    .eq('pre_sa_que_id', input.pre_sa_que_id);
  return error ? humanizeWriteError(error) : null;
}

/**
 * Toggle `is_active` on a question.
 * The Discussion question is the anchor for validation — the UI prevents
 * disabling it (see PreSalesQuestionsTab). This function does not enforce
 * that guard server-side (no backend change permitted).
 */
export async function setPreSalesQuestionActive(
  pre_sa_que_id: number,
  isActive: boolean,
  actorId: string
): Promise<string | null> {
  const { error } = await supabase
    .from('pre_sales_question')
    .update({
      is_active: isActive,
      updated_by: actorId,
      updated_date: new Date().toISOString(),
    })
    .eq('pre_sa_que_id', pre_sa_que_id);
  return error ? humanizeWriteError(error) : null;
}

/**
 * Soft-delete a question. Blocked in the UI if the question has existing answers
 * (the UI checks this before calling). The DB does NOT enforce it.
 */
export async function deletePreSalesQuestion(
  pre_sa_que_id: number,
  actorId: string
): Promise<string | null> {
  const now = new Date().toISOString();
  // Check for existing answers first (best-effort; non-atomic).
  const { data: ansRows } = await supabase
    .from('pre_sales_answer')
    .select('pre_sa_ans_id')
    .eq('pre_sa_que_id', pre_sa_que_id)
    .is('deleted_date', null)
    .limit(1);
  if ((ansRows ?? []).length > 0) {
    return 'This question has saved answers and cannot be deleted. Disable it instead.';
  }
  const { error } = await supabase
    .from('pre_sales_question')
    .update({ deleted_by: actorId, deleted_date: now })
    .eq('pre_sa_que_id', pre_sa_que_id);
  return error ? humanizeWriteError(error) : null;
}
