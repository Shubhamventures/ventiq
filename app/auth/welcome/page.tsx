import Link from "next/link";

type WelcomePageProps = {
  searchParams?: Promise<{
    next?: string;
  }>;
};

export default async function AuthWelcomePage({
  searchParams,
}: WelcomePageProps) {
  const params = await searchParams;
  const nextPath = params?.next || "/fund-onboarding";

  return (
    <main className="welcome-page">
      <style>{`
        .welcome-page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top left, rgba(37, 99, 235, 0.22), transparent 34rem),
            radial-gradient(circle at top right, rgba(245, 200, 91, 0.16), transparent 32rem),
            #07101f;
          color: #f8fbff;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          display: grid;
          place-items: center;
          padding: 34px;
        }

        .welcome-card {
          width: min(760px, 100%);
          border: 1px solid rgba(147, 197, 253, 0.16);
          background: rgba(15, 23, 42, 0.78);
          border-radius: 32px;
          padding: 38px;
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.26);
        }

        .eyebrow {
          color: #f5c85b;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          font-size: 12px;
          font-weight: 950;
          margin: 0 0 14px;
        }

        h1 {
          margin: 0;
          font-size: clamp(38px, 6vw, 68px);
          line-height: 0.96;
          letter-spacing: -0.06em;
        }

        p {
          margin: 20px 0 0;
          color: #c7d7f4;
          font-size: 17px;
          line-height: 1.65;
        }

        .actions {
          margin-top: 28px;
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .primary-link,
        .secondary-link {
          border-radius: 999px;
          padding: 12px 17px;
          font-size: 14px;
          font-weight: 950;
          text-decoration: none;
          white-space: nowrap;
        }

        .primary-link {
          background: #f5c85b;
          color: #07101f;
        }

        .secondary-link {
          background: rgba(15, 23, 42, 0.74);
          color: #dbeafe;
          border: 1px solid rgba(147, 197, 253, 0.24);
        }
      `}</style>

      <section className="welcome-card">
        <p className="eyebrow">VENTIQ Secure Access</p>
        <h1>Invite accepted</h1>
        <p>
          Your VENTIQ access has been initiated. In production, this page will
          complete session verification and route you to your role-based
          dashboard. For the current build, continue to the assigned workspace.
        </p>

        <div className="actions">
          <Link className="primary-link" href={nextPath}>
            Open Assigned Workspace
          </Link>
          <Link className="secondary-link" href="/fund-onboarding">
            Fund Onboarding
          </Link>
        </div>
      </section>
    </main>
  );
}