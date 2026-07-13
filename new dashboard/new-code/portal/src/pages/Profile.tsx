import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { usePortalAuth } from '../hooks/usePortalAuth'
import { User, Mail, Shield, LogOut, KeyRound, CheckCircle, AlertCircle } from 'lucide-react'

export default function Profile() {
  const { session, account, signOut } = usePortalAuth()
  const navigate = useNavigate()
  const [showPwForm, setShowPwForm] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwMsg(null)
    if (newPw !== confirmPw) {
      setPwMsg({ type: 'error', text: 'Passwords do not match.' })
      return
    }
    if (newPw.length < 8) {
      setPwMsg({ type: 'error', text: 'Password must be at least 8 characters.' })
      return
    }
    setPwLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPw })
    setPwLoading(false)
    if (error) {
      setPwMsg({ type: 'error', text: error.message })
    } else {
      setPwMsg({ type: 'success', text: 'Password updated successfully.' })
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      setShowPwForm(false)
    }
  }

  const displayName = account?.fullName || session?.user?.email || 'Portal User'
  const displayEmail = account?.email || session?.user?.email || ''
  const displayRole = account?.roleLabel || '—'

  const initials = () => displayName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-5">
      <h1 className="text-xl font-bold text-gray-900">My Profile</h1>

      {/* Avatar + name */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-bold">
          {initials()}
        </div>
        <div>
          <p className="text-lg font-bold text-gray-900">{displayName}</p>
          <p className="text-sm text-gray-500">{displayEmail}</p>
          <span className="mt-1.5 inline-block text-xs font-semibold bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full">
            {displayRole}
          </span>
        </div>
      </div>

      {/* Info rows */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50">
        <div className="flex items-center gap-3 px-5 py-4">
          <Mail size={18} className="text-gray-400" />
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Email</p>
            <p className="text-sm text-gray-800">{displayEmail}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-5 py-4">
          <Shield size={18} className="text-gray-400" />
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Access Role</p>
            <p className="text-sm text-gray-800">{displayRole}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-5 py-4">
          <User size={18} className="text-gray-400" />
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Portal Status</p>
            <p className="text-sm font-medium text-green-600">Active</p>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <button
          onClick={() => { setShowPwForm(o => !o); setPwMsg(null) }}
          className="w-full flex items-center gap-3 px-5 py-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <KeyRound size={18} className="text-gray-400" />
          Change Password
        </button>

        {showPwForm && (
          <form onSubmit={handleChangePassword} className="px-5 pb-5 space-y-3 border-t border-gray-50">
            {pwMsg && (
              <div className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2.5 mt-3 ${
                pwMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                {pwMsg.type === 'success' ? <CheckCircle size={16} className="mt-0.5 flex-shrink-0" /> : <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />}
                {pwMsg.text}
              </div>
            )}
            <div className="mt-3">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">New Password</label>
              <input
                type="password" required value={newPw} onChange={e => setNewPw(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Confirm Password</label>
              <input
                type="password" required value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                placeholder="Repeat new password"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <button
              type="submit" disabled={pwLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
            >
              {pwLoading ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        )}
      </div>

      {/* Sign Out */}
      <button
        onClick={handleSignOut}
        className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-600 hover:bg-red-50 py-3 rounded-xl text-sm font-semibold transition-colors"
      >
        <LogOut size={18} />
        Sign Out
      </button>
    </div>
  )
}
