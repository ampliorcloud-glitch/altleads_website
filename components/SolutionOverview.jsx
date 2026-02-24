"use client";

import { motion } from "framer-motion";
import { Zap, Target, Users, BarChart3 } from "lucide-react";
import SectionWrapper from "./SectionWrapper";

const solutions = [
    {
        icon: Zap,
        title: "Unified Pipeline",
        desc: "Seamlessly connect lead generation to frontline sales execution in one high-velocity flow.",
    },
    {
        icon: Target,
        title: "Precision Targeting",
        desc: "Automatically qualify and route leads to the right agent based on real-time territory data.",
    },
    {
        icon: Users,
        title: "Operational Synergy",
        desc: "Keep backend and frontend teams perfectly aligned with shared visibility and live updates.",
    },
    {
        icon: BarChart3,
        title: "15-20 SQLs Monthly",
        desc: "Drive predictable growth with a target of 15-20 Sales Qualified Leads monthly per FTE.",
    },
    {
        icon: Target,
        title: "Global Reach",
        desc: "Deep expertise across India, UAE, Singapore, and the United States markets.",
    },
];

export default function SolutionOverview() {
    return (
        <SectionWrapper id="solution" className="bg-white">
            <div className="text-center max-w-3xl mx-auto mb-20">
                <span className="text-primary font-bold tracking-widest text-xs uppercase mb-4 block">The Solution</span>
                <h2 className="text-4xl md:text-6xl font-black tracking-tight text-[#0f172a] mb-6">
                    Efficiency by design. <br /> <span className="text-primary italic">Success by default.</span>
                </h2>
                <p className="text-slate-500 text-xl font-medium leading-relaxed">
                    AltLeads isn't just another database. It's an engine designed to drive your sales operations forward with zero wasted effort.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {solutions.map((sol, index) => (
                    <motion.div
                        key={sol.title}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex flex-col gap-5 group"
                    >
                        <div className="size-16 rounded-2xl bg-[#f8fafc] border border-slate-100 flex items-center justify-center group-hover:bg-primary group-hover:border-primary transition-all duration-300">
                            <sol.icon className="size-8 text-primary group-hover:text-white transition-colors" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-[#0f172a] mb-2">{sol.title}</h3>
                            <p className="text-slate-500 text-sm leading-relaxed font-medium">
                                {sol.desc}
                            </p>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="mt-20 p-12 bg-primary-light/30 rounded-[40px] border border-blue-100/50 flex flex-col md:flex-row items-center justify-between gap-10">
                <div className="max-w-xl">
                    <h4 className="text-2xl font-black text-[#0f172a] mb-3">Built for the modern revenue engine.</h4>
                    <p className="text-slate-600 font-medium leading-relaxed">
                        AltLeads bridges the critical gap between marketing intent and sales results, ensuring every qualified lead gets the attention it deserves.
                    </p>
                </div>
                <a
                    href="#features"
                    className="px-8 py-4 bg-[#0f172a] text-white font-bold rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 whitespace-nowrap text-center"
                >
                    See the Difference
                </a>
            </div>
        </SectionWrapper>
    );
}
