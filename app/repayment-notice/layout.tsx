import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Repayment Notice Workflow | VENTIQ",
  description:
    "Prepare repayment notices, investor communication, email drafts, PDF outputs and dispatch tracking for private credit and venture debt funds.",
};

export default function RepaymentNoticeLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}