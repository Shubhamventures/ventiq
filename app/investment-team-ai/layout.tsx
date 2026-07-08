import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Investment Team AI Workspace | VENTIQ",
  description:
    "A portfolio and investment team workspace for company updates, investment monitoring, risk flags, exit readiness and portfolio intelligence.",
};

export default function InvestmentTeamAiLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}