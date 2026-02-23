"use client";

import Image from "next/image";
import { Twitter, Linkedin, Facebook } from "lucide-react";

export default function Footer() {
    return (
        <footer className="bg-white border-t border-slate-100 pt-20 pb-10 px-4 md:px-10">
            <div className="max-w-[1280px] mx-auto">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12 mb-16">
                    <div className="col-span-2 lg:col-span-2">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="size-8 rounded bg-primary flex items-center justify-center p-1.5">
                                <Image src="/logo-white.png" alt="AltLeads Logo" width={24} height={24} />
                            </div>
                            <span className="text-xl font-black text-[#0f172a]">AltLeads</span>
                        </div>
                        <p className="text-slate-500 max-w-xs mb-8 font-medium leading-relaxed">
                            The first CRM built for operations-heavy sales teams. Bridge the gap between lead gen and closed revenue.
                        </p>
                        <div className="flex gap-4">
                            <a href="#" className="p-2 border border-slate-100 rounded-lg text-slate-400 hover:text-primary hover:border-primary/20 transition-all">
                                <Twitter className="size-5" />
                            </a>
                            <a href="#" className="p-2 border border-slate-100 rounded-lg text-slate-400 hover:text-primary hover:border-primary/20 transition-all">
                                <Linkedin className="size-5" />
                            </a>
                            <a href="#" className="p-2 border border-slate-100 rounded-lg text-slate-400 hover:text-primary hover:border-primary/20 transition-all">
                                <Facebook className="size-5" />
                            </a>
                        </div>
                    </div>

                    <div>
                        <h4 className="font-black text-[#0f172a] mb-6">Product</h4>
                        <ul className="space-y-4 text-sm font-bold text-slate-500">
                            <li><a href="#" className="hover:text-primary transition-colors">Features</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Workflow</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Enterprise</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Changelog</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-black text-[#0f172a] mb-6">Resources</h4>
                        <ul className="space-y-4 text-sm font-bold text-slate-500">
                            <li><a href="#" className="hover:text-primary transition-colors">Documentation</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">API Reference</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Community</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Blog</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-black text-[#0f172a] mb-6">Company</h4>
                        <ul className="space-y-4 text-sm font-bold text-slate-500">
                            <li><a href="#" className="hover:text-primary transition-colors">About</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Careers</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Contact</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Partners</a></li>
                        </ul>
                    </div>
                </div>

                <div className="pt-8 border-t border-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-sm text-slate-400 font-medium">© 2024 AltLeads Inc. All rights reserved.</p>
                    <div className="flex gap-8 text-sm font-bold text-slate-400">
                        <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
                        <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
