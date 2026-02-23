"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export default function FinalCTA() {
    return (
        <section className="py-24 px-4 bg-[#0f172a] text-center relative overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#0099d6 1.5px, transparent 1.5px)', backgroundSize: '40px 40px' }} />

            <div className="relative max-w-4xl mx-auto z-10">
                <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    className="text-4xl md:text-6xl font-black text-white mb-8 tracking-tight"
                >
                    Stop losing qualified leads <br /> in the handoff.
                </motion.h2>
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-lg md:text-xl text-slate-400 mb-12 max-w-2xl mx-auto font-medium"
                >
                    Join 500+ sales teams aligning their revenue engine with AltLeads today.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="flex flex-col sm:flex-row items-center justify-center gap-4"
                >
                    <button className="w-full sm:w-auto px-10 py-5 bg-primary hover:bg-primary-dark text-white text-lg font-bold rounded-2xl shadow-xl shadow-primary/20 transition-all flex items-center justify-center gap-2">
                        Book a Demo
                        <ArrowRight className="size-5" />
                    </button>
                    <button className="w-full sm:w-auto px-10 py-5 bg-transparent border border-slate-700 hover:bg-slate-800 text-white text-lg font-bold rounded-2xl transition-all">
                        Start 14-Day Trial
                    </button>
                </motion.div>

                <p className="mt-8 text-sm text-slate-500 font-medium">No credit card required for trial. Cancel anytime.</p>
            </div>
        </section>
    );
}
