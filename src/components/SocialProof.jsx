export default function SocialProof() {
  const logos = ['Stripe', 'Linear', 'Vercel', 'Notion', 'Figma']

  return (
    <section className="section section-social" data-section="social">
      <div className="section-inner">
        <p className="social-tagline">Built for the way India and APAC sell</p>
        <div className="social-logos">
          {logos.map((name) => (
            <span key={name} className="logo-item">{name}</span>
          ))}
        </div>
      </div>
    </section>
  )
}
