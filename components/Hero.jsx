"use client";

import { motion } from "framer-motion";
import { ArrowRight, Play, Mail, Linkedin, MessageCircle, Phone } from "lucide-react";

const channels = [
    { icon: Mail, label: "Email", color: "text-blue-500", bg: "bg-blue-50" },
    { icon: Linkedin, label: "LinkedIn", color: "text-sky-600", bg: "bg-sky-50" },
    { icon: MessageCircle, label: "WhatsApp", color: "text-emerald-500", bg: "bg-emerald-50" },
    { icon: Phone, label: "Calls", color: "text-violet-500", bg: "bg-violet-50" },
];

const outcomes = [
    "Run multi-channel cadences without tool-hopping",
    "Track activity and outcomes automatically",
    "Get practical targeting and next-step guidance inside the workflow",
];

export default function Hero() {
    return (
        <section className="relative min-h-[90vh] flex items-center justify-center pt-32 pb-20 overflow-hidden bg-white">
            {/* Cinematic Background Mesh */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-100/40 rounded-full blur-[140px]" />
                <div className="absolute top-[20%] right-[30%] w-[30%] h-[30%] bg-primary/5 rounded-full blur-[100px]" />
            </div>

            <div className="max-w-[1280px] mx-auto px-4 md:px-10 relative z-10 w-full">
                <div className="flex flex-col items-center text-center">
                    {/* Badge */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-light border border-primary/10 mb-8 backdrop-blur-sm"
                    >
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </span>
                        <span className="text-xs font-bold text-primary tracking-wide uppercase">Multi-Channel Outbound Engine</span>
                    </motion.div>

                    {/* Main Headline */}
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="text-[36px] leading-[1.1] md:text-[72px] font-black tracking-tighter text-[#0f172a] mb-8"
                    >
                        Outbound execution, <br />
                        <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent italic">intelligence</span>, and CRM <br />
                        orchestration.
                    </motion.h1>

                    {/* Subheadline */}
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="text-lg md:text-xl text-slate-500 max-w-3xl mb-10 font-medium leading-relaxed"
                    >
                        AltLeads helps SDR/BDR and sales teams run multi-channel outreach — Email, LinkedIn, WhatsApp, Calls — in one workflow. Better follow-up discipline, cleaner visibility, and practical intelligence teams actually use.
                    </motion.p>

                    {/* Channel Badges */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="flex flex-wrap items-center justify-center gap-3 mb-10"
                    >
                        {channels.map((ch) => (
                            <div key={ch.label} className={`flex items-center gap-2 px-4 py-2 ${ch.bg} border border-slate-100 rounded-full group hover:scale-105 transition-transform`}>
                                <ch.icon className={`size-4 ${ch.color}`} />
                                <span className="text-xs font-bold text-slate-600">{ch.label}</span>
                            </div>
                        ))}
                    </motion.div>

                    {/* CTAs */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                        className="flex flex-col sm:flex-row items-center gap-5 mb-16 w-full sm:w-auto"
                    >
                        <a
                            href="/contact"
                            className="w-full sm:w-auto px-8 py-4 bg-[#0f172a] text-white font-bold rounded-2xl hover:bg-slate-800 transition-all shadow-2xl shadow-slate-200 flex items-center justify-center gap-2 group"
                        >
                            Book a Demo
                            <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
                        </a>
                        <a
                            href="#how-it-works"
                            className="w-full sm:w-auto px-8 py-4 bg-white text-[#0f172a] font-bold rounded-2xl border border-slate-200 hover:border-primary/50 transition-all flex items-center justify-center gap-2 group"
                        >
                            <div className="size-6 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-primary-light transition-colors">
                                <Play className="size-3 fill-primary text-primary" />
                            </div>
                            See 2-minute Tour
                        </a>
                    </motion.div>

                    {/* Outcome Bullets */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10 mb-12"
                    >
                        {outcomes.map((item) => (
                            <div key={item} className="flex items-center gap-2">
                                <div className="size-1.5 rounded-full bg-primary flex-shrink-0" />
                                <span className="text-sm font-bold text-slate-500">{item}</span>
                            </div>
                        ))}
                    </motion.div>

                    {/* Trust Bar */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                        className="px-8 py-4 bg-slate-50/80 border border-slate-100 rounded-full backdrop-blur-sm"
                    >
                        <p className="text-xs font-bold text-slate-400 tracking-wider uppercase">
                            Built by operators running live outbound programs across India and global markets
                        </p>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
