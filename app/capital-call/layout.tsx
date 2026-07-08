import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Capital Call Workflow | VENTIQ",
  description:
    "Generate capital call drafts, investor-wise allocations, approval previews and capital call notices from one connected private capital workflow.",
};

export default function CapitalCallLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}