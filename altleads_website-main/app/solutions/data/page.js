import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DataPage from "@/components/solutions/DataPage";

export const metadata = {
    title: "Data & Intelligence — AltLeads",
    description: "Verified decision-maker data, contextual pitch guidance, and a Chrome extension — intelligence that reps actually use.",
};

export default function DataSolutionPage() {
    return (
        <main className="min-h-screen bg-white">
            <Navbar />
            <DataPage />
            <Footer />
        </main>
    );
}
