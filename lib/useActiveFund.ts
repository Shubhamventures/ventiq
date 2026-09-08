"use client";

import { useMemo } from "react";
import { useVentiqAuth } from "./auth/AuthProvider";

export function useActiveFund(defaultFundName: string) {
  const {
    activeFundName,
    availableFundAccess,
    fundContextReady,
    setActiveFundName,
  } = useVentiqAuth();

  const availableFundNames = useMemo(
    () =>
      Array.from(
        new Set(
          availableFundAccess
            .map((access) => access.fund_name.trim())
            .filter(Boolean)
        )
      ).sort((left, right) => left.localeCompare(right)),
    [availableFundAccess]
  );

  return {
    activeFundName:
      fundContextReady
        ? activeFundName
        : defaultFundName,
    availableFundNames,
    setActiveFundName,
    isReady: fundContextReady,
  };
}
