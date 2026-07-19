import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Capital Call Allocation Engine | VENTIQ",
  description:
    "Calculate investor-wise capital call allocations from imported commitments and prepare finance-ready capital call drafts.",
};

export default function CapitalCallAllocationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
