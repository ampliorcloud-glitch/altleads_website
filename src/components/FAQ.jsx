import { useState } from 'react'

const faqs = [
  {
    q: 'How long does it take to set up AltLeads?',
    a: 'Most teams are live within 30 minutes. Import your contacts, connect your channels, and launch your first cadence — no implementation consultants required.',
  },
  {
    q: 'Does AltLeads replace my CRM?',
    a: 'AltLeads can be your primary CRM for outbound teams, or it integrates with Salesforce, HubSpot, and Pipedrive via native connectors. It adds the execution layer your CRM is missing.',
  },
  {
    q: 'How does the AI personalization work?',
    a: 'AltLeads analyzes each prospect\'s industry, role, company size, and past interactions to draft messages that feel human. Every suggestion is editable — AI assists, you decide.',
  },
  {
    q: 'Is WhatsApp integration compliant?',
    a: 'Yes. We use the official WhatsApp Business API with template message approval, opt-out handling, and full audit trails. Fully compliant for India and APAC markets.',
  },
  {
    q: 'What does pricing look like?',
    a: 'We offer per-seat pricing with no long-term contracts. Free trial included. Contact us for team and enterprise pricing.',
  },
]

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(null)

  const toggle = (i) => {
    setOpenIndex(openIndex === i ? null : i)
  }

  return (
    <section className="section section-faq" data-section="faq">
      <div className="section-inner faq-inner">
        <h2 className="section-headline">Frequently asked questions</h2>

        <div className="faq-list">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className={`faq-item ${openIndex === i ? 'is-open' : ''}`}
            >
              <button
                className="faq-trigger"
                onClick={() => toggle(i)}
                aria-expanded={openIndex === i}
              >
                <span>{faq.q}</span>
                <svg
                  className="faq-chevron"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <path d="M4 6l4 4 4-4" />
                </svg>
              </button>
              <div className="faq-answer">
                <p>{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
