import Link from "next/link";

export const metadata = {
  title: "FAQ | VENTIQ",
  description:
    "Frequently asked questions about VENTIQ, the AI operating system for private capital and fund operations teams.",
};

const faqs = [
  {
    question: "What is VENTIQ?",
    answer:
      "VENTIQ is an AI operating system for private capital teams. It is designed to connect fund operations, investor reporting, compliance workflows, portfolio intelligence, document generation and stakeholder dashboards in one operating layer.",
  },
  {
    question: "Who is VENTIQ built for?",
    answer:
      "VENTIQ is being built for VC funds, private equity funds, private credit funds, Category II AIFs, GIFT City fund managers, family offices, fund finance teams, compliance teams, investor relations teams and managing partners.",
  },
  {
    question: "Is VENTIQ a fund accounting software?",
    answer:
      "VENTIQ is not positioned as only fund accounting software. It is designed as an operating layer across fund data, workflows and stakeholder views. Accounting-related workflows such as capital calls, distributions, notices and journal previews may be part of the workflow layer.",
  },
  {
    question: "Is the product live?",
    answer:
      "Selected workflows are available as live workflow previews and walkthroughs. Some modules are in active development or roadmap stage. Public product screens may use sample or illustrative data for demonstration.",
  },
  {
    question: "Does VENTIQ use AI?",
    answer:
      "Yes. VENTIQ is designed to use AI for daily workspace opinions, exception flags, workflow recommendations, investor communication drafts, compliance summaries, portfolio risk views and stakeholder-ready reporting outputs.",
  },
  {
    question: "What workflows does VENTIQ support?",
    answer:
      "VENTIQ currently focuses on workflows such as capital calls, distribution waterfalls, repayment notices, investor document generation, portfolio intelligence, compliance knowledge workflows, investor portal views and managing partner dashboards.",
  },
  {
    question: "Is public demo data real client data?",
    answer:
      "No. Public product preview pages should be treated as sample or illustrative data unless explicitly stated otherwise. The purpose is to show workflow design and operating logic.",
  },
  {
    question: "How does VENTIQ handle sensitive fund data?",
    answer:
      "VENTIQ is being designed around role-based access, document controls, workflow history and audit trail thinking. Formal enterprise security documentation will continue to evolve as the product moves toward production deployments.",
  },
  {
    question: "Can I request a walkthrough?",
    answer:
      "Yes. You can request a walkthrough from the website. The walkthrough can focus on a specific workflow such as capital calls, distributions, repayment notices, investor portal, compliance or the full VENTIQ operating system.",
  },
];

export default function FAQPage() {
  return (
    <main className="legal-page">
      <section className="legal-hero">
        <Link className="legal-back-link" href="/">
          ← Back to VENTIQ
        </Link>

        <p className="legal-kicker">FAQ</p>

        <h1>Frequently asked questions about VENTIQ.</h1>

        <p>
          A quick overview of what VENTIQ is, who it is built for, how the
          product should be understood and how walkthroughs work.
        </p>
      </section>

      <section className="legal-content-card">
        {faqs.map((faq) => (
          <div className="faq-item" key={faq.question}>
            <h2>{faq.question}</h2>
            <p>{faq.answer}</p>
          </div>
        ))}
      </section>
    </main>
  );
}