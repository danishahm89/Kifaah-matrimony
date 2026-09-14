// Static FAQ content — transcribed verbatim from the design prototype's FAQS
// constant. Served via GET /api/faq.

export const faqs = [
  {
    question: "Is a wali (guardian) required?",
    answer:
      "Yes. Every profile names a wali, and contact details are only shared once your wali and the other side are both aware — this is fixed, not optional.",
  },
  {
    question: "Why are photos blurred?",
    answer:
      "Photos stay blurred to everyone by default, in line with Islamic modesty norms. They unlock only for a subscriber whose interest request has been mutually accepted.",
  },
  {
    question: "When are contact details shared?",
    answer:
      "Only after an active subscription and a mutual accepted interest. Never before, and never to a non-subscriber.",
  },
  {
    question: "Can I browse without subscribing?",
    answer:
      "You can view names, city, sect and basic details for free. Sending interest, viewing photos and contact details all require an active plan.",
  },
  {
    question: "Is chat supervised?",
    answer:
      "By default, conversations are wali-visible — a note in the chat reminds both sides their guardians are aware, consistent with chaperoned interaction. This can be changed to private in settings if your family agrees.",
  },
  {
    question: "How does the weekly match suggestion work?",
    answer:
      "An internal matching engine scores compatibility on location, sect, prayer routine and profession, and runs automatically once a week plus once at signup. It never repeats a profile you have already matched with, rejected, or have a pending request with.",
  },
  {
    question: "Can I cancel my subscription?",
    answer:
      "Yes, plans auto-renew monthly or annually and can be cancelled anytime from Profile > Subscription.",
  },
  {
    question: "Is my information shared outside the app?",
    answer:
      "No. Your data is only shown to other members within the app, and never contact details until both sides consent.",
  },
];
