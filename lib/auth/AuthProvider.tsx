"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import type { Session, User } from "@supabase/supabase-js";

import {
  isSupabaseConfigured,
  supabase,
} from "../supabaseClient";

import {
  getRoleHomeRoute,
  normalizeVentiqRole,
  type VentiqRole,
} from "./types";

const ACTIVE_FUND_STORAGE_KEY = "ventiq.activeFundName";
const ACTIVE_FUND_CHANGE_EVENT = "ventiq:active-fund-changed";

function normalizeFundName(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function readRequestedActiveFundName() {
  if (typeof window === "undefined") {
    return "";
  }

  return (
    window.localStorage
      .getItem(ACTIVE_FUND_STORAGE_KEY)
      ?.trim() ?? ""
  );
}

function subscribeRequestedActiveFundName(
  onStoreChange: () => void
) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  function handleStorage(event: StorageEvent) {
    if (event.key === ACTIVE_FUND_STORAGE_KEY) {
      onStoreChange();
    }
  }

  function handleFundChange() {
    onStoreChange();
  }

  window.addEventListener(
    "storage",
    handleStorage
  );
  window.addEventListener(
    ACTIVE_FUND_CHANGE_EVENT,
    handleFundChange
  );

  return () => {
    window.removeEventListener(
      "storage",
      handleStorage
    );
    window.removeEventListener(
      ACTIVE_FUND_CHANGE_EVENT,
      handleFundChange
    );
  };
}

function writeRequestedActiveFundName(
  fundName: string
) {
  if (typeof window === "undefined") {
    return;
  }

  const nextFundName = fundName.trim();

  if (nextFundName) {
    window.localStorage.setItem(
      ACTIVE_FUND_STORAGE_KEY,
      nextFundName
    );
  } else {
    window.localStorage.removeItem(
      ACTIVE_FUND_STORAGE_KEY
    );
  }

  window.dispatchEvent(
    new CustomEvent(ACTIVE_FUND_CHANGE_EVENT, {
      detail: {
        fundName: nextFundName,
      },
    })
  );
}

type OrganisationSummary = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

export type VentiqProfile = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  default_role: string | null;
  active_organisation_id: string | null;
  investor_id: string | null;
  status: string | null;
};

type RawOrganisationMembership = {
  id: string;
  organisation_id: string;
  user_id: string;
  role: string;
  status: string;
  is_primary: boolean;
};

export type OrganisationMembership =
  RawOrganisationMembership & {
    ventiq_organisations: OrganisationSummary | null;
  };

export type UserFundAccess = {
  id: string;
  organisation_id: string;
  user_id: string;
  fund_name: string;
  role: string;
  can_view: boolean;
  can_edit: boolean;
  can_approve: boolean;
  investor_id: string | null;
  status: string;
};

type SignInInput = {
  email: string;
  password: string;
};

type VentiqAuthContextValue = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: VentiqProfile | null;
  memberships: OrganisationMembership[];
  fundAccess: UserFundAccess[];
  availableFundAccess: UserFundAccess[];
  activeFundAccess: UserFundAccess | null;
  activeFundName: string;
  fundContextReady: boolean;
  activeRole: VentiqRole | null;
  activeOrganisationId: string | null;
  investorId: string | null;
  accessError: string;

  signIn: (
    input: SignInInput
  ) => Promise<{
    error: string | null;
  }>;

  signOut: () => Promise<void>;
  refreshAccess: () => Promise<void>;
  setActiveFundName: (fundName: string) => void;

  canUseRole: (
    allowedRoles: readonly VentiqRole[]
  ) => boolean;

  canAccessFund: (fundName: string) => boolean;
  getDefaultRoute: () => string;
};

const VentiqAuthContext =
  createContext<VentiqAuthContextValue | null>(null);

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [loading, setLoading] = useState(true);

  const [session, setSession] =
    useState<Session | null>(null);

  const [profile, setProfile] =
    useState<VentiqProfile | null>(null);

  const [memberships, setMemberships] = useState<
    OrganisationMembership[]
  >([]);

  const [fundAccess, setFundAccess] = useState<
    UserFundAccess[]
  >([]);

  const requestedActiveFundName =
    useSyncExternalStore(
      subscribeRequestedActiveFundName,
      readRequestedActiveFundName,
      () => ""
    );

  const [accessError, setAccessError] = useState("");

  const accessUserIdRef = useRef("");

  const clearAccessState = useCallback(() => {
    setProfile(null);
    setMemberships([]);
    setFundAccess([]);
    setAccessError("");
  }, []);

  const loadUserAccess = useCallback(
    async (userId: string) => {
      const client = supabase;

      if (!isSupabaseConfigured || client === null) {
        clearAccessState();
        setAccessError("Supabase is not configured.");
        return;
      }

      const db = client;

      setAccessError("");

      const [
        profileResult,
        membershipResult,
        fundAccessResult,
      ] = await Promise.all([
        db
          .from("ventiq_user_profiles")
          .select(
            "user_id, email, full_name, default_role, active_organisation_id, investor_id, status"
          )
          .eq("user_id", userId)
          .maybeSingle(),

        db
          .from("ventiq_organisation_members")
          .select(
            "id, organisation_id, user_id, role, status, is_primary"
          )
          .eq("user_id", userId)
          .eq("status", "Active")
          .order("is_primary", {
            ascending: false,
          }),

        db
          .from("ventiq_user_fund_access")
          .select(
            "id, organisation_id, user_id, fund_name, role, can_view, can_edit, can_approve, investor_id, status"
          )
          .eq("user_id", userId)
          .eq("status", "Active")
          .order("fund_name", {
            ascending: true,
          }),
      ]);

      const firstError =
        profileResult.error ||
        membershipResult.error ||
        fundAccessResult.error;

      if (firstError) {
        clearAccessState();
        setAccessError(firstError.message);
        return;
      }

      const nextProfile =
        profileResult.data as unknown as
          | VentiqProfile
          | null;

      const rawMemberships =
        (membershipResult.data ??
          []) as unknown as RawOrganisationMembership[];

      const nextFundAccess =
        (fundAccessResult.data ??
          []) as unknown as UserFundAccess[];

      const organisationIds = Array.from(
        new Set(
          rawMemberships
            .map(
              (membership) =>
                membership.organisation_id
            )
            .filter(Boolean)
        )
      );

      let organisations: OrganisationSummary[] = [];

      if (organisationIds.length > 0) {
        const organisationResult = await db
          .from("ventiq_organisations")
          .select("id, name, slug, status")
          .in("id", organisationIds);

        if (organisationResult.error) {
          clearAccessState();
          setAccessError(
            organisationResult.error.message
          );
          return;
        }

        organisations =
          (organisationResult.data ??
            []) as unknown as OrganisationSummary[];
      }

      const organisationById = new Map(
        organisations.map((organisation) => [
          organisation.id,
          organisation,
        ])
      );

      const nextMemberships: OrganisationMembership[] =
        rawMemberships.map((membership) => ({
          ...membership,

          ventiq_organisations:
            organisationById.get(
              membership.organisation_id
            ) ?? null,
        }));

      setProfile(nextProfile ?? null);
      setMemberships(nextMemberships);
      setFundAccess(nextFundAccess);
    },
    [clearAccessState]
  );

  const refreshAccess = useCallback(async () => {
    const userId = session?.user?.id;

    if (!userId) {
      clearAccessState();
      return;
    }

    await loadUserAccess(userId);
  }, [
    clearAccessState,
    loadUserAccess,
    session?.user?.id,
  ]);

  useEffect(() => {
    const client = supabase;

    if (!isSupabaseConfigured || client === null) {
      setLoading(false);
      setAccessError("Supabase is not configured.");
      return;
    }

    const authClient = client;

    let mounted = true;

    async function initialiseAuth() {
      const {
        data: { session: initialSession },
        error,
      } = await authClient.auth.getSession();

      if (!mounted) {
        return;
      }

      if (error) {
        setAccessError(error.message);
      }

      setSession(initialSession ?? null);

      if (initialSession?.user?.id) {
          await loadUserAccess(
            initialSession.user.id
          );
          accessUserIdRef.current =
            initialSession.user.id;
        } else {
          clearAccessState();
          accessUserIdRef.current = "";
        }

      if (mounted) {
        setLoading(false);
      }
    }

    void initialiseAuth();

    const {
      data: { subscription },
    } = authClient.auth.onAuthStateChange(
      (event, nextSession) => {
        setSession(nextSession ?? null);

        const nextUserId =
          nextSession?.user?.id ?? "";
        const accessAlreadyLoaded =
          Boolean(nextUserId) &&
          accessUserIdRef.current === nextUserId;

        // Supabase can rotate a JWT or emit SIGNED_IN again when a
        // browser tab regains focus. Those events must update the
        // session token without blanking/remounting the private app or
        // reloading unchanged governed profile/fund permissions.
        if (
          event === "TOKEN_REFRESHED" ||
          ((event === "SIGNED_IN" ||
            event === "INITIAL_SESSION") &&
            accessAlreadyLoaded)
        ) {
          return;
        }

        setLoading(true);

        window.setTimeout(() => {
          void (async () => {
            if (nextUserId) {
              await loadUserAccess(nextUserId);
              accessUserIdRef.current =
                nextUserId;
            } else {
              clearAccessState();
              accessUserIdRef.current = "";
            }

            if (mounted) {
              setLoading(false);
            }
          })();
        }, 0);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [
    clearAccessState,
    loadUserAccess,
  ]);

  const activeRole =
    useMemo<VentiqRole | null>(() => {
      const profileRole =
        normalizeVentiqRole(
          profile?.default_role
        );

      if (profileRole) {
        return profileRole;
      }

      const primaryMembership =
        memberships.find(
          (membership) =>
            membership.is_primary
        ) ?? memberships[0];

      return normalizeVentiqRole(
        primaryMembership?.role
      );
    }, [
      memberships,
      profile?.default_role,
    ]);

  const activeOrganisationId = useMemo(() => {
    if (profile?.active_organisation_id) {
      return profile.active_organisation_id;
    }

    const primaryMembership =
      memberships.find(
        (membership) =>
          membership.is_primary
      ) ?? memberships[0];

    return (
      primaryMembership?.organisation_id ??
      null
    );
  }, [
    memberships,
    profile?.active_organisation_id,
  ]);

  const availableFundAccess = useMemo(() => {
    const activeViewableAccess = fundAccess.filter(
      (access) =>
        access.status === "Active" &&
        access.can_view &&
        Boolean(access.fund_name.trim())
    );

    if (!activeOrganisationId) {
      return activeViewableAccess;
    }

    return activeViewableAccess.filter(
      (access) =>
        access.organisation_id ===
        activeOrganisationId
    );
  }, [activeOrganisationId, fundAccess]);

  const activeFundAccess = useMemo(() => {
    if (availableFundAccess.length === 0) {
      return null;
    }

    const requested = normalizeFundName(
      requestedActiveFundName
    );

    if (requested) {
      const exactMatch = availableFundAccess.find(
        (access) =>
          normalizeFundName(access.fund_name) ===
          requested
      );

      if (exactMatch) {
        return exactMatch;
      }
    }

    return availableFundAccess[0];
  }, [
    availableFundAccess,
    requestedActiveFundName,
  ]);

  const activeFundName =
    activeFundAccess?.fund_name?.trim() ?? "";

  const fundContextReady = !loading;

  const setActiveFundName = useCallback(
    (fundName: string) => {
      const nextFundName = fundName.trim();

      if (!nextFundName) {
        return;
      }

      writeRequestedActiveFundName(nextFundName);
    },
    []
  );

  useEffect(() => {
    if (
      !fundContextReady ||
      !session?.user?.id
    ) {
      return;
    }

    if (!activeFundName) {
      if (requestedActiveFundName) {
        writeRequestedActiveFundName("");
      }
      return;
    }

    if (
      normalizeFundName(requestedActiveFundName) !==
      normalizeFundName(activeFundName)
    ) {
      writeRequestedActiveFundName(activeFundName);
    }
  }, [
    activeFundName,
    fundContextReady,
    requestedActiveFundName,
    session?.user?.id,
  ]);

  const investorId = useMemo(() => {
    if (profile?.investor_id) {
      return profile.investor_id;
    }

    return (
      fundAccess.find(
        (access) => access.investor_id
      )?.investor_id ?? null
    );
  }, [
    fundAccess,
    profile?.investor_id,
  ]);

  const canUseRole = useCallback(
    (
      allowedRoles: readonly VentiqRole[]
    ) => {
      if (!activeRole) {
        return false;
      }

      if (activeRole === "fund_admin") {
        return true;
      }

      return allowedRoles.includes(
        activeRole
      );
    },
    [activeRole]
  );

  const canAccessFund = useCallback(
    (fundName: string) => {
      const normalizedFundName =
        normalizeFundName(fundName);

      if (!activeRole || !normalizedFundName) {
        return false;
      }

      return availableFundAccess.some(
        (access) =>
          normalizeFundName(access.fund_name) ===
          normalizedFundName
      );
    },
    [
      activeRole,
      availableFundAccess,
    ]
  );

  const signIn = useCallback(
    async ({
      email,
      password,
    }: SignInInput) => {
      const client = supabase;

      if (
        !isSupabaseConfigured ||
        client === null
      ) {
        return {
          error:
            "Supabase is not configured.",
        };
      }

      const { data, error } =
        await client.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (error) {
        return {
          error: error.message,
        };
      }

      const accessToken =
        data.session?.access_token ?? "";

      if (!accessToken) {
        await client.auth.signOut();

        return {
          error:
            "VENTIQ signed you in, but no secure application session was issued. Please sign in again.",
        };
      }

      try {
        const perimeterResponse =
          await fetch("/api/auth/perimeter", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });

        let perimeterPayload: {
          ok?: boolean;
          error?: string;
        } = {};

        try {
          perimeterPayload =
            (await perimeterResponse.json()) as {
              ok?: boolean;
              error?: string;
            };
        } catch {
          // The HTTP status is still authoritative below.
        }

        if (
          !perimeterResponse.ok ||
          !perimeterPayload.ok
        ) {
          await client.auth.signOut();

          return {
            error:
              perimeterPayload.error ||
              "VENTIQ could not establish the governed application session.",
          };
        }
      } catch {
        await client.auth.signOut();

        return {
          error:
            "VENTIQ could not establish the governed application session.",
        };
      }

      return {
        error: null,
      };
    },
    []
  );

  const signOut = useCallback(async () => {
    const client = supabase;

    try {
      await fetch("/api/auth/perimeter", {
        method: "DELETE",
      });
    } catch {
      // Best effort: Supabase sign-out still proceeds below.
    }

    if (client !== null) {
      await client.auth.signOut();
    }

    writeRequestedActiveFundName("");
    setSession(null);
    clearAccessState();
  }, [
    clearAccessState,
  ]);

  const getDefaultRoute = useCallback(
    () => getRoleHomeRoute(activeRole),
    [activeRole]
  );

  const value =
    useMemo<VentiqAuthContextValue>(
      () => ({
        configured: isSupabaseConfigured,
        loading,
        session,
        user: session?.user ?? null,
        profile,
        memberships,
        fundAccess,
        availableFundAccess,
        activeFundAccess,
        activeFundName,
        fundContextReady,
        activeRole,
        activeOrganisationId,
        investorId,
        accessError,
        signIn,
        signOut,
        refreshAccess,
        setActiveFundName,
        canUseRole,
        canAccessFund,
        getDefaultRoute,
      }),
      [
        accessError,
        activeFundAccess,
        activeFundName,
        activeOrganisationId,
        activeRole,
        availableFundAccess,
        canAccessFund,
        canUseRole,
        fundAccess,
        fundContextReady,
        getDefaultRoute,
        investorId,
        loading,
        memberships,
        profile,
        refreshAccess,
        session,
        setActiveFundName,
        signIn,
        signOut,
      ]
    );

  return (
    <VentiqAuthContext.Provider
      value={value}
    >
      {children}
    </VentiqAuthContext.Provider>
  );
}

export function useVentiqAuth() {
  const context = useContext(
    VentiqAuthContext
  );

  if (!context) {
    throw new Error(
      "useVentiqAuth must be used inside AuthProvider."
    );
  }

  return context;
}

export function getMembershipOrganisationName(
  membership: OrganisationMembership
) {
  return (
    membership.ventiq_organisations?.name ??
    "Organisation"
  );
}
