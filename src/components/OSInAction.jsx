export default function OSInAction() {
  const steps = [
    {
      num: '01',
      title: 'Load your ICP',
      desc: 'Import your ideal customer profile. AltLeads enriches every contact with firmographic data, tech stack signals, and intent indicators.',
    },
    {
      num: '02',
      title: 'Run cadences',
      desc: 'Set up multi-channel sequences — email, WhatsApp, LinkedIn — with AI-written, context-aware messages that adapt to each prospect.',
    },
    {
      num: '03',
      title: 'Measure & iterate',
      desc: "Real-time dashboards show what's working. Reply rates, open rates, meeting conversions — all tied back to the cadence that drove them.",
    },
  ]

  return (
    <section className="section section-os" data-section="os">
      <div className="os-inner">
        {/* Left: sticky blob area (CrystalScene is global, this is just spacing) */}
        <div className="os-sticky-blob">
          <div className="os-blob-label">
            <span className="os-label-tag">The OS In Action</span>
          </div>
        </div>

        {/* Right: scrolling step cards */}
        <div className="os-steps">
          {steps.map((step, i) => (
            <div key={step.num} className="os-step" data-step={i}>
              <div className="os-step-num">{step.num}</div>
              <h3 className="os-step-title">{step.title}</h3>
              <p className="os-step-desc">{step.desc}</p>
              <div className="os-step-glow" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
