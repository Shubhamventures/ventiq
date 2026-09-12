import type { ReactNode } from "react";

import ProtectedWorkspace from "../../components/auth/ProtectedWorkspace";

export default function BankReconciliationLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ProtectedWorkspace
      allowedRoles={["finance_head", "maker", "checker"]}
      requireFundAccess
    >
      {children}
    </ProtectedWorkspace>
  );
}
