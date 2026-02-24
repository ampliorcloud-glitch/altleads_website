"use client";

import { motion } from "framer-motion";
import SectionWrapper from "../SectionWrapper";
import {
    ArrowRight, MessageCircle, AlertTriangle, Clock, ShieldAlert, Users,
    CheckCircle, Layers, Zap, BarChart3, ChevronDown, Shield, Target,
    FileText, Bell, Timer, RefreshCw, Calendar, ThumbsUp, BrainCircuit,
    Settings, Eye, Smartphone, Building, Star
} from "lucide-react";
import { useState } from "react";

/* ─── Hero ─── */
function WAHero() {
    return (
        <section className="relative pt-32 pb-20 overflow-hidden bg-white">
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-100/40 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-emerald-50/40 rounded-full blur-[140px]" />
            </div>
            <div className="max-w-[1280px] mx-auto px-4 md:px-10 relative z-10">
                <div className="flex flex-col items-center text-center">
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 mb-8">
                        <MessageCircle className="size-4 text-emerald-600" />
                        <span className="text-xs font-bold text-emerald-600 tracking-wide uppercase">WhatsApp for B2B</span>
                    </motion.div>
                    <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-[36px] md:text-[64px] leading-[1.1] font-black tracking-tighter text-[#0f172a] mb-8">
                        WhatsApp for <span className="bg-gradient-to-r from-emerald-500 to-green-600 bg-clip-text text-transparent italic">B2B sales</span> — <br />done professionally.
                    </motion.h1>
                    <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-lg md:text-xl text-slate-500 max-w-3xl mb-4 font-medium leading-relaxed">
                        Most B2B teams use WhatsApp informally — personal numbers, no templates, no tracking. AltLeads makes WhatsApp a structured, compliant, and measurable outbound channel.
                    </motion.p>
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="text-sm text-slate-400 mb-10 max-w-2xl">
                        Built for meeting confirmations, follow-ups, re-engagement nudges, and structured outreach — via WhatsApp Business API with template-level compliance.
                    </motion.p>
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex flex-col sm:flex-row items-center gap-5">
                        <a href="/contact" className="px-8 py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all shadow-2xl shadow-emerald-100 flex items-center gap-2 group">
                            Start WhatsApp Pilot <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
                        </a>
                        <a href="#wa-workflows" className="px-8 py-4 bg-white text-[#0f172a] font-bold rounded-2xl border border-slate-200 hover:border-emerald-300 transition-all">
                            See Workflows
                        </a>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}

/* ─── Pain Points ─── */
const painPoints = [
    { icon: Smartphone, title: "It's informal", desc: "Reps use personal numbers. No tracking, no templates, no audit trail.", color: "text-red-500", bg: "bg-red-50" },
    { icon: ShieldAlert, title: "No compliance", desc: "Mass messaging from personal accounts risks bans, privacy violations, and reputational damage.", color: "text-orange-500", bg: "bg-orange-50" },
    { icon: Eye, title: "Zero visibility", desc: "Managers can't see what's being sent, to whom, or with what outcome.", color: "text-amber-500", bg: "bg-amber-50" },
];

function WAPainPoints() {
    return (
        <SectionWrapper className="bg-[#0f172a] text-white py-32">
            <div className="text-center mb-16 max-w-3xl mx-auto">
                <span className="text-emerald-400 font-bold tracking-widest text-xs uppercase mb-4 block">The Problem</span>
                <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-6 leading-tight">
                    WhatsApp is powerful. <span className="text-slate-500">But most teams misuse it.</span>
                </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {painPoints.map((p, i) => (
                    <motion.div key={p.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="p-8 bg-slate-900/50 border border-slate-800 rounded-3xl group">
                        <div className={`size-12 rounded-xl ${p.bg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                            <p.icon className={`size-6 ${p.color}`} />
                        </div>
                        <h3 className="text-lg font-bold mb-3">{p.title}</h3>
                        <p className="text-slate-400 text-sm leading-relaxed font-medium">{p.desc}</p>
                    </motion.div>
                ))}
            </div>
        </SectionWrapper>
    );
}

/* ─── Workflow Library ─── */
const workflows = [
    { icon: Calendar, title: "Meeting confirmation", desc: "Auto-confirm via WhatsApp after scheduling." },
    { icon: Bell, title: "Reminder nudges", desc: "24h and 1h pre-meeting reminders." },
    { icon: RefreshCw, title: "Reschedule follow-up", desc: "Quick reschedule link for no-shows." },
    { icon: Timer, title: "Post-meeting follow-up", desc: "Next-step confirmation and document sharing." },
    { icon: ThumbsUp, title: "Re-engagement", desc: "Dormant lead re-activation after 30/60/90 days." },
    { icon: Target, title: "Event/webinar invite", desc: "Targeted invite and RSVP tracking." },
];

function WAWorkflows() {
    return (
        <SectionWrapper id="wa-workflows" className="bg-white">
            <div className="text-center mb-20 max-w-3xl mx-auto">
                <span className="text-emerald-600 font-bold tracking-widest text-xs uppercase mb-4 block">Workflow Library</span>
                <h2 className="text-4xl md:text-5xl font-black tracking-tight text-[#0f172a] mb-6">
                    Pre-built workflows for <span className="text-emerald-600 italic">every stage.</span>
                </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {workflows.map((w, i) => (
                    <motion.div key={w.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="p-8 bg-[#f8fafc] border border-slate-100 rounded-3xl hover:border-emerald-200 hover:shadow-lg transition-all group">
                        <div className="size-12 rounded-2xl bg-emerald-50 flex items-center justify-center mb-5 group-hover:bg-emerald-600 transition-colors">
                            <w.icon className="size-6 text-emerald-600 group-hover:text-white transition-colors" />
                        </div>
                        <h3 className="text-lg font-bold text-[#0f172a] mb-2">{w.title}</h3>
                        <p className="text-slate-500 text-sm leading-relaxed font-medium">{w.desc}</p>
                    </motion.div>
                ))}
            </div>
        </SectionWrapper>
    );
}

/* ─── Orchestration ─── */
function WAOrchestration() {
    return (
        <SectionWrapper className="bg-[#f8fafc]">
            <div className="flex flex-col lg:flex-row gap-16 items-center">
                <div className="lg:w-1/2">
                    <span className="text-emerald-600 font-bold tracking-widest text-xs uppercase mb-4 block">Orchestration</span>
                    <h2 className="text-4xl md:text-5xl font-black tracking-tight text-[#0f172a] mb-6 leading-tight">
                        WhatsApp as part of <span className="text-emerald-600 italic">multi-channel cadences.</span>
                    </h2>
                    <p className="text-slate-500 text-lg font-medium leading-relaxed mb-8">
                        WhatsApp is most effective when orchestrated alongside email, LinkedIn, and calls — not as a standalone blast tool. AltLeads integrates WhatsApp into multi-step cadences.
                    </p>
                </div>
                <div className="lg:w-1/2">
                    <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="p-8 bg-white rounded-[40px] border border-slate-100 shadow-lg">
                        <h4 className="font-black text-sm text-emerald-600 uppercase tracking-widest mb-6">Example Cadence</h4>
                        {[
                            { day: "Day 1", ch: "Email", action: "Initial outreach" },
                            { day: "Day 3", ch: "LinkedIn", action: "Connection request" },
                            { day: "Day 5", ch: "WhatsApp", action: "Follow-up message" },
                            { day: "Day 7", ch: "Call", action: "Direct follow-up" },
                            { day: "Day 10", ch: "WhatsApp", action: "Re-engagement nudge" },
                        ].map((step, i) => (
                            <div key={i} className="flex items-center gap-4 py-3 border-b border-slate-50 last:border-0">
                                <span className="text-xs font-black text-slate-400 w-14">{step.day}</span>
                                <span className={`text-xs font-black px-3 py-1 rounded-full ${step.ch === "WhatsApp" ? "bg-emerald-100 text-emerald-700" : step.ch === "Email" ? "bg-blue-100 text-blue-700" : step.ch === "LinkedIn" ? "bg-sky-100 text-sky-700" : "bg-violet-100 text-violet-700"}`}>{step.ch}</span>
                                <span className="text-sm font-medium text-[#0f172a]">{step.action}</span>
                            </div>
                        ))}
                    </motion.div>
                </div>
            </div>
        </SectionWrapper>
    );
}

/* ─── Segments ─── */
const segments = [
    { icon: Users, title: "SDR / BDR teams", desc: "Running outbound cadences with WhatsApp as a structured touch." },
    { icon: Building, title: "Field sales orgs", desc: "Using WhatsApp for meeting confirmations and post-visit follow-ups." },
    { icon: Target, title: "Account-based teams", desc: "Personalizing WhatsApp for high-value targets within multi-channel plays." },
];

function WASegments() {
    return (
        <SectionWrapper className="bg-white">
            <div className="text-center mb-16 max-w-3xl mx-auto">
                <span className="text-emerald-600 font-bold tracking-widest text-xs uppercase mb-4 block">Built For</span>
                <h2 className="text-4xl md:text-5xl font-black tracking-tight text-[#0f172a] mb-6">
                    Who uses <span className="text-emerald-600 italic">WhatsApp SDR?</span>
                </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {segments.map((s, i) => (
                    <motion.div key={s.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="p-10 bg-[#f8fafc] border border-slate-100 rounded-[40px] hover:border-emerald-200 hover:shadow-lg transition-all group">
                        <div className="size-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <s.icon className="size-7 text-emerald-600" />
                        </div>
                        <h3 className="text-xl font-bold text-[#0f172a] mb-3">{s.title}</h3>
                        <p className="text-slate-500 text-sm leading-relaxed font-medium">{s.desc}</p>
                    </motion.div>
                ))}
            </div>
        </SectionWrapper>
    );
}

/* ─── Automation Engine ─── */
const engineFeatures = [
    { icon: FileText, title: "Template management", desc: "Pre-approved templates with variable personalization." },
    { icon: Zap, title: "Trigger-based sends", desc: "Auto-send on schedule, status change, or CRM event." },
    { icon: BarChart3, title: "Delivery analytics", desc: "Read receipts, reply rates, and engagement tracking." },
    { icon: BrainCircuit, title: "Smart throttling", desc: "Avoid spamming — rate limits and opt-out handling built in." },
];

function WAEngine() {
    return (
        <SectionWrapper className="bg-[#0f172a] text-white py-32">
            <div className="flex flex-col lg:flex-row gap-16 items-center">
                <div className="lg:w-2/5">
                    <span className="text-emerald-400 font-bold tracking-widest text-xs uppercase mb-4 block">Under The Hood</span>
                    <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-6 leading-tight">
                        Automation engine <span className="text-slate-500">built for scale.</span>
                    </h2>
                </div>
                <div className="lg:w-3/5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {engineFeatures.map((f, i) => (
                        <motion.div key={f.title} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="p-6 bg-white/5 border border-slate-800 rounded-3xl hover:border-emerald-500/30 transition-all">
                            <div className="size-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4">
                                <f.icon className="size-5 text-emerald-400" />
                            </div>
                            <h4 className="font-bold text-sm mb-2">{f.title}</h4>
                            <p className="text-slate-400 text-xs leading-relaxed">{f.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </SectionWrapper>
    );
}

/* ─── Platform Capabilities ─── */
function WAPlatform() {
    return (
        <SectionWrapper className="bg-[#f8fafc]">
            <div className="flex flex-col lg:flex-row-reverse gap-16 items-center">
                <div className="lg:w-1/2">
                    <span className="text-emerald-600 font-bold tracking-widest text-xs uppercase mb-4 block">Platform</span>
                    <h2 className="text-4xl md:text-5xl font-black tracking-tight text-[#0f172a] mb-6 leading-tight">
                        Enterprise-grade <span className="text-emerald-600 italic">WhatsApp infrastructure.</span>
                    </h2>
                </div>
                <div className="lg:w-1/2 space-y-4">
                    {[
                        "WhatsApp Business API integration (not personal numbers)",
                        "Multi-agent support (assign conversations to reps)",
                        "Rich media messages (documents, images, PDFs)",
                        "CRM sync: every WhatsApp conversation logged automatically",
                        "Shared inbox for team collaboration",
                    ].map((item, i) => (
                        <motion.div key={item} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }} className="flex items-center gap-3 p-5 bg-white border border-slate-100 rounded-2xl">
                            <CheckCircle className="size-5 text-emerald-600 flex-shrink-0" />
                            <span className="font-bold text-sm text-[#0f172a]">{item}</span>
                        </motion.div>
                    ))}
                </div>
            </div>
        </SectionWrapper>
    );
}

/* ─── Offer Tiers ─── */
const offers = [
    {
        title: "Managed",
        desc: "Full-service WhatsApp SDR operation",
        features: ["AltLeads runs the entire WhatsApp outbound program", "Template creation & approval", "Contact list management", "Send execution & reply routing", "Monthly performance report"],
        highlight: false,
        badge: null,
    },
    {
        title: "Platform-Only",
        desc: "Self-service WhatsApp outbound",
        features: ["Access to AltLeads WhatsApp automation engine", "Template builder with approval workflow", "CRM-integrated messaging", "Analytics dashboard", "Your team runs the day-to-day"],
        highlight: true,
        badge: "Most Popular",
    },
    {
        title: "Hybrid",
        desc: "Best of both worlds",
        features: ["AltLeads manages setup, templates, and compliance", "Your team handles day-to-day sends", "Shared analytics and optimization", "Escalation support for complex scenarios", "Quarterly strategy review"],
        highlight: false,
        badge: null,
    },
];

function WAOffers() {
    return (
        <SectionWrapper className="bg-white">
            <div className="text-center mb-20 max-w-3xl mx-auto">
                <span className="text-emerald-600 font-bold tracking-widest text-xs uppercase mb-4 block">Pricing Models</span>
                <h2 className="text-4xl md:text-5xl font-black tracking-tight text-[#0f172a] mb-6">
                    Choose your <span className="text-emerald-600 italic">engagement model.</span>
                </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {offers.map((offer, i) => (
                    <motion.div key={offer.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                        className={`relative p-10 rounded-[40px] border-2 transition-all ${offer.highlight ? "border-emerald-400 bg-emerald-50/30 shadow-xl shadow-emerald-100/50 scale-[1.02]" : "border-slate-100 bg-[#f8fafc] hover:border-emerald-200"}`}>
                        {offer.badge && (
                            <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white rounded-full shadow-lg">
                                {offer.badge}
                            </span>
                        )}
                        <h3 className="text-2xl font-black text-[#0f172a] mb-2">{offer.title}</h3>
                        <p className="text-slate-500 text-sm font-medium mb-8">{offer.desc}</p>
                        <div className="space-y-3">
                            {offer.features.map(f => (
                                <div key={f} className="flex items-start gap-3">
                                    <CheckCircle className="size-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                                    <span className="text-sm font-medium text-[#0f172a]">{f}</span>
                                </div>
                            ))}
                        </div>
                        <a href="/contact" className={`mt-8 block w-full py-4 text-center font-black rounded-2xl transition-all ${offer.highlight ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-white border border-slate-200 text-[#0f172a] hover:border-emerald-300"}`}>
                            Get Started
                        </a>
                    </motion.div>
                ))}
            </div>
        </SectionWrapper>
    );
}

/* ─── Compliance ─── */
function WACompliance() {
    return (
        <SectionWrapper className="bg-[#0f172a] text-white py-32">
            <div className="flex flex-col lg:flex-row gap-16 items-center">
                <div className="lg:w-1/2">
                    <div className="flex items-center gap-3 mb-6">
                        <Shield className="size-6 text-emerald-400" />
                        <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">Compliance</span>
                    </div>
                    <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-6 leading-tight">
                        Professional-grade <span className="text-slate-500">compliance.</span>
                    </h2>
                    <p className="text-slate-400 text-lg font-medium leading-relaxed">
                        Every message goes through approved templates, rate limiting, and opt-out handling. Built on the official WhatsApp Business API — not personal account workarounds.
                    </p>
                </div>
                <div className="lg:w-1/2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                        { title: "Template approval", desc: "All messages pre-approved by WhatsApp." },
                        { title: "Opt-out handling", desc: "Automatic respect for unsubscribe requests." },
                        { title: "Rate limiting", desc: "Built-in throttling to prevent spam flags." },
                        { title: "Audit trail", desc: "Complete log of every message sent." },
                    ].map((item, i) => (
                        <motion.div key={item.title} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="p-6 bg-white/5 border border-slate-800 rounded-3xl">
                            <h4 className="font-bold text-sm mb-2">{item.title}</h4>
                            <p className="text-slate-400 text-xs leading-relaxed">{item.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </SectionWrapper>
    );
}

/* ─── Pilot CTA ─── */
function WAPilot() {
    return (
        <SectionWrapper className="bg-white text-center relative overflow-hidden py-32 rounded-[60px] mx-4 md:mx-10 mb-20 border-2 border-emerald-100">
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden opacity-10">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[100%] bg-emerald-500 rounded-full blur-[160px]" />
            </div>
            <div className="relative z-10 max-w-3xl mx-auto">
                <span className="text-emerald-600 font-bold tracking-widest text-xs uppercase mb-6 block">Get Started</span>
                <h2 className="text-4xl md:text-6xl font-black tracking-tight text-[#0f172a] mb-8 leading-[1.05]">
                    Start your <span className="text-emerald-600">WhatsApp pilot</span> in 5 days.
                </h2>
                <p className="text-slate-500 text-xl font-medium mb-12">
                    14-day controlled pilot. 500 messages. Full analytics. Real results before commitment.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                    <a href="/contact" className="px-10 py-5 bg-emerald-600 text-white font-black rounded-2xl hover:bg-emerald-700 transition-all shadow-2xl shadow-emerald-100 flex items-center gap-2 group">
                        Start Pilot <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
                    </a>
                    <a href="/contact" className="px-10 py-5 bg-transparent text-[#0f172a] border-2 border-slate-200 font-black rounded-2xl hover:border-emerald-300 transition-all">
                        Talk to Sales
                    </a>
                </div>
            </div>
        </SectionWrapper>
    );
}

/* ─── Page Composition ─── */
export default function WhatsAppPage() {
    return (
        <>
            <WAHero />
            <WAPainPoints />
            <WAWorkflows />
            <WAOrchestration />
            <WASegments />
            <WAEngine />
            <WAPlatform />
            <WAOffers />
            <WACompliance />
            <WAPilot />
        </>
    );
}
