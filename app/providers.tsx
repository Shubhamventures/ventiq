"use client";

import type { ReactNode } from "react";

import { AuthProvider } from "../lib/auth/AuthProvider";
import AuthenticatedAccountControl from "../components/auth/AuthenticatedAccountControl";

export default function Providers({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AuthProvider>
      <AuthenticatedAccountControl />
      {children}
    </AuthProvider>
  );
}
