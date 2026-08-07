import type { ReactNode } from "react";
import ProtectedWorkspace from "../../components/auth/ProtectedWorkspace";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedWorkspace allowedRoles={["investor", "investor_relations"]}>
      {children}
    </ProtectedWorkspace>
  );
}
