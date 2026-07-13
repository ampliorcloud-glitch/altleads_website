'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const modules = [
  {
    id: 'lead-pipeline',
    title: 'Lead & Pipeline Management',
    desc: 'Every company, contact and lead in one database — with saved views, deep filters and a drag-and-drop pipeline.',
    href: '/solutions/crm',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    id: 'email-protect',
    title: 'Email That Protects Your Domain',
    desc: 'Send from your own verified domain with DKIM checks, per-mailbox routing and daily send caps that keep you out of spam.',
    href: '/solutions/crm',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    id: 'call-logging',
    title: 'Call Logging & Outcomes',
    desc: 'Log every call with a structured disposition, so the next person picking up the lead knows exactly what happened.',
    href: '/solutions/crm',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
    ),
  },
  {
    id: 'bulk-import',
    title: 'Reversible Bulk Import',
    desc: 'Import thousands of leads from CSV or Excel. Every batch is audited and can be undone with one click if it goes wrong.',
    href: '/solutions/crm',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
  },
  {
    id: 'duplicate-control',
    title: 'Duplicate Control',
    desc: "Catch duplicates as they're typed, match on email domain and LinkedIn URL, and merge records without losing history.",
    href: '/solutions/crm',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
];

export default function ModuleEcosystem() {
  const [hovered, setHovered] = useState(null);
  const containerRef = useRef(null);
  const leftRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: containerRef.current,
        start: "top 15%",
        end: "bottom 80%",
        pin: leftRef.current,
        pinSpacing: false,
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <section data-section="modules" className="py-32 md:py-48 bg-transparent" ref={containerRef}>
      <div className="max-w-[1200px] mx-auto px-6 md:px-12 lg:flex lg:gap-32 relative">
        
        {/* Left Side: Pinned Headline */}
        <div className="lg:w-2/5" ref={leftRef}>
          <div className="lg:max-w-sm">
            <h2 className="text-[3rem] md:text-[5rem] font-black tracking-tight leading-[1.05] text-slate-900 dark:text-white mb-8">
              The Execution OS
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
              Everything your team needs to run high-volume outbound safely and predictably.
            </p>
          </div>
        </div>

        {/* Right Side: Horizontal Slices (Accordions) */}
        <div className="lg:w-3/5 mt-24 lg:mt-0 flex flex-col">
          {modules.map((mod, i) => {
            const isHovered = hovered === mod.id;

            return (
              <motion.div
                key={mod.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: i * 0.1, ease: "easeOut" }}
                onMouseEnter={() => setHovered(mod.id)}
                onMouseLeave={() => setHovered(null)}
                className="module-card group border-b border-black/10 dark:border-white/10 py-10 cursor-pointer overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-8">
                    <div className="size-14 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-500/20 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-all duration-500 flex-shrink-0">
                      {mod.icon}
                    </div>
                    <h3 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-500 tracking-tight">
                      {mod.title}
                    </h3>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transform -translate-x-4 group-hover:translate-x-0 transition-all duration-500 hidden sm:block">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-6 h-6 text-blue-600 dark:text-blue-400">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>

                <AnimatePresence>
                  {isHovered && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.4, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="pl-[5.5rem] mt-6 pb-2">
                        <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl mb-6">
                          {mod.desc}
                        </p>
                        <Link href={mod.href} className="inline-flex items-center text-sm font-bold text-slate-900 dark:text-white uppercase tracking-widest hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                          Explore Module
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
