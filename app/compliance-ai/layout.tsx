import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Compliance AI Workspace | VENTIQ",
  description:
    "Track AIF and private capital compliance tasks, regulatory filings, evidence gaps, circulars, approvals and daily compliance priorities.",
};

export default function ComplianceAiLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}