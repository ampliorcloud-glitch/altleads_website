"use client";

import { motion } from "framer-motion";
import SectionWrapper from "../SectionWrapper";
import {
    ArrowRight, Play, Monitor, Smartphone, Database, Filter, Calendar, UserCheck, Handshake,
    RefreshCw, LayoutDashboard, Users, Bell, FileText, BarChart3, CheckCircle, Zap, Star,
    AlertTriangle, Target, ChevronDown, Share2, School, Rocket, MapPin, Clock, Wifi
} from "lucide-react";
import { useState } from "react";

/* ─── Hero ─── */
function CRMHero() {
    return (
        <section className="relative pt-32 pb-20 overflow-hidden bg-white">
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-violet-100/30 rounded-full blur-[140px]" />
            </div>
            <div className="max-w-[1280px] mx-auto px-4 md:px-10 relative z-10">
                <div className="flex flex-col items-center text-center">
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-light border border-primary/10 mb-8">
                        <Monitor className="size-4 text-primary" />
                        <span className="text-xs font-bold text-primary tracking-wide uppercase">CRM Solution</span>
                    </motion.div>
                    <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-[36px] md:text-[64px] leading-[1.1] font-black tracking-tighter text-[#0f172a] mb-8">
                        A CRM designed for <br /><span className="bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent italic">outbound execution</span> — <br />not just record keeping.
                    </motion.h1>
                    <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-lg md:text-xl text-slate-500 max-w-3xl mb-10 font-medium leading-relaxed">
                        Web CRM for backend teams that manage leads. Mobile app for field reps that run meetings. One system. No spreadsheets. No missed follow-ups.
                    </motion.p>
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex flex-col sm:flex-row items-center gap-5">
                        <a href="/contact" className="px-8 py-4 bg-[#0f172a] text-white font-bold rounded-2xl hover:bg-slate-800 transition-all shadow-2xl flex items-center gap-2 group">
                            Book a Demo <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
                        </a>
                        <a href="#crm-workflow" className="px-8 py-4 bg-white text-[#0f172a] font-bold rounded-2xl border border-slate-200 hover:border-primary/50 transition-all flex items-center gap-2 group">
                            <Play className="size-4 fill-primary text-primary" /> See How It Works
                        </a>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}

/* ─── Problem ─── */
const crmPainPoints = [
    { icon: AlertTriangle, title: "CRMs that don't control workflow", desc: "Most CRMs let leads enter but don't enforce what happens next. Follow-ups, assignments, and status updates are manual and inconsistent.", color: "text-red-500", bg: "bg-red-50" },
    { icon: Target, title: "Backend overwhelmed by volume", desc: "Backend teams get buried managing incoming leads across web portals, calls, and walk-ins — with no centralized intake or auto-routing.", color: "text-orange-500", bg: "bg-orange-50" },
    { icon: Users, title: "Field reps flying blind", desc: "Without a mobile-first tool, reps miss scheduled meetings, can't update outcomes in the field, and managers lose visibility on what's actually happening.", color: "text-amber-500", bg: "bg-amber-50" },
];

function CRMProblem() {
    return (
        <SectionWrapper id="crm-problem" className="bg-[#0f172a] text-white py-32">
            <div className="text-center mb-16 max-w-3xl mx-auto">
                <span className="text-primary font-bold tracking-widest text-xs uppercase mb-4 block">The Problem</span>
                <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-6 leading-tight">
                    Your CRM isn't running <span className="text-slate-500">the workflow.</span>
                </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {crmPainPoints.map((point, i) => (
                    <motion.div key={point.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="p-8 bg-slate-900/50 border border-slate-800 rounded-3xl group">
                        <div className={`size-12 rounded-xl ${point.bg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                            <point.icon className={`size-6 ${point.color}`} />
                        </div>
                        <h3 className="text-lg font-bold mb-3">{point.title}</h3>
                        <p className="text-slate-400 text-sm leading-relaxed font-medium">{point.desc}</p>
                    </motion.div>
                ))}
            </div>
        </SectionWrapper>
    );
}

/* ─── 5-Step Workflow ─── */
const workflowSteps = [
    { icon: Filter, step: "01", title: "Capture", desc: "Leads enter via web portal, bulk upload, or direct API integration." },
    { icon: Calendar, step: "02", title: "Schedule", desc: "Backend qualifies, assigns territory, and books meetings — all from one dashboard." },
    { icon: UserCheck, step: "03", title: "Accept", desc: "Field reps receive push notification, accept or reschedule with one tap." },
    { icon: Handshake, step: "04", title: "Conduct", desc: "Rep conducts meeting, logs outcome, geo-stamps check-in via mobile app." },
    { icon: RefreshCw, step: "05", title: "Recycle", desc: "Unqualified leads re-enter nurture cadences. No lead is abandoned." },
];

function CRMWorkflow() {
    return (
        <SectionWrapper id="crm-workflow" className="bg-white">
            <div className="text-center mb-20 max-w-3xl mx-auto">
                <span className="text-primary font-bold tracking-widest text-xs uppercase mb-4 block">Workflow</span>
                <h2 className="text-4xl md:text-5xl font-black tracking-tight text-[#0f172a] mb-6">
                    5 steps. <span className="text-primary italic">One workflow.</span>
                </h2>
                <p className="text-slate-500 text-lg font-medium">From lead capture to meeting completion — nothing falls through.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                {workflowSteps.map((step, i) => (
                    <motion.div key={step.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="p-8 bg-[#f8fafc] border border-slate-100 rounded-[40px] hover:border-primary/20 hover:shadow-lg transition-all group text-center">
                        <span className="text-5xl font-black text-slate-100 mb-4 block">{step.step}</span>
                        <div className="size-12 rounded-2xl bg-primary-light flex items-center justify-center mx-auto mb-4 group-hover:bg-primary transition-colors">
                            <step.icon className="size-6 text-primary group-hover:text-white transition-colors" />
                        </div>
                        <h3 className="text-lg font-bold text-[#0f172a] mb-2">{step.title}</h3>
                        <p className="text-slate-500 text-xs leading-relaxed font-medium">{step.desc}</p>
                    </motion.div>
                ))}
            </div>
        </SectionWrapper>
    );
}

/* ─── Web CRM Features ─── */
const webFeatures = [
    { icon: LayoutDashboard, title: "Lead intake dashboard", desc: "Source-tagged, filterable, and auto-assigned." },
    { icon: Users, title: "Backend assignment engine", desc: "Rules-based distribution by territory, product, or availability." },
    { icon: FileText, title: "Pipeline view", desc: "Status tracking across New → Qualified → Scheduled → Completed → Recycled." },
    { icon: Bell, title: "Conflict & overlap detection", desc: "Prevent reps from wasting time on duplicates." },
    { icon: BarChart3, title: "Performance analytics", desc: "Conversion rates, time-to-schedule, and rep-level scorecards." },
    { icon: Star, title: "Lead quality scoring", desc: "Prioritize high-intent leads based on engagement and fit signals." },
];

function WebCRMFeatures() {
    return (
        <SectionWrapper id="web-crm" className="bg-[#f8fafc]">
            <div className="flex flex-col lg:flex-row gap-16 items-center">
                <div className="lg:w-2/5">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="size-10 rounded-xl bg-primary-light flex items-center justify-center">
                            <Monitor className="size-5 text-primary" />
                        </div>
                        <span className="text-xs font-black text-primary uppercase tracking-widest">Web Dashboard</span>
                    </div>
                    <h2 className="text-4xl md:text-5xl font-black tracking-tight text-[#0f172a] mb-6 leading-tight">
                        Backend teams <span className="text-primary italic">command center.</span>
                    </h2>
                    <p className="text-slate-500 text-lg font-medium leading-relaxed">
                        One dashboard to manage lead intake, assignments, pipeline status, and team performance — built specifically for backend coordinators.
                    </p>
                </div>
                <div className="lg:w-3/5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {webFeatures.map((f, i) => (
                        <motion.div key={f.title} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }} className="p-6 bg-white border border-slate-100 rounded-3xl hover:border-primary/20 transition-all group">
                            <div className="size-10 rounded-xl bg-primary-light flex items-center justify-center mb-4 group-hover:bg-primary transition-colors">
                                <f.icon className="size-5 text-primary group-hover:text-white transition-colors" />
                            </div>
                            <h4 className="font-bold text-[#0f172a] mb-1 text-sm">{f.title}</h4>
                            <p className="text-slate-500 text-xs leading-relaxed">{f.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </SectionWrapper>
    );
}

/* ─── Mobile App Features ─── */
const mobileFeatures = [
    { icon: Bell, title: "Push notifications", desc: "Real-time alerts for new assignments and schedule changes." },
    { icon: Calendar, title: "Daily meeting scheduler", desc: "One-tap accept, reschedule, or flag for backend support." },
    { icon: MapPin, title: "Geo-stamped check-in", desc: "Verified meeting attendance with location proof." },
    { icon: FileText, title: "Post-meeting feedback", desc: "Quick outcome logging with structured templates." },
    { icon: Clock, title: "Offline capability", desc: "Full functionality even in low-connectivity zones." },
    { icon: Wifi, title: "Auto-sync", desc: "Data cached locally, synced automatically when back online." },
];

function MobileAppFeatures() {
    return (
        <SectionWrapper id="mobile-app" className="bg-white">
            <div className="flex flex-col lg:flex-row-reverse gap-16 items-center">
                <div className="lg:w-2/5">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="size-10 rounded-xl bg-violet-50 flex items-center justify-center">
                            <Smartphone className="size-5 text-violet-600" />
                        </div>
                        <span className="text-xs font-black text-violet-600 uppercase tracking-widest">Mobile App</span>
                    </div>
                    <h2 className="text-4xl md:text-5xl font-black tracking-tight text-[#0f172a] mb-6 leading-tight">
                        Field reps stay <span className="text-violet-600 italic">in the flow.</span>
                    </h2>
                    <p className="text-slate-500 text-lg font-medium leading-relaxed">
                        A purpose-built mobile experience that gives reps everything they need — schedule, directions, outcome forms, and offline support — in one lightweight app.
                    </p>
                </div>
                <div className="lg:w-3/5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {mobileFeatures.map((f, i) => (
                        <motion.div key={f.title} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }} className="p-6 bg-[#f8fafc] border border-slate-100 rounded-3xl hover:border-violet-200 transition-all group">
                            <div className="size-10 rounded-xl bg-violet-50 flex items-center justify-center mb-4 group-hover:bg-violet-600 transition-colors">
                                <f.icon className="size-5 text-violet-600 group-hover:text-white transition-colors" />
                            </div>
                            <h4 className="font-bold text-[#0f172a] mb-1 text-sm">{f.title}</h4>
                            <p className="text-slate-500 text-xs leading-relaxed">{f.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </SectionWrapper>
    );
}

/* ─── Differentiator ─── */
const diffPoints = [
    "Workflow-first, not data-entry-first",
    "Built for both backend ops and field execution",
    "Mobile-native with offline support",
    "Conflict detection and overlap prevention",
    "Lead recycling instead of dead-end disqualification",
];

function CRMDifferentiator() {
    return (
        <SectionWrapper id="crm-diff" className="bg-[#0f172a] text-white py-32">
            <div className="flex flex-col lg:flex-row gap-16 items-center">
                <div className="lg:w-1/2">
                    <span className="text-primary font-bold tracking-widest text-xs uppercase mb-4 block">Why AltLeads CRM</span>
                    <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-6 leading-tight">
                        This isn't another <span className="text-slate-500">Salesforce.</span>
                    </h2>
                    <p className="text-slate-400 text-lg font-medium leading-relaxed mb-8">
                        Most CRMs focus on recording data. AltLeads focuses on controlling what happens between lead entry and meeting completion.
                    </p>
                </div>
                <div className="lg:w-1/2 space-y-4">
                    {diffPoints.map((point, i) => (
                        <motion.div key={point} initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="flex items-center gap-4 p-5 bg-white/5 border border-slate-800 rounded-2xl hover:border-primary/30 transition-all">
                            <CheckCircle className="size-5 text-primary flex-shrink-0" />
                            <span className="font-bold text-sm">{point}</span>
                        </motion.div>
                    ))}
                </div>
            </div>
        </SectionWrapper>
    );
}

/* ─── Onboarding ─── */
const onboardingSteps = [
    { day: "Day 1-3", title: "Data Migration", desc: "Secure transfer of all your existing client data and leads into AltLeads.", icon: Database },
    { day: "Day 4-7", title: "Workflow Mapping", desc: "We configure custom intake forms and automated qualification scripts.", icon: Share2 },
    { day: "Day 8-10", title: "Team Training", desc: "Live walkthroughs for backend coordinators and field agents.", icon: School },
    { day: "Day 14", title: "Full Launch", desc: "Go live with a unified operation. Start turning leads into meetings.", icon: Rocket },
];

function CRMOnboarding() {
    return (
        <SectionWrapper id="crm-onboarding" className="bg-[#f8fafc]">
            <div className="text-center mb-20 max-w-3xl mx-auto">
                <span className="text-primary font-bold tracking-widest text-xs uppercase mb-4 block">Deployment</span>
                <h2 className="text-4xl md:text-5xl font-black tracking-tight text-[#0f172a] mb-6">
                    Up and running in <span className="text-primary italic">under 14 days.</span>
                </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {onboardingSteps.map((step, i) => (
                    <motion.div key={step.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="p-8 bg-white border border-slate-100 rounded-[40px] shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all group">
                        <div className="flex justify-between items-start mb-6">
                            <div className="size-12 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-primary-light transition-colors">
                                <step.icon className="size-6 text-slate-500 group-hover:text-primary transition-colors" />
                            </div>
                            <span className="text-xs font-black text-primary bg-primary-light px-3 py-1 rounded-full uppercase tracking-tighter">{step.day}</span>
                        </div>
                        <h3 className="text-xl font-bold text-[#0f172a] mb-3">{step.title}</h3>
                        <p className="text-slate-500 text-sm leading-relaxed">{step.desc}</p>
                    </motion.div>
                ))}
            </div>
        </SectionWrapper>
    );
}

/* ─── FAQ ─── */
const crmFaqs = [
    { k: "Can we use our own lead generation tools?", v: "Yes. AltLeads provides a robust API and custom Web Portals to intake leads from any source — Facebook Ads, Google, or direct website traffic." },
    { k: "Does the mobile app work offline?", v: "Absolutely. We know field sales happen in basements and areas with poor signal. Data is cached locally and synced automatically when back online." },
    { k: "How long is the setup process?", v: "We aim for full integration within 14 days. This includes data migration, custom workflow configuration, and team onboarding." },
    { k: "Can AltLeads replace our current CRM?", v: "Yes. AltLeads can serve as your primary CRM or work as a powerful execution layer on top of your existing system." },
];

function CRMFAQ() {
    const [openIndex, setOpenIndex] = useState(0);
    return (
        <SectionWrapper id="crm-faq" className="bg-white">
            <div className="flex flex-col lg:flex-row gap-20">
                <div className="lg:w-1/3">
                    <span className="text-primary font-bold tracking-widest text-xs uppercase mb-4 block">FAQ</span>
                    <h2 className="text-4xl font-black tracking-tight text-[#0f172a] mb-6">CRM questions, <span className="text-primary">answered.</span></h2>
                </div>
                <div className="lg:w-2/3 flex flex-col gap-4">
                    {crmFaqs.map((faq, index) => (
                        <div key={faq.k} className={`border rounded-3xl overflow-hidden transition-all duration-300 ${openIndex === index ? "border-primary bg-primary-light/10 ring-1 ring-primary/20" : "border-slate-100 bg-[#f8fafc] hover:border-slate-300"}`}>
                            <button onClick={() => setOpenIndex(index === openIndex ? -1 : index)} className="w-full p-6 md:p-8 flex items-center justify-between text-left group">
                                <span className={`text-lg font-bold transition-colors ${openIndex === index ? "text-primary" : "text-[#0f172a]"}`}>{faq.k}</span>
                                <ChevronDown className={`size-5 transition-transform duration-300 flex-shrink-0 ml-4 ${openIndex === index ? "rotate-180 text-primary" : "text-slate-400"}`} />
                            </button>
                            <motion.div initial={false} animate={{ height: openIndex === index ? "auto" : 0 }} className="overflow-hidden">
                                <div className="p-6 md:p-8 pt-0 text-slate-500 font-medium leading-relaxed">{faq.v}</div>
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
        <SectionWrapper className="bg-[#0f172a] text-center relative overflow-hidden py-32 rounded-[60px] mx-4 md:mx-10 mb-20">
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden opacity-20">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[100%] bg-primary rounded-full blur-[160px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[100%] bg-violet-400 rounded-full blur-[140px]" />
            </div>
            <div className="relative z-10 max-w-3xl mx-auto">
                <h2 className="text-4xl md:text-6xl font-black tracking-tight text-white mb-8 leading-[1.05]">
                    Stop losing leads to <span className="text-slate-500">invisible friction.</span>
                </h2>
                <p className="text-slate-400 text-xl font-medium mb-12">Turn every lead into a high-value meeting with workflow-first CRM.</p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                    <a href="/contact" className="px-10 py-5 bg-white text-[#0f172a] font-black rounded-2xl hover:bg-slate-100 transition-all shadow-2xl flex items-center gap-2 group">
                        Get Started <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
                    </a>
                    <a href="/contact" className="px-10 py-5 bg-transparent text-white border-2 border-slate-700 font-black rounded-2xl hover:bg-white/5 transition-all">Schedule a Demo</a>
                </div>
            </div>
        </SectionWrapper>
    );
}

/* ─── Page Composition ─── */
export default function CRMPage() {
    return (
        <>
            <CRMHero />
            <CRMProblem />
            <CRMWorkflow />
            <WebCRMFeatures />
            <MobileAppFeatures />
            <CRMDifferentiator />
            <CRMOnboarding />
            <CRMFAQ />
            <CRMBottomCTA />
        </>
    );
}
