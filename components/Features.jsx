"use client";

import { motion } from "framer-motion";
import { Monitor, Smartphone, Database, Zap, AlertTriangle, FileText, Bell, Star } from "lucide-react";
import SectionWrapper from "./SectionWrapper";

export default function Features() {
    return (
        <SectionWrapper id="features" className="bg-slate-50">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
                {/* Backend Team Features */}
                <div className="flex flex-col gap-10">
                    <div className="flex items-center gap-5">
                        <div className="p-4 bg-primary-light rounded-2xl border border-blue-100 shadow-sm">
                            <Monitor className="text-primary size-8" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-[#0f172a]">For Backend Teams</h2>
                            <p className="text-slate-500 font-medium">Powerful web portal for qualification & scheduling.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="col-span-1 sm:col-span-2 p-8 bg-white border border-slate-100 rounded-3xl bento-card relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Database className="size-24 text-primary" />
                            </div>
                            <div className="size-12 rounded-xl bg-slate-50 flex items-center justify-center mb-6 group-hover:bg-primary-light transition-colors">
                                <Database className="size-6 text-slate-500 group-hover:text-primary" />
                            </div>
                            <h3 className="text-xl font-bold text-[#0f172a] mb-3 group-hover:text-primary transition-colors">Centralized Lead Database</h3>
                            <p className="text-slate-500 leading-relaxed">
                                A single source of truth for all incoming leads. Advanced filtering allows your team to slice and dice data by source, status, or potential value instantly.
                            </p>
                            <div className="mt-8 h-2 bg-slate-50 rounded-full overflow-hidden w-full">
                                <div className="h-full bg-primary w-2/3 rounded-full" />
                            </div>
                        </div>

                        <div className="p-8 bg-white border border-slate-100 rounded-3xl bento-card group">
                            <div className="size-12 rounded-xl bg-slate-50 flex items-center justify-center mb-6 group-hover:bg-primary-light transition-colors">
                                <Zap className="size-6 text-slate-500 group-hover:text-primary" />
                            </div>
                            <h3 className="text-lg font-bold text-[#0f172a] mb-2 group-hover:text-primary transition-colors">Smart Questionnaires</h3>
                            <p className="text-sm text-slate-500 leading-relaxed">
                                Customizable intake forms that qualify leads before they ever reach a human.
                            </p>
                        </div>

                        <div className="p-8 bg-orange-50/50 border border-orange-100 rounded-3xl bento-card relative overflow-hidden group">
                            <AlertTriangle className="absolute -right-4 -bottom-4 size-24 text-orange-200 opacity-20" />
                            <div className="size-12 rounded-xl bg-orange-100 flex items-center justify-center mb-6">
                                <AlertTriangle className="size-6 text-orange-600" />
                            </div>
                            <h3 className="text-lg font-bold text-[#0f172a] mb-2">Conflict Detection</h3>
                            <p className="text-sm text-slate-600 leading-relaxed">
                                Automatically detect and prevent multi-client scheduling overlaps across agent calendars.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Sales Team Features */}
                <div className="flex flex-col gap-10">
                    <div className="flex items-center gap-5">
                        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                            <Smartphone className="text-slate-700 size-8" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-[#0f172a]">For Sales Teams</h2>
                            <p className="text-slate-500 font-medium">Streamlined mobile app for field execution.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="col-span-1 sm:col-span-2 p-8 bg-white border border-slate-100 rounded-3xl bento-card relative overflow-hidden group">
                            <div className="absolute -right-10 -top-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-all" />
                            <div className="size-12 rounded-xl bg-slate-50 flex items-center justify-center mb-6 group-hover:bg-primary-light transition-colors relative z-10">
                                <FileText className="size-6 text-slate-500 group-hover:text-primary transition-colors" />
                            </div>
                            <h3 className="text-xl font-bold text-[#0f172a] mb-3 group-hover:text-primary transition-colors relative z-10">Client Briefing Sheets</h3>
                            <p className="text-slate-500 leading-relaxed relative z-10">
                                Sales reps receive a "Battle Card" for every meeting. It contains key client info, answers from the questionnaire, and historical context—all on one mobile screen.
                            </p>
                        </div>

                        <div className="p-8 bg-white border border-slate-100 rounded-3xl bento-card group">
                            <div className="size-12 rounded-xl bg-slate-50 flex items-center justify-center mb-6 group-hover:bg-primary-light transition-colors">
                                <Bell className="size-6 text-slate-500 group-hover:text-primary" />
                            </div>
                            <h3 className="text-lg font-bold text-[#0f172a] mb-2 group-hover:text-primary transition-colors">Instant Alerts</h3>
                            <p className="text-sm text-slate-500 leading-relaxed">
                                Real-time push notifications for new bookings, cancellations, or urgent client updates.
                            </p>
                        </div>

                        <div className="p-8 bg-primary-light/50 border border-blue-100 rounded-3xl bento-card group">
                            <div className="size-12 rounded-xl bg-primary-light flex items-center justify-center mb-6">
                                <Star className="size-6 text-primary" />
                            </div>
                            <h3 className="text-lg font-bold text-[#0f172a] mb-2">30s Feedback</h3>
                            <p className="text-sm text-blue-700 leading-relaxed font-medium">
                                Post-meeting feedback forms designed to be completed in under 30 seconds to keep data fresh.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-24 pt-12 border-t border-slate-200/60">
                <div className="flex flex-col items-center gap-8">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Engineered with Precision</span>
                    <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-40 grayscale hover:grayscale-0 transition-all duration-700">
                        {['Apollo', 'LinkedIn Sales Navigator', 'Lemlist', 'WhatsApp Business'].map((tech) => (
                            <div key={tech} className="text-xl font-black text-[#0f172a] tracking-tighter">
                                {tech}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </SectionWrapper>
    );
}
