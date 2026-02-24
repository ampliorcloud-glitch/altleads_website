"use client";

import Image from "next/image";

export default function Footer() {
    return (
        <footer className="bg-white border-t border-slate-100 pt-20 pb-10 px-4 md:px-10">
            <div className="max-w-[1280px] mx-auto">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12 mb-16">
                    <div className="col-span-2 lg:col-span-2">
                        <div className="flex items-center gap-2 mb-6">
                            <span className="text-xl font-black text-[#0f172a]">AltLeads</span>
                        </div>
                        <p className="max-w-xs text-slate-500 font-medium leading-relaxed">
                            Multi-channel outbound execution, intelligence, and CRM orchestration — built for B2B teams that care about outcomes.
                        </p>
                        <div className="pt-4 text-xs font-bold text-slate-400">
                            © 2026 AltLeads. All rights reserved.
                        </div>
                    </div>

                    <div>
                        <h4 className="font-black text-[#0f172a] mb-6">Solutions</h4>
                        <ul className="space-y-4 text-sm font-bold text-slate-500">
                            <li><a href="/solutions/crm" className="hover:text-primary transition-colors">CRM Solution</a></li>
                            <li><a href="/solutions/data" className="hover:text-primary transition-colors">Data & Intelligence</a></li>
                            <li><a href="/solutions/whatsapp" className="hover:text-primary transition-colors">WhatsApp SDR</a></li>
                            <li><a href="/#faq" className="hover:text-primary transition-colors">FAQ</a></li>
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
                            <li><a href="#top" className="hover:text-primary transition-colors">About</a></li>
                            <li><a href="#cta" className="hover:text-primary transition-colors">Careers</a></li>
                            <li><a href="/contact" className="hover:text-primary transition-colors">Contact</a></li>
                            <li className="pt-4">
                                <span className="block text-[#0f172a] mb-1">Headquarters:</span>
                                Global Tech Park, Tower D,<br />
                                Bellandur, Bengaluru,<br />
                                India 560103
                            </li>
                            <li><a href="#top" className="hover:text-primary transition-colors">Partners</a></li>
                        </ul>
                    </div>
                </div>

                <div className="pt-8 border-t border-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-sm text-slate-400 font-medium">© 2026 AltLeads Inc. All rights reserved.</p>
                    <div className="flex gap-8 text-sm font-bold text-slate-400">
                        <a href="/privacy-policy" className="hover:text-primary transition-colors">Privacy Policy</a>
                        <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
