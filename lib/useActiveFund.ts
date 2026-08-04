"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "ventiq.activeFundName";
const CHANGE_EVENT = "ventiq:active-fund-changed";

type ActiveFundEvent = CustomEvent<{
  fundName: string;
}>;

export function useActiveFund(defaultFundName: string) {
  const [activeFundName, setActiveFundNameState] =
    useState(defaultFundName);

  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const storedFundName = window.localStorage
      .getItem(STORAGE_KEY)
      ?.trim();

    if (storedFundName) {
      setActiveFundNameState(storedFundName);
    }

    setIsReady(true);

    function handleStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY || !event.newValue) {
        return;
      }

      setActiveFundNameState(event.newValue);
    }

    function handleFundChange(event: Event) {
      const customEvent = event as ActiveFundEvent;
      const nextFundName =
        customEvent.detail?.fundName?.trim();

      if (nextFundName) {
        setActiveFundNameState(nextFundName);
      }
    }

    window.addEventListener("storage", handleStorage);
    window.addEventListener(
      CHANGE_EVENT,
      handleFundChange
    );

    return () => {
      window.removeEventListener(
        "storage",
        handleStorage
      );

      window.removeEventListener(
        CHANGE_EVENT,
        handleFundChange
      );
    };
  }, []);

  const setActiveFundName = useCallback(
    (fundName: string) => {
      const normalizedFundName = fundName.trim();

      if (!normalizedFundName) {
        return;
      }

      window.localStorage.setItem(
        STORAGE_KEY,
        normalizedFundName
      );

      setActiveFundNameState(normalizedFundName);

      window.dispatchEvent(
        new CustomEvent(CHANGE_EVENT, {
          detail: {
            fundName: normalizedFundName,
          },
        })
      );
    },
    []
  );

  return {
    activeFundName,
    setActiveFundName,
    isReady,
  };
}