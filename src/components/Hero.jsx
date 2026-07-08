import { useEffect, useRef } from 'react'
import gsap from 'gsap'

export default function Hero() {
  const heroRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: 'expo.out', duration: 1.2 }
      })

      // Badge
      tl.to('.hero-badge', {
        opacity: 1,
        y: 0,
        duration: 0.8,
        delay: 0.3
      })

      // Headline lines stagger
      tl.to('.hero-headline .line-inner', {
        opacity: 1,
        y: 0,
        stagger: 0.1,
        duration: 1
      }, '-=0.5')

      // Sub + actions
      tl.to('.hero-subheadline', {
        opacity: 1,
        y: 0,
        duration: 0.9
      }, '-=0.6')

      tl.to('.hero-actions', {
        opacity: 1,
        y: 0,
        duration: 0.9
      }, '-=0.7')

      // Scroll cue
      tl.to('.scroll-cue', {
        opacity: 0.6,
        duration: 0.6
      }, '-=0.3')

    }, heroRef)

    return () => ctx.revert()
  }, [])

  return (
    <section className="hero" ref={heroRef} data-section="hero">
      <div className="hero-inner">
        {/* ── Left: Copy ──────────────────────── */}
        <div className="hero-copy">
          <div className="hero-badge">
            <span className="badge-dot" />
            Now in Beta — Join Early
          </div>

          <h1 className="hero-headline">
            <span className="line">
              <span className="line-inner">The Outbound OS</span>
            </span>
            <span className="line">
              <span className="line-inner">for India & APAC.</span>
            </span>
          </h1>

          <p className="hero-subheadline">
            One system to load your ICP, run multi-channel cadences,
            and measure what converts — with AI that actually knows your pipeline.
          </p>

          <div className="hero-actions">
            <button className="btn-primary" id="hero-cta-start">
              Start Free Trial
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </button>

            <button className="btn-ghost" id="hero-cta-demo">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
              </svg>
              Watch Demo
            </button>
          </div>
        </div>

        {/* Right side is now the global CrystalScene showing through */}
        <div className="hero-canvas-space" />
      </div>

      {/* ── Scroll Cue ────────────────────────── */}
      <div className="scroll-cue">
        <span>Scroll</span>
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M10 4v12M6 12l4 4 4-4" />
        </svg>
      </div>
    </section>
  )
}
