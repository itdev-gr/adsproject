import { FAQAccordion } from '@/components/marketing/faq-accordion'

export const metadata = { title: 'FAQ — autoads' }

export default function FaqPage() {
  return (
    <>
      <section className="mx-auto max-w-2xl px-6 pt-16 pb-12 text-center">
        <h1 className="text-4xl font-bold">Frequently asked</h1>
      </section>
      <FAQAccordion />
    </>
  )
}
