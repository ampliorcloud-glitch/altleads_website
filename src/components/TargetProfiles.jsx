export default function TargetProfiles() {
  const profiles = [
    {
      title: 'SDR teams',
      label: 'Speed without chaos',
      desc: 'Your reps move fast — AltLeads keeps them organized. Auto-prioritized task lists, one-click cadence enrollment, and real-time coaching nudges.',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      ),
    },
    {
      title: 'Founder-led sales',
      label: 'Focus on closing, not admin',
      desc: 'You can\'t afford to lose a deal to a missed follow-up. AltLeads runs your pipeline while you run the business.',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      ),
    },
    {
      title: 'Sales managers',
      label: 'Visibility & coaching',
      desc: 'See every rep\'s activity, pipeline health, and bottlenecks. Coach with data, not gut feel. Forecast with confidence.',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      ),
    },
  ]

  return (
    <section className="section section-target" data-section="target">
      <div className="section-inner">
        <h2 className="section-headline">Built for how you sell</h2>
        <p className="section-sub">
          Whether you're a team of 3 or 300, AltLeads adapts to your workflow.
        </p>

        <div className="profile-cards">
          {profiles.map((p) => (
            <div key={p.title} className="profile-card">
              <div className="profile-icon">{p.icon}</div>
              <h3>{p.title}</h3>
              <span className="profile-label">{p.label}</span>
              <p>{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
