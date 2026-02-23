"use client";

import { motion } from "framer-motion";
import { Database, Share2, School, Rocket } from "lucide-react";
import SectionWrapper from "./SectionWrapper";

const steps = [
    {
        day: "Day 1-3",
        title: "Data Migration",
        desc: "Secure transfer of all your existing client data and leads into the AltLeads engine.",
        icon: Database
    },
    {
        day: "Day 4-7",
        title: "Workflow Mapping",
        desc: "We configure your custom intake forms and automated qualification scripts.",
        icon: Share2
    },
    {
        day: "Day 8-10",
        title: "Team Training",
        desc: "Live walkthroughs for backend coordinators and field agents on the mobile app.",
        icon: School
    },
    {
        day: "Day 14",
        title: "Full Launch",
        desc: "Go live with a unified operation. Start turning leads into meetings at scale.",
        icon: Rocket
    },
];

export default function Implementation() {
    return (
        <SectionWrapper id="implementation" className="bg-[#f8fafc]">
            <div className="text-center mb-20 max-w-3xl mx-auto">
                <span className="text-primary font-bold tracking-widest text-xs uppercase mb-4 block">Deployment</span>
                <h2 className="text-4xl md:text-5xl font-black tracking-tight text-[#0f172a] mb-6">
                    Up and running in <br /> <span className="text-primary italic">under 14 days.</span>
                </h2>
                <p className="text-slate-500 text-lg font-medium">
                    Our rapid deployment model ensures you start seeing ROI within weeks, not months. We handle the heavy lifting of the transition.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {steps.map((step, index) => (
                    <motion.div
                        key={step.title}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="p-8 bg-white border border-slate-100 rounded-[40px] shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all group"
                    >
                        <div className="flex justify-between items-start mb-6">
                            <div className="size-12 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-primary-light transition-colors">
                                <step.icon className="size-6 text-slate-500 group-hover:text-primary transition-colors" />
                            </div>
                            <span className="text-xs font-black text-primary bg-primary-light px-3 py-1 rounded-full uppercase tracking-tighter">
                                {step.day}
                            </span>
                        </div>
                        <h3 className="text-xl font-bold text-[#0f172a] mb-3">{step.title}</h3>
                        <p className="text-slate-500 text-sm leading-relaxed">
                            {step.desc}
                        </p>
                    </motion.div>
                ))}
            </div>
        </SectionWrapper>
    );
}
