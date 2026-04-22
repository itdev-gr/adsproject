import { Hero } from '@/components/marketing/hero'
import { FeatureGrid } from '@/components/marketing/feature-grid'
import { HowItWorks } from '@/components/marketing/how-it-works'
import { CTASection } from '@/components/marketing/cta-section'

export default function HomePage() {
  return (
    <>
      <Hero />
      <FeatureGrid />
      <HowItWorks />
      <CTASection />
    </>
  )
}
