"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import { Briefcase, MapPin, Clock, ArrowRight } from "lucide-react";

const positions = [
    {
        title: "Senior SDR — Outbound Mastery",
        location: "Bengaluru / Remote",
        type: "Full-time",
        description: "Join our core execution team to scale outbound cadences for B2B founders globally. Scale your career with AltLeads."
    },
    {
        title: "Product Engineer (Next.js/React)",
        location: "Bengaluru",
        type: "Full-time",
        description: "Build the future of CRM orchestration. We're looking for engineers who care about UX and billion-dollar aesthetics."
    },
    {
        title: "Growth Marketing Manager",
        location: "Remote",
        type: "Full-time",
        description: "Own the top-of-funnel and help us define how B2B teams think about multi-channel intelligence."
    }
];

export default function CareersPage() {
    return (
        <main className="min-h-screen bg-white">
            <Navbar />

            {/* Hero */}
            <section className="pt-32 pb-20 px-4 bg-[#f8fafc]">
                <div className="max-w-[1280px] mx-auto text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-bold mb-6"
                    >
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </span>
                        We're Hiring
                    </motion.div>
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-5xl md:text-7xl font-black text-[#0f172a] mb-8 tracking-tight"
                    >
                        Join the team building <br className="hidden md:block" />
                        <span className="text-primary">the future of outbound.</span>
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="max-w-2xl mx-auto text-lg text-slate-500 font-medium leading-relaxed"
                    >
                        We’re remote-first, execution-heavy, and obsessed with outcomes. If you're tired of legacy CRMs and want to build high-performance tools, we should talk.
                    </motion.p>
                </div>
            </section>

            {/* Open Positions */}
            <section className="py-24 px-4">
                <div className="max-w-4xl mx-auto">
                    <div className="flex justify-between items-end mb-12">
                        <div>
                            <h2 className="text-3xl font-black text-[#0f172a] mb-2">Open Positions</h2>
                            <p className="text-slate-500 font-medium">Find your next challenge in sales, engineering, or marketing.</p>
                        </div>
                    </div>

                    <div className="grid gap-6">
                        {positions.map((pos, i) => (
                            <motion.div
                                key={pos.title}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="group p-8 rounded-3xl border border-slate-100 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all bg-white cursor-pointer"
                            >
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                    <div className="flex-1">
                                        <div className="flex flex-wrap gap-3 mb-4">
                                            <span className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-lg text-xs font-bold text-slate-500">
                                                <MapPin className="size-3" /> {pos.location}
                                            </span>
                                            <span className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-lg text-xs font-bold text-slate-500">
                                                <Clock className="size-3" /> {pos.type}
                                            </span>
                                        </div>
                                        <h3 className="text-xl font-bold text-[#0f172a] group-hover:text-primary transition-colors mb-2">
                                            {pos.title}
                                        </h3>
                                        <p className="text-slate-500 font-medium leading-relaxed">
                                            {pos.description}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm font-bold text-primary opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                                            Apply Now
                                        </span>
                                        <div className="size-12 rounded-full border border-slate-100 flex items-center justify-center group-hover:bg-primary group-hover:border-primary transition-all">
                                            <ArrowRight className="size-5 text-slate-400 group-hover:text-white transition-all" />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    <div className="mt-16 p-8 rounded-3xl bg-[#0f172a] text-center">
                        <h3 className="text-2xl font-bold text-white mb-4">Don't see a perfect fit?</h3>
                        <p className="text-slate-400 font-medium mb-8">We're always looking for talented people. Send us your resume and we'll keep you in mind.</p>
                        <a
                            href="mailto:careers@altleads.com"
                            className="inline-flex items-center justify-center px-8 py-4 rounded-2xl bg-primary text-white font-black hover:scale-105 transition-all shadow-lg shadow-primary/20"
                        >
                            General Application
                        </a>
                    </div>
                </div>
            </section>

            <Footer />
        </main>
    );
}
