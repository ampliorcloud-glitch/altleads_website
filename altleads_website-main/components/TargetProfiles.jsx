'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function TargetProfiles() {
  const [expandedId, setExpandedId] = useState(null);

  const profiles = [
    {
      id: 'sdr',
      title: 'SDR teams',
      tag: '20–100 seats',
      label: 'Speed Without Chaos',
      desc: 'Improve follow-up discipline and meeting conversion, with every email and call logged automatically against the lead.',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      ),
    },
    {
      id: 'founder',
      title: 'Founder-led sales',
      label: 'Iterate Fast',
      desc: 'Move fast without losing track. Run outbound, track outcomes, and iterate on messaging — all without building a complex ops stack.',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      ),
    },
    {
      id: 'manager',
      title: 'Sales managers',
      label: 'Visibility & Coaching',
      desc: "Get visibility and coaching signals, not just activity noise. See what's actually happening in your pipeline and where reps need help.",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      ),
    },
  ];

  return (
    <section className="section section-target" data-section="target">
      <div className="section-inner">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <h2 className="section-headline leading-[1.1] text-slate-900 dark:text-white">Built for teams that choose to execute.</h2>
        </motion.div>

        <div className="profile-cards mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {profiles.map((p, i) => {
            const isExpanded = expandedId === p.id;

            return (
              <motion.div
                key={p.id}
                layout
                className={`profile-card cursor-pointer group relative overflow-hidden backdrop-blur-xl border rounded-[32px] p-8 md:p-10 transition-colors duration-500
                  ${isExpanded ? 'bg-white/90 border-blue-500/30 dark:bg-white/10 dark:border-white/20 shadow-[0_0_40px_rgba(37,99,235,0.08)]' : 'bg-white/50 border-black/5 hover:bg-white/80 dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/10'}
                `}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, delay: i * 0.15, ease: "easeOut" }}
                whileHover={{ y: -10, scale: 1.02 }}
                onMouseEnter={() => setExpandedId(p.id)}
                onMouseLeave={() => setExpandedId(null)}
              >
                <motion.div layout className="profile-icon text-slate-800 bg-black/5 dark:text-slate-300 dark:bg-white/10 rounded-2xl w-14 h-14 flex items-center justify-center mb-6 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {p.icon}
                </motion.div>

                {p.tag && (
                  <motion.span layout className="inline-block px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-full mb-4">
                    {p.tag}
                  </motion.span>
                )}

                <motion.h3 layout className="text-2xl font-black text-slate-900 dark:text-white mb-2">{p.title}</motion.h3>
                <motion.span layout className="profile-label block mb-4 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs tracking-widest">{p.label}</motion.span>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden text-slate-600 dark:text-slate-300 font-medium leading-relaxed mt-2"
                    >
                      {p.desc}
                    </motion.p>
                  )}
                </AnimatePresence>

                {!isExpanded && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-4 text-xs font-bold text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
                  >
                    Hover to learn more
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
