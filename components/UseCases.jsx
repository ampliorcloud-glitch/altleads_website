"use client";

import { motion } from "framer-motion";
import { Briefcase, Map, CheckCircle, ArrowRight } from "lucide-react";

const useCases = [
    {
        title: "B2B Agency Ops",
        subtitle: "Agency",
        icon: Briefcase,
        desc: "Centralize client management and white-label reporting. Streamline your backend lead gen with frontend sales teams effortlessly.",
        points: ["Unified Client Portal", "Automated Retainer Billing", "White-label Analytics"],
        cta: "Explore Agency Solution",
        img: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2071&auto=format&fit=crop"
    },
    {
        title: "Distributed Field Sales",
        subtitle: "Field Sales",
        icon: Map,
        desc: "Optimize mobile-first routing and lead territory assignment. Empower your field agents with real-time data and offline tools.",
        points: ["Geolocation Tracking", "Offline Mode Sync", "Territory Heatmaps"],
        cta: "Explore Field Solution",
        img: "https://images.unsplash.com/photo-1556761175-b413da4baf72?q=80&w=2074&auto=format&fit=crop"
    }
];

export default function UseCases() {
    return (
        <section id="use-cases" className="py-24 px-4 md:px-10 bg-white border-b border-slate-100">
            <div className="max-w-[1280px] mx-auto">
                <div className="mb-16 text-center">
                    <h2 className="text-3xl md:text-5xl font-black text-[#0f172a] mb-4">Built for complex sales workflows</h2>
                    <p className="text-slate-500 max-w-2xl mx-auto text-lg leading-relaxed">
                        Whether you are running an agency or managing feet on the street, AltLeads adapts to your specific operational needs.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {useCases.map((uc, index) => (
                        <motion.div
                            key={uc.title}
                            initial={{ opacity: 0, scale: 0.98 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            className="flex flex-col bg-[#f8fafc] border border-slate-100 rounded-3xl overflow-hidden bento-card"
                        >
                            <div className="h-56 relative w-full">
                                <img src={uc.img} alt={uc.title} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a]/80 to-transparent" />
                                <div className="absolute bottom-6 left-6 flex items-center gap-2 text-white">
                                    <uc.icon className="size-5" />
                                    <span className="font-bold tracking-wide uppercase text-xs">{uc.subtitle}</span>
                                </div>
                            </div>
                            <div className="p-8 flex flex-col flex-grow">
                                <h3 className="text-2xl font-black text-[#0f172a] mb-3">{uc.title}</h3>
                                <p className="text-slate-600 mb-8 leading-relaxed">
                                    {uc.desc}
                                </p>
                                <ul className="space-y-4 mb-10">
                                    {uc.points.map((pt) => (
                                        <li key={pt} className="flex items-center gap-3 text-sm font-bold text-slate-700">
                                            <CheckCircle className="size-5 text-primary" />
                                            {pt}
                                        </li>
                                    ))}
                                </ul>
                                <button className="flex items-center justify-center gap-2 px-6 py-3 bg-primary/10 text-primary font-bold rounded-xl hover:bg-primary/20 transition-all w-fit">
                                    {uc.cta}
                                    <ArrowRight className="size-4" />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
