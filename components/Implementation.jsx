"use client";

import { motion } from "framer-motion";
import { ArrowRight, Upload, Link2, Zap } from "lucide-react";
import SectionWrapper from "./SectionWrapper";

const faqTeasers = [
    "Is AltLeads a CRM replacement or execution layer?",
    "How is AltLeads different from HubSpot/Zoho/Salesloft?",
    "What data is stored and how is privacy handled?",
    "What does onboarding look like?",
];

const migrationSteps = [
    { icon: Upload, title: "Import", desc: "CSV or existing CRM" },
    { icon: Link2, title: "Connect", desc: "Existing workflows" },
    { icon: Zap, title: "Go Live", desc: "In days, not months" },
];

export default function Implementation() {
    return (
        <SectionWrapper id="integrations" className="bg-[#f8fafc]">
            <div className="flex flex-col lg:flex-row gap-20 items-start">
                <div className="lg:w-1/2">
                    <span className="text-primary font-black tracking-[0.2em] text-[10px] uppercase mb-6 block">Zero Friction</span>
                    <h2 className="text-[40px] md:text-[56px] font-black headline-premium text-[#0f172a] mb-8 leading-none">
                        Eliminate <br /><span className="text-primary italic">switching fear.</span>
                    </h2>
                    <p className="text-slate-500 text-lg md:text-xl font-medium leading-relaxed mb-12">
                        Designed for speed. Import from CSV, connect to your existing data source, and go live in days — not months.
                    </p>

                    <div className="grid grid-cols-3 gap-4">
                        {migrationSteps.map((step, index) => (
                            <motion.div
                                key={step.title}
                                initial={{ opacity: 0, y: 10 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.1 }}
                                className="p-6 bg-white border border-slate-100 rounded-3xl text-center group hover:border-primary/20 transition-all"
                            >
                                <div className="size-12 rounded-2xl bg-primary-light flex items-center justify-center mx-auto mb-4 group-hover:bg-primary transition-colors">
                                    <step.icon className="size-6 text-primary group-hover:text-white transition-colors" />
                                </div>
                                <h4 className="font-bold text-[#0f172a] mb-1">{step.title}</h4>
                                <p className="text-xs text-slate-500 font-medium">{step.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>

                <div className="lg:w-1/2">
                    <h3 className="text-2xl font-black text-[#0f172a] mb-8">Frequently Asked</h3>
                    <div className="space-y-4">
                        {faqTeasers.map((faq, index) => (
                            <motion.a
                                key={faq}
                                href="#faq"
                                initial={{ opacity: 0, x: 10 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.08 }}
                                className="flex items-center justify-between p-6 bg-white border border-slate-100 rounded-2xl hover:border-primary/20 hover:shadow-md transition-all group"
                            >
                                <span className="font-bold text-[#0f172a] group-hover:text-primary transition-colors text-sm">{faq}</span>
                                <ArrowRight className="size-4 text-slate-400 group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0 ml-4" />
                            </motion.a>
                        ))}
                    </div>
                </div>
            </div>
        </SectionWrapper>
    );
}
