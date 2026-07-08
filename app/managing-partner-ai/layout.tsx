import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Managing Partner AI Dashboard | VENTIQ",
  description:
    "A Managing Partner workspace for fund performance, portfolio intelligence, liquidity, compliance alerts and daily AI opinions across private capital funds.",
};

export default function ManagingPartnerLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}