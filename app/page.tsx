import HeroSection from "@/components/HeroSection";
import FeaturesSection from "@/components/FeaturesSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import PricingSection from "@/components/PricingSection";
import FaqSection from "@/components/FaqSection";
import LandingHeader from "@/components/LandingHeader";

export default function Home() {
  return (
    <main className="min-h-screen bg-void-black relative">
      <LandingHeader />
      <HeroSection />
      <FeaturesSection />
      <TestimonialsSection />
      <PricingSection />
      <FaqSection />
    </main>
  );
}
