import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Finance Head AI Workspace | VENTIQ",
  description:
    "A finance workspace for capital calls, distributions, investor notices, accounting workflows, fund reporting and daily finance priorities.",
};

export default function FinanceHeadAiLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}