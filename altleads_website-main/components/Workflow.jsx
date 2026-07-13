"use client";

import { motion } from "framer-motion";
import { Upload, Layers, TrendingUp } from "lucide-react";
import SectionWrapper from "./SectionWrapper";

const steps = [
    {
        icon: Upload,
        step: "01",
        title: "Load ICP + Accounts",
        desc: "Import from CSV or your existing CRM, or start with a target account list.",
        detail: "Bring your own data or discover accounts that match your ideal customer profile.",
    },
    {
        icon: Layers,
        step: "02",
        title: "Run Cadences Across Channels",
        desc: "Execute Email, LinkedIn, WhatsApp, and call workflows in one place.",
        detail: "One sequence engine for all channels. No switching between 4 different tabs.",
        active: true,
    },
    {
        icon: TrendingUp,
        step: "03",
        title: "Measure and Improve",
        desc: "Track activity, quality, and outcomes — then improve targeting and messaging.",
        detail: "Close the loop between execution data and strategy decisions.",
    },
];

export default function Workflow() {
    return (
        <SectionWrapper id="how-it-works" className="bg-white border-b border-slate-100 relative overflow-hidden">
            {/* Subtle Grid Pattern */}
            <div className="absolute inset-0 bg-grid opacity-[0.2] pointer-events-none" />

            <div className="text-center mb-24 max-w-4xl mx-auto relative z-10">
                <span className="text-primary font-black tracking-[0.2em] text-[10px] uppercase mb-6 block">The OS In Action</span>
                <h2 className="text-[40px] md:text-[64px] font-black headline-premium text-[#0f172a] mb-8 leading-none">
                    How AltLeads works
                </h2>
                <p className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto font-medium">
                    Keep it simple. The goal is execution consistency, not feature overload.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {steps.map((step, index) => (
                    <motion.div
                        key={step.title}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.15 }}
                        className={`relative p-10 rounded-[40px] border-2 transition-all group ${step.active
                            ? "bg-primary-light/20 border-primary/20 shadow-xl shadow-primary/5"
                            : "bg-[#f8fafc] border-slate-100 hover:border-primary/20 hover:shadow-lg"
                            }`}
                    >
                        <span className={`text-6xl font-black mb-8 block ${step.active ? "text-primary/20" : "text-slate-100"}`}>
                            {step.step}
                        </span>
                        <div className={`size-14 rounded-2xl flex items-center justify-center mb-6 transition-all ${step.active
                            ? "bg-primary shadow-lg shadow-primary/30"
                            : "bg-white border border-slate-100 shadow-sm group-hover:bg-primary group-hover:shadow-lg group-hover:shadow-primary/10"
                            }`}>
                            <step.icon className={`size-7 ${step.active ? "text-white" : "text-slate-400 group-hover:text-white"} transition-colors`} />
                        </div>
                        <h3 className={`text-xl font-bold mb-3 ${step.active ? "text-primary" : "text-[#0f172a]"}`}>
                            {step.title}
                        </h3>
                        <p className="text-slate-500 font-medium leading-relaxed mb-4">{step.desc}</p>
                        <p className="text-sm text-slate-400 italic">{step.detail}</p>
                    </motion.div>
                ))}
            </div>
        </SectionWrapper>
    );
}
