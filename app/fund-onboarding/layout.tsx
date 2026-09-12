import type { ReactNode } from "react";

import ProtectedWorkspace from "../../components/auth/ProtectedWorkspace";

export default function FundOnboardingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ProtectedWorkspace
      allowedRoles={["fund_admin"]}
      requireFundAccess={false}
    >
      {children}
    </ProtectedWorkspace>
  );
}
