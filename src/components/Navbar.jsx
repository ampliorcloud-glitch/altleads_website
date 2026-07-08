export default function Navbar() {
  return (
    <nav className="navbar" role="navigation" aria-label="Main navigation">
      <a href="/" className="navbar-logo" aria-label="AltLeads Home">
        <span className="logo-alt">Alt</span>
        <span className="logo-leads">Leads</span>
      </a>

      <div className="navbar-nav">
        <a href="#product">Product</a>
        <a href="#features">Features</a>
        <a href="#pricing">Pricing</a>
        <button className="navbar-cta">Login</button>
      </div>

      <button className="nav-toggle" aria-label="Toggle menu">
        <span />
        <span />
        <span />
      </button>
    </nav>
  )
}
