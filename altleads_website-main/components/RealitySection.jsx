import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export default function RealitySection() {
  const sectionRef = useRef(null)
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

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Inline image reveal
      gsap.fromTo('.inline-img-reveal', 
        { width: 0, opacity: 0 },
        { 
          scrollTrigger: {
            trigger: '.reality-header',
            start: "top 80%",
            end: "top 50%",
            scrub: 1
          },
          width: 96,
          opacity: 1,
          ease: "power2.out"
        }
      )

      // Card Stacking Physics
      const cards = gsap.utils.toArray('.reality-card')
      cards.forEach((card, i) => {
        ScrollTrigger.create({
          trigger: card,
          start: "top 20%",
          endTrigger: ".reality-cards",
          end: "bottom 20%",
          pin: true,
          pinSpacing: false,
          scrub: true,
          animation: gsap.to(card, {
            scale: 1 - ((cards.length - i) * 0.05),
            opacity: 0.4,
            ease: "none"
          })
        })
      })
    }, sectionRef)
    return () => ctx.revert()
  }, [])

  return (
    <section className="section py-32 md:py-48 bg-transparent" ref={sectionRef}>
      <div className="section-inner">
        <div className="reality-header text-center mb-32 max-w-5xl mx-auto">
          <h2 className="text-[3rem] md:text-[5rem] font-black tracking-tight leading-[1.05] text-slate-900 dark:text-white mb-8">
            Most CRMs store data.<br />
            They don't <span className="inline-img-reveal inline-block w-24 h-[1em] rounded-full align-middle bg-cover bg-center mx-2 border border-black/10 dark:border-white/10 filter grayscale contrast-125" style={{backgroundImage: 'url(https://picsum.photos/seed/motion/400/200)'}}></span> run outbound.
          </h2>
          <p className="text-xl text-slate-600 dark:text-slate-400 font-medium max-w-2xl mx-auto leading-relaxed">
            Execution is fragmented across tools, tabs, and memory. The result? Leads fall through the cracks.
          </p>
        </div>

        <div className="reality-cards flex flex-col gap-24 relative">
          {cards.map((card) => (
            <div key={card.title} className="reality-card w-full max-w-4xl mx-auto bg-white/80 dark:bg-white/5 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-[32px] p-12 md:p-16 shadow-[0_20px_80px_rgba(0,0,0,0.05)] dark:shadow-[0_20px_80px_rgba(0,0,0,0.4)] origin-top">
              <div className="size-16 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 mb-10">
                {card.icon}
              </div>
              <h3 className="text-3xl font-bold text-slate-900 dark:text-white mb-4 tracking-tight">{card.title}</h3>
              <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">{card.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
