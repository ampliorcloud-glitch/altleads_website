"use client";

import { motion } from "framer-motion";
import { Shield, Sparkles } from "lucide-react";
import SectionWrapper from "./SectionWrapper";

export default function SolutionOverview() {
    return (
        <SectionWrapper id="intelligence" className="bg-[#f8fafc]">
            <div className="flex flex-col lg:flex-row gap-16 items-center">
                <div className="lg:w-1/2">
                    <span className="text-primary font-bold tracking-widest text-xs uppercase mb-4 block">What Makes Us Different</span>
                    <h2 className="text-4xl md:text-5xl font-black tracking-tight text-[#0f172a] mb-6 leading-tight">
                        Usable intelligence — <br /><span className="text-primary italic">built from real outbound.</span>
                    </h2>
                    <p className="text-slate-500 text-lg leading-relaxed font-medium mb-8">
                        AltLeads intelligence doesn't try to "replace sales." It helps teams execute better by suggesting practical next steps, pitch angles, and message guidance inside the workflow — where reps already work.
                    </p>

                    <div className="space-y-4">
                        {[
                            "Practical next-step suggestions",
                            "Pitch angles tailored to persona",
                            "Channel-specific message guidance",
                            "Built into the workflow, not a separate dashboard",
                        ].map(item => (
                            <div key={item} className="flex items-center gap-3">
                                <Sparkles className="size-4 text-primary flex-shrink-0" />
                                <span className="text-[#0f172a] font-bold text-sm">{item}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="lg:w-1/2">
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="p-10 bg-white rounded-[40px] border border-slate-100 shadow-xl relative overflow-hidden"
                    >
                        <div className="absolute -right-10 -top-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />
                        <div className="flex items-center gap-3 mb-8">
                            <div className="size-10 rounded-xl bg-primary-light flex items-center justify-center">
                                <Shield className="size-5 text-primary" />
                            </div>
                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Privacy Note</span>
                        </div>
                        <p className="text-slate-600 font-medium leading-relaxed relative z-10">
                            Designed to be <span className="text-primary font-bold">privacy-safe</span>, using contextual research and aggregated patterns — not client-confidential exposure. Your data stays yours.
                        </p>
                    </motion.div>
                </div>
            </div>
        </SectionWrapper>
    );
}
