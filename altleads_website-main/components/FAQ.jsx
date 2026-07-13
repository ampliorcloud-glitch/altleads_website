"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus } from "lucide-react";
import { useState } from "react";
import SectionWrapper from "./SectionWrapper";

const faqs = [
  {
    k: "Is AltLeads a CRM replacement or execution layer?",
    v: "AltLeads can work as both. For teams with an existing CRM, it acts as a powerful execution layer on top. For teams starting fresh, it serves as a complete workflow-first CRM that handles outbound, cadences, and intelligence in one system.",
  },
  {
    k: "How is AltLeads different from HubSpot/Zoho/Salesloft?",
    v: "Most CRMs focus on data storage and generic automation. AltLeads is purpose-built for outbound execution — combining multi-channel cadences, practical intelligence, and structured feedback loops. It's designed for teams that care about execution quality, not just activity volume.",
  },
  {
    k: "What data is stored and how is privacy handled?",
    v: "AltLeads intelligence is designed to be privacy-safe, using contextual research and aggregated patterns. We maintain clear controls for data access and usage with role-based options. Your data stays yours.",
  },
  {
    k: "What does onboarding look like?",
    v: "Most teams are up and running within 2 weeks. We handle data import, configuration, team training, and a pilot go-live with optimization cycles built in — no implementation consultants required.",
  },
  {
    k: "Can my team run multi-channel outreach from one place?",
    v: "Yes. AltLeads supports Email, LinkedIn, WhatsApp, and call workflows in a single sequence engine. No more switching between 4 different tabs or losing context between channels.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <SectionWrapper id="faq" data-section="faq" className="bg-transparent py-32 md:py-48 overflow-hidden relative z-10">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/6 dark:bg-blue-500/5 rounded-full blur-[120px]" />

      {/* Two-column layout on large screens - now utilizing the full 1280px width */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-32 items-start w-full">

        {/* Left — sticky header */}
        <div className="lg:sticky lg:top-40">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
            className="flex flex-col gap-8"
          >
            <span className="inline-flex w-fit items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/8 text-blue-500 text-xs font-bold uppercase tracking-widest">
              FAQ
            </span>
            <h2 className="text-[3rem] md:text-[4rem] lg:text-[4.5rem] font-black tracking-tight leading-[1.05] text-slate-900 dark:text-white">
              Everything you{' '}
              <span className="text-blue-500 italic block mt-2">need to know.</span>
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-lg md:text-xl leading-relaxed font-medium max-w-md">
              Have a question about your outbound team? We&apos;re here to help you build the perfect execution engine.
            </p>
            <a
              href="/contact"
              className="mt-6 inline-flex items-center gap-2 text-base font-semibold text-blue-500 hover:text-blue-400 transition-colors"
            >
              Contact support →
            </a>
          </motion.div>
        </div>

        {/* Right — accordion */}
        <div className="flex flex-col gap-2">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <motion.div
                key={faq.k}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.5, delay: index * 0.07, ease: [0.32, 0.72, 0, 1] }}
                className="border-b border-slate-200 dark:border-white/10 last:border-0"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? -1 : index)}
                  className="w-full py-8 flex items-center justify-between text-left gap-6 group"
                >
                  <span className={`text-lg md:text-xl font-bold leading-snug transition-colors duration-300 pr-4 ${
                    isOpen
                      ? "text-blue-500"
                      : "text-slate-800 dark:text-slate-100 group-hover:text-blue-500"
                  }`}>
                    {faq.k}
                  </span>
                  <div className={`flex-shrink-0 size-10 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                    isOpen
                      ? "bg-blue-500/15 border-blue-500 text-blue-500"
                      : "border-slate-200 dark:border-white/15 text-slate-400 dark:text-slate-500 group-hover:border-blue-500 group-hover:text-blue-500"
                  }`}>
                    {isOpen ? <Minus className="size-4" /> : <Plus className="size-4" />}
                  </div>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="answer"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="pb-10 text-slate-600 dark:text-slate-400 text-base md:text-lg leading-relaxed pr-12">
                        {faq.v}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </SectionWrapper>
  );
}
