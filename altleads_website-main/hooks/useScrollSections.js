import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import useBlobState from '../stores/useBlobState'

/**
 * Central ScrollTrigger registration.
 * Uses `immediateRender: false` on all `from()` calls so GSAP doesn't
 * permanently set opacity:0 on elements before ScrollTrigger fires.
 */
export default function useScrollSections() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
    const store = useBlobState

    // Delay to let DOM + Lenis settle
    const timer = setTimeout(() => {
      const ctx = gsap.context(() => {

        // ── Social Proof ──
        ScrollTrigger.create({
          trigger: '[data-section="social"]',
          start: 'top 95%',
          onEnter: () => store.getState().setSection('social'),
          onLeaveBack: () => store.getState().setSection('hero'),
        })

        gsap.fromTo('[data-section="social"] .logo-item',
          { opacity: 0, x: -20 },
          {
            opacity: 1,
            x: 0,
            stagger: 0.08,
            duration: 0.6,
            ease: 'expo.out',
            scrollTrigger: {
              trigger: '[data-section="social"]',
              start: 'top 85%',
              toggleActions: 'play none none reverse',
            },
          }
        )

        // ── Reality (fragmentation) ──
        ScrollTrigger.create({
          trigger: '[data-section="reality"]',
          start: 'top 60%',
          end: 'bottom 40%',
          onEnter: () => store.getState().setSection('reality'),
          onLeaveBack: () => store.getState().setSection('social'),
        })

        gsap.fromTo('[data-section="reality"] .reality-card',
          { opacity: 0, y: 60, rotation: 5 },
          {
            opacity: 1,
            y: 0,
            rotation: 0,
            stagger: 0.15,
            duration: 0.8,
            ease: 'expo.out',
            scrollTrigger: {
              trigger: '[data-section="reality"]',
              start: 'top 70%',
              toggleActions: 'play none none reverse',
            },
          }
        )

        // ── OS In Action (pin + reassembly) ──
        const osSection = document.querySelector('[data-section="os"]')
        if (osSection) {
          ScrollTrigger.create({
            trigger: osSection,
            start: 'top 60%',
            onEnter: () => store.getState().setSection('os'),
            onLeaveBack: () => store.getState().setSection('reality'),
          })

          // Scrub OS progress (0→1) across the section
          ScrollTrigger.create({
            trigger: osSection,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 0.5,
            onUpdate: (self) => {
              store.getState().setOsProgress(self.progress)
            },
          })

          gsap.fromTo('[data-section="os"] .os-step',
            { opacity: 0, x: 40 },
            {
              opacity: 1,
              x: 0,
              stagger: 0.2,
              duration: 0.8,
              ease: 'expo.out',
              scrollTrigger: {
                trigger: osSection,
                start: 'top 65%',
                toggleActions: 'play none none reverse',
              },
            }
          )
        }

        // ── Modules ──
        ScrollTrigger.create({
          trigger: '[data-section="modules"]',
          start: 'top 60%',
          onEnter: () => store.getState().setSection('modules'),
          onLeaveBack: () => store.getState().setSection('os'),
        })

        gsap.fromTo('[data-section="modules"] .module-card',
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            stagger: 0.1,
            duration: 0.7,
            ease: 'expo.out',
            scrollTrigger: {
              trigger: '[data-section="modules"]',
              start: 'top 70%',
              toggleActions: 'play none none reverse',
            },
          }
        )

        // ── Differentiator (camera push) ──
        ScrollTrigger.create({
          trigger: '[data-section="differentiator"]',
          start: 'top 50%',
          end: 'bottom 50%',
          onEnter: () => store.getState().setSection('differentiator'),
          onLeaveBack: () => store.getState().setSection('modules'),
        })

        gsap.fromTo('[data-section="differentiator"] .diff-bullet',
          { opacity: 0, x: -30 },
          {
            opacity: 1,
            x: 0,
            stagger: 0.12,
            duration: 0.7,
            ease: 'expo.out',
            scrollTrigger: {
              trigger: '[data-section="differentiator"]',
              start: 'top 85%',
              toggleActions: 'play none none reverse',
            },
          }
        )

        // ── Target Profiles ──
        ScrollTrigger.create({
          trigger: '[data-section="target"]',
          start: 'top 60%',
          onEnter: () => store.getState().setSection('target'),
          onLeaveBack: () => store.getState().setSection('differentiator'),
        })

        const profileColors = ['#1565C0', '#2196F3', '#42A5F5']
        const profileCards = document.querySelectorAll('[data-section="target"] .profile-card')
        profileCards.forEach((card, i) => {
          ScrollTrigger.create({
            trigger: card,
            start: 'top 60%',
            end: 'bottom 40%',
            onEnter: () => store.getState().setTargetSubColor(profileColors[i]),
            onLeaveBack: () => {
              if (i > 0) store.getState().setTargetSubColor(profileColors[i - 1])
            },
          })
        })

        gsap.fromTo('[data-section="target"] .profile-card',
          { opacity: 0, y: 40, scale: 0.95 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            stagger: 0.12,
            duration: 0.7,
            ease: 'back.out(1.7)',
            scrollTrigger: {
              trigger: '[data-section="target"]',
              start: 'top 70%',
              toggleActions: 'play none none reverse',
            },
          }
        )

        // ── Zero Friction ──
        ScrollTrigger.create({
          trigger: '[data-section="friction"]',
          start: 'top 60%',
          onEnter: () => store.getState().setSection('friction'),
          onLeaveBack: () => store.getState().setSection('target'),
        })

        gsap.fromTo('[data-section="friction"] .friction-node',
          { opacity: 0, scale: 0 },
          {
            opacity: 1,
            scale: 1,
            stagger: 0.2,
            duration: 0.5,
            ease: 'back.out(2)',
            scrollTrigger: {
              trigger: '[data-section="friction"]',
              start: 'top 60%',
              toggleActions: 'play none none reverse',
            },
          }
        )

        // ── FAQ ──
        ScrollTrigger.create({
          trigger: '[data-section="faq"]',
          start: 'top 60%',
          onEnter: () => store.getState().setSection('faq'),
          onLeaveBack: () => store.getState().setSection('friction'),
        })

        // ── Book Demo ──
        ScrollTrigger.create({
          trigger: '[data-section="demo"]',
          start: 'top 60%',
          onEnter: () => store.getState().setSection('demo'),
          onLeaveBack: () => store.getState().setSection('faq'),
        })

        gsap.fromTo('[data-section="demo"] .demo-form',
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: 'expo.out',
            scrollTrigger: {
              trigger: '[data-section="demo"]',
              start: 'top 70%',
              toggleActions: 'play none none reverse',
            },
          }
        )

        // ── Footer ──
        ScrollTrigger.create({
          trigger: '[data-section="footer"]',
          start: 'top 80%',
          onEnter: () => store.getState().setSection('footer'),
          onLeaveBack: () => store.getState().setSection('demo'),
        })
      })

      return () => ctx.revert()
    }, 200)

    return () => {
      clearTimeout(timer)
      ScrollTrigger.getAll().forEach(t => t.kill())
    }
  }, [])
}
