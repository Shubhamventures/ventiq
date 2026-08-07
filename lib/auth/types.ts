"use client";

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
  investor: "Investor",
  maker: "Maker",
  checker: "Checker",
};

export const ROLE_HOME_ROUTES: Record<VentiqRole, string> = {
  fund_admin: "/workspace",
  managing_partner: "/managing-partner-ai",
  finance_head: "/finance-head-ai",
  investment_team: "/investment-team-ai",
  compliance_team: "/compliance-ai",
  investor_relations: "/fundraising-ai",
  investor: "/investor-portal",
  maker: "/migration/activation",
  checker: "/migration/activation",
};

export function isVentiqRole(value: unknown): value is VentiqRole {
  return (
    typeof value === "string" &&
    (VENTIQ_ROLES as readonly string[]).includes(value)
  );
}

export function getRoleLabel(value: string | null | undefined) {
  return isVentiqRole(value) ? ROLE_LABELS[value] : "Access Not Assigned";
}

export function getRoleHomeRoute(value: string | null | undefined) {
  return isVentiqRole(value) ? ROLE_HOME_ROUTES[value] : "/workspace";
}
