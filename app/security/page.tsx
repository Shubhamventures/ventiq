import Link from "next/link";

export const metadata = {
  title: "Security | VENTIQ",
  description:
    "Security, access control, audit trail and data handling principles for VENTIQ.",
};

const securityPrinciples = [
  {
    title: "Role-Based Access",
    description:
      "VENTIQ is designed so fund managers, finance teams, compliance users, investment teams and investors access only the workflows and information relevant to their role.",
  },
  {
    title: "Audit Trail Thinking",
    description:
      "Critical actions such as approvals, generated notices, document status changes and workflow updates are designed to remain traceable.",
  },
  {
    title: "Document Controls",
    description:
      "Investor notices, statements, capital call outputs, repayment notices and compliance documents are structured with controlled access and workflow history.",
  },
  {
    title: "Sensitive Data Handling",
    description:
      "VENTIQ is built for fund operations where investor, fund, portfolio and compliance data require careful handling, limited access and operational discipline.",
  },
];

const roadmapItems = [
  "Formal VAPT review",
  "SOC 2 readiness planning",
  "Granular permission model",
  "Data retention controls",
  "Advanced audit logs",
  "Enterprise security documentation",
];

export default function SecurityPage() {
  return (
    <main className="legal-page">
      <section className="legal-hero">
        <Link className="legal-back-link" href="/">
          ← Back to VENTIQ
        </Link>

        <p className="legal-kicker">Trust & Security</p>

        <h1>Security and control principles for private capital workflows.</h1>

        <p>
          VENTIQ is being designed for fund operations, investor reporting,
          compliance workflows and private capital teams that need controlled
          access, traceable actions and careful handling of sensitive fund data.
        </p>
      </section>

      <section className="legal-card-grid">
        {securityPrinciples.map((item) => (
          <div className="legal-info-card" key={item.title}>
            <h2>{item.title}</h2>
            <p>{item.description}</p>
          </div>
        ))}
      </section>

      <section className="legal-content-card">
        <h2>Current security position</h2>

        <p>
          VENTIQ is currently in product development and walkthrough stage. The
          platform should not be represented as SOC 2, ISO 27001 or VAPT
          certified unless those reviews and certifications are formally
          completed.
        </p>

        <p>
          For early walkthroughs, all product data shown publicly should be
          treated as sample or illustrative data unless explicitly agreed
          otherwise with a client or design partner.
        </p>
      </section>

      <section className="legal-content-card">
        <h2>Security roadmap</h2>

        <div className="legal-pill-grid">
          {roadmapItems.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>

      <section className="legal-content-card">
        <h2>Data handling approach</h2>

        <p>
          VENTIQ is intended to support structured workflows for fund, investor,
          portfolio, compliance and document data. Access control, approval
          history, document traceability and operational logging are core design
          principles of the product.
        </p>

        <p>
          Enterprise security documentation, data processing terms and formal
          controls will continue to evolve as the product moves from walkthrough
          stage to production deployments.
        </p>
      </section>
    </main>
  );
}