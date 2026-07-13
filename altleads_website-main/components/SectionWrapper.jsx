"use client";

import { motion } from "framer-motion";

export default function SectionWrapper({ children, className = "", id = "", ...props }) {
    return (
        <motion.section
            id={id}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={`py-24 px-4 md:px-10 scroll-mt-32 ${className}`}
            {...props}
        >
            <div className="max-w-[1280px] mx-auto">
                {children}
            </div>
        </motion.section>
    );
}
