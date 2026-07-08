import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Portfolio Intelligence | VENTIQ",
  description:
    "Track portfolio company performance, investment exposure, repayment schedules, risk flags, valuation movement and AI portfolio insights.",
};

export default function PortfolioIntelligenceLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}