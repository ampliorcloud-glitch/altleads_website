"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";

export default function PrivacyPolicy() {
    return (
        <main className="min-h-screen bg-white">
            <Navbar />

            {/* Hero Section */}
            <section className="pt-32 pb-16 px-4 bg-slate-50">
                <div className="max-w-4xl mx-auto text-center">
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-4xl md:text-5xl font-black text-[#0f172a] mb-6"
                    >
                        Privacy Policy
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-lg text-slate-500 font-medium"
                    >
                        Last updated: February 2026
                    </motion.p>
                </div>
            </section>

            {/* Content Section */}
            <section className="py-20 px-4">
                <div className="max-w-3xl mx-auto prose prose-slate">
                    <div className="space-y-12">
                        <section>
                            <h2 className="text-2xl font-bold text-[#0f172a] mb-4">1. Overview</h2>
                            <p className="text-slate-600 leading-relaxed font-medium">
                                Altleads is a business productivity and lead management platform used by organizations to manage sales activities, field teams, and performance insights.
                            </p>
                            <p className="text-slate-600 leading-relaxed font-medium mt-4">
                                Access to the application is invite-only, restricted to employees or associates authorized by registered business accounts.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-[#0f172a] mb-4">2. Information We Collect</h2>
                            <p className="text-slate-600 leading-relaxed font-medium mb-4">
                                Since access is invitation-based, we collect limited information shared by your organization's admin, such as:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-slate-600 font-medium">
                                <li>Name</li>
                                <li>Business email address</li>
                                <li>Business phone number</li>
                            </ul>
                            <p className="text-slate-600 leading-relaxed font-medium mt-4">
                                Additionally, to enable field tracking, meeting check-ins, or location-based task management, the mobile app may collect location information as described below.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-[#0f172a] mb-4">3. Login and Authentication</h2>
                            <p className="text-slate-600 leading-relaxed font-medium">
                                Altleads currently supports login only through a unique business email ID. There is no integration with Google, Microsoft, or other third-party sign-in providers. Once invited, users must log in using the credentials shared by their organization.
                            </p>
                            <p className="text-slate-600 leading-relaxed font-medium mt-4">
                                User accounts are strictly controlled by organization administrators, ensuring that unauthorized access or self-registration is not possible.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-[#0f172a] mb-4">4. Location Data</h2>
                            <p className="text-slate-600 leading-relaxed font-medium mb-4">
                                We may collect location information in the following situations:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-slate-600 font-medium">
                                <li>While using the app: To record meeting locations, client visits, attendance check-ins, or field activity tracking.</li>
                                <li>In the background: Only if your organization enables background tracking for performance insights or visit verification.</li>
                                <li>Accuracy: Location data may include approximate or precise coordinates, depending on your device settings and permissions.</li>
                            </ul>
                            <p className="text-slate-600 leading-relaxed font-medium mt-4">
                                We do not use location data for advertising or marketing. Location data is used solely for organizational reporting, route tracking, or attendance verification within your company's authorized account.
                            </p>
                            <p className="text-slate-600 leading-relaxed font-medium mt-4">
                                You can disable or limit location permissions anytime from your device settings; however, certain features (like check-ins or visit tracking) may stop working as intended.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-[#0f172a] mb-4">5. How We Use the Information</h2>
                            <p className="text-slate-600 leading-relaxed font-medium mb-4">
                                We use collected data to:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-slate-600 font-medium">
                                <li>Provide secure access to the app</li>
                                <li>Track and verify field operations or check-ins</li>
                                <li>Generate organizational reports and analytics</li>
                                <li>Manage team performance dashboards</li>
                                <li>Send system notifications or updates related to your organization's activities</li>
                            </ul>
                            <p className="text-slate-600 leading-relaxed font-medium mt-4 italic font-bold">
                                We do not sell, trade, or rent any user data.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-[#0f172a] mb-4">6. Data Sharing and Disclosure</h2>
                            <p className="text-slate-600 leading-relaxed font-medium mb-4">
                                Altleads does not share your personal or location data with any third party except:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-slate-600 font-medium">
                                <li>When required by law</li>
                                <li>To comply with government or regulatory requests</li>
                                <li>To protect our rights, property, or safety</li>
                                <li>When explicitly approved by your organization's administrator (for example, integrating with a CRM or HRMS system)</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-[#0f172a] mb-4">7. Data Security</h2>
                            <p className="text-slate-600 leading-relaxed font-medium">
                                We employ robust encryption and security practices to safeguard your data against unauthorized access or misuse. All passwords and sensitive credentials are encrypted and not accessible to any Altleads staff. However, no digital system is entirely secure, and we cannot guarantee absolute protection.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-[#0f172a] mb-4">8. Cookies and Analytics</h2>
                            <p className="text-slate-600 leading-relaxed font-medium">
                                Currently, the Altleads app does not use cookies or third-party analytics tools. If introduced in future updates, this policy will be revised accordingly.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-[#0f172a] mb-4">9. International Users</h2>
                            <p className="text-slate-600 leading-relaxed font-medium">
                                Altleads currently operates primarily in India. If data is transferred internationally in the future, it will be processed in compliance with applicable data protection laws (e.g., GDPR).
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-[#0f172a] mb-4">10. Policy Updates</h2>
                            <p className="text-slate-600 leading-relaxed font-medium">
                                We may update this Privacy Policy periodically. The latest version will always be available at altleads.com/privacy-policy. Your continued use of the app indicates your acceptance of the updated terms.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-[#0f172a] mb-4">11. Contact Us</h2>
                            <p className="text-slate-600 leading-relaxed font-medium">
                                For any questions or data concerns, contact us at:
                            </p>
                            <p className="mt-4 font-bold">
                                📩 <a href="mailto:contact@altleads.com" className="text-primary hover:underline">contact@altleads.com</a>
                            </p>
                            <p className="mt-8 text-sm text-slate-400 font-bold">
                                © Altleads. All Rights Reserved.
                            </p>
                        </section>
                    </div>
                </div>
            </section>

            <Footer />
        </main>
    );
}
