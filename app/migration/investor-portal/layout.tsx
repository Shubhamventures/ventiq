import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Investor Portal Migration | VENTIQ",
  description:
    "Migrate investor master data, historical investor documents, SOAs, capital calls, distributions and IRR statements into the VENTIQ Investor Portal.",
};

export default function InvestorPortalMigrationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
