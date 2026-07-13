"use client";

import { motion } from "framer-motion";
import { AlertCircle, BarChart3, BrainCircuit } from "lucide-react";
import SectionWrapper from "./SectionWrapper";

const painPoints = [
    {
        icon: AlertCircle,
        title: "Reps forget follow-ups",
        result: "Pipeline leakage",
        desc: "Without sequence enforcement, qualified prospects silently fall through the cracks between touches.",
        color: "text-red-500",
        bg: "bg-red-50",
    },
    {
        icon: BarChart3,
        title: "Activity reporting is unreliable",
        result: "Weak coaching",
        desc: "Managers can't coach what they can't see. Manual CRM logging creates blind spots in every pipeline review.",
        color: "text-orange-500",
        bg: "bg-orange-50",
    },
    {
        icon: BrainCircuit,
        title: "Generic AI suggestions",
        result: "Low adoption",
        desc: "Off-the-shelf AI tools generate generic output that reps ignore — because it doesn't fit their workflow or context.",
        color: "text-amber-500",
        bg: "bg-amber-50",
    },
];

export default function Problem() {
    return (
        <SectionWrapper id="problem" className="bg-[#0f172a] text-white py-32">
            <div className="flex flex-col lg:flex-row gap-16 items-center">
                <div className="lg:w-2/5">
                    <span className="text-primary font-black tracking-[0.2em] text-[10px] uppercase mb-6 block">The Reality</span>
                    <h2 className="text-[40px] md:text-[56px] font-black headline-premium mb-8 leading-none">
                        Most CRMs store data. <br /><span className="text-[#64748b]">They don’t run outbound.</span>
                    </h2>
                    <p className="text-slate-400 text-lg md:text-xl leading-relaxed font-medium mb-12">
                        Most sales teams don’t fail because of effort — they fail because execution is fragmented. Follow-ups slip, reporting becomes unreliable, and “AI insights” sit unused in separate dashboards.
                    </p>
                    <div className="p-8 bg-white/5 border border-slate-700 rounded-[32px] backdrop-blur-sm">
                        <p className="text-sm font-bold text-slate-300 leading-relaxed">
                            <span className="text-primary">AltLeads fixes this by being workflow-first:</span> It combines CRM, outreach cadences, and usable intelligence into one execution layer, so teams move faster and managers see what’s really happening.
                        </p>
                    </div>
                </div>

                <div className="lg:w-3/5 grid grid-cols-1 md:grid-cols-3 gap-6">
                    {painPoints.map((point, index) => (
                        <motion.div
                            key={point.title}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            className="p-8 bg-slate-900/50 border border-slate-800 rounded-3xl hover:border-slate-700 transition-all group flex flex-col"
                        >
                            <div className={`size-12 rounded-xl ${point.bg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                                <point.icon className={`size-6 ${point.color}`} />
                            </div>
                            <h3 className="text-lg font-bold mb-2">{point.title}</h3>
                            <span className={`text-xs font-black uppercase tracking-widest ${point.color} mb-4 block`}>→ {point.result}</span>
                            <p className="text-slate-400 text-sm leading-relaxed font-medium mt-auto">
                                {point.desc}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </SectionWrapper>
    );
}
