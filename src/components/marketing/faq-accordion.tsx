import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const FAQ = [
  {
    q: 'Do you store my ad account credentials?',
    a: 'No — we use OAuth, so we receive a scoped access token from Google and Meta. You can revoke access at any time.',
  },
  {
    q: 'Which platforms do you support?',
    a: 'Google Ads and Meta Ads (Facebook + Instagram) at launch.',
  },
  {
    q: 'Can I create ads from autoads?',
    a: 'Yes — Pro and Business plans support creating Google Search ads and Meta single-image ads directly inside the app.',
  },
  {
    q: 'Is there a free plan?',
    a: 'Yes. The Free plan covers one workspace and one connected ad account, with a read-only dashboard.',
  },
  {
    q: 'Where is my data stored?',
    a: 'In a secure Postgres database hosted on Supabase (US region).',
  },
] as const

export function FAQAccordion() {
  return (
    <Accordion className="mx-auto max-w-2xl">
      {FAQ.map((item, i) => (
        <AccordionItem key={i} value={`item-${i}`}>
          <AccordionTrigger>{item.q}</AccordionTrigger>
          <AccordionContent>{item.a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
