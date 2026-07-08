import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Knowledge Hub | VENTIQ",
  description:
    "A regulatory and workflow knowledge hub for circular tracking, SOP generation, source matching and compliance workflow intelligence.",
};

export default function KnowledgeHubLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}