"use client";

import { motion } from "framer-motion";
import { Briefcase, Map, CheckCircle, ArrowRight } from "lucide-react";
import SectionWrapper from "./SectionWrapper";

const useCases = [
    {
        title: "B2B Agency Ops",
        subtitle: "Agency",
        icon: Briefcase,
        desc: "Scale your lead generation without losing control over sales quality. Centralize client management and white-label reporting.",
    },
    {
        title: "Field Sales",
        subtitle: "Enterprise",
        icon: Map,
        desc: "Coordinate massive frontline teams with pinpoint geographic accuracy. Optimize mobile-first routing and territory assignment.",
    },
];

export default function UseCases() {
    return (
        <SectionWrapper id="usecases" className="bg-white">
            <div className="flex flex-col lg:flex-row gap-16 items-center">
                <div className="lg:w-1/2">
                    <span className="text-primary font-bold tracking-widest text-xs uppercase mb-4 block">Who it's for</span>
                    <h2 className="text-4xl md:text-5xl font-black tracking-tight text-[#0f172a] mb-6 leading-tight">
                        Built for those who lead <br /> <span className="text-primary">from the front.</span>
                    </h2>
                    <p className="text-slate-500 text-lg leading-relaxed font-medium mb-10">
                        Whether you're a high-growth agency or a large-scale field operation, AltLeads provides the structure you need to win.
                    </p>

                    <div className="space-y-4">
                        {["Sales-Marketing Alignment", "Real-time Field Reporting", "Automated Lead Qualification"].map(item => (
                            <div key={item} className="flex items-center gap-3">
                                <CheckCircle className="size-5 text-emerald-500" />
                                <span className="text-[#0f172a] font-bold">{item}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="lg:w-1/2 grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                    {useCases.map((useCase, index) => (
                        <motion.div
                            key={useCase.title}
                            initial={{ opacity: 0, x: 20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="p-8 bg-slate-50 border border-slate-100 rounded-[40px] hover:border-primary/20 transition-all group"
                        >
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary mb-4 block">{useCase.subtitle}</span>
                            <useCase.icon className="size-10 text-[#0f172a] mb-6 group-hover:scale-110 transition-transform origin-left" />
                            <h3 className="text-xl font-bold text-[#0f172a] mb-3">{useCase.title}</h3>
                            <p className="text-slate-500 text-sm leading-relaxed mb-6 italic">
                                "{useCase.desc}"
                            </p>
                            <button className="text-[#0f172a] font-bold text-xs flex items-center gap-2 group/btn border-b border-transparent hover:border-[#0f172a] transition-all w-fit">
                                Read Case Study
                                <ArrowRight className="size-3 group-hover/btn:translate-x-1 transition-transform" />
                            </button>
                        </motion.div>
                    ))}
                </div>
            </div>
        </SectionWrapper>
    );
}
