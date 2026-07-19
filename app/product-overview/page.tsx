import Link from "next/link";

export const metadata = {
  title: "Product Overview | VENTIQ",
  description:
    "Product overview of VENTIQ, the AI operating system for private capital teams across fund operations, investor data rooms, DDQ tracking, investor reporting and portfolio intelligence.",
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
  "Investor Data Room & DDQ Hub",
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

          <Link href="/data-room" className="public-secondary-cta">
            Explore Data Room
          </Link>

          <Link href="/migration" className="public-secondary-cta">
            View Migration Path
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
        <h2>Migration & Modular Adoption</h2>

        <p>
          VENTIQ allows private capital firms to start with one high-impact
          dashboard instead of replacing every process on day one. A firm can
          begin with Investor Portal, Investor Data Room, Finance Head
          Workspace, Compliance Dashboard or Managing Partner Dashboard.
        </p>

        <p>
          The adoption path starts by migrating existing fund, investor,
          document and workflow data into VENTIQ. Once the first workflow is
          live, additional stakeholder dashboards can be connected into the
          same operating layer.
        </p>

        <Link href="/migration" className="public-secondary-cta">
          View Migration & Adoption Path
        </Link>
      </section>
      <section className="legal-content-card">
        <h2>Investor Data Room & DDQ Hub</h2>

        <p>
          VENTIQ includes an investor data room workflow for fundraising and LP
          diligence. Teams can upload legacy documents, classify files, map
          access levels, track investor engagement, manage DDQ questions and
          monitor readiness before sharing information with prospective LPs.
        </p>

        <p>
          This allows firms to start with a modular investor-facing use case —
          such as an LP data room or investor portal — before adopting the full
          VENTIQ operating system.
        </p>

        <Link href="/data-room" className="public-secondary-cta">
          Open Investor Data Room
        </Link>
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