export default function ZeroFriction() {
  const nodes = [
    { label: 'Import', desc: 'Upload your contact list or connect your existing CRM. We handle deduplication and enrichment.' },
    { label: 'Connect', desc: 'Link your email, WhatsApp, and LinkedIn accounts. One-click OAuth, no IT support needed.' },
    { label: 'Go Live', desc: 'Your first cadence launches in minutes, not weeks. Templates, sequences, and tracking — ready from day one.' },
  ]

  return (
    <section className="section section-friction" data-section="friction">
      <div className="section-inner">
        <h2 className="section-headline">Zero friction onboarding</h2>
        <p className="section-sub">
          Three steps. No implementation consultants. No six-week rollouts.
        </p>

        <div className="friction-timeline">
          {/* SVG connecting line */}
          <svg className="friction-line-svg" viewBox="0 0 800 4" preserveAspectRatio="none">
            <line
              className="friction-line"
              x1="0" y1="2" x2="800" y2="2"
              stroke="var(--color-blue)"
              strokeWidth="2"
              strokeDasharray="800"
              strokeDashoffset="800"
              strokeLinecap="round"
            />
          </svg>

          <div className="friction-nodes">
            {nodes.map((node, i) => (
              <div key={node.label} className="friction-node" data-step={i}>
                <div className="friction-dot">
                  <span>{i + 1}</span>
                </div>
                <h3>{node.label}</h3>
                <p>{node.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
