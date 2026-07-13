import { useEffect, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { DEMO, demoSession, demoClient } from '../demo/demoData'
import { PortalScope } from '../data/crm'

export interface PortalAccount {
  userId: number | null
  fullName: string
  email: string
  roles: string[]
  roleLabel: string
  scope: PortalScope
}

const INTERNAL = ['ADMIN', 'TEAM_LEAD', 'AGENT', 'QC']
const SALES = ['SALES_HEAD', 'SALES_PERSON']
const LABEL: Record<string, string> = {
  ADMIN: 'Administrator', TEAM_LEAD: 'Team Lead', AGENT: 'Agent', QC: 'QC',
  SALES_HEAD: 'Sales Head', SALES_PERSON: 'Sales Person', COMPANY_ADMIN: 'Company Admin',
}

const demoAccount: PortalAccount = {
  userId: 1001,
  fullName: demoClient.adminName,
  email: demoClient.adminEmail,
  roles: ['COMPANY_ADMIN'],
  roleLabel: 'Company Admin',
  scope: { kind: 'demo' },
}

function resolveScope(roles: string[], userId: number | null): PortalScope {
  // Internal staff (for viewing) see everything; sales users are scoped to their own.
  if (roles.some((r) => INTERNAL.includes(r))) return { kind: 'all' }
  if (userId != null && roles.some((r) => SALES.includes(r))) return { kind: 'user', userId }
  return { kind: 'all' }
}
function pickLabel(roles: string[]): string {
  for (const r of ['ADMIN', 'TEAM_LEAD', 'SALES_HEAD', 'SALES_PERSON', 'QC', 'AGENT']) {
    if (roles.includes(r)) return LABEL[r]
  }
  return roles[0] ?? 'User'
}

export function usePortalAuth() {
  const [session, setSession] = useState<Session | null>(DEMO ? demoSession : null)
  const [account, setAccount] = useState<PortalAccount | null>(DEMO ? demoAccount : null)
  const [loading, setLoading] = useState(!DEMO)
  const [error, setError] = useState<string | null>(null)

  const resolve = async (uid: string, email: string) => {
    const { data: prof } = await supabase
      .from('profiles').select('user_id, full_name, role').eq('id', uid).maybeSingle()
    const userId = (prof as { user_id: number | null } | null)?.user_id ?? null
    const fullName = ((prof as { full_name: string } | null)?.full_name ?? '').trim() || (email.split('@')[0])
    const fallbackRole = (prof as { role: string | null } | null)?.role

    let roles: string[] = fallbackRole ? [fallbackRole] : []
    if (userId != null) {
      const { data: rr } = await supabase
        .from('user_role').select('role_master(name)').eq('user_id', userId).is('deleted_date', null)
      const names = ((rr ?? []) as Array<{ role_master: { name: string } | { name: string }[] | null }>)
        .flatMap((row) => {
          const rm = row.role_master
          if (!rm) return []
          return Array.isArray(rm) ? rm.map((x) => x.name) : [rm.name]
        }).filter(Boolean)
      roles = [...new Set([...names, ...roles])]
    }

    if (!roles.length) {
      setAccount(null)
      setError('No portal access for this account. Contact your Amplior administrator.')
      return
    }
    setError(null)
    setAccount({ userId, fullName, email, roles, roleLabel: pickLabel(roles), scope: resolveScope(roles, userId) })
  }

  useEffect(() => {
    if (DEMO) return
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session?.user) await resolve(session.user.id, session.user.email ?? '')
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, session) => {
      setSession(session)
      if (session?.user) { setLoading(true); await resolve(session.user.id, session.user.email ?? ''); setLoading(false) }
      else { setAccount(null) }
    })
    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => { await supabase.auth.signOut() }

  return {
    session,
    account,
    scope: account?.scope ?? ({ kind: 'all' } as PortalScope),
    authorized: DEMO || !!account,
    loading,
    error,
    signOut,
  }
}
