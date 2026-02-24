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
            <div className="text-center mb-20 max-w-3xl mx-auto">
                <span className="text-primary font-bold tracking-widest text-xs uppercase mb-4 block">Platform</span>
                <h2 className="text-4xl md:text-6xl font-black tracking-tight text-[#0f172a] mb-6">
                    What AltLeads gives <br /><span className="text-primary italic">your team.</span>
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
                        className={`relative p-8 rounded-[40px] border ${mod.border} bg-white hover:shadow-xl hover:-translate-y-1 transition-all group ${mod.span ? "md:col-span-2 lg:col-span-1" : ""}`}
                    >
                        {mod.badge && (
                            <span className="absolute top-6 right-6 px-3 py-1 text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 rounded-full">
                                {mod.badge}
                            </span>
                        )}
                        <div className={`size-14 rounded-2xl ${mod.bg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                            <mod.icon className={`size-7 ${mod.color}`} />
                        </div>
                        <h3 className="text-xl font-bold text-[#0f172a] mb-3 group-hover:text-primary transition-colors">{mod.title}</h3>
                        <p className="text-slate-500 text-sm leading-relaxed font-medium mb-6">{mod.desc}</p>
                        <div className="flex items-center gap-2 text-xs font-black text-primary uppercase tracking-widest">
                            Learn More
                            <ArrowRight className="size-3 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </motion.a>
                ))}
            </div>
        </SectionWrapper>
    );
}
