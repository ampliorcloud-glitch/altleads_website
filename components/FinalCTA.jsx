"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import SectionWrapper from "./SectionWrapper";

export default function FinalCTA() {
    return (
        <SectionWrapper id="cta" className="bg-[#0f172a] text-center relative overflow-hidden py-32 rounded-[60px] mx-4 md:mx-10 mb-20 scroll-mt-20">
            {/* Cinematic Background */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden opacity-20">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[100%] bg-primary rounded-full blur-[160px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[100%] bg-blue-400 rounded-full blur-[140px]" />
            </div>

            <div className="relative z-10 max-w-4xl mx-auto">
                <span className="text-blue-400 font-black tracking-[0.2em] text-[10px] uppercase mb-10 block">The Next Step</span>
                <h2 className="text-[42px] md:text-[80px] font-black headline-premium text-white mb-10 leading-none">
                    Turn fragmented outreach <br /> into a <span className="text-slate-500">System of Mastery.</span>
                </h2>
                <p className="text-slate-400 text-lg md:text-2xl font-medium mb-16 max-w-3xl mx-auto leading-relaxed">
                    Unify your CRM, outreach, and intelligence into one execution layer that actually converts.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                    <a
                        href="/contact"
                        className="w-full sm:w-auto px-12 py-5 bg-white text-[#0f172a] font-black rounded-2xl hover:bg-slate-100 transition-all shadow-2xl flex items-center justify-center gap-3 group text-center glow-on-hover"
                    >
                        Book Absolute Access
                        <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
                    </a>
                    <a
                        href="/contact"
                        className="w-full sm:w-auto px-10 py-5 bg-transparent text-white border-2 border-slate-700 font-black rounded-2xl hover:bg-white/5 transition-all text-center"
                    >
                        Get Pilot Pricing
                    </a>
                </div>

                <p className="mt-12 text-slate-500 text-sm font-bold tracking-wide">
                    FAST ONBOARDING • MULTI-CHANNEL EXECUTION • PRIVACY-SAFE INTELLIGENCE
                </p>
            </div>
        </SectionWrapper>
    );
}
