"use client";

import { motion } from "framer-motion";
import { Send, CheckCircle2 } from "lucide-react";
import { useState } from "react";

export default function ContactForm() {
    const [status, setStatus] = useState("idle"); // idle, sending, success

    const handleSubmit = (e) => {
        e.preventDefault();
        setStatus("sending");
        // Simulate API call
        setTimeout(() => {
            setStatus("success");
        }, 1500);
    };

    if (status === "success") {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white p-12 rounded-[40px] border border-slate-100 shadow-2xl text-center"
            >
                <div className="size-20 bg-primary-light rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="size-10 text-primary" />
                </div>
                <h3 className="text-3xl font-black text-[#0f172a] mb-4">Request Received</h3>
                <p className="text-slate-500 font-medium text-lg leading-relaxed">
                    A deployment specialist will reach out within the next 2 hours to confirm your demo.
                </p>
            </motion.div>
        );
    }

    return (
        <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-8 md:p-12 rounded-[40px] border border-slate-100 shadow-2xl relative overflow-hidden"
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
                <div className="space-y-2">
                    <label className="text-sm font-black text-[#0f172a] uppercase tracking-tighter">Full Name</label>
                    <input
                        required
                        type="text"
                        placeholder="John Doe"
                        className="w-full px-6 py-4 bg-[#f8fafc] border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-black text-[#0f172a] uppercase tracking-tighter">Business Email</label>
                    <input
                        required
                        type="email"
                        placeholder="john@company.com"
                        className="w-full px-6 py-4 bg-[#f8fafc] border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-black text-[#0f172a] uppercase tracking-tighter">Company Name</label>
                    <input
                        required
                        type="text"
                        placeholder="Acme Corp"
                        className="w-full px-6 py-4 bg-[#f8fafc] border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-black text-[#0f172a] uppercase tracking-tighter">Monthly Lead Volume</label>
                    <select className="w-full px-6 py-4 bg-[#f8fafc] border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium appearance-none">
                        <option>100 - 500 leads</option>
                        <option>500 - 2,000 leads</option>
                        <option>2,000+ leads</option>
                        <option>Enterprise / custom</option>
                    </select>
                </div>
            </div>

            <div className="space-y-2 mb-10">
                <label className="text-sm font-black text-[#0f172a] uppercase tracking-tighter">How can we help?</label>
                <textarea
                    placeholder="Tell us about your sales operation..."
                    rows={4}
                    className="w-full px-6 py-4 bg-[#f8fafc] border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium resize-none"
                ></textarea>
            </div>

            <button
                disabled={status === "sending"}
                className="w-full py-5 bg-[#0f172a] text-white font-black rounded-2xl hover:bg-slate-800 transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-70 group"
            >
                {status === "sending" ? "Processing..." : "Submit Enrollment Request"}
                <Send className="size-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </button>

            <p className="mt-6 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                SECURE 256-BIT ENCRYPTED DATA TRANSFER
            </p>
        </motion.form>
    );
}
