export default function BookDemo() {
  return (
    <section className="section section-demo" data-section="demo">
      <div className="section-inner demo-inner">
        <div className="demo-copy">
          <h2 className="section-headline">
            See AltLeads in action
          </h2>
          <p className="section-sub">
            Book a 20-minute walkthrough. We'll show you how AltLeads fits your team's workflow — no slides, just the product.
          </p>
        </div>

        <form className="demo-form" onSubmit={(e) => e.preventDefault()}>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="demo-name">Full name</label>
              <input type="text" id="demo-name" placeholder="Jane Doe" />
            </div>
            <div className="form-field">
              <label htmlFor="demo-email">Work email</label>
              <input type="email" id="demo-email" placeholder="jane@company.com" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="demo-company">Company</label>
              <input type="text" id="demo-company" placeholder="Acme Inc" />
            </div>
            <div className="form-field">
              <label htmlFor="demo-size">Team size</label>
              <select id="demo-size" defaultValue="">
                <option value="" disabled>Select</option>
                <option value="1-5">1–5</option>
                <option value="6-20">6–20</option>
                <option value="21-50">21–50</option>
                <option value="50+">50+</option>
              </select>
            </div>
          </div>

          <button type="submit" className="btn-primary demo-submit" id="demo-cta-submit">
            Book a Demo
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </button>
        </form>
      </div>
    </section>
  )
}
