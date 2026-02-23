"use client";

import { motion } from "framer-motion";
import { ArrowRight, Play, CheckCircle2 } from "lucide-react";
import Image from "next/image";

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
                        <span className="text-xs font-bold text-primary tracking-wide uppercase">New: Automated Field Handoffs</span>
                    </motion.div>

                    {/* Main Headline */}
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="text-[42px] leading-[1.1] md:text-[84px] font-black tracking-tighter text-[#0f172a] mb-8"
                    >
                        Turn Leads Into <br />
                        <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent italic px-2">Qualified Meetings.</span> <br />
                        Automatically.
                    </motion.h1>

                    {/* Subheadline */}
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="text-lg md:text-xl text-slate-500 max-w-2xl mb-12 font-medium leading-relaxed"
                    >
                        The world's first CRM engineered specifically to bridge the gap between backend lead generation and frontend sales execution.
                    </motion.p>

                    {/* CTAs */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        className="flex flex-col sm:flex-row items-center gap-5 mb-20 w-full sm:w-auto"
                    >
                        <a
                            href="#cta"
                            className="w-full sm:w-auto px-8 py-4 bg-[#0f172a] text-white font-bold rounded-2xl hover:bg-slate-800 transition-all shadow-2xl shadow-slate-200 flex items-center justify-center gap-2 group"
                        >
                            Book a Free Demo
                            <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
                        </a>
                        <a
                            href="#solution"
                            className="w-full sm:w-auto px-8 py-4 bg-white text-[#0f172a] font-bold rounded-2xl border border-slate-200 hover:border-primary/50 transition-all flex items-center justify-center gap-2 group"
                        >
                            <div className="size-6 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-primary-light transition-colors">
                                <Play className="size-3 fill-primary text-primary" />
                            </div>
                            Watch Product Tour
                        </a>
                    </motion.div>

                    {/* Device Montage */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8, delay: 0.4 }}
                        className="relative w-full max-w-5xl aspect-[16/9] lg:aspect-[16/8] mt-4"
                    >
                        {/* Desktop Mockup */}
                        <div className="absolute inset-x-0 top-0 bottom-0 bg-[#f8fafc] rounded-t-[40px] border-x border-t border-slate-100 shadow-2xl overflow-hidden group">
                            <div className="h-8 md:h-12 bg-white border-b border-slate-50 flex items-center px-4 gap-2">
                                <div className="flex gap-1.5">
                                    <div className="size-2 md:size-3 rounded-full bg-red-400/20" />
                                    <div className="size-2 md:size-3 rounded-full bg-amber-400/20" />
                                    <div className="size-2 md:size-3 rounded-full bg-emerald-400/20" />
                                </div>
                                <div className="flex-1 max-w-md h-4 md:h-6 bg-slate-50 rounded-full mx-auto" />
                            </div>
                            <div className="p-4 md:p-8 grid grid-cols-12 gap-4 md:gap-6">
                                <div className="col-span-3 space-y-4">
                                    <div className="h-20 bg-primary-light/50 rounded-2xl border border-primary/5" />
                                    <div className="space-y-2">
                                        {[1, 2, 3, 4].map(i => (
                                            <div key={i} className="h-8 bg-slate-50 rounded-lg" />
                                        ))}
                                    </div>
                                </div>
                                <div className="col-span-9 space-y-6">
                                    <div className="h-12 bg-white rounded-xl border border-slate-50" />
                                    <div className="grid grid-cols-3 gap-4">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="aspect-video bg-white border border-slate-50 rounded-2xl shadow-sm" />
                                        ))}
                                    </div>
                                    <div className="h-48 bg-white border border-slate-50 rounded-3xl shadow-sm overflow-hidden p-6">
                                        <div className="flex flex-col gap-4 animate-pulse">
                                            <div className="h-4 bg-slate-100 rounded-full w-2/3" />
                                            <div className="h-32 bg-slate-50 rounded-2xl" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Mobile Mockup Overlay */}
                        <motion.div
                            initial={{ x: 50, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ duration: 0.8, delay: 0.6 }}
                            className="absolute -right-4 -bottom-10 md:right-10 md:-bottom-20 w-[140px] md:w-[280px] aspect-[9/19] bg-white rounded-[24px] md:rounded-[48px] border-[5px] md:border-[10px] border-[#0f172a] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] overflow-hidden z-20"
                        >
                            <div className="absolute top-0 inset-x-0 h-6 bg-[#0f172a] flex items-center justify-center">
                                <div className="w-12 h-1 bg-white/10 rounded-full" />
                            </div>
                            <div className="p-4 md:p-6 space-y-4 mt-4">
                                <div className="h-12 md:h-16 bg-primary-light rounded-2xl border border-primary/10 flex items-center justify-center">
                                    <ArrowRight className="size-6 text-primary" />
                                </div>
                                <div className="space-y-2">
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <div key={i} className="h-8 md:h-12 bg-[#f8fafc] rounded-xl border border-slate-50" />
                                    ))}
                                </div>
                            </div>
                        </motion.div>

                        {/* Float Labels */}
                        <div className="hidden lg:block">
                            <motion.div
                                animate={{ y: [0, -10, 0] }}
                                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                className="absolute -left-12 top-20 p-4 bg-white rounded-2xl shadow-xl border border-slate-100 flex items-center gap-3 z-30"
                            >
                                <CheckCircle2 className="size-5 text-emerald-500" />
                                <div className="flex flex-col">
                                    <span className="text-[10px] uppercase font-black text-slate-400">Status Update</span>
                                    <span className="text-xs font-bold text-slate-700">Lead Qualified</span>
                                </div>
                            </motion.div>

                            <motion.div
                                animate={{ y: [0, 10, 0] }}
                                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                                className="absolute -left-20 bottom-40 p-4 bg-white rounded-2xl shadow-xl border border-slate-100 flex items-center gap-3 z-30"
                            >
                                <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center">
                                    <span className="text-primary font-black text-xs">98%</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] uppercase font-black text-slate-400">Match Score</span>
                                    <span className="text-xs font-bold text-slate-700">Perfect Candidate</span>
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
