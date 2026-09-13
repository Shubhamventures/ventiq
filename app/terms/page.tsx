import Link from "next/link";

export const metadata = {
  title: "Terms of Use | VENTIQ",
  description:
    "Terms of use for the VENTIQ website, public product experience and product enquiries.",
};

export default function TermsPage() {
  return (
    <main className="legal-page">
      <section className="legal-hero">
        <Link className="legal-back-link" href="/">
          ← Back to VENTIQ
        </Link>

        <p className="legal-kicker">Terms of Use</p>

        <h1>Terms for using the VENTIQ website and public product experience.</h1>

        <p>
          These terms apply to use of the VENTIQ website, public product
          experience, product enquiry forms and related informational content.
        </p>
      </section>

      <section className="legal-content-card">
        <h2>Website and public product experience</h2>

        <p>
          VENTIQ product screens shown on the website may include representative
          demonstration data. They are intended to explain VENTIQ workflows,
          operating concepts and product capabilities for private capital teams.
        </p>

        <p>
          Public product screens are not a client workspace and do not constitute
          investment, accounting, tax, legal or compliance advice. Authenticated
          client workspaces are governed separately under the applicable
          implementation and access scope.
        </p>
      </section>

      <section className="legal-content-card">
        <h2>No professional advice</h2>

        <p>
          VENTIQ may reference fund operations, capital calls, distributions,
          repayment notices, investor reporting and compliance workflows.
          Website content is provided for product explanation only and should
          not replace professional advice from legal, tax, audit, accounting,
          compliance or investment advisors.
        </p>
      </section>

      <section className="legal-content-card">
        <h2>Use of content</h2>

        <p>
          The VENTIQ website, product descriptions, screenshots, workflows,
          interface concepts and written content are intended for evaluating
          VENTIQ. They should not be copied, reused or represented as another
          product without permission.
        </p>
      </section>

      <section className="legal-content-card">
        <h2>Product availability</h2>

        <p>
          VENTIQ may be made available through guided evaluation, governed client onboarding or an authenticated production workspace depending on the agreed scope. Availability and permitted use may vary by client, workflow and access rights.
        </p>
      </section>

      <section className="legal-content-card">
        <h2>Updates</h2>

        <p>
          These terms may be updated as VENTIQ&apos;s product, operating model and client usage evolve.
        </p>
      </section>
    </main>
  );
}