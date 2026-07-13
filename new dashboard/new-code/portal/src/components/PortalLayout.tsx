import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Home, LayoutDashboard, Calendar, ListPlus, CalendarCheck,
  FolderOpen, Megaphone, Receipt, Bell, User, LogOut, Menu, X,
} from 'lucide-react'
import { usePortalAuth } from '../hooks/usePortalAuth'
import { DEMO, demoClient } from '../demo/demoData'
import { ProjectScopeProvider } from '../contexts/ProjectScope'
import ProjectFilter from './ProjectFilter'

interface NavItem { label: string; to: string; icon: React.ReactNode }
interface NavSection { heading?: string; items: NavItem[] }

const sections: NavSection[] = [
  { items: [
    { label: 'Overview', to: '/', icon: <Home size={17} /> },
    { label: 'Dashboard', to: '/dashboard', icon: <LayoutDashboard size={17} /> },
  ] },
  { heading: 'Engagement', items: [
    { label: 'Meetings', to: '/meetings', icon: <Calendar size={17} /> },
    { label: 'Wishlist', to: '/wishlist', icon: <ListPlus size={17} /> },
  ] },
  { heading: 'Governance', items: [
    { label: 'Review Meetings', to: '/governance', icon: <CalendarCheck size={17} /> },
    { label: 'Documents', to: '/documents', icon: <FolderOpen size={17} /> },
    { label: 'Updates', to: '/updates', icon: <Megaphone size={17} /> },
    { label: 'Invoices', to: '/invoices', icon: <Receipt size={17} /> },
  ] },
  { heading: 'Account', items: [
    { label: 'Notifications', to: '/notifications', icon: <Bell size={17} /> },
    { label: 'Profile', to: '/profile', icon: <User size={17} /> },
  ] },
]

export default function PortalLayout() {
  const { account, signOut } = usePortalAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  const displayName = DEMO ? demoClient.adminName : account?.fullName ?? 'Portal User'
  const displaySub = DEMO ? demoClient.companyName : account?.roleLabel ?? ''
  const initials = displayName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-surface">
      {/* Brand */}
      <div className="px-5 h-16 flex items-center border-b border-line flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-extrabold text-sm">A</div>
          <div>
            <p className="font-extrabold text-ink leading-none tracking-tight">Amplior</p>
            <p className="text-[10px] text-ink-faint uppercase tracking-widest mt-0.5">Client Portal</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-thin">
        {sections.map((sec, si) => (
          <div key={si} className={si > 0 ? 'mt-5' : ''}>
            {sec.heading && (
              <p className="px-3 mb-1.5 text-[10px] font-semibold text-ink-faint uppercase tracking-widest">{sec.heading}</p>
            )}
            <ul className="space-y-0.5">
              {sec.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      [
                        'flex items-center gap-3 pl-3 pr-3 py-2 rounded-lg text-sm font-medium transition-colors relative',
                        isActive
                          ? 'bg-primary-light text-primary'
                          : 'text-ink-mute hover:text-ink hover:bg-mist',
                      ].join(' ')
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full bg-primary" />}
                        {item.icon}
                        {item.label}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-line flex-shrink-0">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink truncate">{displayName}</p>
            <p className="text-xs text-ink-faint truncate">{displaySub}</p>
          </div>
          <button onClick={handleSignOut} title="Sign out" className="text-ink-faint hover:text-red-500 transition-colors flex-shrink-0">
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <ProjectScopeProvider>
    <div className="flex h-screen overflow-hidden bg-canvas">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 flex-shrink-0 border-r border-line">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="fixed inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-50 flex flex-col w-72 h-full shadow-pop">
            <button onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 text-ink-faint hover:text-ink z-10">
              <X size={20} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Desktop top bar — global project scope (mirrors CRM global select) */}
        <header className="hidden md:flex items-center justify-between px-8 h-14 bg-surface border-b border-line flex-shrink-0">
          <span className="text-xs font-semibold text-ink-faint uppercase tracking-widest">Scope</span>
          <ProjectFilter />
        </header>

        {/* Mobile topbar */}
        <header className="md:hidden flex items-center justify-between px-4 h-14 bg-surface border-b border-line flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="text-ink-soft"><Menu size={22} /></button>
          <ProjectFilter />
          <NavLink to="/notifications" className="text-ink-soft"><Bell size={20} /></NavLink>
        </header>

        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <Outlet />
        </main>
      </div>
    </div>
    </ProjectScopeProvider>
  )
}
