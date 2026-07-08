import { useState } from 'react'
import useBlobState from '../stores/useBlobState'

const modules = [
  {
    id: 'crm',
    title: 'CRM',
    desc: 'Contact and deal management built for outbound teams. Every interaction logged, every relationship tracked.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    id: 'cadences',
    title: 'Cadences',
    desc: 'Multi-channel sequences that run on autopilot. Email, WhatsApp, LinkedIn — orchestrated, not manual.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    id: 'intelligence',
    title: 'Data & Intelligence',
    desc: 'Enrichment, intent signals, and AI-driven suggestions. Know who to call and what to say before you pick up the phone.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
        <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
      </svg>
    ),
  },
  {
    id: 'visibility',
    title: 'Manager Visibility',
    desc: 'See every rep\'s pipeline at a glance. Coaching insights, activity metrics, and deal progression — no spreadsheets needed.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    id: 'whatsapp',
    title: 'WhatsApp',
    desc: 'Native WhatsApp integration with template management, bulk sends, and conversation tracking — built for APAC selling.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
      </svg>
    ),
  },
]

export default function ModuleEcosystem() {
  const [hovered, setHovered] = useState(null)

  return (
    <section className="section section-modules" data-section="modules">
      <div className="section-inner">
        <h2 className="section-headline">Five modules, one system</h2>
        <p className="section-sub">
          Each module works independently. Together, they replace your entire outbound stack.
        </p>

        <div className="module-grid">
          {modules.map((mod) => (
            <div
              key={mod.id}
              className={`module-card ${hovered === mod.id ? 'is-hovered' : ''}`}
              onMouseEnter={() => setHovered(mod.id)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="module-icon">{mod.icon}</div>
              <h3>{mod.title}</h3>
              <p>{mod.desc}</p>
              <span className="module-link">
                Open solution
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
