'use client';
import { useEffect, useRef, Suspense, Component } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import SocialProof from '@/components/SocialProof';
import RealitySection from '@/components/RealitySection';
import OSInAction from '@/components/OSInAction';
import ModuleEcosystem from '@/components/ModuleEcosystem';
import Differentiator from '@/components/Differentiator';
import TargetProfiles from '@/components/TargetProfiles';
import ZeroFriction from '@/components/ZeroFriction';
import FAQ from '@/components/FAQ';
import BookDemo from '@/components/BookDemo';
import Footer from '@/components/Footer';
import DotNavigation from '@/components/DotNavigation';
import useScrollSections from '@/hooks/useScrollSections';
import dynamic from 'next/dynamic';

const CrystalScene = dynamic(() => import('@/components/CrystalScene'), {
  ssr: false,
});

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    if (typeof window !== 'undefined') {
      window.__R3F_ERROR = error.message + '\n' + error.stack;
    }
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

export default function Home() {
  useScrollSections();

  return (
    <>
      <ErrorBoundary>
        <Suspense fallback={<CrystalFallback />}>
          <CrystalScene />
        </Suspense>
      </ErrorBoundary>

      <div className="page-content w-full relative z-10">
        <Navbar />
        <DotNavigation />

        <div className="min-h-screen"><Hero /></div>
        <div className="min-h-screen"><SocialProof /></div>
        <div className="min-h-screen"><RealitySection /></div>
        <div className="min-h-screen"><OSInAction /></div>
        <div className="h-[20vh] md:h-[40vh]"></div> {/* Spacer between OS and Ecosystem */}
        <div className="min-h-screen"><ModuleEcosystem /></div>
        <div className="min-h-screen"><Differentiator /></div>
        <div className="min-h-screen"><TargetProfiles /></div>
        <div className="min-h-screen"><ZeroFriction /></div>
        <div className="min-h-screen"><FAQ /></div>
        <div className="min-h-screen"><BookDemo /></div>
        <div><Footer /></div>
      </div>
    </>
  );
}
