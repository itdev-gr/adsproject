import { FeaturePageHero } from '@/components/marketing/feature-page-hero'

export const metadata = { title: 'Google Ads — autoads' }

export default function GoogleAdsFeaturePage() {
  return (
    <FeaturePageHero
      eyebrow="Google Ads"
      title="One place for every Google Ads account"
      body="Connect any Google Ads account in seconds and see Search, Display, and Performance Max campaigns side-by-side with your Meta data."
    />
  )
}
