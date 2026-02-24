"use client";

import { motion } from "framer-motion";
import { Users, Rocket, Eye, ArrowRight } from "lucide-react";
import SectionWrapper from "./SectionWrapper";

const useCases = [
    {
        title: "Outbound SDR Teams",
        subtitle: "20–100 Seats",
        icon: Users,
        desc: "Improve follow-up discipline and meeting conversion with structured multi-channel cadences and automatic activity tracking.",
        color: "bg-primary-light",
        iconColor: "text-primary",
    },
    {
        title: "Founder-Led Sales",
        subtitle: "Speed Without Chaos",
        icon: Rocket,
        desc: "Move fast without losing track. Run outbound, track outcomes, and iterate on messaging — all without building a complex ops stack.",
        color: "bg-violet-50",
        iconColor: "text-violet-600",
    },
    {
        title: "Sales Managers",
        subtitle: "Visibility & Coaching",
        icon: Eye,
        desc: "Get visibility and coaching signals, not just activity noise. See what's actually happening in your pipeline and where reps need help.",
        color: "bg-emerald-50",
        iconColor: "text-emerald-600",
    },
];

export default function UseCases() {
    return (
        <SectionWrapper id="usecases" className="bg-white">
            <div className="text-center mb-24 max-w-4xl mx-auto">
                <span className="text-primary font-black tracking-[0.2em] text-[10px] uppercase mb-6 block">Target Profiles</span>
                <h2 className="text-[40px] md:text-[64px] font-black headline-premium text-[#0f172a] mb-8 leading-none">
                    Built for teams that <br /><span className="text-primary italic">choose to execute.</span>
                </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {useCases.map((useCase, index) => (
                    <motion.div
                        key={useCase.title}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.1 }}
                        className="p-12 bg-white border border-slate-100 rounded-[48px] hover:border-primary/20 hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-2 transition-all group"
                    >
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-primary mb-8 block">{useCase.subtitle}</span>
                        <div className={`size-16 rounded-3xl ${useCase.color} flex items-center justify-center mb-10 group-hover:scale-110 transition-transform`}>
                            <useCase.icon className={`size-8 ${useCase.iconColor}`} />
                        </div>
                        <h3 className="text-2xl font-black text-[#0f172a] mb-4 group-hover:text-primary transition-colors">{useCase.title}</h3>
                        <p className="text-slate-500 text-base leading-relaxed font-medium">
                            {useCase.desc}
                        </p>
                    </motion.div>
                ))}
            </div>
        </SectionWrapper>
    );
}
