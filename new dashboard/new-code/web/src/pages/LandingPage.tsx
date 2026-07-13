import React, { useRef, useState } from 'react';
import { motion, useScroll, useTransform, useSpring, useInView } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  ArrowRight, BarChart3, Users, Zap, CheckCircle2, 
  Layers, MessageSquare, Phone, Mail, Shield, 
  Target, Rocket, Briefcase, Workflow, Database, LineChart, MoveRight, ChevronDown, Play
} from 'lucide-react';
import { Logo } from '../components/ui/Logo';
import { ThemeEditor } from '../components/ui/ThemeEditor';

// Variants
const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } }
};
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as const } }
};

// --- Components ---

function TiltCard({ children, className, style }: any) {
  const ref = useRef<HTMLDivElement>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    setRotateX(yPct * 15);
    setRotateY(xPct * -15);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        ...style,
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      className={`transition-all duration-200 ease-out ${className}`}
    >
      {children}
    </motion.div>
  );
}

function RevealSection({ children, className }: any) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px 0px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] as const }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// --- Main Page ---

export function LandingPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, 300]);
  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);

  return (
    <div className="min-h-screen relative overflow-hidden font-sans" style={{ background: 'var(--theme-bg, #121212)', color: '#F8F5F0' }}>
      
      {/* Theme Editor & Noise Overlay */}
      <ThemeEditor />
      <div 
        className="fixed inset-0 pointer-events-none z-[90]" 
        style={{ 
          opacity: 'var(--theme-noise, 0.4)',
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.5' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          mixBlendMode: 'overlay'
        }} 
      />

      {/* Background ambient glow */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[150px] pointer-events-none transition-opacity duration-300" style={{ background: 'var(--theme-accent, #E07A5F)', opacity: 'var(--theme-glow, 0.2)' }} />
      <div className="fixed bottom-[-20%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[150px] pointer-events-none transition-opacity duration-300" style={{ background: 'var(--theme-secondary, #4A90E2)', opacity: 'calc(var(--theme-glow, 0.2) / 2)' }} />

      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 px-8 py-4 backdrop-blur-md" style={{ background: 'rgba(18, 18, 18, 0.7)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-2 scale-110 origin-left">
            <Logo />
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium" style={{ color: '#A0A0A0' }}>
            <a href="#reality" className="hover:text-[var(--theme-accent, #E07A5F)] transition-colors">The Reality</a>
            <a href="#how-it-works" className="hover:text-[var(--theme-accent, #E07A5F)] transition-colors">How It Works</a>
            <a href="#modules" className="hover:text-[var(--theme-accent, #E07A5F)] transition-colors">Modules</a>
            <a href="#faq" className="hover:text-[var(--theme-accent, #E07A5F)] transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-6">
            <button 
              onClick={() => navigate('/login')}
              className="text-sm font-medium transition-colors hover:text-[var(--theme-accent, #E07A5F)]"
              style={{ color: '#F8F5F0', letterSpacing: '0.02em' }}
            >
              Log In
            </button>
            <button
              onClick={() => navigate(session ? '/dashboard' : '/login')}
              className="px-6 py-2.5 rounded-full text-sm font-semibold transition-all hover:scale-105"
              style={{ 
                background: 'var(--theme-accent, #E07A5F)', 
                color: 'var(--theme-bg, #121212)',
                boxShadow: '0 4px 14px rgba(224, 122, 95, 0.25)' 
              }}
            >
              {session ? 'Go to Dashboard' : 'Get Started'}
            </button>
          </div>
        </div>
      </nav>

      <main className="relative z-10 flex flex-col items-center">
        
        {/* --- Hero Section --- */}
        <section className="relative pt-40 pb-20 px-8 w-full max-w-7xl flex flex-col items-center text-center min-h-[90vh] justify-center">
          <motion.div className="absolute top-20 left-10 w-32 h-32 rounded-full blur-[100px]" style={{ y, opacity, background: 'var(--theme-accent, #E07A5F)' }} />
          
          <motion.div 
            variants={staggerContainer} 
            initial="hidden" 
            animate="visible"
            className="max-w-4xl flex flex-col items-center z-10"
          >
            <motion.div variants={fadeUp} className="mb-8 inline-flex items-center gap-2 px-4 py-1.5 rounded-full backdrop-blur-sm" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--theme-accent, #E07A5F)' }} />
              <span className="text-xs font-medium tracking-widest uppercase" style={{ color: '#A0A0A0' }}>AltLeads 2.0 is live</span>
            </motion.div>

            <motion.h1 
              variants={fadeUp}
              className="text-6xl md:text-8xl font-bold mb-8 leading-[1.1] tracking-tight"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Accelerate your <br/>
              <span style={{ color: 'var(--theme-accent, #E07A5F)' }}>pipeline.</span>
            </motion.h1>

            <motion.p 
              variants={fadeUp}
              className="text-lg md:text-xl mb-12 max-w-2xl"
              style={{ color: '#A0A0A0', lineHeight: 1.6 }}
            >
              Empowering precision in sales automation for growth-focused enterprise teams. 
              No clutter. No friction. Just structured data and velocity.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center gap-4">
              <button
                onClick={() => navigate(session ? '/dashboard' : '/login')}
                className="group px-8 py-4 rounded-full text-base font-semibold transition-all hover:scale-105 flex items-center gap-2 relative overflow-hidden"
                style={{ 
                  background: 'var(--theme-accent, #E07A5F)', 
                  color: '#121212',
                  boxShadow: '0 0 30px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.3)' 
                }}
              >
                {/* Button Noise Texture */}
                <div 
                  className="absolute inset-0 opacity-40 pointer-events-none mix-blend-overlay"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='btnNoise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='2' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23btnNoise)'/%3E%3C/svg%3E")` }}
                />
                <span className="relative z-10 flex items-center gap-2">
                  {session ? 'Enter App' : 'Start Building'}
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
            </motion.div>
          </motion.div>

          {/* Hero Mockup */}
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.6, ease: [0.16, 1, 0.3, 1] as const }}
            className="mt-24 w-full max-w-5xl rounded-2xl overflow-hidden relative z-20"
            style={{ 
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              perspective: "1000px"
            }}
          >
            {/* Browser Chrome */}
            <div className="h-10 px-4 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', background: 'rgba(0,0,0,0.3)' }}>
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ background: '#FF5F56' }} />
                <div className="w-3 h-3 rounded-full" style={{ background: '#FFBD2E' }} />
                <div className="w-3 h-3 rounded-full" style={{ background: '#27C93F' }} />
              </div>
            </div>
            
            {/* Mock Dashboard Area */}
            <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6 backdrop-blur-xl">
              <div className="col-span-2 space-y-6">
                <div className="h-48 rounded-xl p-6 relative overflow-hidden group" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                   <h3 className="text-sm font-medium mb-4 z-10 relative" style={{ color: '#A0A0A0' }}>Lead Velocity</h3>
                   <div className="absolute bottom-0 left-0 w-full h-24" style={{
                     background: 'linear-gradient(0deg, rgba(224, 122, 95, 0.15) 0%, rgba(224, 122, 95, 0) 100%)'
                   }}/>
                   <svg className="w-full h-20 absolute bottom-0 left-0 transition-transform duration-700 group-hover:scale-y-110 origin-bottom" viewBox="0 0 100 20" preserveAspectRatio="none">
                      <path d="M0,20 L20,15 L40,18 L60,5 L80,10 L100,0" fill="none" stroke="var(--theme-accent, #E07A5F)" strokeWidth="2" vectorEffect="non-scaling-stroke"/>
                   </svg>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="h-32 rounded-xl p-5 flex flex-col justify-between" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <Users size={20} color="var(--theme-secondary, #4A90E2)" />
                    <div>
                      <div className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>2,450</div>
                      <div className="text-xs mt-1" style={{ color: '#A0A0A0' }}>Active Leads</div>
                    </div>
                  </div>
                  <div className="h-32 rounded-xl p-5 flex flex-col justify-between" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <Zap size={20} color="var(--theme-accent, #E07A5F)" />
                    <div>
                      <div className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>18</div>
                      <div className="text-xs mt-1" style={{ color: '#A0A0A0' }}>Conversions Today</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-span-1 h-full rounded-xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h3 className="text-sm font-medium mb-6" style={{ color: '#A0A0A0' }}>Recent Activity</h3>
                <div className="space-y-4">
                  {[1,2,3,4].map((i, idx) => (
                    <motion.div 
                      key={i} 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 1 + (idx * 0.1) }}
                      className="flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(224, 122, 95, 0.1)' }}>
                        <div className="w-2 h-2 rounded-full" style={{ background: 'var(--theme-accent, #E07A5F)' }} />
                      </div>
                      <div className="flex-1">
                        <div className="h-2 w-full rounded" style={{ background: 'rgba(255,255,255,0.1)' }} />
                        <div className="h-2 w-1/2 rounded mt-2" style={{ background: 'rgba(255,255,255,0.05)' }} />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* --- The Reality Section --- */}
        <section id="reality" className="py-32 px-8 w-full max-w-7xl relative">
          <RevealSection className="text-center mb-20 max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold mb-6" style={{ fontFamily: 'var(--font-display)' }}>
              Most CRMs store data.<br/>
              <span style={{ color: 'var(--theme-accent, #E07A5F)' }}>They don't run outbound.</span>
            </h2>
            <p className="text-lg" style={{ color: '#A0A0A0' }}>
              Most sales teams don’t fail because of effort — they fail because execution is fragmented. Follow-ups slip, reporting becomes unreliable, and "AI insights" sit unused in separate dashboards.
            </p>
          </RevealSection>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <RevealSection>
              <TiltCard className="p-8 rounded-2xl h-full shadow-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="w-12 h-12 rounded-full mb-6 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <Users size={24} color="#A0A0A0" />
                </div>
                <h3 className="text-xl font-bold mb-2">Pipeline Leakage</h3>
                <p className="text-sm mb-4" style={{ color: 'var(--theme-accent, #E07A5F)' }}>Reps forget follow-ups</p>
                <p style={{ color: '#A0A0A0', lineHeight: 1.6 }}>Without sequence enforcement, qualified prospects silently fall through the cracks between touches.</p>
              </TiltCard>
            </RevealSection>
            
            <RevealSection>
              <TiltCard className="p-8 rounded-2xl h-full shadow-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="w-12 h-12 rounded-full mb-6 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <BarChart3 size={24} color="#A0A0A0" />
                </div>
                <h3 className="text-xl font-bold mb-2">Weak Coaching</h3>
                <p className="text-sm mb-4" style={{ color: 'var(--theme-accent, #E07A5F)' }}>Activity reporting is unreliable</p>
                <p style={{ color: '#A0A0A0', lineHeight: 1.6 }}>Managers can't coach what they can't see. Manual CRM logging creates blind spots in every pipeline review.</p>
              </TiltCard>
            </RevealSection>

            <RevealSection>
              <TiltCard className="p-8 rounded-2xl h-full shadow-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="w-12 h-12 rounded-full mb-6 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <MessageSquare size={24} color="#A0A0A0" />
                </div>
                <h3 className="text-xl font-bold mb-2">Low Adoption</h3>
                <p className="text-sm mb-4" style={{ color: 'var(--theme-accent, #E07A5F)' }}>Generic AI suggestions</p>
                <p style={{ color: '#A0A0A0', lineHeight: 1.6 }}>Off-the-shelf AI tools generate generic output that reps ignore — because it doesn't fit their workflow or context.</p>
              </TiltCard>
            </RevealSection>
          </div>
          
          <RevealSection className="mt-16 text-center">
            <p className="text-lg max-w-3xl mx-auto" style={{ color: '#F8F5F0' }}>
              <strong style={{ color: 'var(--theme-accent, #E07A5F)' }}>AltLeads fixes this by being workflow-first:</strong> It combines CRM, outreach cadences, and usable intelligence into one execution layer, so teams move faster and managers see what’s really happening.
            </p>
          </RevealSection>
        </section>

        {/* --- The OS In Action --- */}
        <section id="how-it-works" className="py-32 w-full border-y" style={{ borderColor: 'rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}>
          <div className="max-w-7xl mx-auto px-8">
            <RevealSection className="mb-20">
              <h2 className="text-4xl md:text-5xl font-bold mb-6" style={{ fontFamily: 'var(--font-display)' }}>
                How AltLeads Works
              </h2>
              <p className="text-lg" style={{ color: '#A0A0A0' }}>
                Keep it simple. The goal is execution consistency, not feature overload.
              </p>
            </RevealSection>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
              {/* Connector line for desktop */}
              <div className="hidden md:block absolute top-[28px] left-[10%] right-[10%] h-[1px]" style={{ background: 'rgba(255,255,255,0.1)' }} />
              
              <RevealSection>
                <div className="relative z-10 flex flex-col">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl mb-8 shadow-[0_0_30px_rgba(224,122,95,0.3)]" style={{ background: 'var(--theme-bg, #121212)', border: '1px solid var(--theme-accent, #E07A5F)', color: 'var(--theme-accent, #E07A5F)' }}>01</div>
                  <h3 className="text-2xl font-bold mb-4">Load ICP + Accounts</h3>
                  <p style={{ color: '#A0A0A0', lineHeight: 1.6 }}>Import from CSV or your existing CRM, or start with a target account list. Bring your own data or discover accounts that match your ideal customer profile.</p>
                </div>
              </RevealSection>

              <RevealSection>
                <div className="relative z-10 flex flex-col">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl mb-8 shadow-[0_0_30px_rgba(224,122,95,0.3)]" style={{ background: 'var(--theme-bg, #121212)', border: '1px solid var(--theme-accent, #E07A5F)', color: 'var(--theme-accent, #E07A5F)' }}>02</div>
                  <h3 className="text-2xl font-bold mb-4">Run Cadences</h3>
                  <p style={{ color: '#A0A0A0', lineHeight: 1.6 }}>Execute Email, LinkedIn, WhatsApp, and call workflows in one place. One sequence engine for all channels. No switching between 4 different tabs.</p>
                </div>
              </RevealSection>

              <RevealSection>
                <div className="relative z-10 flex flex-col">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl mb-8 shadow-[0_0_30px_rgba(224,122,95,0.3)]" style={{ background: 'var(--theme-bg, #121212)', border: '1px solid var(--theme-accent, #E07A5F)', color: 'var(--theme-accent, #E07A5F)' }}>03</div>
                  <h3 className="text-2xl font-bold mb-4">Measure & Improve</h3>
                  <p style={{ color: '#A0A0A0', lineHeight: 1.6 }}>Track activity, quality, and outcomes — then improve targeting and messaging. Close the loop between execution data and strategy decisions.</p>
                </div>
              </RevealSection>
            </div>
          </div>
        </section>

        {/* --- Module Ecosystem (Bento) --- */}
        <section id="modules" className="py-32 px-8 w-full max-w-7xl">
          <RevealSection className="mb-20">
            <h2 className="text-4xl md:text-5xl font-bold mb-6" style={{ fontFamily: 'var(--font-display)' }}>
              Module Ecosystem
            </h2>
            <p className="text-lg" style={{ color: '#A0A0A0' }}>
              What AltLeads gives your team.
            </p>
          </RevealSection>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 auto-rows-[240px]">
            {/* Cell 1: CRM (col-span-2, row-span-2) */}
            <RevealSection className="md:col-span-2 md:row-span-2">
              <TiltCard className="h-full p-8 rounded-3xl flex flex-col relative overflow-hidden group shadow-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--theme-accent, #E07A5F)] rounded-full blur-[100px] opacity-10 group-hover:opacity-20 transition-opacity duration-500" />
                <Workflow size={40} color="var(--theme-accent, #E07A5F)" className="mb-auto" />
                <div className="mt-8 relative z-10">
                  <h3 className="text-3xl font-bold mb-4">AltLeads CRM</h3>
                  <p style={{ color: '#A0A0A0', lineHeight: 1.6 }} className="text-lg">Workflow-first CRM designed for outbound and backend-to-sales alignment. Keep your source of truth active.</p>
                </div>
              </TiltCard>
            </RevealSection>

            {/* Cell 2: Multi-channel (col-span-2, row-span-1) */}
            <RevealSection className="md:col-span-2">
              <TiltCard className="h-full p-8 rounded-3xl flex flex-col justify-end relative overflow-hidden shadow-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg bg-black/40 border border-white/10 text-[#A0A0A0]"><Mail size={20}/></div>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg bg-[#0077b5]/20 border border-[#0077b5]/30 text-[#0077b5]"><Briefcase size={20}/></div>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg bg-[#25D366]/20 border border-[#25D366]/30 text-[#25D366]"><MessageSquare size={20}/></div>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg bg-black/40 border border-white/10 text-[#A0A0A0]"><Phone size={20}/></div>
                </div>
                <h3 className="text-xl font-bold mb-2">Multi-channel Cadences</h3>
                <p className="text-sm" style={{ color: '#A0A0A0' }}>Email, LinkedIn, WhatsApp, and call workflows with real follow-up discipline.</p>
              </TiltCard>
            </RevealSection>

            {/* Cell 3: Data & Intel (col-span-1, row-span-1) */}
            <RevealSection>
              <TiltCard className="h-full p-8 rounded-3xl flex flex-col justify-end shadow-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <Database size={28} className="mb-4" color="var(--theme-accent, #E07A5F)" />
                <h3 className="text-lg font-bold mb-2">Data & Intel</h3>
                <p className="text-sm" style={{ color: '#A0A0A0' }}>Verified decision-maker data plus pitch guidance.</p>
              </TiltCard>
            </RevealSection>

            {/* Cell 4: Manager Visibility (col-span-1, row-span-1) */}
            <RevealSection>
              <TiltCard className="h-full p-8 rounded-3xl flex flex-col justify-end shadow-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <LineChart size={28} className="mb-4" color="var(--theme-accent, #E07A5F)" />
                <h3 className="text-lg font-bold mb-2">Manager View</h3>
                <p className="text-sm" style={{ color: '#A0A0A0' }}>Dashboards that show activity quality and bottlenecks.</p>
              </TiltCard>
            </RevealSection>
          </div>
        </section>

        {/* --- The Differentiator --- */}
        <section className="py-32 px-8 w-full max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <RevealSection>
              <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
                Usable intelligence — <br/>
                <span style={{ color: 'var(--theme-accent, #E07A5F)' }}>built from real outbound.</span>
              </h2>
              <p className="text-lg mb-8" style={{ color: '#A0A0A0', lineHeight: 1.6 }}>
                AltLeads intelligence doesn’t try to “replace sales.” It helps teams execute better by suggesting practical next steps, pitch angles, and message guidance inside the workflow — where reps already work.
              </p>
              
              <ul className="space-y-4 mb-8">
                {[
                  "Practical next-step suggestions",
                  "Pitch angles tailored to persona",
                  "Channel-specific message guidance",
                  "Built into the workflow, not a separate dashboard"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle2 size={18} color="var(--theme-accent, #E07A5F)" className="flex-shrink-0" />
                    <span style={{ color: 'var(--theme-accent, #E07A5F)' }}>{item}</span>
                  </li>
                ))}
              </ul>
              
              <div className="p-5 rounded-xl flex gap-4 items-start shadow-xl" style={{ background: 'rgba(224, 122, 95, 0.05)', border: '1px solid rgba(224, 122, 95, 0.2)' }}>
                <Shield size={20} color="var(--theme-accent, #E07A5F)" className="mt-1" />
                <div>
                  <h4 className="font-semibold mb-1" style={{ color: 'var(--theme-accent, #E07A5F)' }}>Privacy Note</h4>
                  <p className="text-sm leading-relaxed" style={{ color: '#A0A0A0' }}>Designed to be privacy-safe, using contextual research and aggregated patterns — not client-confidential exposure. Your data stays yours.</p>
                </div>
              </div>
            </RevealSection>
            
            <RevealSection>
              <div className="relative aspect-square rounded-3xl overflow-hidden p-8 flex items-center justify-center shadow-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle at center, var(--theme-accent, #E07A5F) 0%, transparent 70%)' }} />
                
                {/* 3D-ish Floating UI Elements */}
                <motion.div 
                  animate={{ y: [0, -10, 0] }} 
                  transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                  className="w-full max-w-sm rounded-xl p-6 backdrop-blur-md relative z-10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)]"
                  style={{ background: 'rgba(30, 30, 30, 0.8)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <div className="flex gap-3 mb-5">
                    <div className="w-10 h-10 rounded bg-[var(--theme-accent, #E07A5F)]/20 flex items-center justify-center text-[var(--theme-accent, #E07A5F)] border border-[var(--theme-accent, #E07A5F)]/30"><Target size={18} /></div>
                    <div>
                      <div className="text-sm font-bold">Suggested Angle</div>
                      <div className="text-xs text-gray-400 mt-1">Based on recent hiring data</div>
                    </div>
                  </div>
                  <div className="rounded bg-black/40 border border-white/5 mb-5 p-4 text-sm text-gray-300 leading-relaxed shadow-inner">
                    "Noticed your team is scaling SDRs. Our platform enforces sequence discipline automatically..."
                  </div>
                  <button className="w-full py-3 rounded-lg bg-[var(--theme-accent, #E07A5F)] hover:bg-[#cf6d52] transition-colors text-[var(--theme-bg, #121212)] text-sm font-bold shadow-[0_5px_15px_rgba(224,122,95,0.2)]">
                    Apply to Email
                  </button>
                </motion.div>
                
                <motion.div 
                  animate={{ y: [0, 10, 0] }} 
                  transition={{ repeat: Infinity, duration: 5, ease: "easeInOut", delay: 1 }}
                  className="absolute bottom-12 right-12 w-56 rounded-xl p-5 backdrop-blur-md shadow-2xl"
                  style={{ background: 'rgba(40, 40, 40, 0.9)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <div className="text-xs text-gray-400 mb-3 uppercase tracking-wider font-semibold">Next Best Action</div>
                  <div className="flex items-center gap-3 text-sm font-medium">
                    <div className="w-8 h-8 rounded-full bg-[var(--theme-secondary, #4A90E2)]/20 flex items-center justify-center">
                      <Phone size={14} color="var(--theme-secondary, #4A90E2)" /> 
                    </div>
                    Follow up call
                  </div>
                </motion.div>
              </div>
            </RevealSection>
          </div>
        </section>

        {/* --- Target Profiles --- */}
        <section className="py-32 w-full border-t" style={{ borderColor: 'rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}>
          <div className="max-w-7xl mx-auto px-8">
            <RevealSection className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>Built for teams that choose to execute.</h2>
            </RevealSection>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { title: "Outbound SDR teams", pre: "20–100 seats", desc: "Improve follow-up discipline and meeting conversion with structured multi-channel cadences and automatic activity tracking." },
                { title: "Founder-led sales", pre: "Speed Without Chaos", desc: "Move fast without losing track. Run outbound, track outcomes, and iterate on messaging — all without building a complex ops stack." },
                { title: "Sales managers", pre: "Visibility & Coaching", desc: "Get visibility and coaching signals, not just activity noise. See what's actually happening in your pipeline and where reps need help." }
              ].map((item, i) => (
                <RevealSection key={i}>
                  <TiltCard className="p-8 rounded-2xl border border-white/5 bg-white/[0.01] h-full shadow-2xl">
                    <div className="text-xs uppercase tracking-widest text-[var(--theme-accent, #E07A5F)] mb-6 font-semibold">{item.pre}</div>
                    <h3 className="text-2xl font-bold mb-4">{item.title}</h3>
                    <p className="text-gray-400 leading-relaxed text-sm md:text-base">{item.desc}</p>
                  </TiltCard>
                </RevealSection>
              ))}
            </div>
          </div>
        </section>

        {/* --- FAQ --- */}
        <section id="faq" className="py-32 px-8 w-full max-w-3xl mx-auto">
          <RevealSection className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Frequently Asked</h2>
          </RevealSection>

          <div className="space-y-6">
            {[
              { q: "Is AltLeads a CRM replacement or execution layer?", a: "AltLeads can work as both. For teams with an existing CRM, it acts as a powerful execution layer on top. For teams starting fresh, it serves as a complete workflow-first CRM that handles outbound, cadences, and intelligence in one system." },
              { q: "How is AltLeads different from HubSpot/Zoho/Salesloft?", a: "Most CRMs focus on data storage and generic automation. AltLeads is purpose-built for outbound execution — combining multi-channel cadences, practical intelligence, and structured feedback loops in one workflow." },
              { q: "What data is stored and how is privacy handled?", a: "AltLeads intelligence is designed to be privacy-safe, using contextual research and aggregated patterns — not client-confidential exposure. We maintain clear controls for data access and usage with role-based options." },
              { q: "What does onboarding look like?", a: "Most teams can start with a focused setup and pilot rollout in about 2 weeks, then expand once the workflow is stable. We handle data import, configuration, team training, and a pilot go-live with optimization cycles built in." }
            ].map((faq, i) => (
              <RevealSection key={i}>
                <div className="p-8 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer group">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-lg font-bold group-hover:text-[var(--theme-accent, #E07A5F)] transition-colors">{faq.q}</h4>
                    <ChevronDown size={20} className="text-gray-500" />
                  </div>
                  <p className="text-gray-400 leading-relaxed text-sm">{faq.a}</p>
                </div>
              </RevealSection>
            ))}
          </div>
        </section>

        {/* --- Footer & CTA --- */}
        <section className="py-32 px-8 w-full border-t flex flex-col items-center text-center relative overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.05)', background: '#0a0a0a' }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-64 bg-[var(--theme-accent, #E07A5F)] rounded-full blur-[200px] opacity-[0.03] pointer-events-none" />
          
          <RevealSection className="max-w-3xl relative z-10">
            <h2 className="text-5xl md:text-7xl font-bold mb-8" style={{ fontFamily: 'var(--font-display)' }}>Eliminate switching fear.</h2>
            <p className="text-xl text-gray-400 mb-12">Import from CSV, connect to existing CRM workflows, and go live in days — not months.</p>
            <button
              onClick={() => navigate(session ? '/dashboard' : '/login')}
              className="px-8 py-4 rounded-full text-base font-semibold transition-all hover:scale-105 inline-flex items-center gap-2 relative overflow-hidden group"
              style={{ background: 'var(--theme-accent, #E07A5F)', color: '#121212', boxShadow: '0 0 30px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.3)' }}
            >
              {/* Button Noise Texture */}
              <div 
                className="absolute inset-0 opacity-40 pointer-events-none mix-blend-overlay"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='btnNoise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='2' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23btnNoise)'/%3E%3C/svg%3E")` }}
              />
              <span className="relative z-10 flex items-center gap-2">
                Book a Live Demo
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
            <p className="mt-8 text-sm text-gray-500 font-medium tracking-wide uppercase">No credit card required • Response within 2 hours</p>
          </RevealSection>
          
          <div className="w-full max-w-7xl mt-32 pt-12 border-t border-white/5 flex flex-col md:flex-row items-center justify-between text-sm text-gray-500">
            <div className="flex items-center gap-2 mb-6 md:mb-0">
              <Logo /> <span className="ml-4 font-medium">© 2026 AltLeads Inc.</span>
            </div>
            <div className="flex gap-8 font-medium">
              <a href="#" className="hover:text-gray-300 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-gray-300 transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-gray-300 transition-colors">Contact</a>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}

export default LandingPage;
