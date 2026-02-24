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
            <div className="text-center mb-20 max-w-3xl mx-auto">
                <span className="text-primary font-bold tracking-widest text-xs uppercase mb-4 block">Use Cases</span>
                <h2 className="text-4xl md:text-5xl font-black tracking-tight text-[#0f172a] mb-6 leading-tight">
                    Built for teams that <span className="text-primary italic">execute.</span>
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
                        className="p-10 bg-[#f8fafc] border border-slate-100 rounded-[40px] hover:border-primary/20 hover:shadow-xl hover:-translate-y-1 transition-all group"
                    >
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary mb-6 block">{useCase.subtitle}</span>
                        <div className={`size-14 rounded-2xl ${useCase.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                            <useCase.icon className={`size-7 ${useCase.iconColor}`} />
                        </div>
                        <h3 className="text-2xl font-bold text-[#0f172a] mb-4 group-hover:text-primary transition-colors">{useCase.title}</h3>
                        <p className="text-slate-500 leading-relaxed font-medium">
                            {useCase.desc}
                        </p>
                    </motion.div>
                ))}
            </div>
        </SectionWrapper>
    );
}
