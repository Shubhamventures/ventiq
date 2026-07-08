import Link from "next/link";

export const metadata = {
  title: "Product Overview | VENTIQ",
  description:
    "Product overview of VENTIQ, the AI operating system for private capital teams across fund operations, workflows, investor reporting and portfolio intelligence.",
};

const overviewSections = [
  {
    title: "One operating layer",
    description:
      "VENTIQ connects fund, investor, portfolio, compliance, document and workflow data into one operating layer for private capital teams.",
  },
  {
    title: "Stakeholder workspaces",
    description:
      "Managing Partners, Finance Heads, Compliance Teams, Investment Teams, Investor Relations and LPs get role-specific views instead of scattered files and manual follow-ups.",
  },
  {
    title: "Workflow execution",
    description:
      "Capital calls, distributions, repayment notices, investor documents, compliance workflows and portfolio updates are structured into controlled workflows.",
  },
  {
    title: "Daily AI opinions",
    description:
      "VENTIQ is designed to generate daily workspace opinions, risk flags, recommended actions and stakeholder-ready communication drafts.",
  },
];

const workflows = [
  "Capital Call Workflow",
  "Distribution Waterfall",
  "Repayment Notices",
  "Document Engine",
  "Investor Portal",
  "Managing Partner Dashboard",
  "Portfolio Intelligence",
  "Compliance Knowledge Hub",
];

export default function ProductOverviewPage() {
  return (
    <main className="legal-page">
      <section className="legal-hero">
        <Link className="legal-back-link" href="/">
          ← Back to VENTIQ
        </Link>

        <p className="legal-kicker">Product Overview</p>

        <h1>The AI operating system for private capital workflows.</h1>

        <p>
          VENTIQ is built to help private capital teams replace scattered
          spreadsheets, emails, fund admin reports and manual MIS with one
          connected operating layer.
        </p>

        <div className="overview-cta-row">
          <Link href="/#contact" className="public-primary-cta">
            Request Walkthrough
          </Link>

          <Link href="/capital-call" className="public-secondary-cta">
            See Capital Call Workflow
          </Link>
        </div>
      </section>

      <section className="legal-card-grid">
        {overviewSections.map((section) => (
          <div className="legal-info-card" key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.description}</p>
          </div>
        ))}
      </section>

      <section className="legal-content-card">
        <h2>Core workflows</h2>

        <div className="legal-pill-grid">
          {workflows.map((workflow) => (
            <span key={workflow}>{workflow}</span>
          ))}
        </div>
      </section>

      <section className="legal-content-card">
        <h2>Built for fund operations reality</h2>

        <p>
          VENTIQ is designed for teams that need to prepare investor
          communications, review fund numbers, track compliance priorities,
          manage workflow approvals and give stakeholders access to the right
          information without repeatedly rebuilding MIS from Excel.
        </p>

        <p>
          Public product screens may show sample or illustrative data. The
          purpose is to demonstrate workflow design, operating logic and the
          connected workspace experience.
        </p>
      </section>
    </main>
  );
}