/**
 * ProjectScope — the portal's GLOBAL project selector state (owner ask: "freehand
 * to select project or multi-projects, similar to the CRM global select").
 *
 * Unlike the CRM's single-select ProjectSwitcher, the portal supports MULTI-select
 * (an empty selection = "All projects"). The choice is persisted per-browser and
 * read app-wide: Meetings + Dashboard AND/filter their rows by project_id
 * (PortalMeeting.project_id, sourced from lead_master.project_id).
 */
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { usePortalAuth } from '../hooks/usePortalAuth'
import { fetchProjects, PortalProject } from '../data/projects'
import { DEMO, demoClient } from '../demo/demoData'

interface ProjectScopeValue {
  projects: PortalProject[]
  /** empty = all projects (no filter) */
  selectedIds: number[]
  setSelectedIds: (ids: number[]) => void
  /** convenience: true when a meeting's project_id passes the current selection */
  inScope: (projectId: number | null | undefined) => boolean
  loading: boolean
}

const Ctx = createContext<ProjectScopeValue>({
  projects: [],
  selectedIds: [],
  setSelectedIds: () => {},
  inScope: () => true,
  loading: false,
})

const LS_KEY = 'amplior_portal_projects'

export function ProjectScopeProvider({ children }: { children: ReactNode }) {
  const { account, scope } = usePortalAuth()
  const [projects, setProjects] = useState<PortalProject[]>([])
  const [selectedIds, setSelectedIdsState] = useState<number[]>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      const arr = raw ? JSON.parse(raw) : []
      return Array.isArray(arr) ? arr.filter((x) => typeof x === 'number') : []
    } catch {
      return []
    }
  })
  const [loading, setLoading] = useState(!DEMO)

  const setSelectedIds = (ids: number[]) => {
    setSelectedIdsState(ids)
    try { localStorage.setItem(LS_KEY, JSON.stringify(ids)) } catch { /* ignore */ }
  }

  useEffect(() => {
    if (DEMO) {
      setProjects(demoClient.projects.map((name, i) => ({ project_id: 9001 + i, project_name: name, client_assoc_id: 501 })))
      setLoading(false)
      return
    }
    if (!account) return
    setLoading(true)
    fetchProjects(scope).then((ps) => {
      setProjects(ps)
      // Drop any persisted id that's no longer accessible (avoids a stale filter
      // silently hiding everything).
      setSelectedIdsState((prev) => prev.filter((id) => ps.some((p) => p.project_id === id)))
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account])

  const inScope = (projectId: number | null | undefined) =>
    selectedIds.length === 0 || (projectId != null && selectedIds.includes(projectId))

  return (
    <Ctx.Provider value={{ projects, selectedIds, setSelectedIds, inScope, loading }}>
      {children}
    </Ctx.Provider>
  )
}

export const useProjectScope = () => useContext(Ctx)
