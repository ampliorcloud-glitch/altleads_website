"use client";

import { motion } from "framer-motion";
import { Database, Share2, School, Rocket } from "lucide-react";

const steps = [
    {
        day: "Day 1-3",
        title: "Data Migration",
        desc: "Secure transfer of all your existing contacts and deal history.",
        icon: Database
    },
    {
        day: "Day 4-7",
        title: "Workflow Mapping",
        desc: "Customizing pipelines to match your backend and frontend processes.",
        icon: Share2
    },
    {
        day: "Day 8-12",
        title: "Team Training",
        desc: "Live sessions for admins and sales reps to ensure adoption.",
        icon: School
    },
    {
        day: "Day 14",
        title: "Go Live",
        desc: "Launch day support and final system checks.",
        icon: Rocket
    },
];

export default function Implementation() {
    return (
        <section className="py-24 px-4 md:px-10 bg-[#f8fafc]">
            <div className="max-w-[1280px] mx-auto">
                <div className="mb-16">
                    <h2 className="text-3xl md:text-5xl font-black text-[#0f172a] mb-2">Live in 14 Days</h2>
                    <p className="text-slate-500 font-medium text-lg">We don't just hand you a login. We build your workflow.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
                    {/* Timeline Line */}
                    <div className="hidden md:block absolute top-12 left-0 w-full h-0.5 bg-slate-200 -z-0" />

                    {steps.map((step, index) => (
                        <motion.div
                            key={step.title}
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            className="flex flex-col items-start group relative z-10"
                        >
                            <div className="flex items-center justify-center size-20 rounded-full bg-white border-[6px] border-[#f8fafc] shadow-md mb-6 group-hover:border-primary-light transition-all">
                                <step.icon className="size-8 text-primary" />
                            </div>
                            <h4 className="text-xl font-black text-[#0f172a] mb-1">{step.title}</h4>
                            <p className="text-sm font-black text-primary mb-3 tracking-wide uppercase">{step.day}</p>
                            <p className="text-sm text-slate-500 leading-relaxed max-w-[200px]">{step.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
