"use client";

import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight, Users, MessageSquare, Wrench, Shield } from "lucide-react";
import { useState } from "react";
import SectionWrapper from "./SectionWrapper";

const perks = [
  { icon: Users, title: "Personalised Walkthrough", desc: "Tailored to your industry and team size." },
  { icon: MessageSquare, title: "Live Q&A With Experts", desc: "Get answers from our deployment specialists." },
  { icon: Wrench, title: "Custom Workflow Design", desc: "We'll map a pipeline that fits your exact process." },
  { icon: Shield, title: "No Commitment Required", desc: "Explore at your own pace — zero pressure." },
];

const inputClass =
  "w-full bg-transparent border-b-2 border-slate-900 dark:border-white/30 focus:border-blue-600 dark:focus:border-blue-400 outline-none py-3.5 text-base font-medium text-black dark:text-white placeholder:text-slate-600 dark:placeholder:text-slate-300 transition-colors duration-300";

const labelClass = "block text-xs font-bold text-black dark:text-white uppercase tracking-widest mb-2";

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
      const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      setStatus(res.ok ? "success" : "error");
    } catch {
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <SectionWrapper id="book-demo" data-section="demo" className="py-32 md:py-48">
        <motion.div
          initial={{ opacity: 0, scale: 0.93 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
          className="max-w-xl mx-auto text-center px-6"
        >
          <div className="w-20 h-20 rounded-full bg-blue-500/15 border border-blue-500/25 flex items-center justify-center mx-auto mb-8">
            <CheckCircle2 className="w-10 h-10 text-blue-500" />
          </div>
          <h3 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">Demo booked!</h3>
          <p className="text-slate-500 dark:text-slate-400 text-lg leading-relaxed">Our specialist will reach out within 2 hours to confirm your slot.</p>
        </motion.div>
      </SectionWrapper>
    );
  }

  return (
    <SectionWrapper id="book-demo" data-section="demo" className="relative py-32 md:py-48 overflow-hidden">

      {/* Background glow */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-blue-600/8 dark:bg-blue-600/6 rounded-full blur-[140px]" />

      <div className="relative z-10 max-w-[1200px] mx-auto px-8 md:px-12">

        {/* Header */}
        <div className="max-w-2xl mb-16 md:mb-20">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
            className="flex flex-col gap-5"
          >
            <span className="inline-flex w-fit items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/8 text-blue-400 text-xs font-bold uppercase tracking-widest">
              Book a Demo
            </span>
            <h2 className="text-[2.8rem] md:text-[4rem] lg:text-[5rem] font-black tracking-tight leading-[1.05] text-slate-900 dark:text-white">
              See it in action.<br />
              <span className="text-blue-500">Live.</span>
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-base md:text-lg font-medium leading-relaxed max-w-lg">
              Fill in the form and our team will set up a personalised walkthrough tailored to your sales operation.
            </p>
          </motion.div>
        </div>

        {/* Two-column card */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6 lg:gap-8">

          {/* Left — perks */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
            className="flex flex-col gap-6 p-8 md:p-10 rounded-3xl"
          >
            <p className="text-xs font-bold text-black dark:text-white uppercase tracking-widest mb-2">What to expect</p>
            <div className="flex flex-col gap-7">
              {perks.map(({ icon: Icon, title, desc }, i) => (
                <motion.div
                  key={title}
                  className="flex items-start gap-4"
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.1 + i * 0.1 }}
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 dark:bg-blue-500/15 flex items-center justify-center shrink-0">
                    <Icon className="w-4.5 h-4.5 text-blue-500" />
                  </div>
                  <div>
                    <p className="font-bold text-black dark:text-white text-sm mb-0.5">{title}</p>
                    <p className="text-slate-800 dark:text-slate-200 text-sm leading-relaxed">{desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right — form */}
          <motion.div
            className="demo-form p-8 md:p-10 rounded-3xl"
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
          >
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8 mb-10">
                <div>
                  <label className={labelClass}>Full Name *</label>
                  <input required name="name" type="text" placeholder="John Doe" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Business Email *</label>
                  <input required name="email" type="email" placeholder="john@company.com" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Phone Number *</label>
                  <input required name="phone" type="tel" placeholder="+91 98765 43210" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Company Name *</label>
                  <input required name="company" type="text" placeholder="Acme Corp" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>SQLs Required *</label>
                  <input required name="sqlRequired" type="number" min="1" placeholder="e.g. 500" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Sales Team Size *</label>
                  <input required name="teamSize" type="number" min="1" placeholder="e.g. 10" className={inputClass} />
                </div>
              </div>
              <div className="mb-10">
                <label className={labelClass}>How can we help? *</label>
                <textarea
                  required
                  name="message"
                  placeholder="Tell us about your sales operation and goals..."
                  rows={3}
                  className={`${inputClass} resize-none`}
                />
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="w-full sm:w-auto flex items-center justify-center gap-3 px-10 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base rounded-full transition-all shadow-[0_0_40px_rgba(37,99,235,0.25)] hover:shadow-[0_0_50px_rgba(37,99,235,0.35)] disabled:opacity-60 group"
                >
                  {status === "sending" ? "Sending…" : status === "error" ? "Try Again" : "Book My Demo"}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
                <p className="text-slate-800 dark:text-slate-200 text-xs font-bold uppercase tracking-wider text-center">
                  No credit card required<br />Response within 2 hours
                </p>
              </div>
              {status === "error" && (
                <p className="mt-5 text-red-400 text-sm font-semibold">Something went wrong. Please try again.</p>
              )}
            </form>
          </motion.div>
        </div>

      </div>
    </SectionWrapper>
  );
}
