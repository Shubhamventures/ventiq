"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import ProtectedWorkspace from "../../components/auth/ProtectedWorkspace";
import {
  getMembershipOrganisationName,
  useVentiqAuth,
} from "../../lib/auth/AuthProvider";
import {
  getRoleLabel,
  type VentiqRole,
} from "../../lib/auth/types";

type WorkspaceLink = {
  label: string;
  route: string;
  roles: readonly VentiqRole[];
  description: string;
};

const workspaceLinks: WorkspaceLink[] = [
  {
    label: "Managing Partner",
    route: "/managing-partner-ai",
    roles: ["managing_partner"],
    description: "Fund performance, portfolio, risks and LP-ready intelligence.",
  },
  {
    label: "Finance Head",
    route: "/finance-head-ai",
    roles: ["finance_head", "maker", "checker"],
    description: "Capital calls, distributions, documents and finance controls.",
  },
  {
    label: "Investment Team",
    route: "/investment-team-ai",
    roles: ["investment_team"],
    description: "Portfolio movement, repayments, covenants and exit readiness.",
  },
  {
    label: "Compliance",
    route: "/compliance-ai",
    roles: ["compliance_team", "maker", "checker"],
    description: "Filings, evidence, regulatory review and audit readiness.",
  },
  {
    label: "Investor Relations",
    route: "/fundraising-ai",
    roles: ["investor_relations"],
    description: "LP pipeline, DDQs, data room and investor engagement.",
  },
  {
    label: "Investor Portal",
    route: "/investor-portal",
    roles: ["investor", "investor_relations"],
    description: "Investor-specific commitments, cashflows and documents.",
  },
  {
    label: "Fund Activation",
    route: "/migration/activation",
    roles: ["fund_admin", "maker", "checker"],
    description: "Data readiness, maker-checker approvals and fund activation.",
  },
];

export default function WorkspacePage() {
  const router = useRouter();
  const {
    profile,
    activeRole,
    memberships,
    fundAccess,
    signOut,
    canUseRole,
  } = useVentiqAuth();

  const accessibleLinks = useMemo(
    () =>
      workspaceLinks.filter(
        (link) => activeRole === "fund_admin" || canUseRole(link.roles)
      ),
    [activeRole, canUseRole]
  );

  async function handleSignOut() {
    await signOut();
    router.replace("/auth/login");
  }

  return (
    <ProtectedWorkspace
      allowedRoles={[
        "fund_admin",
        "managing_partner",
        "finance_head",
        "investment_team",
        "compliance_team",
        "investor_relations",
        "investor",
        "maker",
        "checker",
      ]}
      requireFundAccess={false}
    >
      <main className="workspace-home">
        <section className="workspace-shell">
          <header>
            <div>
              <p className="eyebrow">VENTIQ SECURE WORKSPACE</p>
              <h1>Welcome, {profile?.full_name || profile?.email || "VENTIQ User"}</h1>
              <p>
                Your role, organisation and fund permissions determine the
                dashboards and workflows available below.
              </p>
            </div>

            <button onClick={handleSignOut} type="button">
              Sign out
            </button>
          </header>

          <div className="context-grid">
            <article>
              <span>Role</span>
              <strong>{getRoleLabel(activeRole)}</strong>
            </article>
            <article>
              <span>Organisation</span>
              <strong>
                {memberships[0]
                  ? getMembershipOrganisationName(memberships[0])
                  : "Not assigned"}
              </strong>
            </article>
            <article>
              <span>Fund access</span>
              <strong>{fundAccess.length} fund permission(s)</strong>
            </article>
          </div>

          <div className="workspace-grid">
            {accessibleLinks.map((link) => (
              <a href={link.route} key={link.route}>
                <span>Open workspace</span>
                <h2>{link.label}</h2>
                <p>{link.description}</p>
                <strong>Continue →</strong>
              </a>
            ))}
          </div>
        </section>

        <style jsx>{`
          .workspace-home {
            min-height: 100vh;
            padding: 36px;
            color: #f8fbff;
            background:
              radial-gradient(circle at 10% 8%, rgba(37, 110, 255, 0.24), transparent 30%),
              linear-gradient(145deg, #020814, #07152b 58%, #061126);
          }

          .workspace-shell {
            width: min(1280px, 100%);
            margin: 0 auto;
          }

          header {
            display: flex;
            justify-content: space-between;
            gap: 24px;
            align-items: flex-start;
          }

          header h1 {
            margin: 0;
            font-size: clamp(42px, 7vw, 76px);
            line-height: 1;
            letter-spacing: -0.05em;
          }

          header p {
            max-width: 760px;
            color: #bdcbe0;
            line-height: 1.7;
          }

          header button {
            min-height: 46px;
            padding: 0 17px;
            border: 1px solid rgba(130, 172, 228, 0.34);
            border-radius: 12px;
            color: #dce9fa;
            font-weight: 800;
            cursor: pointer;
            background: rgba(5, 18, 38, 0.72);
          }

          .eyebrow {
            color: #62a8ff;
            font-weight: 900;
            letter-spacing: 0.1em;
          }

          .context-grid,
          .workspace-grid {
            display: grid;
            gap: 16px;
          }

          .context-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            margin: 34px 0;
          }

          .context-grid article,
          .workspace-grid a {
            border: 1px solid rgba(118, 163, 222, 0.27);
            background: rgba(7, 20, 42, 0.82);
          }

          .context-grid article {
            padding: 20px;
            border-radius: 18px;
          }

          .context-grid span,
          .workspace-grid span {
            color: #78b2ff;
            font-weight: 850;
          }

          .context-grid strong {
            display: block;
            margin-top: 8px;
            font-size: 20px;
          }

          .workspace-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .workspace-grid a {
            min-height: 210px;
            padding: 24px;
            display: flex;
            flex-direction: column;
            border-radius: 20px;
            color: inherit;
            text-decoration: none;
            transition: transform 160ms ease, border-color 160ms ease;
          }

          .workspace-grid a:hover {
            transform: translateY(-3px);
            border-color: rgba(98, 168, 255, 0.72);
          }

          .workspace-grid h2 {
            margin: 16px 0 8px;
            font-size: 27px;
          }

          .workspace-grid p {
            color: #b7c7dc;
            line-height: 1.6;
          }

          .workspace-grid strong {
            margin-top: auto;
          }

          @media (max-width: 900px) {
            .context-grid,
            .workspace-grid {
              grid-template-columns: 1fr;
            }

            header {
              flex-direction: column;
            }
          }
        `}</style>
      </main>
    </ProtectedWorkspace>
  );
}
