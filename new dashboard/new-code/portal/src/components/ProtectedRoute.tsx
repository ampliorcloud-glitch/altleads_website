import { Navigate, Outlet } from 'react-router-dom'
import { usePortalAuth } from '../hooks/usePortalAuth'
import { supabase } from '../lib/supabase'

export default function ProtectedRoute() {
  const { session, authorized, loading, error } = usePortalAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-ink-mute text-sm">Loading portal…</p>
        </div>
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
        <div className="bg-surface rounded-2xl shadow-pop border border-line p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-ink mb-2">Access Denied</h2>
          <p className="text-ink-mute text-sm mb-6">
            {error ?? 'Your account does not have portal access. Please contact your Amplior administrator.'}
          </p>
          <button
            onClick={() => { void supabase.auth.signOut() }}
            className="px-6 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors text-sm font-semibold"
          >
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  return <Outlet />
}
