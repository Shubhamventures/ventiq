import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Distribution Waterfall Workflow | VENTIQ",
  description:
    "Prepare investor-wise distribution allocations, approval workflows, notices, accounting outputs and waterfall previews for private capital funds.",
};

export default function DistributionWaterfallLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}