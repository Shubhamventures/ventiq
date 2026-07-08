import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Document Engine | VENTIQ",
  description:
    "Generate, preview and manage investor documents including capital call notices, distribution notices and fund workflow outputs.",
};

export default function DocumentEngineLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}