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
          VENTIQ is designed for fund operations, investor reporting,
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
          VENTIQ is deployed in production with governed access, workflow controls and operational monitoring. VENTIQ does not represent itself as SOC 2, ISO 27001 or VAPT certified unless those reviews and certifications have been formally completed.
        </p>

        <p>
          Public product pages use representative demonstration data unless explicitly stated otherwise. Client workspaces are available only through authenticated, governed access under the agreed implementation scope.
        </p>
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
          Security documentation, data-processing terms and control evidence
          are maintained as part of VENTIQ&apos;s client security review and
          onboarding process. Current assurance materials can be reviewed within
          the scope of an evaluation or implementation.
        </p>
      </section>
    </main>
  );
}