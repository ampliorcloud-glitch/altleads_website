"use client";

import { motion } from "framer-motion";
import { Filter, Calendar, ThumbsUp, Handshake, RefreshCw } from "lucide-react";

const steps = [
    { icon: Filter, title: "Capture", desc: "Leads enter via Web Portal" },
    { icon: Calendar, title: "Schedule", desc: "Backend qualifies & books" },
    { icon: ThumbsUp, title: "Accept", desc: "Sales rep gets notified", active: true },
    { icon: Handshake, title: "Conduct", desc: "Meeting happens via App" },
    { icon: RefreshCw, title: "Refine", desc: "Feedback loops back" },
];

export default function Workflow() {
    return (
        <section id="workflow" className="py-24 px-4 md:px-10 bg-white border-b border-slate-100">
            <div className="max-w-[1280px] mx-auto">
                <div className="text-center mb-16 max-w-2xl mx-auto">
                    <span className="text-primary font-bold tracking-wider text-xs uppercase mb-3 block bg-primary-light py-1 px-3 rounded-full w-fit mx-auto">Process Workflow</span>
                    <h2 className="text-3xl md:text-5xl font-black tracking-tight text-[#0f172a] mb-4">
                        The Workflow that Aligns Teams
                    </h2>
                    <p className="text-lg text-slate-500 max-w-xl mx-auto">
                        From lead capture to deal refinement, AltLeads bridges the gap between your backend operations and frontline sales.
                    </p>
                </div>

                <div className="relative">
                    {/* Connector Line */}
                    <div className="hidden md:block absolute top-[28px] left-[10%] right-[10%] h-0.5 bg-slate-100 -z-0" />

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-8 md:gap-4 relative z-10">
                        {steps.map((step, index) => (
                            <motion.div
                                key={step.title}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.1 }}
                                className="flex flex-col items-center text-center group"
                            >
                                <div className={`size-14 rounded-2xl border-2 flex items-center justify-center mb-4 transition-all duration-300 ${step.active
                                    ? "bg-primary border-primary shadow-lg shadow-primary/30"
                                    : "bg-white border-slate-100 shadow-sm group-hover:border-primary group-hover:shadow-lg group-hover:shadow-primary/10"
                                    }`}>
                                    <step.icon className={`size-7 ${step.active ? "text-white" : "text-slate-400 group-hover:text-primary"} transition-colors`} />
                                </div>
                                <h3 className={`text-lg font-bold mb-1 ${step.active ? "text-primary" : "text-[#0f172a] group-hover:text-primary"} transition-colors`}>
                                    {step.title}
                                </h3>
                                <p className="text-sm text-slate-500">{step.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
