"use client";

import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import SectionWrapper from "./SectionWrapper";

const faqs = [
    {
        k: "How is AltLeads different from Salesforce?",
        v: "Most CRMs focus on data storage (records). AltLeads focuses on the 'Action Gap' between a lead entering your system and a rep sitting at the meeting. We are built for velocity, not just record-keeping.",
    },
    {
        k: "Can we use our own lead generation tools?",
        v: "Yes. AltLeads provides a robust API and custom Web Portals to intake leads from any source—Facebook Ads, Google, or direct website traffic.",
    },
    {
        k: "Does the mobile app work offline?",
        v: "Absolutely. We know field sales happen in basements and areas with poor signal. Data is cached locally and synced automatically when back online.",
    },
    {
        k: "How long is the setup process?",
        v: "We aim for full integration within 14 days. This includes data migration, custom workflow configuration, and team onboarding.",
    },
];

export default function FAQ() {
    const [openIndex, setOpenIndex] = useState(0);

    return (
        <SectionWrapper id="faq" className="bg-white">
            <div className="flex flex-col lg:flex-row gap-20">
                <div className="lg:w-1/3">
                    <span className="text-primary font-bold tracking-widest text-xs uppercase mb-4 block">Support</span>
                    <h2 className="text-4xl md:text-5xl font-black tracking-tight text-[#0f172a] mb-6">
                        Everything you <br /> <span className="text-primary">need to know.</span>
                    </h2>
                    <p className="text-slate-500 text-lg font-medium mb-10">
                        Have a different question? Our deployment specialists are ready to help.
                    </p>
                    <button className="px-8 py-4 border border-slate-200 rounded-2xl font-bold text-[#0f172a] hover:bg-slate-50 transition-all">
                        Contact Support
                    </button>
                </div>

                <div className="lg:w-2/3 flex flex-col gap-4">
                    {faqs.map((faq, index) => (
                        <motion.div
                            key={faq.k}
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className={`border rounded-3xl overflow-hidden transition-all duration-300 ${openIndex === index ? "border-primary bg-primary-light/10 ring-1 ring-primary/20" : "border-slate-100 bg-[#f8fafc] hover:border-slate-300"}`}
                        >
                            <button
                                onClick={() => setOpenIndex(index === openIndex ? -1 : index)}
                                className="w-full p-6 md:p-8 flex items-center justify-between text-left group"
                            >
                                <span className={`text-lg font-bold transition-colors ${openIndex === index ? "text-primary" : "text-[#0f172a]"}`}>
                                    {faq.k}
                                </span>
                                <ChevronDown className={`size-5 transition-transform duration-300 ${openIndex === index ? "rotate-180 text-primary" : "text-slate-400"}`} />
                            </button>
                            <motion.div
                                initial={false}
                                animate={{ height: openIndex === index ? "auto" : 0 }}
                                className="overflow-hidden"
                            >
                                <div className="p-6 md:p-8 pt-0 text-slate-500 font-medium leading-relaxed">
                                    {faq.v}
                                </div>
                            </motion.div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </SectionWrapper>
    );
}
