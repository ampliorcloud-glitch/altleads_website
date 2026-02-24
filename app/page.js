import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Problem from "@/components/Problem";
import Workflow from "@/components/Workflow";
import CoreModules from "@/components/CoreModules";
import SolutionOverview from "@/components/SolutionOverview";
import UseCases from "@/components/UseCases";
import Implementation from "@/components/Implementation";
import FAQ from "@/components/FAQ";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main id="top" className="min-h-screen bg-white">
      <Navbar />
      <Hero />
      <Problem />
      <Workflow />
      <CoreModules />
      <SolutionOverview />
      <UseCases />
      <Implementation />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}
