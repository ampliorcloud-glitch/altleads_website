"use client";

import { motion } from "framer-motion";
import SectionWrapper from "../SectionWrapper";
import {
    ArrowRight, Play, Brain, Search, UserCheck, Database, Globe, Chrome,
    Target, BarChart3, Users, CheckCircle, Zap, Shield, ChevronDown,
    Building, Mail, Sparkles, TrendingUp, Eye, Layers
} from "lucide-react";
import { useState } from "react";

/* ─── Hero ─── */
function DataHero() {
    return (
        <section className="relative pt-32 pb-20 overflow-hidden bg-white">
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-100/40 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-primary/10 rounded-full blur-[140px]" />
            </div>
            <div className="max-w-[1280px] mx-auto px-4 md:px-10 relative z-10">
                <div className="flex flex-col items-center text-center">
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 mb-8">
                        <Brain className="size-4 text-emerald-600" />
                        <span className="text-xs font-bold text-emerald-600 tracking-wide uppercase">Data & Intelligence</span>
                    </motion.div>
                    <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-[36px] md:text-[64px] leading-[1.1] font-black tracking-tighter text-[#0f172a] mb-8">
                        Targeting and intelligence <br /><span className="bg-gradient-to-r from-emerald-500 to-primary bg-clip-text text-transparent italic">reps actually use.</span>
                    </motion.h1>
                    <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-lg md:text-xl text-slate-500 max-w-3xl mb-10 font-medium leading-relaxed">
                        Most intelligence tools generate noise: irrelevant alerts, raw firmographic dumps, and generic "insights" no rep reads. AltLeads takes a different approach with verified contact data, contextual pitch guidance, and a Chrome extension that works where reps already are.
                    </motion.p>
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex flex-col sm:flex-row items-center gap-5">
                        <a href="/contact" className="px-8 py-4 bg-[#0f172a] text-white font-bold rounded-2xl hover:bg-slate-800 transition-all shadow-2xl flex items-center gap-2 group">
                            Book a Demo <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
                        </a>
                        <a href="#data-outcomes" className="px-8 py-4 bg-white text-[#0f172a] font-bold rounded-2xl border border-slate-200 hover:border-emerald-300 transition-all flex items-center gap-2">
                            <Play className="size-4 fill-emerald-500 text-emerald-500" /> See It In Action
                        </a>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}

/* ─── 3 Outcomes ─── */
const outcomes = [
    { icon: UserCheck, title: "Verified decision-maker contacts", desc: "Accurate email, phone, and LinkedIn data for real buyers — not generic company contacts.", color: "text-emerald-600", bg: "bg-emerald-50" },
    { icon: Sparkles, title: "Contextual pitch angles", desc: "Suggested talking points based on company data, recent activity, and persona type — ready before the call.", color: "text-primary", bg: "bg-primary-light" },
    { icon: TrendingUp, title: "Relevance signals", desc: "Company research, industry context, and timing indicators that help reps prioritize and personalize.", color: "text-violet-600", bg: "bg-violet-50" },
];

function DataOutcomes() {
    return (
        <SectionWrapper id="data-outcomes" className="bg-[#f8fafc]">
            <div className="text-center mb-16 max-w-3xl mx-auto">
                <span className="text-emerald-600 font-bold tracking-widest text-xs uppercase mb-4 block">What You Get</span>
                <h2 className="text-4xl md:text-5xl font-black tracking-tight text-[#0f172a] mb-6 leading-tight">
                    Three outcomes, <span className="text-emerald-600 italic">not three dashboards.</span>
                </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {outcomes.map((o, i) => (
                    <motion.div key={o.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="p-10 bg-white border border-slate-100 rounded-[40px] hover:shadow-xl hover:-translate-y-1 transition-all group">
                        <div className={`size-14 rounded-2xl ${o.bg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                            <o.icon className={`size-7 ${o.color}`} />
                        </div>
                        <h3 className="text-xl font-bold text-[#0f172a] mb-3">{o.title}</h3>
                        <p className="text-slate-500 text-sm leading-relaxed font-medium">{o.desc}</p>
                    </motion.div>
                ))}
            </div>
        </SectionWrapper>
    );
}

/* ─── Data App ─── */
const dataAppFeatures = [
    { icon: Search, title: "Verified mobile numbers and business emails" },
    { icon: Building, title: "Company firmographics — size, funding stage, tech stack, recent hires" },
    { icon: Globe, title: "Search within AltLeads or enrich existing prospect lists" },
    { icon: Database, title: "Export clean, deduplicated contact lists to CRM or cadence workflows" },
];

function DataApp() {
    return (
        <SectionWrapper id="data-app" className="bg-white">
            <div className="flex flex-col lg:flex-row gap-16 items-center">
                <div className="lg:w-1/2">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="size-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                            <Database className="size-5 text-emerald-600" />
                        </div>
                        <span className="text-xs font-black text-emerald-600 uppercase tracking-widest">Data App</span>
                    </div>
                    <h2 className="text-4xl md:text-5xl font-black tracking-tight text-[#0f172a] mb-6 leading-tight">
                        Find, verify, <span className="text-emerald-600 italic">and target.</span>
                    </h2>
                    <p className="text-slate-500 text-lg font-medium leading-relaxed mb-8">
                        A purpose-built data application for finding verified decision-maker contacts that fit your ICP.
                    </p>
                    <div className="space-y-4">
                        {dataAppFeatures.map(f => (
                            <div key={f.title} className="flex items-center gap-3 p-4 bg-[#f8fafc] rounded-2xl border border-slate-50">
                                <div className="size-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                                    <f.icon className="size-4 text-emerald-600" />
                                </div>
                                <span className="text-sm font-bold text-[#0f172a]">{f.title}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="lg:w-1/2">
                    <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="p-10 bg-gradient-to-br from-emerald-50 to-primary-light/30 rounded-[40px] border border-emerald-100">
                        <div className="space-y-4">
                            {["Search by ICP criteria", "Preview verified contacts", "Enrich with firmographic data", "Export to cadence or CRM"].map((step, i) => (
                                <div key={step} className="flex items-center gap-4">
                                    <span className="text-xs font-black text-emerald-600 bg-white size-8 rounded-full flex items-center justify-center shadow-sm">{i + 1}</span>
                                    <span className="font-bold text-[#0f172a] text-sm">{step}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>
        </SectionWrapper>
    );
}

/* ─── Intelligence Layer ─── */
function IntelligenceLayer() {
    return (
        <SectionWrapper id="intelligence-layer" className="bg-[#0f172a] text-white py-32">
            <div className="flex flex-col lg:flex-row gap-16 items-center">
                <div className="lg:w-1/2">
                    <span className="text-emerald-400 font-bold tracking-widest text-xs uppercase mb-4 block">Intelligence Layer</span>
                    <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-6 leading-tight">
                        Not "AI magic." <span className="text-slate-500">Practical guidance.</span>
                    </h2>
                    <p className="text-slate-400 text-lg font-medium leading-relaxed mb-8">
                        AltLeads intelligence isn't trying to replace the rep. It provides contextual support — persona-level pitch angles, relevant triggers, and suggested messaging frameworks. The rep stays in control.
                    </p>
                </div>
                <div className="lg:w-1/2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                        { title: "Persona-based pitch suggestions", desc: "Tailored talking points by decision-maker type." },
                        { title: "Relevant trigger events", desc: "Funding, hiring, leadership changes, product launches." },
                        { title: "Messaging frameworks", desc: "Best-practice templates adapted to your ICP." },
                        { title: "In-workflow delivery", desc: "Shows up inside the cadence — no separate tab." },
                    ].map((item, i) => (
                        <motion.div key={item.title} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="p-6 bg-white/5 border border-slate-800 rounded-3xl hover:border-emerald-500/30 transition-all">
                            <h4 className="font-bold text-sm mb-2">{item.title}</h4>
                            <p className="text-slate-400 text-xs leading-relaxed">{item.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </SectionWrapper>
    );
}

/* ─── Chrome Extension ─── */
function ChromeExtension() {
    return (
        <SectionWrapper id="chrome-extension" className="bg-white">
            <div className="flex flex-col lg:flex-row-reverse gap-16 items-center">
                <div className="lg:w-1/2">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="size-10 rounded-xl bg-yellow-50 flex items-center justify-center">
                            <Chrome className="size-5 text-yellow-600" />
                        </div>
                        <span className="text-xs font-black text-yellow-600 uppercase tracking-widest">Chrome Extension</span>
                    </div>
                    <h2 className="text-4xl md:text-5xl font-black tracking-tight text-[#0f172a] mb-6 leading-tight">
                        Intelligence where <span className="text-yellow-600 italic">you already work.</span>
                    </h2>
                    <p className="text-slate-500 text-lg font-medium leading-relaxed mb-8">
                        Surface contact details, company context, and pitch suggestions right inside LinkedIn and the browser — without switching tabs.
                    </p>
                </div>
                <div className="lg:w-1/2">
                    <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="p-10 bg-gradient-to-br from-yellow-50 to-orange-50/30 rounded-[40px] border border-yellow-100">
                        <div className="space-y-6">
                            {[
                                "View contact details on any LinkedIn profile",
                                "Get pitch angles before connecting",
                                "One-click save to AltLeads CRM",
                                "See company research without leaving the page",
                            ].map((item, i) => (
                                <div key={item} className="flex items-start gap-3">
                                    <CheckCircle className="size-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                                    <span className="font-bold text-[#0f172a] text-sm">{item}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>
        </SectionWrapper>
    );
}

/* ─── How It Works ─── */
const dataSteps = [
    { step: "01", title: "Define ICP", desc: "Set target criteria: industry, size, role, geography." },
    { step: "02", title: "Search & Discover", desc: "Find verified contacts matching your ideal profile." },
    { step: "03", title: "Enrich & Research", desc: "Pull company context, triggers, and pitch angles." },
    { step: "04", title: "Load Into Cadence", desc: "Push clean data directly into outbound workflows." },
];

function DataHowItWorks() {
    return (
        <SectionWrapper id="data-how" className="bg-[#f8fafc]">
            <div className="text-center mb-20 max-w-3xl mx-auto">
                <span className="text-emerald-600 font-bold tracking-widest text-xs uppercase mb-4 block">Process</span>
                <h2 className="text-4xl md:text-5xl font-black tracking-tight text-[#0f172a] mb-6">
                    From ICP to <span className="text-emerald-600 italic">first touch.</span>
                </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {dataSteps.map((s, i) => (
                    <motion.div key={s.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="p-8 bg-white border border-slate-100 rounded-[40px] hover:shadow-xl hover:-translate-y-1 transition-all group text-center">
                        <span className="text-5xl font-black text-emerald-100 mb-4 block">{s.step}</span>
                        <h3 className="text-lg font-bold text-[#0f172a] mb-2">{s.title}</h3>
                        <p className="text-slate-500 text-xs leading-relaxed font-medium">{s.desc}</p>
                    </motion.div>
                ))}
            </div>
        </SectionWrapper>
    );
}

/* ─── Who It's For ─── */
const audiences = [
    { icon: Users, title: "Outbound SDR teams", desc: "Who need verified ICP contacts without manual research.", color: "text-primary", bg: "bg-primary-light" },
    { icon: Eye, title: "Sales managers", desc: "Who want targeting quality insights, not just activity logs.", color: "text-violet-600", bg: "bg-violet-50" },
    { icon: Target, title: "Revenue operations", desc: "Who need clean data flowing into CRM and cadence tools.", color: "text-emerald-600", bg: "bg-emerald-50" },
];

function DataWhoItsFor() {
    return (
        <SectionWrapper id="data-who" className="bg-white">
            <div className="text-center mb-16 max-w-3xl mx-auto">
                <span className="text-emerald-600 font-bold tracking-widest text-xs uppercase mb-4 block">Built For</span>
                <h2 className="text-4xl md:text-5xl font-black tracking-tight text-[#0f172a] mb-6">
                    Who uses <span className="text-emerald-600 italic">this?</span>
                </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {audiences.map((a, i) => (
                    <motion.div key={a.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="p-10 bg-[#f8fafc] border border-slate-100 rounded-[40px] hover:border-emerald-200 hover:shadow-lg transition-all group">
                        <div className={`size-14 rounded-2xl ${a.bg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                            <a.icon className={`size-7 ${a.color}`} />
                        </div>
                        <h3 className="text-xl font-bold text-[#0f172a] mb-3">{a.title}</h3>
                        <p className="text-slate-500 text-sm leading-relaxed font-medium">{a.desc}</p>
                    </motion.div>
                ))}
            </div>
        </SectionWrapper>
    );
}

/* ─── Differentiator ─── */
function DataDifferentiator() {
    return (
        <SectionWrapper className="bg-[#0f172a] text-white py-32">
            <div className="flex flex-col lg:flex-row gap-16 items-center">
                <div className="lg:w-1/2">
                    <span className="text-emerald-400 font-bold tracking-widest text-xs uppercase mb-4 block">Different By Design</span>
                    <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-6 leading-tight">
                        Intelligence that lives <span className="text-slate-500">inside the workflow.</span>
                    </h2>
                    <p className="text-slate-400 text-lg font-medium leading-relaxed">
                        Unlike standalone data tools, AltLeads intelligence is embedded in the CRM and cadence engine — so reps use it naturally, not as an afterthought.
                    </p>
                </div>
                <div className="lg:w-1/2">
                    <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="p-10 bg-white/5 border border-slate-800 rounded-[40px]">
                        <div className="flex items-center gap-3 mb-6">
                            <Shield className="size-5 text-emerald-400" />
                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Privacy-Safe</span>
                        </div>
                        <p className="text-slate-300 font-medium leading-relaxed">
                            Designed to be privacy-safe, using contextual research and aggregated patterns — not client-confidential exposure. Clear controls for data access and usage. Your data stays yours.
                        </p>
                    </motion.div>
                </div>
            </div>
        </SectionWrapper>
    );
}

/* ─── FAQ ─── */
const dataFaqs = [
    { k: "Where does the contact data come from?", v: "AltLeads aggregates and verifies data from multiple public and licensed sources, with continuous validation to maintain accuracy." },
    { k: "How accurate is the data?", v: "We maintain high verification standards with regular re-validation cycles. Bounced or disconnected contacts are flagged automatically." },
    { k: "Can I use my own data alongside AltLeads data?", v: "Absolutely. Import your existing lists, enrich them with AltLeads data, and use both seamlessly within cadence workflows." },
    { k: "Is the Chrome extension free with AltLeads?", v: "Yes. The Chrome extension is included with all AltLeads plans that include the Data & Intelligence module." },
];

function DataFAQ() {
    const [openIndex, setOpenIndex] = useState(0);
    return (
        <SectionWrapper id="data-faq" className="bg-[#f8fafc]">
            <div className="flex flex-col lg:flex-row gap-20">
                <div className="lg:w-1/3">
                    <span className="text-emerald-600 font-bold tracking-widest text-xs uppercase mb-4 block">FAQ</span>
                    <h2 className="text-4xl font-black tracking-tight text-[#0f172a] mb-6">Data questions, <span className="text-emerald-600">answered.</span></h2>
                </div>
                <div className="lg:w-2/3 flex flex-col gap-4">
                    {dataFaqs.map((faq, index) => (
                        <div key={faq.k} className={`border rounded-3xl overflow-hidden transition-all duration-300 ${openIndex === index ? "border-emerald-400 bg-emerald-50/30 ring-1 ring-emerald-200" : "border-slate-100 bg-white hover:border-slate-300"}`}>
                            <button onClick={() => setOpenIndex(index === openIndex ? -1 : index)} className="w-full p-6 md:p-8 flex items-center justify-between text-left group">
                                <span className={`text-lg font-bold transition-colors ${openIndex === index ? "text-emerald-600" : "text-[#0f172a]"}`}>{faq.k}</span>
                                <ChevronDown className={`size-5 transition-transform duration-300 flex-shrink-0 ml-4 ${openIndex === index ? "rotate-180 text-emerald-600" : "text-slate-400"}`} />
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
function DataBottomCTA() {
    return (
        <SectionWrapper className="bg-[#0f172a] text-center relative overflow-hidden py-32 rounded-[60px] mx-4 md:mx-10 mb-20">
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden opacity-20">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[100%] bg-emerald-500 rounded-full blur-[160px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[100%] bg-primary rounded-full blur-[140px]" />
            </div>
            <div className="relative z-10 max-w-3xl mx-auto">
                <h2 className="text-4xl md:text-6xl font-black tracking-tight text-white mb-8 leading-[1.05]">
                    Stop guessing. <span className="text-slate-500">Start targeting.</span>
                </h2>
                <p className="text-slate-400 text-xl font-medium mb-12">Get verified contacts, contextual intelligence, and practical pitch guidance your team will actually use.</p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                    <a href="/contact" className="px-10 py-5 bg-white text-[#0f172a] font-black rounded-2xl hover:bg-slate-100 transition-all shadow-2xl flex items-center gap-2 group">
                        Book a Demo <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
                    </a>
                    <a href="/contact" className="px-10 py-5 bg-transparent text-white border-2 border-slate-700 font-black rounded-2xl hover:bg-white/5 transition-all">Try Data App</a>
                </div>
            </div>
        </SectionWrapper>
    );
}

/* ─── Page Composition ─── */
export default function DataPage() {
    return (
        <>
            <DataHero />
            <DataOutcomes />
            <DataApp />
            <IntelligenceLayer />
            <ChromeExtension />
            <DataHowItWorks />
            <DataWhoItsFor />
            <DataDifferentiator />
            <DataFAQ />
            <DataBottomCTA />
        </>
    );
}
