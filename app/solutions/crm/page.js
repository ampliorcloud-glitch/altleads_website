import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CRMPage from "@/components/solutions/CRMPage";

export const metadata = {
    title: "CRM Solution — AltLeads",
    description: "A workflow-first CRM designed for outbound sales teams. Web dashboard for backend, mobile app for field reps.",
};

export default function CRMSolutionPage() {
    return (
        <main className="min-h-screen bg-white">
            <Navbar />
            <CRMPage />
            <Footer />
        </main>
    );
}
