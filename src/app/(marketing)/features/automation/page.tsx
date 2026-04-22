import { FeaturePageHero } from '@/components/marketing/feature-page-hero'

export const metadata = { title: 'Automation — autoads' }

export default function AutomationFeaturePage() {
  return (
    <FeaturePageHero
      eyebrow="Automation"
      title="Stop babysitting campaigns"
      body="Define rules once. We will watch your performance metrics 24/7 and pause, resume, or rebudget automatically."
    />
  )
}
