import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Migration & Modular Adoption | VENTIQ",
  description:
    "Start with one VENTIQ dashboard, migrate existing fund and investor data, and expand into a full private capital operating system.",
};

export default function MigrationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
