"use client";

import { motion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import Image from "next/image";

export default function Hero() {
    return (
        <section className="relative min-h-screen flex flex-col items-center justify-center pt-32 pb-20 px-4 overflow-hidden bg-[#f8fafc]">
            {/* Background Decorative Elements */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none -z-10">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#0099d6]/5 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-400/5 blur-[120px] rounded-full" />
            </div>

            <div className="max-w-[1280px] mx-auto text-center relative z-10">
                {/* Badge */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-light border border-blue-100 mb-8"
                >
                    <span className="flex size-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-xs font-bold text-primary tracking-wide uppercase">Now: AI-Powered Lead Scoring</span>
                </motion.div>

                {/* Headline */}
                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight text-[#0f172a] mb-6 leading-[1.05]"
                >
                    Turn Leads Into <br />
                    <span className="text-primary italic">Qualified Meetings.</span> <br />
                    Automatically.
                </motion.h1>

                {/* Subheadline */}
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="max-w-2xl mx-auto text-lg md:text-xl text-[#64748b] mb-10 leading-relaxed"
                >
                    Align your backend lead gen with frontend sales. Stop pipeline leakage and start closing deals with the only workflow-first CRM built for high-velocity teams.
                </motion.p>

                {/* CTAs */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
                >
                    <button className="w-full sm:w-auto px-8 py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all flex items-center justify-center gap-2 group">
                        Book a Demo
                        <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                    <button className="w-full sm:w-auto px-8 py-4 bg-white text-[#0f172a] border border-slate-200 font-bold rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                        Start Pilot
                    </button>
                </motion.div>

                {/* Trust Labels */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className="flex flex-wrap items-center justify-center gap-4 md:gap-8 opacity-60 mb-20"
                >
                    <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-primary" />
                        <span className="text-xs font-bold uppercase tracking-widest">Real-time sync</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-primary" />
                        <span className="text-xs font-bold uppercase tracking-widest">Structured feedback</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-primary" />
                        <span className="text-xs font-bold uppercase tracking-widest">SOC2 Compliant</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-primary" />
                        <span className="text-xs font-bold uppercase tracking-widest">Workflow First</span>
                    </div>
                </motion.div>

                {/* Mockup Montage */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 40 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    className="relative max-w-5xl mx-auto"
                >
                    {/* Main Dashboard Mockup */}
                    <div className="rounded-2xl border-4 border-[#0f172a] bg-[#1e293b] shadow-2xl overflow-hidden aspect-[16/10] relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-slate-700">
                            {/* Internal placeholder for the CRM dashboard screenshot */}
                            <div className="w-full h-full p-8 opacity-40">
                                <div className="w-full h-8 bg-slate-700 rounded mb-8" />
                                <div className="grid grid-cols-4 gap-4 mb-8">
                                    <div className="h-24 bg-slate-700 rounded" />
                                    <div className="h-24 bg-slate-700 rounded" />
                                    <div className="h-24 bg-slate-700 rounded" />
                                    <div className="h-24 bg-slate-700 rounded" />
                                </div>
                                <div className="h-64 bg-slate-700 rounded" />
                            </div>
                        </div>
                        {/* Overlay Text to make it look active */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/10 select-none">
                            <span className="text-6xl font-black">ALTLEADS CRM</span>
                        </div>
                    </div>

                    {/* Floating Mobile Mockup */}
                    <motion.div
                        animate={{ y: [0, -10, 0] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute -right-4 -bottom-8 md:-right-12 md:-bottom-12 w-32 md:w-64 aspect-[9/19] rounded-[2rem] border-8 border-[#0f172a] bg-[#f8fafc] shadow-2xl overflow-hidden hidden sm:block"
                    >
                        <div className="w-full h-full bg-white p-4">
                            <div className="w-full h-2 bg-slate-100 rounded mb-4" />
                            <div className="space-y-3">
                                <div className="h-10 bg-blue-50 rounded" />
                                <div className="h-10 bg-slate-50 rounded" />
                                <div className="h-10 bg-slate-50 rounded" />
                                <div className="h-10 bg-slate-50 rounded" />
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            </div>
        </section>
    );
}
