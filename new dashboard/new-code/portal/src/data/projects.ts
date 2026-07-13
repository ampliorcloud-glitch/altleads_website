/**
 * projects.ts — reads the live CRM `project` table for the global project selector.
 *
 * Mirrors the CRM web app's ProjectSwitcher source (new-code/web/src/data/wishlist.ts
 * fetchWishlistLookups → `project` table): columns project_id, project_name,
 * client_assoc_id, enabled, deleted_date. A lead/meeting links to a project via
 * lead_master.project_id (carried onto PortalMeeting.project_id by crm.ts), so the
 * selector filters meetings + dashboard CLIENT-SIDE by project_id.
 *
 * NOTE: returns ALL enabled projects (RLS is off in prod). True per-user project
 * scoping (a sales user only sees their own projects) arrives with the RLS pass —
 * the same CRM-touching step that gates client-safe isolation.
 */
import { supabase } from '../lib/supabase'
import { PortalScope } from './crm'

export interface PortalProject {
  project_id: number
  project_name: string
  client_assoc_id: number | null
}

export async function fetchProjects(_scope: PortalScope): Promise<PortalProject[]> {
  if (_scope.kind === 'demo') return []
  const { data, error } = await supabase
    .from('project')
    .select('project_id, project_name, client_assoc_id')
    .is('deleted_date', null)
    .eq('enabled', true)
    .order('project_name', { ascending: true, nullsFirst: false })
    .limit(500)
  if (error || !data) return []
  return (data as Array<{ project_id: number; project_name: string | null; client_assoc_id: number | null }>)
    .map((p) => ({
      project_id: p.project_id,
      project_name: (p.project_name ?? '').trim() || `Project #${p.project_id}`,
      client_assoc_id: p.client_assoc_id ?? null,
    }))
}
