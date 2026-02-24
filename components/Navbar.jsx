"use client";

import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { Menu, X, ChevronDown, Monitor, Brain, MessageCircle } from "lucide-react";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";

const solutions = [
    { name: "CRM Solution", href: "/solutions/crm", icon: Monitor, desc: "Workflow-first CRM for outbound teams", color: "text-primary", bg: "bg-primary-light" },
    { name: "Data & Intelligence", href: "/solutions/data", icon: Brain, desc: "Verified contacts & pitch guidance", color: "text-emerald-600", bg: "bg-emerald-50" },
    { name: "WhatsApp SDR", href: "/solutions/whatsapp", icon: MessageCircle, desc: "Professional B2B WhatsApp outreach", color: "text-green-600", bg: "bg-green-50" },
];

const navLinks = [
    { name: "How It Works", href: "/#how-it-works" },
    { name: "Use Cases", href: "/#usecases" },
    { name: "FAQ", href: "/#faq" },
    { name: "Contact", href: "/contact" },
];

export default function Navbar() {
    const [isOpen, setIsOpen] = useState(false);
    const [showSolutions, setShowSolutions] = useState(false);
    const dropdownRef = useRef(null);
    const { scrollY } = useScroll();

    const backgroundColor = useTransform(
        scrollY,
        [0, 100],
        ["rgba(248, 250, 252, 0)", "rgba(255, 255, 255, 0.8)"]
    );

    const borderColor = useTransform(
        scrollY,
        [0, 100],
        ["rgba(226, 232, 240, 0)", "rgba(226, 232, 240, 0.8)"]
    );

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowSolutions(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <motion.header
            style={{ backgroundColor, borderBottom: `1px solid ${borderColor}`, backdropFilter: "blur(12px)" }}
            className="fixed top-0 z-50 w-full px-4 md:px-10 py-4 transition-all"
        >
            <div className="max-w-[1280px] mx-auto flex items-center justify-between">
                {/* Logo */}
                <a href="/" className="flex items-center gap-3 group">
                    <h1 className="text-xl font-bold tracking-tight text-[#0f172a]">
                        <span className="text-[#0099d6]">Alt</span>Leads
                    </h1>
                </a>

                {/* Desktop Nav */}
                <nav className="hidden md:flex flex-1 justify-center gap-8 items-center">
                    {/* Solutions Dropdown */}
                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => setShowSolutions(!showSolutions)}
                            className="flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-primary transition-colors"
                        >
                            Solutions
                            <ChevronDown className={`size-3.5 transition-transform duration-200 ${showSolutions ? "rotate-180" : ""}`} />
                        </button>

                        <AnimatePresence>
                            {showSolutions && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute top-full left-1/2 -translate-x-1/2 mt-4 w-[340px] bg-white rounded-3xl border border-slate-100 shadow-2xl shadow-slate-200/60 p-3 z-50"
                                >
                                    {solutions.map(s => (
                                        <a
                                            key={s.name}
                                            href={s.href}
                                            onClick={() => setShowSolutions(false)}
                                            className="flex items-start gap-4 p-4 rounded-2xl hover:bg-[#f8fafc] transition-all group"
                                        >
                                            <div className={`size-10 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                                                <s.icon className={`size-5 ${s.color}`} />
                                            </div>
                                            <div>
                                                <span className="font-bold text-[#0f172a] text-sm block group-hover:text-primary transition-colors">{s.name}</span>
                                                <span className="text-xs text-slate-500 font-medium">{s.desc}</span>
                                            </div>
                                        </a>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {navLinks.map((item) => (
                        <a
                            key={item.name}
                            href={item.href}
                            className="text-sm font-semibold text-slate-600 hover:text-primary transition-colors"
                        >
                            {item.name}
                        </a>
                    ))}
                </nav>

                {/* Actions */}
                <div className="flex items-center gap-4">
                    <a href="#" className="hidden sm:block text-sm font-bold text-slate-600 hover:text-primary transition-colors">
                        Login
                    </a>
                    <a
                        href="/contact"
                        className="hidden sm:flex items-center justify-center rounded-lg bg-[#0f172a] px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-slate-800 shadow-md"
                    >
                        Book a Demo
                    </a>

                    {/* Mobile Toggle */}
                    <button
                        className="md:hidden p-2 text-slate-600"
                        onClick={() => setIsOpen(!isOpen)}
                    >
                        {isOpen ? <X className="size-6" /> : <Menu className="size-6" />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute top-full left-0 w-full bg-white border-b border-slate-200 p-6 flex flex-col gap-2 md:hidden shadow-xl"
                >
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-2">Solutions</span>
                    {solutions.map(s => (
                        <a
                            key={s.name}
                            href={s.href}
                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#f8fafc] transition-all"
                            onClick={() => setIsOpen(false)}
                        >
                            <div className={`size-8 rounded-lg ${s.bg} flex items-center justify-center`}>
                                <s.icon className={`size-4 ${s.color}`} />
                            </div>
                            <span className="font-bold text-[#0f172a] text-sm">{s.name}</span>
                        </a>
                    ))}
                    <div className="border-t border-slate-50 my-2" />
                    {navLinks.map((item) => (
                        <a
                            key={item.name}
                            href={item.href}
                            className="text-lg font-bold text-slate-900 px-2 py-2"
                            onClick={() => setIsOpen(false)}
                        >
                            {item.name}
                        </a>
                    ))}
                    <a
                        href="/contact"
                        onClick={() => setIsOpen(false)}
                        className="w-full py-4 bg-primary text-white font-bold text-center rounded-xl mt-4"
                    >
                        Book a Demo
                    </a>
                </motion.div>
            )}
        </motion.header>
    );
}
