"use client";

import { motion } from "framer-motion";
import SectionWrapper from "../SectionWrapper";
import {
    ArrowRight, MessageSquare, AlertTriangle, Workflow, Share2, FastForward,
    CheckCircle, Layers, Zap, BarChart3, ChevronDown, Shield, Target,
    FileText, Bell, Timer, RefreshCw, Calendar, ThumbsUp, BrainCircuit,
    Settings, Eye, Smartphone, Building, Star, Check, Users, LayoutDashboard
} from "lucide-react";
import { useState } from "react";

/* ─── Hero ─── */
function WAHero() {
    return (
        <section className="relative pt-32 pb-20 overflow-hidden bg-[#0f172a]">
            {/* Cinematic Background */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute inset-0 bg-grid opacity-[0.2]" />
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[100%] bg-emerald-500/20 rounded-full blur-[120px] animate-pulse" />
            </div>

            <div className="max-w-[1280px] mx-auto px-4 md:px-10 relative z-10 w-full">
                <div className="flex flex-col items-center text-center">
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-10">
                        <MessageSquare className="size-3 text-emerald-400" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">WhatsApp Orchestration</span>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
                        className="text-[36px] md:text-[80px] font-black headline-premium text-white leading-[0.95] mb-10 max-w-5xl"
                    >
                        Conversational outbound that <span className="text-emerald-400 italic">scales with you.</span>
                    </motion.h1>

                    <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }} className="text-lg md:text-2xl font-medium text-slate-400 max-w-3xl mb-12 leading-relaxed">
                        Control your WhatsApp outreach with the same precision as email. Automated flows, verified templates, and human-in-the-loop orchestration.
                    </motion.p>

                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="flex flex-col sm:flex-row items-center gap-6">
                        <a href="/contact" className="px-12 py-5 bg-emerald-600 text-white font-black rounded-2xl hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-500/20 flex items-center gap-3 group glow-on-hover">
                            Request Early Access <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
                        </a>
                        <a href="#wa-workflows" className="px-10 py-5 bg-white/5 text-white border border-white/10 font-black rounded-2xl hover:bg-white/10 transition-all flex items-center gap-3">
                            View Workflow Library
                        </a>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}

/* ─── Pain Points ─── */
const painPointsList = [
    { icon: AlertTriangle, title: "Risk of Bans", desc: "Traditional tools trigger WhatsApp's spam detection. We use verified API orchestration to stay compliant." },
    { icon: Workflow, title: "Broken Workflows", desc: "WhatsApp often sits in a silo. We integrate it directly into your main outbound OS pipeline." },
    { icon: Share2, title: "Lack of Oversight", desc: "No clear reporting on what's working. AltLeads provides full transparency on every conversation." },
    { icon: FastForward, title: "Slow Response", desc: "Manual replies kill momentum. Our automation engine ensures instant follow-ups at scale." },
];

function WAPainPoints() {
    return (
        <SectionWrapper id="wa-pain" className="bg-[#f8fafc]">
            <div className="text-center mb-24 max-w-4xl mx-auto">
                <span className="text-emerald-600 font-black tracking-[0.2em] text-[10px] uppercase mb-6 block">The Challenge</span>
                <h2 className="text-4xl md:text-7xl font-black headline-premium text-[#0f172a] mb-8 leading-[0.95]">
                    Outreach has <span className="text-emerald-600 italic">evolved.</span>
                </h2>
                <p className="text-slate-500 text-xl font-medium">B2B is moving to mobile. Most tools just can't keep up.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {painPointsList.map((point, i) => (
                    <motion.div key={point.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="p-10 bg-white border border-slate-100 rounded-[48px] hover:shadow-2xl hover:-translate-y-1 transition-all group flex gap-8 items-start">
                        <div className="size-16 rounded-[24px] bg-emerald-50 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-600 transition-colors shadow-sm">
                            <point.icon className="size-8 text-emerald-600 group-hover:text-white transition-colors" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-[#0f172a] mb-3 leading-tight">{point.title}</h3>
                            <p className="text-slate-500 font-medium leading-relaxed">{point.desc}</p>
                        </div>
                    </motion.div>
                ))}
            </div>
        </SectionWrapper>
    );
}
/* ─── Workflow Library ─── */
const workflows = [
    { icon: Calendar, title: "Meeting confirmations", desc: "Auto-confirm via WhatsApp after scheduling to ensure high show rates." },
    { icon: Bell, title: "Reminder nudges", desc: "Intelligent 24h and 1h pre-meeting reminders that drive attendance." },
    { icon: RefreshCw, title: "Reschedule flows", desc: "Quick reschedule link for no-shows, keeping the conversation alive." },
    { icon: Timer, title: "Post-meeting follow-ups", desc: "Next-step confirmation and document sharing via mobile." },
    { icon: ThumbsUp, title: "Dormant re-activation", desc: "Re-engage cold leads with subtle, non-spammy mobile nudges." },
    { icon: Target, title: "Event/webinar invites", desc: "High-intent personal invites with tracking." },
];

function WAWorkflows() {
    return (
        <SectionWrapper id="wa-workflows" className="bg-white relative overflow-hidden">
            <div className="absolute inset-0 bg-grid opacity-[0.2] pointer-events-none" />
            <div className="text-center mb-24 max-w-4xl mx-auto relative z-10">
                <span className="text-emerald-600 font-black tracking-[0.2em] text-[10px] uppercase mb-6 block">The Library</span>
                <h2 className="text-4xl md:text-7xl font-black headline-premium text-[#0f172a] mb-8 leading-[0.95]">
                    Playbooks for <span className="text-emerald-600 italic">every touch.</span>
                </h2>
                <p className="text-slate-500 text-xl font-medium">Pre-built, compliant, and ready to deploy in minutes.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                {workflows.map((w, i) => (
                    <motion.div key={w.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="p-10 bg-[#f8fafc] border border-slate-100 rounded-[48px] hover:border-emerald-200 hover:shadow-2xl hover:-translate-y-1 transition-all group">
                        <div className="size-14 rounded-[20px] bg-white flex items-center justify-center mb-8 group-hover:bg-emerald-600 transition-colors shadow-sm">
                            <w.icon className="size-7 text-emerald-600 group-hover:text-white transition-colors" />
                        </div>
                        <h3 className="text-2xl font-black text-[#0f172a] mb-3">{w.title}</h3>
                        <p className="text-slate-500 text-sm font-medium leading-relaxed">{w.desc}</p>
                    </motion.div>
                ))}
            </div>
        </SectionWrapper>
    );
}

/* ─── Orchestration ─── */
function WAOrchestration() {
    return (
        <SectionWrapper className="bg-[#f8fafc] relative overflow-hidden">
            <div className="flex flex-col lg:flex-row gap-20 items-center">
                <div className="lg:w-1/2">
                    <span className="text-emerald-600 font-black tracking-[0.2em] text-[10px] uppercase mb-6 block">Unified Flow</span>
                    <h2 className="text-4xl md:text-7xl font-black headline-premium text-[#0f172a] mb-8 leading-[0.95]">
                        Multi-channel <span className="text-emerald-600 italic">orchestration.</span>
                    </h2>
                    <p className="text-slate-500 text-xl font-medium leading-relaxed">
                        WhatsApp works best when orchestrated alongside email and LinkedIn — not as a standalone blast tool.
                    </p>
                </div>
                <div className="lg:w-1/2 w-full">
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="p-12 bg-[#0f172a] rounded-[64px] border border-white/10 shadow-3xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px]" />
                        <h4 className="font-black text-xs text-emerald-400 uppercase tracking-widest mb-10 relative z-10">Sequence Example</h4>
                        <div className="space-y-6 relative z-10">
                            {[
                                { day: "D1", ch: "Email", action: "Intro & Value" },
                                { day: "D3", ch: "LinkedIn", action: "Connect & Engagement" },
                                { day: "D5", ch: "WhatsApp", action: "Structured Nudge" },
                                { day: "D8", ch: "Email", action: "Contextual Follow-up" },
                            ].map((step, i) => (
                                <div key={i} className="flex items-center gap-6 group">
                                    <span className="text-[10px] font-black text-slate-500 w-10">{step.day}</span>
                                    <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${step.ch === "WhatsApp" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-white/5 border-white/10 text-slate-400"}`}>{step.ch}</div>
                                    <span className="text-white font-bold">{step.action}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>
        </SectionWrapper>
    );
}

/* ─── Segments ─── */
const segments = [
    { icon: Users, title: "SDR / BDR Teams", desc: "Running high-velocity outbound where WhatsApp is a structured, compliant touchpoint." },
    { icon: Building, title: "Field Sales Orgs", desc: "Using WhatsApp for meeting confirmations, location sharing, and real-time follow-ups." },
    { icon: Target, title: "Account-based Teams", desc: "Personalizing mobile outreach for high-value targets within multi-channel plays." },
];

function WASegments() {
    return (
        <SectionWrapper className="bg-white">
            <div className="text-center mb-24 max-w-4xl mx-auto">
                <span className="text-emerald-600 font-black tracking-[0.2em] text-[10px] uppercase mb-6 block">Applications</span>
                <h2 className="text-4xl md:text-7xl font-black headline-premium text-[#0f172a] mb-8 leading-[0.95]">
                    Built for your <span className="text-emerald-600 italic">entire team.</span>
                </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {segments.map((s, i) => (
                    <div key={s.title} className="p-10 bg-[#f8fafc] border border-slate-100 rounded-[48px] hover:border-emerald-200 transition-all">
                        <div className="size-14 rounded-2xl bg-white border border-slate-50 flex items-center justify-center mb-8 shadow-sm">
                            <s.icon className="size-7 text-emerald-600" />
                        </div>
                        <h3 className="text-2xl font-black text-[#0f172a] mb-4">{s.title}</h3>
                        <p className="text-slate-500 text-sm font-medium leading-relaxed">{s.desc}</p>
                    </div>
                ))}
            </div>
        </SectionWrapper>
    );
}

/* ─── Automation Engine ─── */
function WAEngine() {
    return (
        <SectionWrapper id="wa-engine" className="bg-[#0f172a] text-white py-40 relative overflow-hidden">
            <div className="absolute inset-0 bg-grid opacity-[0.2] pointer-events-none" />
            <div className="flex flex-col lg:flex-row gap-20 items-center relative z-10">
                <div className="lg:w-1/2">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="size-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                            <Zap className="size-6 text-emerald-400" />
                        </div>
                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">The Engine</span>
                    </div>
                    <h2 className="text-4xl md:text-7xl font-black headline-premium mb-8 leading-[0.95]">
                        High-intent <span className="text-emerald-400">automation.</span>
                    </h2>
                    <p className="text-slate-400 text-xl font-medium leading-relaxed mb-10">
                        Our engine handles the routine so your team can handle the relationships. Verified templates, automated rules, and instant triggers.
                    </p>
                </div>
                <div className="lg:w-1/2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                        { title: "Verified BSPA API", desc: "No bans. No gray-market tools. Full compliance." },
                        { title: "Logic-based Triggers", desc: "Messages sent based on specific lead behavior." },
                        { title: "Unified Inbox", desc: "Manage all WhatsApp responses in one central dashboard." },
                        { title: "Automated Rescheduling", desc: "Drive show-rates with instant re-booking links." },
                    ].map((item, i) => (
                        <div key={item.title} className="p-8 bg-white/5 border border-white/10 rounded-[32px] hover:border-emerald-500/30 transition-all group">
                            <h4 className="font-black text-lg mb-2 group-hover:text-emerald-400 transition-colors">{item.title}</h4>
                            <p className="text-slate-500 text-sm font-medium leading-relaxed">{item.desc}</p>
                        </div>
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
            <div className="flex flex-col lg:flex-row-reverse gap-24 items-center">
                <div className="lg:w-1/2">
                    <span className="text-emerald-600 font-black tracking-[0.2em] text-[10px] uppercase mb-6 block">Capabilities</span>
                    <h2 className="text-4xl md:text-7xl font-black headline-premium text-[#0f172a] mb-8 leading-[0.95]">
                        Enterprise-grade <span className="text-emerald-600 italic">infrastructure.</span>
                    </h2>
                    <p className="text-slate-500 text-xl font-medium leading-relaxed mb-10">
                        Built for scale and security. AltLeads provides the backbone for professional mobile outreach.
                    </p>
                </div>
                <div className="lg:w-1/2 grid grid-cols-1 gap-4 w-full">
                    {[
                        { title: "Official WhatsApp Business API", desc: "No personal accounts. No risk of spoofing." },
                        { title: "Multi-Agent Routing", desc: "Seamlessly route conversations to the right rep." },
                        { title: "Full Rich Media", desc: "Send PDFs, brochures, and dynamic links at scale." },
                        { title: "Bi-directional Sync", desc: "Every reply is instantly logged to your core CRM." },
                    ].map((item, i) => (
                        <motion.div key={item.title} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} className="flex items-start gap-5 p-8 bg-white border border-slate-100 rounded-[32px] hover:shadow-xl transition-all group">
                            <div className="size-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-600 transition-colors">
                                <Check className="size-5 text-emerald-600 group-hover:text-white" />
                            </div>
                            <div>
                                <h4 className="text-lg font-black text-[#0f172a] mb-1">{item.title}</h4>
                                <p className="text-slate-500 text-sm font-medium">{item.desc}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </SectionWrapper>
    );
}

/* ─── Offer Tiers ─── */
const offersList = [
    {
        title: "Managed",
        desc: "Full-service mobile operation",
        features: ["Scale to 1,000+ personal touches/mo", "Template creation & compliance", "Custom logic & routing", "Monthly performance report"],
        highlight: false,
    },
    {
        title: "Platform-Only",
        desc: "Self-service mobile automation",
        features: ["Access to AltLeads automation engine", "Drag-and-drop workflow builder", "CRM-integrated inbox", "Analytics dashboard"],
        highlight: true,
        badge: "Growth Choice",
    },
    {
        title: "Enterprise",
        desc: "Global multi-team setup",
        features: ["Multi-account management", "SSO & Advanced Security", "Dedicated Account Manager", "Priority support & custom SLA"],
        highlight: false,
    },
];

function WAOffers() {
    return (
        <SectionWrapper className="bg-white">
            <div className="text-center mb-24 max-w-4xl mx-auto">
                <span className="text-emerald-600 font-black tracking-[0.2em] text-[10px] uppercase mb-6 block">Pricing</span>
                <h2 className="text-4xl md:text-7xl font-black headline-premium text-[#0f172a] mb-8 leading-[0.95]">
                    Built for <span className="text-emerald-600 italic">your scale.</span>
                </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {offersList.map((offer, i) => (
                    <motion.div key={offer.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                        className={`relative p-12 rounded-[56px] border-2 transition-all flex flex-col ${offer.highlight ? "border-emerald-600 bg-emerald-50/20 shadow-3xl scale-[1.05] z-10" : "border-slate-100 bg-[#f8fafc] hover:border-emerald-200"}`}>
                        {offer.badge && (
                            <span className="absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-2 text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white rounded-full shadow-lg">
                                {offer.badge}
                            </span>
                        )}
                        <h3 className="text-3xl font-black text-[#0f172a] mb-2">{offer.title}</h3>
                        <p className="text-slate-500 font-medium mb-10">{offer.desc}</p>
                        <div className="space-y-4 mb-12 flex-grow">
                            {offer.features.map(f => (
                                <div key={f} className="flex items-start gap-4">
                                    <CheckCircle className="size-5 text-emerald-600 flex-shrink-0" />
                                    <span className="text-sm font-bold text-slate-700 leading-tight">{f}</span>
                                </div>
                            ))}
                        </div>
                        <a href="/contact" className={`block w-full py-5 text-center font-black rounded-2xl transition-all ${offer.highlight ? "bg-emerald-600 text-white hover:bg-emerald-500 shadow-xl shadow-emerald-500/20" : "bg-white border border-slate-200 text-[#0f172a] hover:border-emerald-300"}`}>
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
        <SectionWrapper className="bg-[#0f172a] text-white py-40 relative overflow-hidden">
            <div className="absolute inset-0 bg-grid opacity-[0.2] pointer-events-none" />
            <div className="flex flex-col lg:flex-row gap-24 items-center relative z-10">
                <div className="lg:w-1/2">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="size-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                            <Shield className="size-6 text-emerald-400" />
                        </div>
                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">Compliance</span>
                    </div>
                    <h2 className="text-4xl md:text-7xl font-black headline-premium mb-8 leading-[0.95]">
                        Safety first <span className="text-emerald-400">always.</span>
                    </h2>
                    <p className="text-slate-400 text-xl font-medium leading-relaxed">
                        Risk management is built into our DNA. From template pre-approvals to intelligent throttling, we keep your account healthy.
                    </p>
                </div>
                <div className="lg:w-1/2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                        { title: "Meta Approved", desc: "Official API integration with full Meta compliance." },
                        { title: "Opt-out Logic", desc: "Automatic respect for unsubscribe triggers." },
                        { title: "Audit Trail", desc: "Minute-by-minute logs for security audits." },
                        { title: "Secure Data", desc: "End-to-end encryption for all mobile traffic." },
                    ].map((item, i) => (
                        <div key={item.title} className="p-10 bg-white/5 border border-white/10 rounded-[40px] hover:border-emerald-500/30 transition-all">
                            <h4 className="font-black text-xl mb-3">{item.title}</h4>
                            <p className="text-slate-500 text-sm font-medium leading-relaxed">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </SectionWrapper>
    );
}

/* ─── FAQ ─── */
const waFaqs = [
    { q: "Is this legal?", a: "Yes. We use the official WhatsApp Business API. Every message follows Meta's template guidelines and requires lead opt-in." },
    { q: "Will my number get banned?", a: "Unlike mass-blasting tools, we focus on high-intent orchestration with verified templates which Meta encourages." },
    { q: "Do I need to manage the replies?", a: "You can either manage them in our unified inbox, or we can route them directly to your CRM for your reps." },
    { q: "What's the setup time?", a: "Typically 3-5 days for API verification and initial template approval." },
];

function WAFAQ() {
    const [openIndex, setOpenIndex] = useState(null);
    return (
        <SectionWrapper className="bg-white">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-24">
                    <span className="text-emerald-600 font-black tracking-[0.2em] text-[10px] uppercase mb-6 block">Questions</span>
                    <h2 className="text-4xl md:text-7xl font-black headline-premium text-[#0f172a] leading-[0.95]">
                        Common <span className="text-emerald-600 italic">concerns.</span>
                    </h2>
                </div>
                <div className="space-y-4">
                    {waFaqs.map((faq, i) => (
                        <div key={i} className="border border-slate-100 rounded-[32px] bg-[#f8fafc] overflow-hidden transition-all hover:border-emerald-200">
                            <button onClick={() => setOpenIndex(openIndex === i ? null : i)} className="w-full p-8 text-left flex items-center justify-between group">
                                <span className="text-xl font-black text-[#0f172a] group-hover:text-emerald-600 transition-colors pr-8">{faq.q}</span>
                                <ChevronDown className={`size-6 text-slate-400 transition-transform flex-shrink-0 ${openIndex === i ? "rotate-180" : ""}`} />
                            </button>
                            <motion.div initial={false} animate={{ height: openIndex === i ? "auto" : 0, opacity: openIndex === i ? 1 : 0 }} className="overflow-hidden">
                                <div className="p-8 pt-0 text-slate-500 font-medium leading-relaxed leading-relaxed border-t border-slate-200/50 mt-2">
                                    {faq.a}
                                </div>
                            </motion.div>
                        </div>
                    ))}
                </div>
            </div>
        </SectionWrapper>
    );
}

/* ─── Pilot CTA ─── */
function WAPilot() {
    return (
        <SectionWrapper className="bg-white text-center relative py-40 rounded-[80px] mx-4 md:mx-10 mb-20 border-2 border-emerald-100 shadow-2xl shadow-emerald-500/5">
            <div className="absolute inset-0 bg-grid opacity-[0.2] pointer-events-none" />
            <div className="relative z-10 max-w-4xl mx-auto px-6">
                <span className="text-emerald-600 font-black tracking-[0.2em] text-[10px] uppercase mb-8 block">Next Steps</span>
                <h2 className="text-4xl md:text-8xl font-black headline-premium text-[#0f172a] mb-10 leading-[0.9]">
                    The <span className="text-emerald-600">WhatsApp Pilot.</span>
                </h2>
                <p className="text-slate-500 text-xl md:text-2xl font-medium mb-16 max-w-2xl mx-auto leading-relaxed">
                    14 days. 500 high-intent messages. Real revenue potential. No long-term commitment.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
                    <a href="/contact" className="px-12 py-6 bg-emerald-600 text-white font-black rounded-3xl hover:bg-emerald-500 transition-all shadow-2xl shadow-emerald-500/20 flex items-center gap-4 group text-lg">
                        Start Pilot <ArrowRight className="size-6 group-hover:translate-x-1 transition-transform" />
                    </a>
                    <a href="/contact" className="px-10 py-6 bg-transparent text-[#0f172a] border-2 border-slate-200 font-black rounded-3xl hover:border-emerald-300 transition-all text-lg">
                        Talk to Strategy
                    </a>
                </div>
            </div>
        </SectionWrapper>
    );
}

/* ─── Bottom CTA ─── */
function WABottomCTA() {
    return (
        <section className="bg-[#0f172a] py-40 relative overflow-hidden">
            <div className="absolute inset-0 bg-grid opacity-[0.1]" />
            <div className="max-w-[1280px] mx-auto px-4 md:px-10 relative z-10 text-center">
                <h2 className="text-[40px] md:text-[100px] font-black headline-premium text-white leading-[0.9] mb-12">
                    Level up your <span className="text-emerald-400 italic">outreach.</span>
                </h2>
                <a href="/contact" className="inline-flex items-center gap-4 px-16 py-8 bg-emerald-600 text-white font-black text-2xl rounded-full hover:bg-emerald-500 transition-all shadow-3xl shadow-emerald-500/20 glow-on-hover">
                    Get Early Access <ArrowRight className="size-8" />
                </a>
            </div>
        </section>
    );
}

/* ─── Page Composition ─── */
export default function WhatsAppPage() {
    return (
        <main className="bg-white">
            <WAHero />
            <WAPainPoints />
            <WAWorkflows />
            <WAOrchestration />
            <WASegments />
            <WAEngine />
            <WAPlatform />
            <WAOffers />
            <WACompliance />
            <WAFAQ />
            <WAPilot />
            <WABottomCTA />
        </main>
    );
}
