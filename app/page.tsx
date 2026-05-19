import HeroSection from "@/components/HeroSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import PricingSection from "@/components/PricingSection";
import LandingHeader from "@/components/LandingHeader";

export default function Home() {
  return (
    <main className="min-h-screen bg-white relative">
      <LandingHeader />
      <HeroSection />
      <TestimonialsSection />
      <PricingSection />
    </main>
  );
}
