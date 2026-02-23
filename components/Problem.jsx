"use client";

import { motion } from "framer-motion";
import { AlertCircle, Lock, LayoutGrid, EyeOff } from "lucide-react";
import SectionWrapper from "./SectionWrapper";

const painPoints = [
    {
        icon: AlertCircle,
        title: "Clogged Pipelines",
        desc: "Qualified leads get buried under administrative noise, causing delays in follow-ups and lost revenue opportunities.",
        color: "text-red-500",
        bg: "bg-red-50"
    },
    {
        icon: Lock,
        title: "Fragmented Data",
        desc: "Backend operations and frontend sales teams operate in silos, leading to inconsistent client information and mixed messaging.",
        color: "text-orange-500",
        bg: "bg-orange-50"
    },
    {
        icon: LayoutGrid,
        title: "Conflict Chaos",
        desc: "Overlapping schedules and territory disputes create internal friction and project a disorganized image to your clients.",
        color: "text-amber-500",
        bg: "bg-amber-50"
    },
    {
        icon: EyeOff,
        title: "Blind Spots",
        desc: "Without real-time feedback loops from the field, leadership makes critical decisions based on outdated or incomplete data.",
        color: "text-rose-500",
        bg: "bg-rose-50"
    }
];

export default function Problem() {
    return (
        <SectionWrapper id="problem" className="bg-[#0f172a] text-white py-32">
            <div className="flex flex-col lg:flex-row gap-16 items-center">
                <div className="lg:w-1/3">
                    <span className="text-primary font-bold tracking-widest text-xs uppercase mb-4 block">The Friction</span>
                    <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-6 leading-tight">
                        Sales teams are slowed down by <span className="text-slate-500">invisible barriers.</span>
                    </h2>
                    <p className="text-slate-400 text-lg leading-relaxed font-medium">
                        Most CRMs are just fancy spreadsheets. They store data, but they don't solve the friction between finding a lead and closing a deal.
                    </p>
                </div>

                <div className="lg:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {painPoints.map((point, index) => (
                        <motion.div
                            key={point.title}
                            initial={{ opacity: 0, x: 20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="p-8 bg-slate-900/50 border border-slate-800 rounded-3xl hover:border-slate-700 transition-all group"
                        >
                            <div className={`size-12 rounded-xl ${point.bg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                                <point.icon className={`size-6 ${point.color}`} />
                            </div>
                            <h3 className="text-xl font-bold mb-3">{point.title}</h3>
                            <p className="text-slate-400 text-sm leading-relaxed font-medium">
                                {point.desc}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </SectionWrapper>
    );
}
