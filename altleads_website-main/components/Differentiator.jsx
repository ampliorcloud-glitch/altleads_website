'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ShieldCheck, Lock, Eye, RotateCcw, FileCheck } from 'lucide-react';

const bullets = [
  { icon: Eye, text: 'Emails and phone numbers masked until revealed' },
  { icon: Lock, text: 'Row-level access for every role' },
  { icon: RotateCcw, text: 'Deleted records recoverable from the recycle bin' },
  { icon: FileCheck, text: 'Every bulk import audited and reversible' },
];

export default function Differentiator() {
  const containerRef = useRef(null);
  const text = "Contact details are masked until someone with permission clicks to reveal them. Role scoping is enforced at the database level — not hidden behind a button. We do not sell, trade, or rent your data. Ever.";
  const words = text.split(" ");

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.scrub-word',
        { opacity: 0.06, filter: 'blur(4px)' },
        {
          opacity: 1,
          filter: 'blur(0px)',
          stagger: 0.08,
          scrollTrigger: {
            trigger: '.scrub-container',
            start: 'top 80%',
            end: 'bottom 55%',
            scrub: 1.2,
          }
        }
      );
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <section
      className="relative min-h-screen py-32 md:py-40 bg-transparent overflow-hidden"
      ref={containerRef}
      data-section="differentiator"
    >
      {/* Ambient glow */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/8 dark:bg-blue-600/5 rounded-full blur-[120px]" />

      <div className="relative z-10 max-w-[900px] mx-auto px-8 md:px-12 flex flex-col items-center text-center gap-16 md:gap-24">

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
          className="flex flex-col gap-6 items-center"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/8 text-blue-400 text-xs font-bold uppercase tracking-widest">
            <ShieldCheck className="w-3.5 h-3.5" />
            Data Security
          </span>
          <h2 className="text-[2.8rem] md:text-[4.5rem] font-black tracking-tight leading-[1.05] text-slate-900 dark:text-white">
            Your data,<br />
            <span className="text-blue-500">locked down</span> by default.
          </h2>
        </motion.div>

        {/* Scrubbing text reveal */}
        <div className="scrub-container w-full">
          <p className="text-[1.15rem] md:text-[1.5rem] font-medium leading-[1.75] text-slate-800 dark:text-slate-300 text-left">
            {words.map((word, i) => (
              <span key={i} className="scrub-word inline-block">{word}&nbsp;</span>
            ))}
          </p>
        </div>

        {/* Bullet list */}
        <div className="diff-bullets w-full flex flex-col gap-0 text-left">
          {bullets.map(({ icon: Icon, text: label }, i) => (
            <motion.div
              key={label}
              className="diff-bullet flex items-center gap-5 py-5 border-b border-slate-200 dark:border-white/10 last:border-0"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: [0.32, 0.72, 0, 1] }}
            >
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 dark:bg-blue-500/15 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-blue-500" />
              </div>
              <p className="font-semibold text-slate-800 dark:text-slate-200 text-base md:text-lg">{label}</p>
            </motion.div>
          ))}
        </div>

        {/* Privacy callout */}
        <motion.div
          className="privacy-note w-full flex items-start gap-5 p-7 md:p-8 rounded-2xl bg-blue-500/6 dark:bg-blue-500/10 border border-blue-500/15 dark:border-blue-500/20 text-left"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-white text-base mb-1.5 tracking-tight">Privacy first, always</p>
            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
              Access is invite-only and granted by your own administrators. Login is by business email; there is no third-party sign-in. Your data stays yours.
            </p>
          </div>
        </motion.div>

      </div>
    </section>
  );
}
