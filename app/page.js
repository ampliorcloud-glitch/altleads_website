import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Problem from "@/components/Problem";
import SolutionOverview from "@/components/SolutionOverview";
import Workflow from "@/components/Workflow";
import Features from "@/components/Features";
import UseCases from "@/components/UseCases";
import Implementation from "@/components/Implementation";
import FAQ from "@/components/FAQ";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main id="top" className="min-h-screen bg-[#f8fafc]">
      <Navbar />
      <Hero />
      <Problem />
      <SolutionOverview />
      <Workflow />
      <Features />
      <UseCases />
      <Implementation />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}
