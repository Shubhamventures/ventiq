export const VENTIQ_ROLES = [
  "fund_admin",
  "managing_partner",
  "finance_head",
  "investment_team",
  "compliance_team",
  "investor_relations",
  "investor",
  "maker",
  "checker",
] as const;

export type VentiqRole = (typeof VENTIQ_ROLES)[number];

export const ROLE_LABELS: Record<VentiqRole, string> = {
  fund_admin: "Fund Administrator",
  managing_partner: "Managing Partner",
  finance_head: "Finance Head",
  investment_team: "Investment Team",
  compliance_team: "Compliance Team",
  investor_relations: "Investor Relations",
  investor: "Investor / LP",
  maker: "Maker",
  checker: "Checker",
};

export const ROLE_HOME_ROUTES: Record<VentiqRole, string> = {
  fund_admin: "/fund-onboarding",
  managing_partner: "/managing-partner-ai",
  finance_head: "/finance-head-ai",
  investment_team: "/investment-team-ai",
  compliance_team: "/compliance-ai",
  investor_relations: "/fundraising-ai",
  investor: "/investor-portal",
  maker: "/migration/activation",
  checker: "/migration/activation",
};

export const LEGACY_ROLE_ALIASES: Record<string, VentiqRole> = {
  compliance_officer: "compliance_team",
  investor_lp: "investor",
};

export function isVentiqRole(value: unknown): value is VentiqRole {
  return (
    typeof value === "string" &&
    (VENTIQ_ROLES as readonly string[]).includes(value)
  );
}

export function normalizeVentiqRole(
  value: unknown
): VentiqRole | null {
  if (isVentiqRole(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  return LEGACY_ROLE_ALIASES[value.trim()] ?? null;
}

export function getRoleLabel(value: string | null | undefined) {
  const normalized = normalizeVentiqRole(value);
  return normalized ? ROLE_LABELS[normalized] : "Access Not Assigned";
}

export function getRoleHomeRoute(value: string | null | undefined) {
  const normalized = normalizeVentiqRole(value);
  return normalized ? ROLE_HOME_ROUTES[normalized] : "/workspace";
}
