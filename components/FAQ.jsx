"use client";

import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import SectionWrapper from "./SectionWrapper";

const faqs = [
    {
        k: "Is AltLeads a CRM replacement or execution layer?",
        v: "AltLeads can work as both. For teams with an existing CRM, it acts as a powerful execution layer on top. For teams starting fresh, it serves as a complete workflow-first CRM that handles outbound, cadences, and intelligence in one system.",
    },
    {
        k: "How is AltLeads different from HubSpot/Zoho/Salesloft?",
        v: "Most CRMs focus on data storage and generic automation. AltLeads is purpose-built for outbound execution — combining multi-channel cadences, practical intelligence, and structured feedback loops in one workflow. It's designed for teams that care about execution quality, not just activity volume.",
    },
    {
        k: "What data is stored and how is privacy handled?",
        v: "AltLeads intelligence is designed to be privacy-safe, using contextual research and aggregated patterns — not client-confidential exposure. We maintain clear controls for data access and usage with role-based options. Your data stays yours.",
    },
    {
        k: "What does onboarding look like?",
        v: "Most teams can start with a focused setup and pilot rollout in about 2 weeks, then expand once the workflow is stable. We handle data import, configuration, team training, and a pilot go-live with optimization cycles built in.",
    },
    {
        k: "Can my team run multi-channel outreach from one place?",
        v: "Yes. AltLeads supports Email, LinkedIn, WhatsApp, and call workflows in a single sequence engine. No more switching between 4 different tabs or losing context between channels.",
    },
];

export default function FAQ() {
    const [openIndex, setOpenIndex] = useState(0);

    return (
        <SectionWrapper id="faq" className="bg-white">
            <div className="flex flex-col lg:flex-row gap-20">
                <div className="lg:w-1/3">
                    <span className="text-primary font-bold tracking-widest text-xs uppercase mb-4 block">Support</span>
                    <h2 className="text-4xl md:text-5xl font-black tracking-tight text-[#0f172a] mb-6">
                        Everything you <br /> <span className="text-primary">need to know.</span>
                    </h2>
                    <p className="text-slate-500 text-lg font-medium mb-10">
                        Have a different question? Our team is ready to help.
                    </p>
                    <a
                        href="/contact"
                        className="px-8 py-4 border border-slate-200 rounded-2xl font-bold text-[#0f172a] hover:bg-slate-50 transition-all text-center inline-block"
                    >
                        Contact Us
                    </a>
                </div>

                <div className="lg:w-2/3 flex flex-col gap-4">
                    {faqs.map((faq, index) => (
                        <motion.div
                            key={faq.k}
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            className={`border rounded-3xl overflow-hidden transition-all duration-300 ${openIndex === index ? "border-primary bg-primary-light/10 ring-1 ring-primary/20" : "border-slate-100 bg-[#f8fafc] hover:border-slate-300"}`}
                        >
                            <button
                                onClick={() => setOpenIndex(index === openIndex ? -1 : index)}
                                className="w-full p-6 md:p-8 flex items-center justify-between text-left group"
                            >
                                <span className={`text-lg font-bold transition-colors ${openIndex === index ? "text-primary" : "text-[#0f172a]"}`}>
                                    {faq.k}
                                </span>
                                <ChevronDown className={`size-5 transition-transform duration-300 flex-shrink-0 ml-4 ${openIndex === index ? "rotate-180 text-primary" : "text-slate-400"}`} />
                            </button>
                            <motion.div
                                initial={false}
                                animate={{ height: openIndex === index ? "auto" : 0 }}
                                className="overflow-hidden"
                            >
                                <div className="p-6 md:p-8 pt-0 text-slate-500 font-medium leading-relaxed">
                                    {faq.v}
                                </div>
                            </motion.div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </SectionWrapper>
    );
}
