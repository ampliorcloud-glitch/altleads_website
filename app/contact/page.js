"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ContactForm from "@/components/ContactForm";
import { motion } from "framer-motion";
import { Mail, Phone, MapPin, Clock } from "lucide-react";

export default function ContactPage() {
    return (
        <main className="min-h-screen bg-[#f8fafc]">
            <Navbar />

            {/* Page Header */}
            <section className="relative pt-32 pb-20 overflow-hidden">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 right-0 w-[40%] h-[40%] bg-primary/5 rounded-full blur-[100px]" />
                    <div className="absolute bottom-0 left-0 w-[30%] h-[30%] bg-blue-100/30 rounded-full blur-[120px]" />
                </div>

                <div className="max-w-[1280px] mx-auto px-4 md:px-10 relative z-10 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-10"
                    >
                        <span className="text-primary font-bold tracking-widest text-xs uppercase mb-4 block">Get Started</span>
                        <h1 className="text-5xl md:text-7xl font-black tracking-tight text-[#0f172a] mb-6">
                            Connect with our <br /> <span className="text-primary italic">deployment experts.</span>
                        </h1>
                        <p className="text-slate-500 text-xl font-medium max-w-2xl mx-auto">
                            Ready to automate your sales execution? Tell us about your operation and we'll design a custom flow for your team.
                        </p>
                    </motion.div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start mt-20">
                        {/* Contact Info */}
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 }}
                            className="lg:col-span-5 text-left space-y-12"
                        >
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div className="size-12 rounded-2xl bg-white shadow-sm flex items-center justify-center p-3 border border-slate-50">
                                        <Mail className="size-6 text-primary" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-[#0f172a] text-sm uppercase tracking-tighter mb-1">Email Us</h4>
                                        <p className="text-slate-500 font-bold">contact@altleads.com</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="size-12 rounded-2xl bg-white shadow-sm flex items-center justify-center p-3 border border-slate-50">
                                        <Clock className="size-6 text-primary" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-[#0f172a] text-sm uppercase tracking-tighter mb-1">Response Time</h4>
                                        <p className="text-slate-500 font-bold">Under 2 Hours</p>
                                    </div>
                                </div>
                                <div className="sm:col-span-2 space-y-4">
                                    <div className="size-12 rounded-2xl bg-white shadow-sm flex items-center justify-center p-3 border border-slate-50">
                                        <MapPin className="size-6 text-primary" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-[#0f172a] text-sm uppercase tracking-tighter mb-1">Global Headquarters</h4>
                                        <p className="text-slate-500 font-bold leading-relaxed">
                                            Global Tech Park, Tower D, Outer Ring Road,<br />
                                            Bellandur, Bengaluru, India 560103
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 bg-primary rounded-[32px] text-white">
                                <h4 className="text-xl font-bold mb-3">Enterprise Support?</h4>
                                <p className="text-white/80 font-medium mb-6">
                                    For organizations processing more than 10,000 leads per month, we offer dedicated white-glove migration services.
                                </p>
                                <button className="px-6 py-3 bg-white text-primary font-bold rounded-xl hover:bg-slate-50 transition-all">
                                    Contact Enterprise
                                </button>
                            </div>
                        </motion.div>

                        {/* Form Container */}
                        <div className="lg:col-span-7">
                            <ContactForm />
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </main>
    );
}
