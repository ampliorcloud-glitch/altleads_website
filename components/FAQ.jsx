"use client";

import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

const faqs = [
    {
        k: "How is AltLeads different from Salesforce?",
        v: "Most CRMs like Salesforce are 'Database-first'—great for storing data but clunky for doing work. AltLeads is 'Workflow-first.' We align your backend lead generation directly with frontend sales activities, reducing friction and administrative overhead by up to 40%."
    },
    {
        k: "Can I migrate my existing data?",
        v: "Yes. Our 'Live in 14 Days' implementation package includes a dedicated data specialist who will map, clean, and migrate your data from HubSpot, Pipedrive, Salesforce, or Excel spreadsheets during the first 3 days of onboarding."
    },
    {
        k: "Is there a minimum seat requirement?",
        v: "We require a minimum of 3 seats for our Team plan. This ensures you get the full value of our collaborative workflow features. For Enterprise plans, we typically work with teams of 20+."
    },
    {
        k: "Does it work offline?",
        v: "Absolutely. Our mobile app (iOS and Android) caches all your territory data. You can log visits, update deal stages, and take notes without an internet connection. Data syncs automatically once you're back online."
    },
];

export default function FAQ() {
    const [openIndex, setOpenIndex] = useState(null);

    return (
        <section id="faq" className="py-24 px-4 md:px-10 bg-white">
            <div className="max-w-3xl mx-auto">
                <h2 className="text-3xl md:text-5xl font-black text-[#0f172a] mb-12 text-center">Frequently Asked Questions</h2>
                <div className="space-y-4">
                    {faqs.map((faq, index) => (
                        <div
                            key={index}
                            className={`rounded-2xl border transition-all duration-300 ${openIndex === index
                                    ? "border-primary bg-primary-light/30 shadow-lg shadow-primary/5"
                                    : "border-slate-100 bg-[#f8fafc] hover:border-slate-200"
                                }`}
                        >
                            <button
                                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                                className="flex w-full items-center justify-between p-6 text-left"
                            >
                                <h3 className="font-bold text-lg text-[#0f172a]">{faq.k}</h3>
                                <ChevronDown className={`size-5 text-primary transition-transform duration-300 ${openIndex === index ? "rotate-180" : ""}`} />
                            </button>
                            {openIndex === index && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    className="px-6 pb-6 text-slate-600 leading-relaxed font-medium"
                                >
                                    {faq.v}
                                </motion.div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
