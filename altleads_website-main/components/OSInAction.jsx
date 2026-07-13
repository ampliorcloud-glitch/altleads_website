'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';

const steps = [
  {
    num: '01',
    label: 'Load your ICP',
    desc: 'Import your ideal customer profile. AltLeads enriches every contact with firmographic data, tech stack signals, and intent indicators.',
  },
  {
    num: '02',
    label: 'Run cadences',
    desc: 'Set up multi-channel sequences — email, WhatsApp, LinkedIn — with AI-written, context-aware messages that adapt to each prospect.',
  },
  {
    num: '03',
    label: 'Measure & iterate',
    desc: "Real-time dashboards show what's working. Reply rates, open rates, meeting conversions — all tied back to the cadence that drove them.",
  },
];

export default function OSInAction() {
  const ref = useRef(null);

  return (
    <section
      id="how-it-works"
      data-section="os"
      ref={ref}
      className="w-full min-h-screen flex items-center bg-transparent relative z-10 px-8 md:px-16 lg:px-24 py-40"
    >
      <div className="w-full max-w-[1280px] mx-auto flex justify-end">
        <div className="w-full max-w-[700px]">
          {/* Section label */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-20 lg:mb-28"
          >
            <span className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full border border-blue-500/25 bg-blue-500/8 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-blue-500 dark:text-blue-400 font-bold uppercase tracking-[0.2em] text-xs">The OS In Action</span>
            </span>
          </motion.div>

          {/* Timeline */}
          <div className="flex flex-col gap-0">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                className="os-step group relative grid grid-cols-[auto_1fr] gap-10 md:gap-16"
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.7, delay: i * 0.15, ease: [0.32, 0.72, 0, 1] }}
              >
                {/* Left column — number + connector */}
                <div className="flex flex-col items-center">
                  {/* Circle */}
                  <div className="relative z-10 flex-shrink-0 w-14 h-14 rounded-full border border-blue-500/30 bg-white dark:bg-[#050505] flex items-center justify-center group-hover:border-blue-500 group-hover:bg-blue-500/10 transition-all duration-500 shadow-[0_0_0_6px_rgba(59,130,246,0.06)]">
                    <span className="text-blue-500 dark:text-blue-400 font-black text-sm tracking-wider">{step.num}</span>
                  </div>
                  {/* Vertical connector */}
                  {i < steps.length - 1 && (
                    <div className="w-px flex-1 my-4 bg-gradient-to-b from-blue-500/30 to-transparent" style={{ minHeight: '80px' }} />
                  )}
                </div>

                {/* Right column — content */}
                <div className="pb-24 pt-3">
                  <motion.div
                    whileHover={{ x: 8 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                  >
                    <h3 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-white mb-5 leading-tight group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors duration-400">
                      {step.label}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 text-base md:text-lg leading-relaxed max-w-xl font-medium">
                      {step.desc}
                    </p>
                  </motion.div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
