"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { Session, User } from "@supabase/supabase-js";

import {
  isSupabaseConfigured,
  supabase,
} from "../supabaseClient";

import {
  getRoleHomeRoute,
  isVentiqRole,
  type VentiqRole,
} from "./types";

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

  const [accessError, setAccessError] = useState("");

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
      } else {
        clearAccessState();
      }

      if (mounted) {
        setLoading(false);
      }
    }

    void initialiseAuth();

    const {
      data: { subscription },
    } = authClient.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession ?? null);
        setLoading(true);

        window.setTimeout(() => {
          void (async () => {
            if (nextSession?.user?.id) {
              await loadUserAccess(
                nextSession.user.id
              );
            } else {
              clearAccessState();
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
        profile?.default_role;

      if (isVentiqRole(profileRole)) {
        return profileRole;
      }

      const primaryMembership =
        memberships.find(
          (membership) =>
            membership.is_primary
        ) ?? memberships[0];

      return isVentiqRole(
        primaryMembership?.role
      )
        ? primaryMembership.role
        : null;
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
      if (
        !activeRole ||
        !fundName.trim()
      ) {
        return false;
      }

      if (activeRole === "fund_admin") {
        return true;
      }

      const normalizedFundName =
        fundName.trim().toLowerCase();

      return fundAccess.some(
        (access) =>
          access.can_view &&
          access.status === "Active" &&
          access.fund_name
            .trim()
            .toLowerCase() ===
            normalizedFundName
      );
    },
    [
      activeRole,
      fundAccess,
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

      const { error } =
        await client.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      return {
        error: error?.message ?? null,
      };
    },
    []
  );

  const signOut = useCallback(async () => {
    const client = supabase;

    if (client !== null) {
      await client.auth.signOut();
    }

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
        activeRole,
        activeOrganisationId,
        investorId,
        accessError,
        signIn,
        signOut,
        refreshAccess,
        canUseRole,
        canAccessFund,
        getDefaultRoute,
      }),
      [
        accessError,
        activeOrganisationId,
        activeRole,
        canAccessFund,
        canUseRole,
        fundAccess,
        getDefaultRoute,
        investorId,
        loading,
        memberships,
        profile,
        refreshAccess,
        session,
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