"use client";

import type { VentiqRole } from "./types";

export type PrivateRouteAccessPolicy = {
  key: string;
  prefix: string;
  allowedRoles: readonly VentiqRole[];
  requireFundAccess: boolean;
};

const ALL_ACTIVE_ROLES: readonly VentiqRole[] = [
  "fund_admin",
  "managing_partner",
  "finance_head",
  "investment_team",
  "compliance_team",
  "investor_relations",
  "investor",
  "maker",
  "checker",
];

const INTERNAL_ROLES: readonly VentiqRole[] = [
  "fund_admin",
  "managing_partner",
  "finance_head",
  "investment_team",
  "compliance_team",
  "investor_relations",
  "maker",
  "checker",
];

const FINANCE_ROLES: readonly VentiqRole[] = [
  "fund_admin",
  "finance_head",
  "maker",
  "checker",
];

const DEBT_ROLES: readonly VentiqRole[] = [
  "fund_admin",
  "finance_head",
  "investment_team",
  "maker",
  "checker",
];

const DOCUMENT_ROLES: readonly VentiqRole[] = [
  "fund_admin",
  "managing_partner",
  "finance_head",
  "compliance_team",
  "investor_relations",
  "maker",
  "checker",
];

export const PRIVATE_ROUTE_POLICIES: readonly PrivateRouteAccessPolicy[] = [
  { key: "launch-center", prefix: "/launch-center", allowedRoles: ALL_ACTIVE_ROLES, requireFundAccess: false },
  { key: "workspace", prefix: "/workspace", allowedRoles: ALL_ACTIVE_ROLES, requireFundAccess: false },
  { key: "fund-onboarding", prefix: "/fund-onboarding", allowedRoles: ["fund_admin"], requireFundAccess: false },
  { key: "admin", prefix: "/admin", allowedRoles: ["fund_admin"], requireFundAccess: false },
  { key: "database-test", prefix: "/database-test", allowedRoles: ["fund_admin"], requireFundAccess: false },
  { key: "founder-leads-shell", prefix: "/founder/leads", allowedRoles: ALL_ACTIVE_ROLES, requireFundAccess: false },
  { key: "activity-engine", prefix: "/activity-engine", allowedRoles: INTERNAL_ROLES, requireFundAccess: true },
  { key: "issue-center", prefix: "/issues", allowedRoles: INTERNAL_ROLES, requireFundAccess: true },
  { key: "migration", prefix: "/migration", allowedRoles: ["fund_admin", "maker", "checker"], requireFundAccess: true },
  { key: "investor-import", prefix: "/investor-import", allowedRoles: ["fund_admin", "maker", "checker"], requireFundAccess: true },
  { key: "managing-partner", prefix: "/managing-partner-ai", allowedRoles: ["fund_admin", "managing_partner"], requireFundAccess: true },
  { key: "finance-head", prefix: "/finance-head-ai", allowedRoles: FINANCE_ROLES, requireFundAccess: true },
  { key: "finance-legacy", prefix: "/finance", allowedRoles: FINANCE_ROLES, requireFundAccess: true },
  { key: "investment-team", prefix: "/investment-team-ai", allowedRoles: ["fund_admin", "investment_team"], requireFundAccess: true },
  { key: "compliance", prefix: "/compliance-ai", allowedRoles: ["fund_admin", "compliance_team", "maker", "checker"], requireFundAccess: true },
  { key: "knowledge-hub", prefix: "/knowledge-hub", allowedRoles: ["fund_admin", "compliance_team"], requireFundAccess: true },
  { key: "investor-relations", prefix: "/fundraising-ai", allowedRoles: ["fund_admin", "investor_relations"], requireFundAccess: true },
  { key: "investor-portal", prefix: "/investor-portal", allowedRoles: ["fund_admin", "investor", "investor_relations"], requireFundAccess: true },
  { key: "debt-lms", prefix: "/debt-lms", allowedRoles: DEBT_ROLES, requireFundAccess: true },
  { key: "repayment-notice", prefix: "/repayment-notice", allowedRoles: DEBT_ROLES, requireFundAccess: true },
  { key: "bank-reconciliation", prefix: "/bank-reconciliation", allowedRoles: FINANCE_ROLES, requireFundAccess: true },
  { key: "capital-call-allocation", prefix: "/capital-call-allocation", allowedRoles: FINANCE_ROLES, requireFundAccess: true },
  { key: "capital-call", prefix: "/capital-call", allowedRoles: FINANCE_ROLES, requireFundAccess: true },
  { key: "distribution-waterfall", prefix: "/distribution-waterfall", allowedRoles: FINANCE_ROLES, requireFundAccess: true },
  { key: "portfolio-intelligence", prefix: "/portfolio-intelligence", allowedRoles: ["fund_admin", "managing_partner", "finance_head", "investment_team"], requireFundAccess: true },
  { key: "document-studio", prefix: "/document-studio", allowedRoles: DOCUMENT_ROLES, requireFundAccess: true },
  { key: "document-engine", prefix: "/document-engine", allowedRoles: DOCUMENT_ROLES, requireFundAccess: true },
  { key: "data-room", prefix: "/data-room", allowedRoles: ["fund_admin", "managing_partner", "compliance_team", "investor_relations", "investor"], requireFundAccess: true },
] as const;

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function getPrivateRoutePolicy(pathname: string) {
  return PRIVATE_ROUTE_POLICIES.find((policy) => matchesPrefix(pathname, policy.prefix)) ?? null;
}
