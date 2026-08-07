import type { Metadata } from "next";
import type { ReactNode } from "react";

import ProtectedWorkspace from "../../components/auth/ProtectedWorkspace";

export const metadata: Metadata = {
  title: "Migration & Modular Adoption | VENTIQ",
  description:
    "Start with one VENTIQ dashboard, migrate existing fund and investor data, and expand into a full private capital operating system.",
};

export default function MigrationLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ProtectedWorkspace
      allowedRoles={["fund_admin", "maker", "checker"]}
    >
      {children}
    </ProtectedWorkspace>
  );
}