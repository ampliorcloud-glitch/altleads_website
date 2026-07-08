import { useEffect, useRef, Suspense, lazy, useState, Component } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import SocialProof from './components/SocialProof'
import RealitySection from './components/RealitySection'
import OSInAction from './components/OSInAction'
import ModuleEcosystem from './components/ModuleEcosystem'
import Differentiator from './components/Differentiator'
import TargetProfiles from './components/TargetProfiles'
import ZeroFriction from './components/ZeroFriction'
import FAQ from './components/FAQ'
import BookDemo from './components/BookDemo'
import Footer from './components/Footer'
import useScrollSections from './hooks/useScrollSections'

gsap.registerPlugin(ScrollTrigger)

const CrystalScene = lazy(() => import('./components/CrystalScene'))

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    window.__R3F_ERROR = error.message + '\n' + error.stack;
  }
  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

function CrystalFallback() {
  return (
    <div className="crystal-scene-global fallback-spinner-container" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        width: 48,
        height: 48,
        border: '2px solid rgba(33,150,243,0.15)',
        borderTopColor: 'var(--color-emerald)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

export default function App() {
  const lenisRef = useRef(null)

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })
    lenisRef.current = lenis

    // Connect Lenis to GSAP ScrollTrigger
    lenis.on('scroll', ScrollTrigger.update)
    gsap.ticker.add((time) => {
      lenis.raf(time * 1000)
    })
    gsap.ticker.lagSmoothing(0)

    return () => {
      lenis.destroy()
      gsap.ticker.remove(lenis.raf)
    }
  }, [])

  // Register all scroll triggers
  useScrollSections()

  return (
    <>
      {/* Global 3D layer — fixed behind all DOM */}
      <ErrorBoundary>
        <Suspense fallback={<CrystalFallback />}>
          <CrystalScene />
        </Suspense>
      </ErrorBoundary>

      {/* DOM sections scroll over the 3D layer */}
      <div className="page-content">
        <Navbar />
        <Hero />
        <SocialProof />
        <RealitySection />
        <OSInAction />
        <ModuleEcosystem />
        <Differentiator />
        <TargetProfiles />
        <ZeroFriction />
        <FAQ />
        <BookDemo />
        <Footer />
      </div>
    </>
  )
}
