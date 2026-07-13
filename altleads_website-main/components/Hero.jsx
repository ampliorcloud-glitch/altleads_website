import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Play, ArrowRight } from 'lucide-react'
import AnimatedButton from './AnimatedButton'

export default function Hero() {
  const heroRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: 'expo.out', duration: 1.4 }
      })

      tl.to('.line-inner', {
        opacity: 1,
        y: 0,
        stagger: 0.15,
      })

      tl.to('.hero-sub', { opacity: 1, y: 0, duration: 1 }, '-=0.8')
      tl.to('.hero-actions', { opacity: 1, y: 0, duration: 1 }, '-=0.8')

      gsap.to(containerRef.current, {
        scrollTrigger: {
          trigger: heroRef.current,
          start: "top top",
          end: "bottom top",
          scrub: 1,
        },
        scale: 0.9,
        opacity: 0,
        y: 100,
        ease: "none"
      })

    }, heroRef)

    return () => ctx.revert()
  }, [])

  return (
    <section className="relative min-h-[100dvh] w-full flex items-center justify-center pt-24 px-4 overflow-hidden bg-transparent" ref={heroRef}>
      <div ref={containerRef} className="w-full max-w-6xl mx-auto flex flex-col items-center relative z-10">

        <h1 className="text-center font-black tracking-tight text-slate-900 dark:text-white mb-8 leading-[1.05]" style={{ fontSize: 'clamp(3rem, 6.5vw, 6.5rem)' }}>
          <span className="block overflow-hidden pb-2">
            <span className="line-inner inline-block opacity-0 translate-y-[60px]">The Outbound CRM for</span>
          </span>
          <span className="block overflow-hidden">
            <span className="line-inner inline-block opacity-0 translate-y-[60px] text-blue-600 italic">teams that execute.</span>
          </span>
        </h1>

        <p className="hero-sub text-center text-slate-600 dark:text-slate-300 text-lg md:text-xl font-medium max-w-2xl mx-auto leading-relaxed mb-12 opacity-0 translate-y-[20px]">
          Execution is fragmented across tools, tabs, and memory. AltLeads unifies multi-channel outreach and clean data into one powerful pipeline.
        </p>

        <div className="hero-actions flex flex-col sm:flex-row items-center justify-center gap-6 opacity-0 translate-y-[20px]">
          <AnimatedButton href="/#book-demo" variant="custom" className="flex items-center gap-4 bg-blue-600 text-white px-8 py-5 rounded-full font-bold text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 group">
            Book a Demo
            <div className="size-8 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-1 transition-transform">
              <ArrowRight size={16} />
            </div>
          </AnimatedButton>

          <AnimatedButton href="/solutions/crm" variant="custom" className="flex items-center gap-3 px-8 py-5 font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors">
            <Play size={20} fill="currentColor" />
            Explore the Product
          </AnimatedButton>
        </div>

      </div>
    </section>
  )
}
