"use client";

import { motion } from "framer-motion";
import SectionWrapper from "../SectionWrapper";
import {
    ArrowRight, Play, Brain, Search, UserCheck, Database, Globe, Chrome,
    Target, BarChart3, Users, CheckCircle, Zap, Shield, ChevronDown,
    Building, Mail, Sparkles, TrendingUp, Eye, Layers, Monitor, Check
} from "lucide-react";
import { useState } from "react";

/* ─── Hero ─── */
function DataHero() {
    return (
        <section className="relative pt-32 pb-20 overflow-hidden bg-[#0f172a]">
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute inset-0 bg-grid opacity-[0.2]" />
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[100%] bg-blue-500/20 rounded-full blur-[120px] animate-pulse" />
            </div>
            <div className="max-w-[1280px] mx-auto px-4 md:px-10 relative z-10">
                <div className="flex flex-col items-center text-center">
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 mb-10">
                        <Database className="size-3 text-blue-400" />
                        <span className="text-[10px] font-black text-blue-400 tracking-[0.2em] uppercase leading-none">The Intelligence Layer</span>
                    </motion.div>
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                        className="text-[36px] md:text-[80px] leading-[0.95] font-black headline-premium text-white mb-10 max-w-5xl"
                    >
                        Every lead you'll ever need. <span className="text-blue-400 italic">Fresh every 24 hours.</span>
                    </motion.h1>
                    <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-lg md:text-2xl text-slate-400 max-w-3xl mb-12 font-medium leading-relaxed">
                        Precision data at scale. We combine web-level scraping with real-time intent signals to give your team the most accurate B2B contact data in the world.
                    </motion.p>
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex flex-col sm:flex-row items-center gap-6">
                        <a href="/contact" className="px-12 py-5 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-500 transition-all shadow-xl shadow-blue-500/20 flex items-center gap-3 group glow-on-hover">
                            Scale Your Data <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
                        </a>
                        <a href="#data-app" className="px-10 py-5 bg-white/5 text-white border border-white/10 font-black rounded-2xl hover:bg-white/10 transition-all flex items-center gap-3">
                            Explore Platform
                        </a>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}

/* ─── Outcomes / Stats ─── */
const dataStats = [
    { label: "Data Freshness", value: "24h", desc: "Every record updated daily." },
    { label: "Match Rate", value: "95%", desc: "Industry-leading email accuracy." },
    { label: "Contact Points", value: "50M+", desc: "B2B professionals in our reach." },
    { label: "Intent Signals", value: "Real-time", desc: "Know exactly when they're buying." },
];

function DataOutcomes() {
    return (
        <SectionWrapper id="data-outcomes" className="bg-[#0f172a] text-white py-32 border-t border-white/5 relative overflow-hidden">
            <div className="absolute inset-0 bg-grid opacity-[0.2] pointer-events-none" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
                {dataStats.map((stat, i) => (
                    <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="text-center group p-8 rounded-[40px] bg-white/5 border border-white/10 hover:border-blue-500/30 transition-all">
                        <div className="text-4xl md:text-6xl font-black text-blue-400 mb-4 group-hover:scale-110 transition-transform tabular-nums">{stat.value}</div>
                        <div className="text-lg font-bold text-white mb-2">{stat.label}</div>
                        <div className="text-slate-500 text-sm font-medium">{stat.desc}</div>
                    </motion.div>
                ))}
            </div>
        </SectionWrapper>
    );
}

/* ─── Data App ─── */
const dataAppFeatures = [
    { icon: Search, title: "Verified mobile numbers and business emails" },
    { icon: Building, title: "Company firmographics — size, funding, tech stack" },
    { icon: Globe, title: "Search within AltLeads or enrich existing lists" },
    { icon: Database, title: "Export clean, deduplicated lists to CRM or cadences" },
];

function DataApp() {
    return (
        <SectionWrapper id="data-app" className="bg-white relative overflow-hidden">
            <div className="absolute inset-0 bg-grid opacity-[0.2] pointer-events-none" />
            <div className="flex flex-col lg:flex-row gap-20 items-center relative z-10">
                <div className="lg:w-1/2">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="size-12 rounded-2xl bg-blue-50 flex items-center justify-center">
                            <Database className="size-6 text-blue-600" />
                        </div>
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">Data App</span>
                    </div>
                    <h2 className="text-4xl md:text-6xl font-black headline-premium text-[#0f172a] mb-8 leading-[0.95]">
                        Find, verify, <span className="text-blue-600 italic">and target.</span>
                    </h2>
                    <p className="text-slate-500 text-xl font-medium leading-relaxed mb-10">
                        A purpose-built data application for finding verified decision-maker contacts that fit your ICP perfectly.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {dataAppFeatures.map(f => (
                            <div key={f.title} className="flex items-center gap-4 p-5 bg-[#f8fafc] rounded-3xl border border-slate-100 hover:border-blue-200 transition-colors">
                                <div className="size-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                                    <f.icon className="size-5 text-blue-600" />
                                </div>
                                <span className="text-sm font-bold text-[#0f172a] leading-tight">{f.title}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="lg:w-1/2">
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="p-12 bg-[#0f172a] rounded-[64px] border border-white/10 relative overflow-hidden shadow-2xl">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px]" />
                        <div className="relative z-10 space-y-6">
                            {["Search by ICP criteria", "Preview verified contacts", "Enrich with firmographic data", "Export to cadence or CRM"].map((step, i) => (
                                <div key={step} className="flex items-center gap-6 group">
                                    <span className="text-xs font-black text-blue-400 bg-white/5 size-10 rounded-full flex items-center justify-center border border-white/10 group-hover:bg-blue-400 group-hover:text-white transition-all">{i + 1}</span>
                                    <span className="font-bold text-white text-lg">{step}</span>
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
        <SectionWrapper id="intelligence-layer" className="bg-[#0f172a] text-white py-32 relative overflow-hidden">
            <div className="absolute inset-0 bg-grid opacity-[0.2] pointer-events-none" />
            <div className="flex flex-col lg:flex-row gap-20 items-center relative z-10">
                <div className="lg:w-1/2">
                    <span className="text-blue-400 font-black tracking-[0.2em] text-[10px] uppercase mb-6 block">Intelligence Layer</span>
                    <h2 className="text-4xl md:text-6xl font-black headline-premium mb-8 leading-[0.95]">
                        Practical guidance, <span className="text-slate-500">not "AI magic."</span>
                    </h2>
                    <p className="text-slate-400 text-lg md:text-xl font-medium leading-relaxed">
                        AltLeads intelligence provides contextual support — persona-level pitch angles, relevant triggers, and suggested messaging frameworks.
                    </p>
                </div>
                <div className="lg:w-1/2 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                    {[
                        { title: "Persona-based pitch angles", desc: "Tailored talking points by decision-maker type." },
                        { title: "Relevant trigger events", desc: "Funding, hiring, leadership changes, product launches." },
                        { title: "Messaging frameworks", desc: "Best-practice templates adapted to your ICP." },
                        { title: "In-workflow delivery", desc: "Shows up inside the cadence — no separate tab." },
                    ].map((item, i) => (
                        <motion.div key={item.title} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="p-8 bg-white/5 border border-white/10 rounded-[32px] hover:border-blue-500/30 transition-all group">
                            <h4 className="font-bold text-lg mb-2 group-hover:text-blue-400 transition-colors">{item.title}</h4>
                            <p className="text-slate-400 text-sm leading-relaxed font-medium">{item.desc}</p>
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
            <div className="flex flex-col lg:flex-row-reverse gap-20 items-center">
                <div className="lg:w-1/2">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="size-12 rounded-2xl bg-slate-50 flex items-center justify-center">
                            <Monitor className="size-6 text-slate-400" />
                        </div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Browser Extension</span>
                    </div>
                    <h2 className="text-4xl md:text-6xl font-black headline-premium text-[#0f172a] mb-8 leading-[0.95]">
                        Works where <span className="text-blue-600 italic">you work.</span>
                    </h2>
                    <p className="text-slate-500 text-xl font-medium leading-relaxed mb-10">
                        Enrich profiles on LinkedIn, Sales Navigator, and company websites with one click. Intelligence follows you across the web.
                    </p>
                    <div className="space-y-4">
                        {[
                            "Direct LinkedIn profile enrichment",
                            "Bulk-save prospects to AltLeads lists",
                            "One-click verified email reveals",
                            "Contextual intelligence in your peripheral",
                        ].map((p) => (
                            <div key={p} className="flex items-center gap-4">
                                <div className="size-6 rounded-full bg-blue-50 flex items-center justify-center">
                                    <Check className="size-4 text-blue-600" />
                                </div>
                                <span className="text-[#0f172a] font-bold">{p}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="lg:w-1/2">
                    <div className="p-12 bg-slate-50 rounded-[64px] border border-slate-100 relative group overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-indigo-500" />
                        <div className="bg-white p-6 rounded-3xl shadow-2xl border border-slate-100 group-hover:-translate-y-2 transition-transform">
                            <div className="flex items-center gap-4 mb-6 border-b border-slate-50 pb-6">
                                <div className="size-12 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black">A</div>
                                <div>
                                    <div className="font-bold text-[#0f172a]">AltLeads Extension</div>
                                    <div className="text-xs text-slate-400 font-medium">Verified & Ready</div>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="h-4 bg-slate-100 rounded-full w-3/4 animate-pulse" />
                                <div className="h-4 bg-slate-50 rounded-full w-1/2 animate-pulse" />
                                <div className="h-10 bg-blue-600 rounded-xl w-full mt-6" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </SectionWrapper>
    );
}

/* ─── How It Works ─── */
const dataSteps = [
    { title: "Define Target", desc: "Use firmographics, technographics, or intent signals to define your ICP." },
    { title: "Extract Contacts", desc: "Our engine pulls verified emails and mobile numbers for your target list." },
    { title: "Enrich & Sync", desc: "Push clean data directly into your CRM or outbound OS with one click." },
];

function DataHowItWorks() {
    return (
        <SectionWrapper id="data-how-it-works" className="bg-[#f8fafc]">
            <div className="text-center mb-24 max-w-4xl mx-auto">
                <span className="text-blue-600 font-black tracking-[0.2em] text-[10px] uppercase mb-6 block">The Pipeline</span>
                <h2 className="text-4xl md:text-7xl font-black headline-premium text-[#0f172a] mb-8 leading-[0.95]">
                    Simple, fast, <span className="text-blue-600 italic">and compliant.</span>
                </h2>
                <p className="text-slate-500 text-xl font-medium">From raw intent to verified contacts in minutes.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-blue-100 hidden md:block -translate-y-1/2 z-0" />
                {dataSteps.map((step, i) => (
                    <motion.div key={step.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="relative z-10 text-center group">
                        <div className="size-16 rounded-[24px] bg-white border border-blue-100 flex items-center justify-center mx-auto mb-8 text-2xl font-black text-blue-600 shadow-xl group-hover:bg-blue-600 group-hover:text-white transition-all">
                            {i + 1}
                        </div>
                        <h3 className="text-2xl font-black text-[#0f172a] mb-4">{step.title}</h3>
                        <p className="text-slate-500 text-sm font-medium leading-relaxed max-w-[280px] mx-auto">{step.desc}</p>
                    </motion.div>
                ))}
            </div>
        </SectionWrapper>
    );
}

/* ─── Who It's For ─── */
const targetAudience = [
    { type: "SDRs / BDRs", use: "Stop digging for numbers. Start making dials with verified data." },
    { type: "Marketing Pros", use: "Build hyper-targeted lists for account-based advertising." },
    { type: "Founders", use: "Scale your early outbound without a massive data budget." },
    { type: "Sales Ops", use: "Keep your CRM clean with daily data refreshes and deduplication." },
];

function DataWhoItsFor() {
    return (
        <SectionWrapper id="data-who-its-for" className="bg-white">
            <div className="flex flex-col lg:flex-row gap-20 items-end">
                <div className="lg:w-1/2">
                    <span className="text-blue-600 font-black tracking-[0.2em] text-[10px] uppercase mb-6 block">Targeting</span>
                    <h2 className="text-4xl md:text-7xl font-black headline-premium text-[#0f172a] mb-8 leading-[0.95]">
                        Data for every <span className="text-blue-600 italic">growth stage.</span>
                    </h2>
                </div>
                <div className="lg:w-1/2 grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
                    {targetAudience.map((audience, i) => (
                        <div key={audience.type} className="p-8 bg-[#f8fafc] border border-slate-100 rounded-[32px] hover:border-blue-200 transition-all">
                            <h3 className="font-black text-xl text-[#0f172a] mb-3">{audience.type}</h3>
                            <p className="text-slate-500 text-sm font-medium">{audience.use}</p>
                        </div>
                    ))}
                </div>
            </div>
        </SectionWrapper>
    );
}

/* ─── Differentiator ─── */
function DataDifferentiator() {
    return (
        <SectionWrapper id="data-diff" className="bg-white pb-40">
            <div className="p-12 md:p-24 bg-[#0f172a] rounded-[64px] relative overflow-hidden text-center border border-white/10 shadow-3xl">
                <div className="absolute inset-0 bg-grid opacity-[0.2] pointer-events-none" />
                <div className="relative z-10 max-w-4xl mx-auto">
                    <h2 className="text-4xl md:text-7xl font-black headline-premium text-white mb-10 leading-[0.95]">
                        The AltLeads <span className="text-blue-400">Data Guarantee.</span>
                    </h2>
                    <p className="text-slate-400 text-xl font-medium leading-relaxed max-w-2xl mx-auto mb-16">
                        We don't sell static repositories. Every record exported is cross-verified in real-time, ensuring you never waste a dial on a dead number.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            { label: "Daily Refreshes", val: "24h" },
                            { label: "Match Accuracy", val: "95%+" },
                            { label: "Verification", val: "Real-time" },
                        ].map(item => (
                            <div key={item.label} className="p-8 bg-white/5 border border-white/10 rounded-[40px]">
                                <div className="text-3xl font-black text-blue-400 mb-2">{item.val}</div>
                                <div className="text-xs font-black text-slate-500 uppercase tracking-widest">{item.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </SectionWrapper>
    );
}

/* ─── FAQ ─── */
const dataFaqs = [
    { k: "Where does AltLeads get its data?", v: "We combine our proprietary web-scale scraping engine with real-time intent triggers and cross-verification from multiple premium B2B data vendors." },
    { k: "Is your data GDPR / CCPA compliant?", v: "Yes. We strictly adhere to all major data privacy regulations. We only provide professional B2B contact information." },
    { k: "How often is the data updated?", v: "Our entire database is subjected to a rolling 24-hour verification cycle. If a contact changed jobs yesterday, we'll know today." },
    { k: "Can I export data to my existing CRM?", v: "Directly. We have native integrations with Salesforce, HubSpot, and all major outbound OS platforms." },
    { k: "Do you offer bulk enrichment?", v: "Yes. You can upload any existing list and we'll append missing emails, mobile numbers, and technographic data." },
];

function DataFAQ() {
    const [openIndex, setOpenIndex] = useState(0);
    return (
        <SectionWrapper id="data-faq" className="bg-[#f8fafc]">
            <div className="flex flex-col lg:flex-row gap-20">
                <div className="lg:w-1/3">
                    <span className="text-blue-600 font-black tracking-[0.2em] text-[10px] uppercase mb-6 block">Support</span>
                    <h2 className="text-4xl font-black headline-premium text-[#0f172a] mb-6 leading-none">Data <span className="text-blue-600">FAQ.</span></h2>
                </div>
                <div className="lg:w-2/3 flex flex-col gap-4">
                    {dataFaqs.map((faq, index) => (
                        <div key={faq.k} className={`border rounded-[32px] overflow-hidden transition-all duration-300 ${openIndex === index ? "border-blue-500 bg-white ring-1 ring-blue-500/20 shadow-xl shadow-blue-500/5" : "border-slate-100 bg-white hover:border-slate-300"}`}>
                            <button onClick={() => setOpenIndex(index === openIndex ? -1 : index)} className="w-full p-8 flex items-center justify-between text-left group">
                                <span className={`text-lg font-bold transition-colors ${openIndex === index ? "text-blue-600" : "text-[#0f172a]"}`}>{faq.k}</span>
                                <ChevronDown className={`size-5 transition-transform duration-300 flex-shrink-0 ml-4 ${openIndex === index ? "rotate-180 text-blue-600" : "text-slate-400"}`} />
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
function DataBottomCTA() {
    return (
        <SectionWrapper className="bg-[#0f172a] text-center relative overflow-hidden py-40 rounded-[64px] mx-4 md:mx-10 mb-20">
            <div className="absolute inset-0 bg-grid opacity-[0.2] pointer-events-none" />
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden opacity-20">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[100%] bg-blue-600 rounded-full blur-[160px]" />
            </div>
            <div className="relative z-10 max-w-4xl mx-auto">
                <h2 className="text-4xl md:text-7xl font-black headline-premium text-white mb-10 leading-[0.95]">
                    Build your pipeline with <span className="text-blue-400 italic">data that converts.</span>
                </h2>
                <p className="text-slate-400 text-xl md:text-2xl font-medium mb-16 max-w-2xl mx-auto">
                    Stop wasting time on dead numbers. Get the precision data your sales team deserves.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                    <a href="/contact" className="px-12 py-5 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-500 transition-all shadow-xl shadow-blue-500/20 flex items-center gap-3 group glow-on-hover">
                        Get Your Data Sample <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
                    </a>
                    <a href="/contact" className="px-10 py-5 bg-transparent text-white border border-white/20 font-black rounded-2xl hover:bg-white/5 transition-all">Schedule Strategy Session</a>
                </div>
            </div>
        </SectionWrapper>
    );
}

/* ─── Page Composition ─── */
export default function DataPage() {
    return (
        <main className="bg-white">
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
        </main>
    );
}
