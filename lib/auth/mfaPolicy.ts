import type { VentiqRole } from "./types";

export const MFA_PRIVILEGED_ROLES = [
  "fund_admin",
  "managing_partner",
  "finance_head",
  "investment_team",
  "compliance_team",
  "investor_relations",
  "maker",
  "checker",
] as const satisfies readonly VentiqRole[];

const PRIVILEGED_ROLE_SET = new Set<string>(MFA_PRIVILEGED_ROLES);

export const MFA_PRECONDITION_STATUS = 428;

export type VentiqAssuranceLevel = "aal1" | "aal2";

export type VentiqMfaRequirementCode =
  | "MFA_ENROLLMENT_REQUIRED"
  | "MFA_CHALLENGE_REQUIRED";

export function isMfaPrivilegedRole(
  role: string | null | undefined
) {
  return PRIVILEGED_ROLE_SET.has(
    String(role ?? "").trim().toLowerCase()
  );
}
