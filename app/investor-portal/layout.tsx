import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Investor Portal | VENTIQ",
  description:
    "A self-service investor portal for capital call notices, distribution notices, statements, fund documents and investor communication.",
};

export default function InvestorPortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}