import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Investor Relations & Fundraising AI | VENTIQ",
  description:
    "Support investor relations, LP updates, DDQ responses, fundraising materials, investor follow-ups and fund communication workflows.",
};

export default function FundraisingAiLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}