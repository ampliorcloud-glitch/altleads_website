"use client";

import { motion } from "framer-motion";
import { CheckCircle2, CalendarCheck, ArrowRight } from "lucide-react";
import { useState } from "react";
import SectionWrapper from "./SectionWrapper";

export default function BookDemo() {
    const [status, setStatus] = useState("idle");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus("sending");

        const formData = new FormData(e.target);
        const payload = {
            name: formData.get("name"),
            email: formData.get("email"),
            phone: formData.get("phone"),
            company: formData.get("company"),
            sqlRequired: formData.get("sqlRequired"),
            teamSize: formData.get("teamSize"),
            message: formData.get("message"),
            formType: "book-demo",
        };

        try {
            const res = await fetch("/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                setStatus("success");
            } else {
                setStatus("error");
            }
        } catch {
            setStatus("error");
        }
    };

    if (status === "success") {
        return (
            <SectionWrapper id="book-demo" className="py-32 scroll-mt-20">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-2xl mx-auto bg-white p-12 rounded-[40px] border border-slate-100 shadow-2xl text-center"
                >
                    <div className="size-20 bg-primary-light rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="size-10 text-primary" />
                    </div>
                    <h3 className="text-3xl font-black text-[#0f172a] mb-4">Demo Booked!</h3>
                    <p className="text-slate-500 font-medium text-lg leading-relaxed">
                        Our deployment specialist will reach out within 2 hours to confirm your demo slot.
                    </p>
                </motion.div>
            </SectionWrapper>
        );
    }

    return (
        <SectionWrapper id="book-demo" className="py-32 scroll-mt-20 relative overflow-hidden">
            {/* Background accents */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-[-10%] w-[40%] h-[50%] bg-primary/5 rounded-full blur-[120px]" />
                <div className="absolute bottom-0 right-[-10%] w-[35%] h-[50%] bg-blue-100/40 rounded-full blur-[100px]" />
            </div>

            <div className="max-w-[1280px] mx-auto px-4 md:px-10 relative z-10">
                <div className="text-center mb-16">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                    >
                        <span className="text-primary font-bold tracking-widest text-xs uppercase mb-4 block">
                            Get Started Today
                        </span>
                        <h2 className="text-4xl md:text-6xl font-black tracking-tight text-[#0f172a] mb-6">
                            Book a <span className="text-primary italic">Live Demo</span>
                        </h2>
                        <p className="text-slate-500 text-lg md:text-xl font-medium max-w-2xl mx-auto">
                            See how AltLeads can transform your sales pipeline. Fill in the form and our team will set up a personalised walkthrough.
                        </p>
                    </motion.div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    {/* Left — value props */}
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="space-y-8"
                    >
                        {[
                            { title: "Personalised Walkthrough", desc: "Tailored to your industry and team size." },
                            { title: "Live Q&A With Experts", desc: "Get answers from our deployment specialists." },
                            { title: "Custom Workflow Design", desc: "We'll map a pipeline that fits your process." },
                            { title: "No Commitment Required", desc: "Explore at your own pace — zero pressure." },
                        ].map((item, i) => (
                            <div key={i} className="flex items-start gap-5">
                                <div className="size-12 rounded-2xl bg-primary-light flex items-center justify-center flex-shrink-0">
                                    <CalendarCheck className="size-6 text-primary" />
                                </div>
                                <div>
                                    <h4 className="font-black text-[#0f172a] text-base mb-1">{item.title}</h4>
                                    <p className="text-slate-500 font-medium text-sm">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </motion.div>

                    {/* Right — form */}
                    <motion.form
                        onSubmit={handleSubmit}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="bg-white p-8 md:p-10 rounded-[40px] border border-slate-100 shadow-2xl"
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                            <div className="space-y-2">
                                <label className="text-sm font-black text-[#0f172a] uppercase tracking-tighter">Full Name *</label>
                                <input
                                    required
                                    name="name"
                                    type="text"
                                    placeholder="John Doe"
                                    className="w-full px-6 py-4 bg-[#f8fafc] border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-black text-[#0f172a] uppercase tracking-tighter">Business Email *</label>
                                <input
                                    required
                                    name="email"
                                    type="email"
                                    placeholder="john@company.com"
                                    className="w-full px-6 py-4 bg-[#f8fafc] border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-black text-[#0f172a] uppercase tracking-tighter">Phone Number *</label>
                                <input
                                    required
                                    name="phone"
                                    type="tel"
                                    placeholder="+91 9876543210"
                                    className="w-full px-6 py-4 bg-[#f8fafc] border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-black text-[#0f172a] uppercase tracking-tighter">Company Name *</label>
                                <input
                                    required
                                    name="company"
                                    type="text"
                                    placeholder="Acme Corp"
                                    className="w-full px-6 py-4 bg-[#f8fafc] border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-black text-[#0f172a] uppercase tracking-tighter">Sales Qualified Leads Required *</label>
                                <input
                                    required
                                    name="sqlRequired"
                                    type="number"
                                    min="1"
                                    placeholder="e.g. 500"
                                    className="w-full px-6 py-4 bg-[#f8fafc] border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-black text-[#0f172a] uppercase tracking-tighter">Current Sales Team Size *</label>
                                <input
                                    required
                                    name="teamSize"
                                    type="number"
                                    min="1"
                                    placeholder="e.g. 10"
                                    className="w-full px-6 py-4 bg-[#f8fafc] border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                />
                            </div>
                        </div>

                        <div className="space-y-2 mb-8">
                            <label className="text-sm font-black text-[#0f172a] uppercase tracking-tighter">How can we help? *</label>
                            <textarea
                                required
                                name="message"
                                placeholder="Tell us about your sales operation..."
                                rows={3}
                                className="w-full px-6 py-4 bg-[#f8fafc] border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium resize-none"
                            ></textarea>
                        </div>

                        <button
                            disabled={status === "sending"}
                            className="w-full py-5 bg-[#0f172a] text-white font-black rounded-2xl hover:bg-slate-800 transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-70 group"
                        >
                            {status === "sending" ? "Processing..." : status === "error" ? "Try Again" : "Book My Demo"}
                            <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
                        </button>

                        {status === "error" && (
                            <p className="mt-4 text-center text-red-500 text-sm font-bold">
                                Something went wrong. Please try again.
                            </p>
                        )}

                        <p className="mt-5 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                            No credit card required • Response within 2 hours
                        </p>
                    </motion.form>
                </div>
            </div>
        </SectionWrapper>
    );
}
