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
        <section className="relative min-h-[95vh] flex items-center justify-center pt-32 pb-20 overflow-hidden bg-[#0f172a]">
            {/* Cinematic Background Mesh & Grid */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute inset-0 bg-grid opacity-[0.2]" />
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[100%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[100%] bg-blue-500/10 rounded-full blur-[140px]" />
            </div>

            <div className="max-w-[1280px] mx-auto px-4 md:px-10 relative z-10 w-full">
                <div className="flex flex-col items-center text-center">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-10"
                    >
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">The Outbound OS</span>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="text-[44px] md:text-[80px] font-black headline-premium text-white leading-[0.95] mb-10 max-w-5xl"
                    >
                        Outbound execution, intelligence, and <span className="text-primary italic">CRM orchestration</span> — built for B2B teams.
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="text-lg md:text-2xl text-slate-400 font-medium leading-relaxed mb-12 max-w-3xl"
                    >
                        AltLeads helps SDR/BDR and sales teams run multi-channel outreach (Email, LinkedIn, WhatsApp, Calls) in one workflow — with better follow-up discipline, cleaner visibility, and practical intelligence that teams actually use.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="flex flex-col sm:flex-row gap-6 mb-20"
                    >
                        <a href="/contact" className="px-12 py-5 bg-primary text-white font-black rounded-2xl hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-3 group glow-on-hover">
                            Book a Demo
                            <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
                        </a>
                        <a href="/solutions/crm" className="px-10 py-5 bg-white/5 text-white border border-white/10 font-black rounded-2xl hover:bg-white/10 transition-all flex items-center justify-center gap-3 group">
                            <div className="size-6 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-primary transition-colors">
                                <Play className="size-3 fill-white text-white" />
                            </div>
                            Start Pilot / See 2-minute Tour
                        </a>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1.2, delay: 0.4 }}
                        className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-16 border-t border-white/5 pt-16 w-full"
                    >
                        {[
                            "Run multi-channel cadences without tool-hopping",
                            "Track activity and outcomes automatically",
                            "Get practical guidance inside the workflow"
                        ].map((item) => (
                            <div key={item} className="flex items-center justify-center gap-3">
                                <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <Check className="size-3 text-primary" />
                                </div>
                                <span className="text-sm text-slate-400 font-bold tracking-tight">{item}</span>
                            </div>
                        ))}
                    </motion.div>

                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8 }}
                        className="mt-20 text-[10px] font-black uppercase tracking-[0.3em] text-slate-600"
                    >
                        Built by operators running live outbound programs across India and global markets.
                    </motion.p>
                </div>
            </div>
        </section>
    );
}

function Check({ className }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );
}
