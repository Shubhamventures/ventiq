import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | VENTIQ",
  description:
    "Privacy policy for VENTIQ, including how walkthrough requests and product interactions may be handled.",
};

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <section className="legal-hero">
        <Link className="legal-back-link" href="/">
          ← Back to VENTIQ
        </Link>

        <p className="legal-kicker">Privacy Policy</p>

        <h1>Privacy principles for VENTIQ visitors and walkthrough requests.</h1>

        <p>
          This page explains how VENTIQ may handle information submitted through
          the website, walkthrough requests and product preview interactions.
        </p>
      </section>

      <section className="legal-content-card">
        <h2>Information we may collect</h2>

        <p>
          When you request a walkthrough, VENTIQ may collect details such as your
          name, email address, phone number, company or fund name, role, firm
          type, area of interest and message.
        </p>

        <p>
          During product walkthroughs, VENTIQ may also receive business context
          that you voluntarily share, such as fund operations challenges,
          reporting workflows, compliance requirements or investor communication
          needs.
        </p>
      </section>

      <section className="legal-content-card">
        <h2>How information may be used</h2>

        <p>
          Information submitted through the website may be used to respond to
          walkthrough requests, understand product interest, improve VENTIQ
          workflows and communicate relevant product updates.
        </p>

        <p>
          VENTIQ does not claim to sell personal information to advertisers.
          Product and walkthrough information is used for legitimate business communication, product evaluation, support and product improvement purposes.
        </p>
      </section>

      <section className="legal-content-card">
        <h2>Product preview data</h2>

        <p>
          Public product pages may contain sample or illustrative fund,
          portfolio, investor, compliance and workflow data. Public demo data
          should not be treated as client data unless explicitly stated.
        </p>
      </section>

      <section className="legal-content-card">
        <h2>Data protection direction</h2>

        <p>
          VENTIQ is designed for private capital workflows where investor, fund and compliance information can be sensitive. Role-aware access, audit history, document controls and governed workflow patterns are part of the product data-handling approach.
        </p>

        <p>
          This notice may be updated as VENTIQ’s product, operating model and applicable privacy requirements evolve. Material changes should be reflected on this page.
        </p>
      </section>
    </main>
  );
}