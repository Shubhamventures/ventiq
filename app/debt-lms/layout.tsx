import type { ReactNode } from "react";

import ProtectedWorkspace from "../../components/auth/ProtectedWorkspace";

export default function DebtLmsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ProtectedWorkspace
      allowedRoles={["finance_head", "investment_team", "maker", "checker"]}
      requireFundAccess
    >
      {children}
    </ProtectedWorkspace>
  );
}
