export default function RealitySection() {
  const cards = [
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 8v4l3 3" />
          <circle cx="12" cy="12" r="10" />
        </svg>
      ),
      title: 'Forgotten follow-ups',
      desc: 'Leads slip through the cracks because no system is watching the clock. Reps rely on memory, not process.',
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18" />
          <path d="M7 16l4-8 4 4 4-6" />
        </svg>
      ),
      title: 'Unreliable reporting',
      desc: 'Dashboards show vanity metrics. Nobody trusts the pipeline numbers because the data entry is inconsistent.',
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a4 4 0 014 4c0 1.5-1 3-4 5-3-2-4-3.5-4-5a4 4 0 014-4z" />
          <path d="M8.5 14L4 20h16l-4.5-6" />
          <path d="M12 11v5" />
        </svg>
      ),
      title: 'Generic AI',
      desc: 'AI writes emails that sound like AI. No context about the prospect, no awareness of where they are in the funnel.',
    },
  ]

  return (
    <section className="section section-reality" data-section="reality">
      <div className="section-inner">
        <div className="reality-header">
          <h2 className="section-headline">
            Most CRMs store data.<br />
            They don't run outbound.
          </h2>
          <p className="section-sub">
            Execution is fragmented across tools, tabs, and memory. The result? Leads fall through the cracks.
          </p>
        </div>

        <div className="reality-cards">
          {cards.map((card) => (
            <div key={card.title} className="reality-card">
              <div className="reality-card-icon">{card.icon}</div>
              <h3>{card.title}</h3>
              <p>{card.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
