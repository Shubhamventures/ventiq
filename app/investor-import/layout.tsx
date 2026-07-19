import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Investor Import Engine | VENTIQ",
  description:
    "Import investor masters, commitments and fund onboarding data into VENTIQ for capital calls, finance workflows and investor reporting.",
};

export default function InvestorImportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
