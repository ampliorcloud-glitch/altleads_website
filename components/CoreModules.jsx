"use client";

import { motion } from "framer-motion";
import { Database, Layers, Brain, BarChart3, MessageCircle, ArrowRight } from "lucide-react";
import SectionWrapper from "./SectionWrapper";

const modules = [
    {
        icon: Database,
        title: "AltLeads CRM",
        desc: "Workflow-first CRM designed for outbound and backend-to-sales alignment.",
        href: "/solutions/crm",
        color: "text-primary",
        bg: "bg-primary-light",
        border: "border-primary/10",
        span: true,
    },
    {
        icon: Layers,
        title: "Multi-channel Cadences",
        desc: "Email, LinkedIn, WhatsApp, and call workflows with real follow-up discipline.",
        href: "/solutions/crm",
        color: "text-violet-600",
        bg: "bg-violet-50",
        border: "border-violet-100",
    },
    {
        icon: Brain,
        title: "Data & Intelligence",
        desc: "Verified decision-maker data plus pitch guidance reps can use immediately.",
        href: "/solutions/data",
        color: "text-emerald-600",
        bg: "bg-emerald-50",
        border: "border-emerald-100",
    },
    {
        icon: BarChart3,
        title: "Manager Visibility & Coaching",
        desc: "Dashboards that show activity quality, outcomes, and bottlenecks.",
        href: "/solutions/crm",
        color: "text-orange-600",
        bg: "bg-orange-50",
        border: "border-orange-100",
    },
    {
        icon: MessageCircle,
        title: "WhatsApp for B2B",
        desc: "Template-based, compliance-aware WhatsApp workflows for confirmations, reminders, re-engagement, and follow-ups.",
        href: "/solutions/whatsapp",
        color: "text-emerald-600",
        bg: "bg-emerald-50",
        border: "border-emerald-100",
        badge: "Professional",
    },
];

export default function CoreModules() {
    return (
        <SectionWrapper id="modules" className="bg-white">
            <div className="text-center mb-24 max-w-4xl mx-auto">
                <span className="text-primary font-black tracking-[0.2em] text-[10px] uppercase mb-6 block">The Infrastructure</span>
                <h2 className="text-[40px] md:text-[64px] font-black headline-premium text-[#0f172a] mb-8 leading-none">
                    One platform. <br /><span className="text-primary italic">Absolute mastery.</span>
                </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {modules.map((mod, index) => (
                    <motion.a
                        key={mod.title}
                        href={mod.href}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.08 }}
                        className={`relative p-10 rounded-[48px] border border-slate-100 bg-white hover:border-primary/20 hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-2 transition-all group ${mod.span ? "md:col-span-2 lg:col-span-1" : ""}`}
                    >
                        {mod.badge && (
                            <span className="absolute top-8 right-8 px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] bg-primary/10 text-primary rounded-full">
                                {mod.badge}
                            </span>
                        )}
                        <div className={`size-16 rounded-3xl ${mod.bg} flex items-center justify-center mb-8 group-hover:scale-110 transition-transform`}>
                            <mod.icon className={`size-8 ${mod.color}`} />
                        </div>
                        <h3 className="text-2xl font-black text-[#0f172a] mb-4 group-hover:text-primary transition-colors">{mod.title}</h3>
                        <p className="text-slate-500 text-base leading-relaxed font-medium mb-10">{mod.desc}</p>
                        <div className="flex items-center gap-3 text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                            Open Solution
                            <div className="size-6 rounded-full border border-primary/20 flex items-center justify-center group-hover:bg-primary group-hover:border-primary transition-all">
                                <ArrowRight className="size-3 group-hover:translate-x-0.5 group-hover:text-white transition-all" />
                            </div>
                        </div>
                    </motion.a>
                ))}
            </div>
        </SectionWrapper>
    );
}
