export default function Footer() {
  return (
    <footer className="site-footer" data-section="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <a href="/" className="navbar-logo" aria-label="AltLeads Home">
            <span className="logo-alt">Alt</span>
            <span className="logo-leads">Leads</span>
          </a>
          <p className="footer-tagline">The outbound operating system for India and APAC.</p>
        </div>

        <div className="footer-links">
          <div className="footer-col">
            <h4>Product</h4>
            <a href="#crm">CRM</a>
            <a href="#cadences">Cadences</a>
            <a href="#intelligence">Data & Intelligence</a>
            <a href="#whatsapp">WhatsApp</a>
          </div>
          <div className="footer-col">
            <h4>Company</h4>
            <a href="#about">About</a>
            <a href="#careers">Careers</a>
            <a href="#blog">Blog</a>
            <a href="#contact">Contact</a>
          </div>
          <div className="footer-col">
            <h4>Legal</h4>
            <a href="#privacy">Privacy Policy</a>
            <a href="#terms">Terms of Service</a>
            <a href="#security">Security</a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p>&copy; 2025 AltLeads. All rights reserved.</p>
      </div>
    </footer>
  )
}
