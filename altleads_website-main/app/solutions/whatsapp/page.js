import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppPage from "@/components/solutions/WhatsAppPage";

export const metadata = {
    title: "WhatsApp SDR — AltLeads",
    description: "Professional WhatsApp workflows for B2B sales. Template-based, compliance-aware outreach for confirmations, follow-ups, and re-engagement.",
};

export default function WhatsAppSolutionPage() {
    return (
        <main className="min-h-screen bg-white">
            <Navbar />
            <WhatsAppPage />
            <Footer />
        </main>
    );
}
