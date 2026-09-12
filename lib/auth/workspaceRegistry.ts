import type { VentiqRole } from "./types";

export type WorkspaceGroup = "Setup" | "Dashboards" | "Workflows";

export type WorkspaceDefinition = {
  key: string;
  group: WorkspaceGroup;
  label: string;
  href: string;
  roles: readonly VentiqRole[];
  subtitle: string;
  description: string;
  showInLaunchCenter?: boolean;
};

export const WORKSPACE_REGISTRY: readonly WorkspaceDefinition[] = [
  {
    key: "setup-control-center",
    group: "Setup",
    label: "Setup Control Center",
    href: "/fund-onboarding",
    roles: ["fund_admin"],
    subtitle: "Governed onboarding",
    description:
      "Create the governed fund, configure people and access, and manage implementation setup.",
    showInLaunchCenter: true,
  },
  {
    key: "data-center",
    group: "Setup",
    label: "Data Center",
    href: "/migration",
    roles: ["fund_admin", "maker", "checker"],
    subtitle: "Fund data control",
    description:
      "Review migrated fund data, lineage, readiness and connected operating datasets.",
  },
  {
    key: "data-intake",
    group: "Setup",
    label: "Data Intake",
    href: "/migration/data-intake",
    roles: ["fund_admin", "maker", "checker"],
    subtitle: "Controlled intake",
    description:
      "Bring structured and historical fund data into VENTIQ through governed intake.",
    showInLaunchCenter: true,
  },
  {
    key: "activation",
    group: "Setup",
    label: "Activation",
    href: "/migration/activation",
    roles: ["fund_admin", "maker", "checker"],
    subtitle: "Readiness and approval",
    description:
      "Review readiness, maker-checker approvals and controlled fund activation.",
    showInLaunchCenter: true,
  },
  {
    key: "issue-center",
    group: "Setup",
    label: "Issue Center",
    href: "/issues",
    roles: [
      "fund_admin",
      "managing_partner",
      "finance_head",
      "investment_team",
      "compliance_team",
      "investor_relations",
      "maker",
      "checker",
    ],
    subtitle: "Exceptions and repair",
    description:
      "Centralize canonical validation, reconciliation and launch blockers with governed repair links.",
    showInLaunchCenter: true,
  },
  {
    key: "managing-partner",
    group: "Dashboards",
    label: "Managing Partner",
    href: "/managing-partner-ai",
    roles: ["managing_partner"],
    subtitle: "Executive command",
    description:
      "Performance, deployment, portfolio movement, risk and fund-level operating context.",
    showInLaunchCenter: true,
  },
  {
    key: "finance-head",
    group: "Dashboards",
    label: "Finance",
    href: "/finance-head-ai",
    roles: ["finance_head", "maker", "checker"],
    subtitle: "Finance operations",
    description:
      "Capital activity, reconciliations, notices, documents and finance controls.",
    showInLaunchCenter: true,
  },
  {
    key: "investment-team",
    group: "Dashboards",
    label: "Investment",
    href: "/investment-team-ai",
    roles: ["investment_team"],
    subtitle: "Portfolio intelligence",
    description:
      "Deal monitoring, valuation, portfolio company context and investment updates.",
    showInLaunchCenter: true,
  },
  {
    key: "compliance",
    group: "Dashboards",
    label: "Compliance",
    href: "/compliance-ai",
    roles: ["compliance_team", "maker", "checker"],
    subtitle: "Governed control",
    description:
      "Filings, evidence, approvals, due dates, exceptions and regulatory control.",
    showInLaunchCenter: true,
  },
  {
    key: "investor-relations",
    group: "Dashboards",
    label: "Investor Relations",
    href: "/fundraising-ai",
    roles: ["investor_relations"],
    subtitle: "LP operations",
    description:
      "Investor servicing, fundraising workflow, DDQs, data room and LP engagement.",
    showInLaunchCenter: true,
  },
  {
    key: "investor-portal",
    group: "Dashboards",
    label: "Investor / LP",
    href: "/investor-portal",
    roles: ["investor", "investor_relations"],
    subtitle: "Investor experience",
    description:
      "Entitled financial position, cashflows, statements and private documents.",
    showInLaunchCenter: true,
  },
  {
    key: "debt-lms",
    group: "Workflows",
    label: "Debt LMS",
    href: "/debt-lms",
    roles: ["finance_head", "investment_team", "maker", "checker"],
    subtitle: "Debt operations",
    description:
      "Track borrower schedules, repayments, notices, covenants and operating controls.",
    showInLaunchCenter: true,
  },
  {
    key: "bank-reconciliation",
    group: "Workflows",
    label: "Bank MIS",
    href: "/bank-reconciliation",
    roles: ["finance_head", "maker", "checker"],
    subtitle: "Cash control",
    description:
      "Process bank activity, mappings, evidence and reconciliations.",
    showInLaunchCenter: true,
  },
  {
    key: "document-studio",
    group: "Workflows",
    label: "Document Studio",
    href: "/document-studio",
    roles: [
      "managing_partner",
      "finance_head",
      "compliance_team",
      "investor_relations",
      "maker",
      "checker",
    ],
    subtitle: "Governed documents",
    description:
      "Generate, review and publish governed fund and investor documents.",
    showInLaunchCenter: true,
  },
  {
    key: "data-room",
    group: "Workflows",
    label: "Data Room & DDQ",
    href: "/data-room",
    roles: ["managing_partner", "compliance_team", "investor_relations", "investor"],
    subtitle: "Investor diligence",
    description:
      "Manage controlled diligence documents, DDQs and investor engagement.",
    showInLaunchCenter: true,
  },
] as const;

export const WORKSPACE_GROUPS: readonly WorkspaceGroup[] = [
  "Setup",
  "Dashboards",
  "Workflows",
];

export function canRoleUseWorkspace(
  role: VentiqRole | null | undefined,
  workspace: WorkspaceDefinition
) {
  if (!role) {
    return false;
  }

  if (role === "fund_admin") {
    return true;
  }

  return workspace.roles.includes(role);
}

export function visibleWorkspacesForRole(
  role: VentiqRole | null | undefined,
  group?: WorkspaceGroup
) {
  return WORKSPACE_REGISTRY.filter(
    (workspace) =>
      (!group || workspace.group === group) &&
      canRoleUseWorkspace(role, workspace)
  );
}
