export default function Differentiator() {
  const bullets = [
    {
      title: 'Practical next-step suggestions',
      desc: 'AI recommends the exact action — not a generic "follow up." Based on deal stage, last interaction, and buyer signals.',
    },
    {
      title: 'Context-aware message drafts',
      desc: 'Every email and WhatsApp draft knows the prospect\'s industry, role, and where they are in your cadence.',
    },
    {
      title: 'Pipeline risk scoring',
      desc: 'Deals going cold get flagged before they stall. Reps see warnings, managers see patterns.',
    },
    {
      title: 'Reply sentiment analysis',
      desc: 'Positive, negative, or objection — AltLeads reads the signal and adjusts the cadence step automatically.',
    },
  ]

  return (
    <section className="section section-differentiator" data-section="differentiator">
      <div className="section-inner diff-inner">
        <div className="diff-copy">
          <h2 className="section-headline">
            Usable intelligence,<br />
            not another dashboard.
          </h2>
          <p className="section-sub">
            AI that tells your reps what to do next — not just what happened yesterday.
          </p>

          <div className="diff-bullets">
            {bullets.map((b) => (
              <div key={b.title} className="diff-bullet">
                <div className="diff-bullet-dot" />
                <div>
                  <h4>{b.title}</h4>
                  <p>{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
