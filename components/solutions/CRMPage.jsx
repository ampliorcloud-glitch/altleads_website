"use client";

import { motion } from "framer-motion";
import SectionWrapper from "../SectionWrapper";
import {
    ArrowRight, Play, Monitor, Smartphone, Database, Filter, Calendar, UserCheck, Handshake,
    RefreshCw, LayoutDashboard, Users, Bell, FileText, BarChart3, CheckCircle, Zap, Star,
    AlertTriangle, Target, ChevronDown, Share2, School, Rocket, MapPin, Clock, Wifi, Check, Settings
} from "lucide-react";
import { useState } from "react";

/* ─── Hero ─── */
function CRMHero() {
    return (
        <section className="relative pt-32 pb-20 overflow-hidden bg-[#0f172a]">
            {/* Cinematic Background Mesh & Grid */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute inset-0 bg-grid opacity-[0.2]" />
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[100%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[100%] bg-blue-500/10 rounded-full blur-[140px]" />
            </div>

            <div className="max-w-[1280px] mx-auto px-4 md:px-10 relative z-10 w-full">
                <div className="flex flex-col items-center text-center">
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-10">
                        <Monitor className="size-3 text-primary" />
                        <span className="text-[10px] font-black text-primary tracking-[0.2em] uppercase leading-none">The Outbound OS</span>
                    </motion.div>
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                        className="text-[36px] md:text-[80px] leading-[0.95] font-black headline-premium text-white mb-10 max-w-5xl"
                    >
                        A CRM designed for <span className="text-primary italic">outbound execution</span> — not just record keeping.
                    </motion.h1>
                    <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-lg md:text-2xl text-slate-400 max-w-3xl mb-12 font-medium leading-relaxed">
                        AltLeads CRM is a workflow-first system built for the handoff between backend qualification and frontend sales execution. Web dashboard for ops. Mobile app for field reps.
                    </motion.p>
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex flex-col sm:flex-row items-center gap-6">
                        <a href="/contact" className="px-12 py-5 bg-primary text-white font-black rounded-2xl hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 flex items-center gap-3 group glow-on-hover">
                            Book a Demo <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
                        </a>
                        <a href="#crm-workflow" className="px-10 py-5 bg-white/5 text-white border border-white/10 font-black rounded-2xl hover:bg-white/10 transition-all flex items-center gap-3">
                            <div className="size-6 rounded-full bg-white/10 flex items-center justify-center">
                                <Play className="size-3 fill-white text-white" />
                            </div>
                            See 2-Min Tour
                        </a>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}

/* ─── Problem ─── */
const crmPainPoints = [
    { icon: AlertTriangle, title: "Execution leakage", desc: "Leads enter but don't move. Follow-ups and assignments remain manual, inconsistent, and invisible.", color: "text-primary", bg: "bg-primary/10" },
    { icon: Target, title: "Handoff friction", desc: "The gap between qualification and sales is where pipeline dies. Reps lack the pre-meeting context they need.", color: "text-blue-500", bg: "bg-blue-500/10" },
    { icon: Users, title: "Zero field visibility", desc: "Managers can't see what actually happened in the room — resulting in poor coaching and lost intelligence.", color: "text-violet-500", bg: "bg-violet-500/10" },
];

function CRMProblem() {
    return (
        <SectionWrapper id="crm-problem" className="bg-[#0f172a] text-white py-32 border-t border-white/5 relative overflow-hidden">
            <div className="absolute inset-0 bg-grid opacity-[0.2] pointer-events-none" />
            <div className="flex flex-col lg:flex-row gap-20 items-center relative z-10">
                <div className="lg:w-1/2">
                    <span className="text-primary font-black tracking-[0.2em] text-[10px] uppercase mb-6 block">The Gap</span>
                    <h2 className="text-4xl md:text-6xl font-black headline-premium text-white mb-8 leading-[0.95]">
                        Your CRM stores data. <br /><span className="text-slate-500">It doesn't run the motion.</span>
                    </h2>
                    <p className="text-slate-400 text-lg md:text-xl leading-relaxed max-w-xl">
                        Generic CRMs are generic. AltLeads is purpose-built for high-performance B2B teams where every meeting and every follow-up must be disciplined.
                    </p>
                </div>
                <div className="lg:w-1/2 grid grid-cols-1 gap-4 w-full">
                    {crmPainPoints.map((point, i) => (
                        <motion.div key={point.title} initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="p-8 bg-white/5 border border-white/10 rounded-3xl group flex gap-6 items-start">
                            <div className={`size-12 rounded-xl ${point.bg} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                                <point.icon className={`size-6 ${point.color}`} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold mb-2">{point.title}</h3>
                                <p className="text-slate-400 text-sm leading-relaxed font-medium">{point.desc}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </SectionWrapper>
    );
}

/* ─── 5-Step Workflow ─── */
const workflowSteps = [
    { icon: Filter, step: "01", title: "Intake", desc: "Lead management with rich profiles, history, and conflict detection." },
    { icon: Calendar, step: "02", title: "Orchestrate", desc: "Qualified leads assigned to territory with customizable questionnaires." },
    { icon: UserCheck, step: "03", title: "Execute", desc: "Reps receive pre-meeting context, history, and status alerts." },
    { icon: Handshake, step: "04", title: "Feedback", desc: "Mandatory structured feedback loop directly from the field sales app." },
    { icon: RefreshCw, step: "05", title: "Recycle", desc: "Unqualified leads re-enter multi-channel nurture cadences." },
];

function CRMWorkflow() {
    return (
        <SectionWrapper id="crm-workflow" className="bg-white relative overflow-hidden">
            <div className="absolute inset-0 bg-grid opacity-[0.2] pointer-events-none" />
            <div className="text-center mb-24 max-w-4xl mx-auto relative z-10">
                <span className="text-primary font-black tracking-[0.2em] text-[10px] uppercase mb-6 block px-4 py-1.5 bg-primary/5 rounded-full w-fit mx-auto border border-primary/10">The Motion</span>
                <h2 className="text-4xl md:text-7xl font-black headline-premium text-[#0f172a] mb-8 leading-[0.95]">
                    5 steps. <span className="text-primary italic">One closed loop.</span>
                </h2>
                <p className="text-slate-500 text-lg md:text-2xl font-medium max-w-2xl mx-auto">From backend qualification to meeting completion — intelligence stays in the system.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-8 relative z-10">
                {workflowSteps.map((step, i) => (
                    <motion.div key={step.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="p-10 bg-white border border-slate-100 rounded-[48px] hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-2 transition-all group text-center">
                        <span className="text-6xl font-black text-slate-50 mb-6 block group-hover:text-primary/10 transition-colors">{step.step}</span>
                        <div className="size-16 rounded-[24px] bg-primary/5 flex items-center justify-center mx-auto mb-6 group-hover:bg-primary transition-colors">
                            <step.icon className="size-8 text-primary group-hover:text-white transition-colors" />
                        </div>
                        <h3 className="text-xl font-bold text-[#0f172a] mb-3">{step.title}</h3>
                        <p className="text-slate-500 text-xs leading-relaxed font-bold tracking-tight opacity-80">{step.desc}</p>
                    </motion.div>
                ))}
            </div>
        </SectionWrapper>
    );
}

/* ─── Web CRM Features ─── */
const webFeatures = [
    { icon: LayoutDashboard, title: "Lead Intake Dashboard", desc: "Centralized management of leads from web, CSV, or direct APIs." },
    { icon: Users, title: "Assignment Engine", desc: "Smart territory assignment and stakeholder mapping across teams." },
    { icon: FileText, title: "Custom Questionnaires", desc: "Domain-specific qualification forms that reps must address." },
    { icon: Bell, title: "Conflict Detection", desc: "Multi-client safe workflows to prevent prospect overlap." },
    { icon: BarChart3, title: "Feedback Analytics", desc: "Translate meeting outcomes into pattern analysis for coaching." },
    { icon: Star, title: "Campaign Hub", desc: "Manage multi-channel outreach across Email, LI, WA, and calls." },
];

function WebCRMFeatures() {
    return (
        <SectionWrapper id="web-crm" className="bg-[#f8fafc]">
            <div className="flex flex-col lg:flex-row gap-16 items-center">
                <div className="lg:w-2/5">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="size-12 rounded-2xl bg-primary-light flex items-center justify-center">
                            <Monitor className="size-6 text-primary" />
                        </div>
                        <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Backend Dash</span>
                    </div>
                    <h2 className="text-4xl md:text-6xl font-black headline-premium text-[#0f172a] mb-8 leading-[0.95]">
                        Ops team <span className="text-primary italic">command center.</span>
                    </h2>
                    <p className="text-slate-500 text-xl font-medium leading-relaxed">
                        Control lead management, stakeholder mapping, and questionnaire design from a unified dashboard designed for speed and visibility.
                    </p>
                </div>
                <div className="lg:w-3/5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {webFeatures.map((f, i) => (
                        <motion.div key={f.title} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }} className="p-8 bg-white border border-slate-100 rounded-[40px] hover:shadow-xl hover:border-primary/20 transition-all group">
                            <div className="size-12 rounded-2xl bg-primary/5 flex items-center justify-center mb-6 group-hover:bg-primary transition-colors">
                                <f.icon className="size-6 text-primary group-hover:text-white transition-colors" />
                            </div>
                            <h4 className="font-bold text-[#0f172a] mb-2 text-lg">{f.title}</h4>
                            <p className="text-slate-500 text-sm leading-relaxed font-medium">{f.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </SectionWrapper>
    );
}

/* ─── Mobile App Features ─── */
const mobileFeatures = [
    { icon: Bell, title: "Meeting Alerts", desc: "Accept, reschedule, or review meeting context in one tap." },
    { icon: Calendar, title: "Pre-Meeting History", desc: "Full history of touches, lead responses, and signals." },
    { icon: MapPin, title: "Geo-Tagged Reminders", desc: "Territory-aware check-ins and verified meeting attendance." },
    { icon: FileText, title: "Mandatory Feedback", desc: "Structured outcome forms required after every interaction." },
    { icon: Smartphone, title: "Rep ↔ Ops Messenger", desc: "Seamless communication between field and backend Hub." },
    { icon: Wifi, title: "Offline Persistence", desc: "Works without signal; syncs automatically when reconnected." },
];

function MobileAppFeatures() {
    return (
        <SectionWrapper id="mobile-app" className="bg-white">
            <div className="flex flex-col lg:flex-row-reverse gap-16 items-center">
                <div className="lg:w-2/5">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="size-12 rounded-2xl bg-violet-50 flex items-center justify-center">
                            <Smartphone className="size-6 text-violet-600" />
                        </div>
                        <span className="text-[10px] font-black text-violet-600 uppercase tracking-[0.2em]">Field App</span>
                    </div>
                    <h2 className="text-4xl md:text-6xl font-black headline-premium text-[#0f172a] mb-8 leading-[0.95]">
                        Reps stay <span className="text-violet-600 italic">in the flow.</span>
                    </h2>
                    <p className="text-slate-500 text-xl font-medium leading-relaxed">
                        A lightweight mobile app that treats field reps like elite operators. No manual logging — just structured execution and instant sync.
                    </p>
                </div>
                <div className="lg:w-3/5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {mobileFeatures.map((f, i) => (
                        <motion.div key={f.title} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }} className="p-8 bg-slate-50/50 border border-slate-100 rounded-[40px] hover:border-violet-200 hover:shadow-xl transition-all group">
                            <div className="size-12 rounded-2xl bg-violet-50 flex items-center justify-center mb-6 group-hover:bg-violet-600 transition-colors">
                                <f.icon className="size-6 text-violet-600 group-hover:text-white transition-colors" />
                            </div>
                            <h4 className="font-bold text-[#0f172a] mb-2 text-lg">{f.title}</h4>
                            <p className="text-slate-500 text-sm leading-relaxed font-medium">{f.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </SectionWrapper>
    );
}

/* ─── Differentiator ─── */
const diffPoints = [
    { title: "Aligned for Backend + Sales", desc: "Optimized for the handoff where deals traditionally die." },
    { title: "Structured Intel, Not Notes", desc: "Enforced questionnaire data instead of messy free-text." },
    { title: "Mandatory Feedback Loops", desc: "Ensures no campaign is run without outcome visibility." },
    { title: "Multi-Client Safe (Agencies)", desc: "Built to run complex, multi-account environments flawlessly." },
];

function CRMDifferentiator() {
    return (
        <SectionWrapper id="crm-diff" className="bg-[#0f172a] text-white py-32 rounded-[60px] mx-4 md:mx-10 my-20">
            <div className="flex flex-col lg:flex-row gap-16 items-center">
                <div className="lg:w-1/2">
                    <span className="text-primary font-black tracking-[0.2em] text-[10px] uppercase mb-6 block">Why AltLeads</span>
                    <h2 className="text-4xl md:text-6xl font-black headline-premium text-white mb-8 leading-[0.95]">
                        Workflow-first <br /><span className="text-slate-500">for execution teams.</span>
                    </h2>
                    <p className="text-slate-400 text-lg md:text-xl font-medium leading-relaxed mb-8">
                        AltLeads CRM isn't trying to be a generic suite. It's a purpose-built OS for the B2B sales motion.
                    </p>
                </div>
                <div className="lg:w-1/2 grid grid-cols-1 gap-4 w-full">
                    {diffPoints.map((point, i) => (
                        <motion.div key={point.title} initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="flex items-center gap-6 p-8 bg-white/5 border border-white/10 rounded-[32px] hover:border-primary/30 transition-all">
                            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <CheckCircle className="size-5 text-primary" />
                            </div>
                            <div>
                                <h4 className="font-bold text-lg text-white mb-1">{point.title}</h4>
                                <p className="text-slate-400 text-sm font-medium">{point.desc}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </SectionWrapper>
    );
}

/* ─── Onboarding ─── */
const onboardingSteps = [
    { day: "Phase 1", title: "Setup & Roles", desc: "Define territory rules, user permissions, and campaigns.", icon: Settings },
    { day: "Phase 2", title: "Data Import", desc: "Seamless migration of leads and account history into AltLeads.", icon: Database },
    { day: "Phase 3", title: "Ops Training", desc: "Dashboard onboarding for your backend coordinators.", icon: School },
    { day: "Phase 4", title: "Pilot Go-Live", desc: "Sales app onboarding and live rollout of first campaign.", icon: Rocket },
];

function CRMOnboarding() {
    return (
        <SectionWrapper id="crm-onboarding" className="bg-white">
            <div className="text-center mb-24 max-w-4xl mx-auto">
                <span className="text-primary font-black tracking-[0.2em] text-[10px] uppercase mb-6 block">Structured Rollout</span>
                <h2 className="text-4xl md:text-7xl font-black headline-premium text-[#0f172a] mb-8 leading-[0.95]">
                    Go live in <span className="text-primary italic">2 weeks.</span>
                </h2>
                <p className="text-slate-500 text-xl font-medium">Most teams start with a focused setup and pilot rollout in about 14 days.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {onboardingSteps.map((step, i) => (
                    <motion.div key={step.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="p-10 bg-[#f8fafc] border border-slate-100 rounded-[48px] shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all group">
                        <div className="flex justify-between items-start mb-8">
                            <div className="size-14 rounded-[20px] bg-white flex items-center justify-center group-hover:bg-primary transition-colors shadow-sm">
                                <step.icon className="size-7 text-primary group-hover:text-white transition-colors" />
                            </div>
                            <span className="text-[10px] font-black text-primary bg-primary/5 px-4 py-1.5 rounded-full uppercase tracking-widest border border-primary/10">{step.day}</span>
                        </div>
                        <h3 className="text-2xl font-black text-[#0f172a] mb-3">{step.title}</h3>
                        <p className="text-slate-500 text-sm leading-relaxed font-medium">{step.desc}</p>
                    </motion.div>
                ))}
            </div>
        </SectionWrapper>
    );
}

/* ─── FAQ ─── */
const crmFaqs = [
    { k: "How is AltLeads CRM different from Salesforce/HubSpot?", v: "AltLeads is purpose-built for the handoff between qualification and field sales. While traditional CRMs store records, we control the workflow, enforce feedback loops, and design mobile experiences specifically for field reps." },
    { k: "Can we customize the questionnaires for our industry?", v: "Absolutely. You can design domain-specific intake forms and qualification questionnaires that your team must address as part of their workflow." },
    { k: "What happens if a sales rep doesn't submit feedback?", v: "AltLeads enforces status compliance. Managers have clear visibility on pending feedback, and it can be set as a blocker for accepting new high-intent meetings." },
    { k: "Can it work for multiple clients without conflict?", v: "Yes. Our architecture is multi-client safe, making it perfect for agencies or services teams running outreach for different accounts/brands." },
    { k: "Does it work offline?", v: "Yes. The field sales app is built for low-connectivity environments. Everything is cached locally and synced automatically when back online." },
];

function CRMFAQ() {
    const [openIndex, setOpenIndex] = useState(0);
    return (
        <SectionWrapper id="crm-faq" className="bg-[#f8fafc]">
            <div className="flex flex-col lg:flex-row gap-20">
                <div className="lg:w-1/3">
                    <span className="text-primary font-black tracking-[0.2em] text-[10px] uppercase mb-6 block">Support</span>
                    <h2 className="text-4xl font-black headline-premium text-[#0f172a] mb-6 leading-none">CRM <span className="text-primary">FAQ.</span></h2>
                </div>
                <div className="lg:w-2/3 flex flex-col gap-4">
                    {crmFaqs.map((faq, index) => (
                        <div key={faq.k} className={`border rounded-[32px] overflow-hidden transition-all duration-300 ${openIndex === index ? "border-primary bg-white ring-1 ring-primary/20 shadow-xl shadow-primary/5" : "border-slate-100 bg-white hover:border-slate-300"}`}>
                            <button onClick={() => setOpenIndex(index === openIndex ? -1 : index)} className="w-full p-8 flex items-center justify-between text-left group">
                                <span className={`text-lg font-bold transition-colors ${openIndex === index ? "text-primary" : "text-[#0f172a]"}`}>{faq.k}</span>
                                <ChevronDown className={`size-5 transition-transform duration-300 flex-shrink-0 ml-4 ${openIndex === index ? "rotate-180 text-primary" : "text-slate-400"}`} />
                            </button>
                            <motion.div initial={false} animate={{ height: openIndex === index ? "auto" : 0 }} className="overflow-hidden">
                                <div className="p-8 pt-0 text-slate-500 font-medium leading-relaxed">{faq.v}</div>
                            </motion.div>
                        </div>
                    ))}
                </div>
            </div>
        </SectionWrapper>
    );
}

/* ─── Bottom CTA ─── */
function CRMBottomCTA() {
    return (
        <SectionWrapper className="bg-[#0f172a] text-center relative overflow-hidden py-40 rounded-[64px] mx-4 md:mx-10 mb-20">
            <div className="absolute inset-0 bg-grid opacity-[0.2] pointer-events-none" />
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden opacity-20">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[100%] bg-primary rounded-full blur-[160px]" />
            </div>
            <div className="relative z-10 max-w-4xl mx-auto">
                <h2 className="text-4xl md:text-7xl font-black headline-premium text-white mb-10 leading-[0.95]">
                    Stop losing intelligence between <span className="text-primary italic">lead gen and sales.</span>
                </h2>
                <p className="text-slate-400 text-xl md:text-2xl font-medium mb-16 max-w-2xl mx-auto">
                    AltLeads CRM helps your backend and sales teams work as one system — so every meeting gets better.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                    <a href="/contact" className="px-12 py-5 bg-primary text-white font-black rounded-2xl hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 flex items-center gap-3 group glow-on-hover">
                        Book a Demo <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
                    </a>
                    <a href="/contact" className="px-10 py-5 bg-transparent text-white border border-white/20 font-black rounded-2xl hover:bg-white/5 transition-all">Start Pilot</a>
                </div>
            </div>
        </SectionWrapper>
    );
}

/* ─── Page Composition ─── */
export default function CRMPage() {
    return (
        <main className="bg-white">
            <CRMHero />
            <CRMProblem />
            <CRMWorkflow />
            <WebCRMFeatures />
            <MobileAppFeatures />
            <CRMDifferentiator />
            <CRMOnboarding />
            <CRMFAQ />
            <CRMBottomCTA />
        </main>
    );
}
