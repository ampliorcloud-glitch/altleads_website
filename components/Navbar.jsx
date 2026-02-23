"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { Menu, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

export default function Navbar() {
    const [isOpen, setIsOpen] = useState(false);
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

    return (
        <motion.header
            style={{ backgroundColor, borderBottom: `1px solid ${borderColor}`, backdropFilter: "blur(12px)" }}
            className="fixed top-0 z-50 w-full px-4 md:px-10 py-4 transition-all"
        >
            <div className="max-w-[1280px] mx-auto flex items-center justify-between">
                {/* Logo */}
                <a href="#top" className="flex items-center gap-3 group">
                    <div className="flex items-center justify-center size-9 rounded bg-[#0099d6] p-1.5 shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
                        <Image src="/logo-white.png" alt="AltLeads Logo" width={32} height={32} className="object-contain" />
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-[#0f172a]">
                        <span className="text-[#0099d6]">Alt</span>Leads
                    </h1>
                </a>

                {/* Desktop Nav */}
                <nav className="hidden md:flex flex-1 justify-center gap-8">
                    {[
                        { name: "Workflow", id: "workflow" },
                        { name: "Solutions", id: "solution" },
                        { name: "Features", id: "features" },
                        { name: "Use Cases", id: "usecases" },
                        { name: "FAQ", id: "faq" },
                        { name: "Contact", id: "contact", isExternal: true, path: "/contact" }
                    ].map((item) => (
                        <a
                            key={item.name}
                            href={item.isExternal ? item.path : `#${item.id}`}
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
                    className="absolute top-full left-0 w-full bg-white border-b border-slate-200 p-6 flex flex-col gap-4 md:hidden shadow-xl"
                >
                    {[
                        { name: "Workflow", id: "workflow" },
                        { name: "Solutions", id: "solution" },
                        { name: "Features", id: "features" },
                        { name: "Use Cases", id: "usecases" },
                        { name: "FAQ", id: "faq" },
                        { name: "Contact", id: "contact", isExternal: true, path: "/contact" }
                    ].map((item) => (
                        <a
                            key={item.name}
                            href={item.isExternal ? item.path : `#${item.id}`}
                            className="text-lg font-bold text-slate-900 border-b border-slate-50 pb-2"
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
