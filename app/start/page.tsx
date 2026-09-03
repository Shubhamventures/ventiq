import Link from "next/link";
import "./start.css";

const steps = [
  ["01", "Create Fund", "Establish the governed fund record."],
  ["02", "People & Access", "Assign roles and send secure invitations."],
  ["03", "Fund Data", "Bring structured data and documents into VENTIQ."],
  ["04", "Review & Readiness", "Resolve exceptions and confirm readiness."],
  ["05", "Activate", "Complete maker-checker activation."],
  ["06", "Launch VENTIQ", "Open role-native workspaces and workflows."],
];

export default function StartPage() {
  return (
    <main className="ventiq-start-page">
      <section className="ventiq-start-shell">
        <header className="ventiq-start-header">
          <Link className="ventiq-start-brand" href="/">VENTIQ</Link>
          <div className="ventiq-start-header-actions">
            <Link className="ghost" href="/demo">Guided demo</Link>
            <Link className="ghost" href="/auth/login">Sign in</Link>
          </div>
        </header>

        <section className="ventiq-start-hero">
          <p className="eyebrow">GET STARTED</p>
          <h1>Bring your first fund onto VENTIQ.</h1>
          <p className="lede">
            Create the governed fund record, invite your team, bring historical
            data into one operating layer and activate role-native workspaces.
          </p>

          <div className="ventiq-start-actions">
            <Link className="primary" href="/fund-onboarding">
              Continue to VENTIQ →
            </Link>
            <Link className="secondary" href="/#contact">
              Request onboarding →
            </Link>
          </div>

          <div className="controlled-note">
            <strong>Controlled onboarding</strong>
            New Fund Admin accounts are currently provisioned through VENTIQ&apos;s
            assisted implementation process. Each administrator receives a secure
            invitation and sets their own password.
          </div>
        </section>

        <section className="ventiq-start-journey" aria-label="VENTIQ onboarding journey">
          {steps.map(([step, title, body]) => (
            <article key={step}>
              <span>{step}</span>
              <div>
                <h2>{title}</h2>
                <p>{body}</p>
              </div>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
