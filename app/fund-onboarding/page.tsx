"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient";

type DataRow = Record<string, unknown>;

type FundRow = {
  id: string;
  fundName: string;
  fundType: string;
  jurisdiction: string;
  sebiRegistrationNumber: string;
  giftCityRegistrationNumber: string;
  sponsorName: string;
  investmentManagerName: string;
  trusteeName: string;
  onboardingStatus: string;
  dataMode: string;
  createdAt: string;
};

type SchemeRow = {
  id: string;
  fundId: string;
  schemeName: string;
  schemeType: string;
  category: string;
  strategy: string;
  baseCurrency: string;
  schemeStatus: string;
};

type StakeholderRow = {
  id: string;
  fundId: string;
  schemeId: string;
  fullName: string;
  email: string;
  organization: string;
  stakeholderType: string;
  roleKey: string;
  roleLabel: string;
  dashboardPath: string;
  accessLevel: string;
  inviteStatus: string;
  invitedAt: string;
  activatedAt: string;
  revokedAt: string;
  lastLoginAt: string;
};

type InviteBatchRow = {
  id: string;
  fundId: string;
  batchName: string;
  totalInvites: number;
  sentCount: number;
  pendingCount: number;
  activatedCount: number;
  batchStatus: string;
  createdAt: string;
};

type AuditLogRow = {
  id: string;
  fundId: string;
  stakeholderId: string;
  eventType: string;
  eventTitle: string;
  eventDescription: string;
  actorName: string;
  actorEmail: string;
  createdAt: string;
};

type FundForm = {
  fundName: string;
  fundType: string;
  jurisdiction: string;
  sebiRegistrationNumber: string;
  giftCityRegistrationNumber: string;
  sponsorName: string;
  investmentManagerName: string;
  trusteeName: string;
  dataMode: string;
};

type SchemeForm = {
  schemeName: string;
  schemeType: string;
  category: string;
  strategy: string;
  baseCurrency: string;
};

type StakeholderForm = {
  fullName: string;
  email: string;
  organization: string;
  stakeholderType: string;
  roleKey: string;
  schemeId: string;
  accessLevel: string;
};

type RoleOption = {
  roleKey: string;
  roleLabel: string;
  stakeholderType: string;
  dashboardPath: string;
  accessLevel: string;
  description: string;
};

const roleOptions: RoleOption[] = [
  {
    roleKey: "fund_admin",
    roleLabel: "Fund Admin",
    stakeholderType: "Internal",
    dashboardPath: "/fund-onboarding",
    accessLevel: "Full Admin",
    description:
      "Can create funds, add schemes, invite users, revoke access and manage implementation setup.",
  },
  {
    roleKey: "managing_partner",
    roleLabel: "Managing Partner",
    stakeholderType: "Internal",
    dashboardPath: "/managing-partner-ai",
    accessLevel: "Executive View",
    description:
      "Fund-level performance, deployment, risk, collections, portfolio alerts and operating summary.",
  },
  {
    roleKey: "finance_head",
    roleLabel: "Finance Head",
    stakeholderType: "Internal",
    dashboardPath: "/finance-head-ai",
    accessLevel: "Finance Operations",
    description:
      "Bank MIS, Debt LMS, receipts, notices, reconciliations, fees, finance controls and reports.",
  },
  {
    roleKey: "investment_team",
    roleLabel: "Investment Team",
    stakeholderType: "Internal",
    dashboardPath: "/investment-team-ai",
    accessLevel: "Investment View",
    description:
      "Portfolio company intelligence, deal monitoring, repayment visibility and investment updates.",
  },
  {
    roleKey: "compliance_officer",
    roleLabel: "Compliance Officer",
    stakeholderType: "Internal",
    dashboardPath: "/compliance-ai",
    accessLevel: "Compliance View",
    description:
      "Compliance calendar, filings, covenant breaches, audit trail, evidence and control workflows.",
  },
  {
    roleKey: "investor_relations",
    roleLabel: "Investor Relations",
    stakeholderType: "Internal",
    dashboardPath: "/investor-portal",
    accessLevel: "Investor Communication",
    description:
      "Investor notices, SOA, capital call communication, distribution notices and reporting packs.",
  },
  {
    roleKey: "investor_lp",
    roleLabel: "Investor / LP",
    stakeholderType: "External",
    dashboardPath: "/investor-portal",
    accessLevel: "Investor Read Only",
    description:
      "Investor portal access for notices, statements, capital calls, distributions and reports.",
  },
  {
    roleKey: "auditor_trustee",
    roleLabel: "Auditor / Trustee",
    stakeholderType: "External",
    dashboardPath: "/document-studio",
    accessLevel: "Evidence Read Only",
    description:
      "Read-only evidence pack, audit documents, notices, schedules, logs and supporting files.",
  },
];

const emptyFundForm: FundForm = {
  fundName: "",
  fundType: "Category II AIF",
  jurisdiction: "India",
  sebiRegistrationNumber: "",
  giftCityRegistrationNumber: "",
  sponsorName: "",
  investmentManagerName: "",
  trusteeName: "",
  dataMode: "Demo Data",
};

const emptySchemeForm: SchemeForm = {
  schemeName: "",
  schemeType: "Close Ended",
  category: "Category II AIF",
  strategy: "Private Credit",
  baseCurrency: "INR",
};

const emptyStakeholderForm: StakeholderForm = {
  fullName: "",
  email: "",
  organization: "",
  stakeholderType: "Internal",
  roleKey: "finance_head",
  schemeId: "",
  accessLevel: "Role Based",
};

const sampleFunds: FundRow[] = [
  {
    id: "fund-001",
    fundName: "VENTIQ Venture Debt Fund I",
    fundType: "Category II AIF",
    jurisdiction: "India",
    sebiRegistrationNumber: "IN/AIF2/DEMO/2026",
    giftCityRegistrationNumber: "",
    sponsorName: "VENTIQ Sponsor LLP",
    investmentManagerName: "VENTIQ Capital Advisors LLP",
    trusteeName: "Demo Trustee Services Pvt Ltd",
    onboardingStatus: "Implementation Review",
    dataMode: "Demo Data",
    createdAt: "2026-08-02",
  },
];

const sampleSchemes: SchemeRow[] = [
  {
    id: "scheme-001",
    fundId: "fund-001",
    schemeName: "Venture Debt Scheme I",
    schemeType: "Close Ended",
    category: "Category II AIF",
    strategy: "Venture Debt",
    baseCurrency: "INR",
    schemeStatus: "Active",
  },
];

const sampleStakeholders: StakeholderRow[] = [
  {
    id: "stake-001",
    fundId: "fund-001",
    schemeId: "scheme-001",
    fullName: "Ananya Mehta",
    email: "finance.head@example.com",
    organization: "VENTIQ Capital Advisors LLP",
    stakeholderType: "Internal",
    roleKey: "finance_head",
    roleLabel: "Finance Head",
    dashboardPath: "/finance-head-ai",
    accessLevel: "Finance Operations",
    inviteStatus: "Invite Sent",
    invitedAt: "2026-08-02",
    activatedAt: "",
    revokedAt: "",
    lastLoginAt: "",
  },
  {
    id: "stake-002",
    fundId: "fund-001",
    schemeId: "",
    fullName: "Rohit Shah",
    email: "mp@example.com",
    organization: "VENTIQ Capital Advisors LLP",
    stakeholderType: "Internal",
    roleKey: "managing_partner",
    roleLabel: "Managing Partner",
    dashboardPath: "/managing-partner-ai",
    accessLevel: "Executive View",
    inviteStatus: "Activated",
    invitedAt: "2026-08-02",
    activatedAt: "2026-08-02",
    revokedAt: "",
    lastLoginAt: "2026-08-02",
  },
  {
    id: "stake-003",
    fundId: "fund-001",
    schemeId: "scheme-001",
    fullName: "LP Demo Investor",
    email: "lp@example.com",
    organization: "Family Office",
    stakeholderType: "External",
    roleKey: "investor_lp",
    roleLabel: "Investor / LP",
    dashboardPath: "/investor-portal",
    accessLevel: "Investor Read Only",
    inviteStatus: "Not Invited",
    invitedAt: "",
    activatedAt: "",
    revokedAt: "",
    lastLoginAt: "",
  },
];

const sampleInviteBatches: InviteBatchRow[] = [
  {
    id: "batch-001",
    fundId: "fund-001",
    batchName: "Initial stakeholder invite batch",
    totalInvites: 2,
    sentCount: 2,
    pendingCount: 1,
    activatedCount: 1,
    batchStatus: "Sent",
    createdAt: "2026-08-02",
  },
];

const sampleAuditLogs: AuditLogRow[] = [
  {
    id: "audit-001",
    fundId: "fund-001",
    stakeholderId: "stake-002",
    eventType: "Access Activated",
    eventTitle: "Managing Partner access activated",
    eventDescription:
      "Managing Partner role was activated with access to executive dashboard.",
    actorName: "VENTIQ Admin",
    actorEmail: "admin@useventiq.com",
    createdAt: "2026-08-02",
  },
];

function getString(row: DataRow, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = row[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return fallback;
}

function getNumber(row: DataRow, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = row[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (
      typeof value === "string" &&
      value.trim() &&
      !Number.isNaN(Number(value))
    ) {
      return Number(value);
    }
  }

  return fallback;
}

function getDateString(row: DataRow, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = row[key];

    if (typeof value === "string" && value.trim()) {
      return value.slice(0, 10);
    }
  }

  return fallback;
}

function formatDate(value: string) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusClass(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function getRoleOption(roleKey: string) {
  return (
    roleOptions.find((role) => role.roleKey === roleKey) ?? roleOptions[0]
  );
}

function mapFund(row: DataRow): FundRow {
  return {
    id: getString(row, ["id"], crypto.randomUUID()),
    fundName: getString(row, ["fund_name"], "Unnamed Fund"),
    fundType: getString(row, ["fund_type"], "AIF"),
    jurisdiction: getString(row, ["jurisdiction"], "India"),
    sebiRegistrationNumber: getString(row, ["sebi_registration_number"], ""),
    giftCityRegistrationNumber: getString(
      row,
      ["gift_city_registration_number"],
      ""
    ),
    sponsorName: getString(row, ["sponsor_name"], ""),
    investmentManagerName: getString(row, ["investment_manager_name"], ""),
    trusteeName: getString(row, ["trustee_name"], ""),
    onboardingStatus: getString(row, ["onboarding_status"], "Draft"),
    dataMode: getString(row, ["data_mode"], "Demo Data"),
    createdAt: getDateString(row, ["created_at"], ""),
  };
}

function mapScheme(row: DataRow): SchemeRow {
  return {
    id: getString(row, ["id"], crypto.randomUUID()),
    fundId: getString(row, ["fund_id"], ""),
    schemeName: getString(row, ["scheme_name"], "Unnamed Scheme"),
    schemeType: getString(row, ["scheme_type"], "Close Ended"),
    category: getString(row, ["category"], "Category II AIF"),
    strategy: getString(row, ["strategy"], "Private Credit"),
    baseCurrency: getString(row, ["base_currency"], "INR"),
    schemeStatus: getString(row, ["scheme_status"], "Active"),
  };
}

function mapStakeholder(row: DataRow): StakeholderRow {
  const roleKey = getString(row, ["role_key"], "finance_head");
  const role = getRoleOption(roleKey);

  return {
    id: getString(row, ["id"], crypto.randomUUID()),
    fundId: getString(row, ["fund_id"], ""),
    schemeId: getString(row, ["scheme_id"], ""),
    fullName: getString(row, ["full_name"], "Unnamed User"),
    email: getString(row, ["email"], ""),
    organization: getString(row, ["organization"], ""),
    stakeholderType: getString(row, ["stakeholder_type"], role.stakeholderType),
    roleKey,
    roleLabel: getString(row, ["role_label"], role.roleLabel),
    dashboardPath: getString(row, ["dashboard_path"], role.dashboardPath),
    accessLevel: getString(row, ["access_level"], role.accessLevel),
    inviteStatus: getString(row, ["invite_status"], "Not Invited"),
    invitedAt: getDateString(row, ["invited_at"], ""),
    activatedAt: getDateString(row, ["activated_at"], ""),
    revokedAt: getDateString(row, ["revoked_at"], ""),
    lastLoginAt: getDateString(row, ["last_login_at"], ""),
  };
}

function mapInviteBatch(row: DataRow): InviteBatchRow {
  return {
    id: getString(row, ["id"], crypto.randomUUID()),
    fundId: getString(row, ["fund_id"], ""),
    batchName: getString(row, ["batch_name"], "Invite Batch"),
    totalInvites: getNumber(row, ["total_invites"]),
    sentCount: getNumber(row, ["sent_count"]),
    pendingCount: getNumber(row, ["pending_count"]),
    activatedCount: getNumber(row, ["activated_count"]),
    batchStatus: getString(row, ["batch_status"], "Draft"),
    createdAt: getDateString(row, ["created_at"], ""),
  };
}

function mapAuditLog(row: DataRow): AuditLogRow {
  return {
    id: getString(row, ["id"], crypto.randomUUID()),
    fundId: getString(row, ["fund_id"], ""),
    stakeholderId: getString(row, ["stakeholder_id"], ""),
    eventType: getString(row, ["event_type"], "Access Event"),
    eventTitle: getString(row, ["event_title"], "Access log"),
    eventDescription: getString(row, ["event_description"], ""),
    actorName: getString(row, ["actor_name"], "VENTIQ Admin"),
    actorEmail: getString(row, ["actor_email"], "admin@useventiq.com"),
    createdAt: getDateString(row, ["created_at"], ""),
  };
}

export default function FundOnboardingPage() {
  const [funds, setFunds] = useState<FundRow[]>(sampleFunds);
  const [schemes, setSchemes] = useState<SchemeRow[]>(sampleSchemes);
  const [stakeholders, setStakeholders] =
    useState<StakeholderRow[]>(sampleStakeholders);
  const [inviteBatches, setInviteBatches] =
    useState<InviteBatchRow[]>(sampleInviteBatches);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>(sampleAuditLogs);

  const [selectedFundId, setSelectedFundId] = useState(sampleFunds[0].id);
  const [fundForm, setFundForm] = useState<FundForm>(emptyFundForm);
  const [schemeForm, setSchemeForm] = useState<SchemeForm>(emptySchemeForm);
  const [stakeholderForm, setStakeholderForm] =
    useState<StakeholderForm>(emptyStakeholderForm);

  const [loading, setLoading] = useState(true);
  const [dataMessage, setDataMessage] = useState(
    "Loading onboarding workspace..."
  );
  const [fundMessage, setFundMessage] = useState("");
  const [schemeMessage, setSchemeMessage] = useState("");
  const [stakeholderMessage, setStakeholderMessage] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [isSavingFund, setIsSavingFund] = useState(false);
  const [isSavingScheme, setIsSavingScheme] = useState(false);
  const [isSavingStakeholder, setIsSavingStakeholder] = useState(false);
  const [isSendingInvites, setIsSendingInvites] = useState(false);

  useEffect(() => {
    async function loadOnboardingData() {
      if (!isSupabaseConfigured || !supabase) {
        setDataMessage(
          "Using sample onboarding data. Supabase is not configured."
        );
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const db = supabase as any;

        const [
          fundsResult,
          schemesResult,
          stakeholdersResult,
          batchesResult,
          auditResult,
        ] = await Promise.all([
          db
            .from("ventiq_funds")
            .select("*")
            .order("created_at", { ascending: false }),

          db
            .from("ventiq_schemes")
            .select("*")
            .order("created_at", { ascending: false }),

          db
            .from("ventiq_stakeholders")
            .select("*")
            .order("created_at", { ascending: false }),

          db
            .from("ventiq_invite_batches")
            .select("*")
            .order("created_at", { ascending: false }),

          db
            .from("ventiq_access_audit_logs")
            .select("*")
            .order("created_at", { ascending: false }),
        ]);

        if (fundsResult.error) throw new Error(fundsResult.error.message);
        if (schemesResult.error) throw new Error(schemesResult.error.message);
        if (stakeholdersResult.error) {
          throw new Error(stakeholdersResult.error.message);
        }
        if (batchesResult.error) throw new Error(batchesResult.error.message);
        if (auditResult.error) throw new Error(auditResult.error.message);

        const nextFunds =
          fundsResult.data && fundsResult.data.length > 0
            ? (fundsResult.data as DataRow[]).map(mapFund)
            : sampleFunds;

        const nextSchemes =
          schemesResult.data && schemesResult.data.length > 0
            ? (schemesResult.data as DataRow[]).map(mapScheme)
            : sampleSchemes;

        const nextStakeholders =
          stakeholdersResult.data && stakeholdersResult.data.length > 0
            ? (stakeholdersResult.data as DataRow[]).map(mapStakeholder)
            : sampleStakeholders;

        const nextBatches =
          batchesResult.data && batchesResult.data.length > 0
            ? (batchesResult.data as DataRow[]).map(mapInviteBatch)
            : sampleInviteBatches;

        const nextAuditLogs =
          auditResult.data && auditResult.data.length > 0
            ? (auditResult.data as DataRow[]).map(mapAuditLog)
            : sampleAuditLogs;

        setFunds(nextFunds);
        setSchemes(nextSchemes);
        setStakeholders(nextStakeholders);
        setInviteBatches(nextBatches);
        setAuditLogs(nextAuditLogs);
        setSelectedFundId(nextFunds[0]?.id || sampleFunds[0].id);

        setDataMessage(
          fundsResult.data && fundsResult.data.length > 0
            ? "Connected to onboarding Supabase records."
            : "Onboarding tables are ready. Showing sample data until a fund is created."
        );
      } catch (error) {
        setDataMessage(
          error instanceof Error
            ? `Onboarding database issue: ${error.message}`
            : "Unable to load onboarding data. Showing sample data."
        );

        setFunds(sampleFunds);
        setSchemes(sampleSchemes);
        setStakeholders(sampleStakeholders);
        setInviteBatches(sampleInviteBatches);
        setAuditLogs(sampleAuditLogs);
      } finally {
        setLoading(false);
      }
    }

    loadOnboardingData();
  }, []);

  const selectedFund =
    funds.find((fund) => fund.id === selectedFundId) ?? funds[0] ?? sampleFunds[0];

  const selectedSchemes = schemes.filter(
    (scheme) => scheme.fundId === selectedFund.id
  );

  const selectedStakeholders = stakeholders.filter(
    (stakeholder) => stakeholder.fundId === selectedFund.id
  );

  const selectedInviteBatches = inviteBatches.filter(
    (batch) => batch.fundId === selectedFund.id
  );

  const selectedAuditLogs = auditLogs.filter(
    (auditLog) => auditLog.fundId === selectedFund.id
  );

  const selectedRole = getRoleOption(stakeholderForm.roleKey);

  const summary = useMemo(() => {
    const totalFunds = funds.length;
    const totalSchemes = schemes.length;
    const totalStakeholders = selectedStakeholders.length;
    const invited = selectedStakeholders.filter(
      (item) => item.inviteStatus === "Invite Sent"
    ).length;
    const activated = selectedStakeholders.filter(
      (item) => item.inviteStatus === "Activated"
    ).length;
    const notInvited = selectedStakeholders.filter(
      (item) => item.inviteStatus === "Not Invited"
    ).length;
    const revoked = selectedStakeholders.filter(
      (item) => item.inviteStatus === "Revoked"
    ).length;

    return {
      totalFunds,
      totalSchemes,
      totalStakeholders,
      invited,
      activated,
      notInvited,
      revoked,
    };
  }, [funds, schemes, selectedStakeholders]);

  function updateFundForm(field: keyof FundForm, value: string) {
    setFundForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function updateSchemeForm(field: keyof SchemeForm, value: string) {
    setSchemeForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function updateStakeholderForm(field: keyof StakeholderForm, value: string) {
    setStakeholderForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  async function createAuditLog(payload: {
    fundId: string;
    stakeholderId?: string;
    eventType: string;
    eventTitle: string;
    eventDescription: string;
  }) {
    const localAuditLog: AuditLogRow = {
      id: crypto.randomUUID(),
      fundId: payload.fundId,
      stakeholderId: payload.stakeholderId || "",
      eventType: payload.eventType,
      eventTitle: payload.eventTitle,
      eventDescription: payload.eventDescription,
      actorName: "VENTIQ Admin",
      actorEmail: "admin@useventiq.com",
      createdAt: new Date().toISOString().slice(0, 10),
    };

    if (!isSupabaseConfigured || !supabase) {
      setAuditLogs((currentLogs) => [localAuditLog, ...currentLogs]);
      return;
    }

    try {
      const db = supabase as any;

      const { data, error } = await db
        .from("ventiq_access_audit_logs")
        .insert({
          fund_id: payload.fundId,
          stakeholder_id: payload.stakeholderId || null,
          event_type: payload.eventType,
          event_title: payload.eventTitle,
          event_description: payload.eventDescription,
          actor_name: "VENTIQ Admin",
          actor_email: "admin@useventiq.com",
        })
        .select("*")
        .single();

      if (error) {
        setAuditLogs((currentLogs) => [localAuditLog, ...currentLogs]);
        return;
      }

      setAuditLogs((currentLogs) => [
        mapAuditLog(data as DataRow),
        ...currentLogs,
      ]);
    } catch {
      setAuditLogs((currentLogs) => [localAuditLog, ...currentLogs]);
    }
  }

  async function submitFund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFundMessage("");

    if (!fundForm.fundName.trim()) {
      setFundMessage("Fund name is required.");
      return;
    }

    setIsSavingFund(true);

    const payload = {
      fund_name: fundForm.fundName.trim(),
      fund_type: fundForm.fundType,
      jurisdiction: fundForm.jurisdiction,
      sebi_registration_number: fundForm.sebiRegistrationNumber.trim(),
      gift_city_registration_number: fundForm.giftCityRegistrationNumber.trim(),
      sponsor_name: fundForm.sponsorName.trim(),
      investment_manager_name: fundForm.investmentManagerName.trim(),
      trustee_name: fundForm.trusteeName.trim(),
      onboarding_status: "Fund Created",
      data_mode: fundForm.dataMode,
    };

    try {
      if (!isSupabaseConfigured || !supabase) {
        const localFund: FundRow = {
          id: crypto.randomUUID(),
          fundName: payload.fund_name,
          fundType: payload.fund_type,
          jurisdiction: payload.jurisdiction,
          sebiRegistrationNumber: payload.sebi_registration_number,
          giftCityRegistrationNumber: payload.gift_city_registration_number,
          sponsorName: payload.sponsor_name,
          investmentManagerName: payload.investment_manager_name,
          trusteeName: payload.trustee_name,
          onboardingStatus: payload.onboarding_status,
          dataMode: payload.data_mode,
          createdAt: new Date().toISOString().slice(0, 10),
        };

        setFunds((currentFunds) => [localFund, ...currentFunds]);
        setSelectedFundId(localFund.id);
        setFundForm(emptyFundForm);
        setFundMessage("Fund created locally.");
        await createAuditLog({
          fundId: localFund.id,
          eventType: "Fund Created",
          eventTitle: "New fund created",
          eventDescription: `${localFund.fundName} was created in onboarding workspace.`,
        });
        return;
      }

      const db = supabase as any;

      const { data, error } = await db
        .from("ventiq_funds")
        .insert(payload)
        .select("*")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      const savedFund = mapFund(data as DataRow);

      setFunds((currentFunds) => [savedFund, ...currentFunds]);
      setSelectedFundId(savedFund.id);
      setFundForm(emptyFundForm);
      setFundMessage("Fund created successfully.");

      await createAuditLog({
        fundId: savedFund.id,
        eventType: "Fund Created",
        eventTitle: "New fund created",
        eventDescription: `${savedFund.fundName} was created in onboarding workspace.`,
      });
    } catch (error) {
      setFundMessage(
        error instanceof Error ? error.message : "Unable to create fund."
      );
    } finally {
      setIsSavingFund(false);
    }
  }

  async function submitScheme(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSchemeMessage("");

    if (!selectedFund) {
      setSchemeMessage("Please create or select a fund first.");
      return;
    }

    if (!schemeForm.schemeName.trim()) {
      setSchemeMessage("Scheme name is required.");
      return;
    }

    setIsSavingScheme(true);

    const payload = {
      fund_id: selectedFund.id,
      scheme_name: schemeForm.schemeName.trim(),
      scheme_type: schemeForm.schemeType,
      category: schemeForm.category,
      strategy: schemeForm.strategy,
      base_currency: schemeForm.baseCurrency,
      scheme_status: "Active",
    };

    try {
      if (!isSupabaseConfigured || !supabase) {
        const localScheme: SchemeRow = {
          id: crypto.randomUUID(),
          fundId: payload.fund_id,
          schemeName: payload.scheme_name,
          schemeType: payload.scheme_type,
          category: payload.category,
          strategy: payload.strategy,
          baseCurrency: payload.base_currency,
          schemeStatus: payload.scheme_status,
        };

        setSchemes((currentSchemes) => [localScheme, ...currentSchemes]);
        setSchemeForm(emptySchemeForm);
        setSchemeMessage("Scheme added locally.");
        await createAuditLog({
          fundId: selectedFund.id,
          eventType: "Scheme Added",
          eventTitle: "Scheme added",
          eventDescription: `${localScheme.schemeName} was added under ${selectedFund.fundName}.`,
        });
        return;
      }

      const db = supabase as any;

      const { data, error } = await db
        .from("ventiq_schemes")
        .insert(payload)
        .select("*")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      const savedScheme = mapScheme(data as DataRow);

      setSchemes((currentSchemes) => [savedScheme, ...currentSchemes]);
      setSchemeForm(emptySchemeForm);
      setSchemeMessage("Scheme added successfully.");

      await createAuditLog({
        fundId: selectedFund.id,
        eventType: "Scheme Added",
        eventTitle: "Scheme added",
        eventDescription: `${savedScheme.schemeName} was added under ${selectedFund.fundName}.`,
      });
    } catch (error) {
      setSchemeMessage(
        error instanceof Error ? error.message : "Unable to add scheme."
      );
    } finally {
      setIsSavingScheme(false);
    }
  }

  async function submitStakeholder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStakeholderMessage("");

    if (!selectedFund) {
      setStakeholderMessage("Please create or select a fund first.");
      return;
    }

    if (!stakeholderForm.fullName.trim()) {
      setStakeholderMessage("Stakeholder name is required.");
      return;
    }

    if (!stakeholderForm.email.trim()) {
      setStakeholderMessage("Stakeholder email is required.");
      return;
    }

    const role = getRoleOption(stakeholderForm.roleKey);

    setIsSavingStakeholder(true);

    const payload = {
      fund_id: selectedFund.id,
      scheme_id: stakeholderForm.schemeId || null,
      full_name: stakeholderForm.fullName.trim(),
      email: stakeholderForm.email.trim(),
      organization: stakeholderForm.organization.trim(),
      stakeholder_type: stakeholderForm.stakeholderType || role.stakeholderType,
      role_key: role.roleKey,
      role_label: role.roleLabel,
      dashboard_path: role.dashboardPath,
      access_level:
        stakeholderForm.accessLevel === "Role Based"
          ? role.accessLevel
          : stakeholderForm.accessLevel,
      invite_status: "Not Invited",
    };

    try {
      if (!isSupabaseConfigured || !supabase) {
        const localStakeholder: StakeholderRow = {
          id: crypto.randomUUID(),
          fundId: selectedFund.id,
          schemeId: stakeholderForm.schemeId,
          fullName: payload.full_name,
          email: payload.email,
          organization: payload.organization,
          stakeholderType: payload.stakeholder_type,
          roleKey: payload.role_key,
          roleLabel: payload.role_label,
          dashboardPath: payload.dashboard_path,
          accessLevel: payload.access_level,
          inviteStatus: payload.invite_status,
          invitedAt: "",
          activatedAt: "",
          revokedAt: "",
          lastLoginAt: "",
        };

        setStakeholders((currentStakeholders) => [
          localStakeholder,
          ...currentStakeholders,
        ]);
        setStakeholderForm(emptyStakeholderForm);
        setStakeholderMessage("Stakeholder added locally.");

        await createAuditLog({
          fundId: selectedFund.id,
          stakeholderId: localStakeholder.id,
          eventType: "Stakeholder Added",
          eventTitle: "Stakeholder added",
          eventDescription: `${localStakeholder.fullName} was added as ${localStakeholder.roleLabel}.`,
        });
        return;
      }

      const db = supabase as any;

      const { data, error } = await db
        .from("ventiq_stakeholders")
        .insert(payload)
        .select("*")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      const savedStakeholder = mapStakeholder(data as DataRow);

      setStakeholders((currentStakeholders) => [
        savedStakeholder,
        ...currentStakeholders,
      ]);
      setStakeholderForm(emptyStakeholderForm);
      setStakeholderMessage("Stakeholder added successfully.");

      await createAuditLog({
        fundId: selectedFund.id,
        stakeholderId: savedStakeholder.id,
        eventType: "Stakeholder Added",
        eventTitle: "Stakeholder added",
        eventDescription: `${savedStakeholder.fullName} was added as ${savedStakeholder.roleLabel}.`,
      });
    } catch (error) {
      setStakeholderMessage(
        error instanceof Error ? error.message : "Unable to add stakeholder."
      );
    } finally {
      setIsSavingStakeholder(false);
    }
  }
  async function getInviteAccessToken() {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error("Supabase authentication is not configured.");
    }

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      throw new Error(
        "Please sign in as an authorised Fund Admin before sending invites."
      );
    }

    return session.access_token;
  }

  async function requestSecureInvite(
    stakeholderId: string,
    accessToken: string
  ) {
    const response = await fetch("/api/stakeholders/invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ stakeholderId }),
    });

    const result = (await response.json()) as {
      ok?: boolean;
      message?: string;
    };

    if (!response.ok || !result.ok) {
      throw new Error(result.message || "Unable to send secure invite.");
    }

    return result;
  }

  async function sendSecureInvite(stakeholder: StakeholderRow) {
    setInviteMessage("");

    try {
      const accessToken = await getInviteAccessToken();
      await requestSecureInvite(stakeholder.id, accessToken);

      const today = new Date().toISOString().slice(0, 10);

      setStakeholders((currentStakeholders) =>
        currentStakeholders.map((item) =>
          item.id === stakeholder.id
            ? {
                ...item,
                inviteStatus: "Invite Sent",
                invitedAt: today,
              }
            : item
        )
      );

      setInviteMessage(
        `Secure invite sent to ${stakeholder.email}. User will set their own password.`
      );
    } catch (error) {
      setInviteMessage(
        error instanceof Error
          ? error.message
          : "Unable to send secure invite."
      );
    }
  }
  async function updateStakeholderStatus(
    stakeholder: StakeholderRow,
    nextStatus: string
  ) {
    const now = new Date().toISOString();

    const updatePayload: Record<string, string | null> = {
      invite_status: nextStatus,
    };

    if (nextStatus === "Invite Sent") {
      updatePayload.invited_at = now;
    }

    if (nextStatus === "Activated") {
      updatePayload.activated_at = now;
    }

    if (nextStatus === "Revoked") {
      updatePayload.revoked_at = now;
    }

    try {
      if (isSupabaseConfigured && supabase && !stakeholder.id.startsWith("stake-")) {
        const db = supabase as any;

        const { error } = await db
          .from("ventiq_stakeholders")
          .update(updatePayload)
          .eq("id", stakeholder.id);

        if (error) {
          throw new Error(error.message);
        }
      }

      setStakeholders((currentStakeholders) =>
        currentStakeholders.map((item) =>
          item.id === stakeholder.id
            ? {
                ...item,
                inviteStatus: nextStatus,
                invitedAt:
                  nextStatus === "Invite Sent"
                    ? now.slice(0, 10)
                    : item.invitedAt,
                activatedAt:
                  nextStatus === "Activated"
                    ? now.slice(0, 10)
                    : item.activatedAt,
                revokedAt:
                  nextStatus === "Revoked" ? now.slice(0, 10) : item.revokedAt,
              }
            : item
        )
      );

      await createAuditLog({
        fundId: stakeholder.fundId,
        stakeholderId: stakeholder.id,
        eventType: nextStatus,
        eventTitle: `${stakeholder.roleLabel} status updated`,
        eventDescription: `${stakeholder.fullName} moved to ${nextStatus}.`,
      });
    } catch (error) {
      setInviteMessage(
        error instanceof Error
          ? `Unable to update stakeholder: ${error.message}`
          : "Unable to update stakeholder."
      );
    }
  }

  async function sendInviteBatch() {
    setInviteMessage("");

    if (!selectedFund) {
      setInviteMessage("Please select a fund first.");
      return;
    }

    const pendingStakeholders = selectedStakeholders.filter(
      (stakeholder) => stakeholder.inviteStatus === "Not Invited"
    );

    if (pendingStakeholders.length === 0) {
      setInviteMessage("No pending stakeholders available for invite.");
      return;
    }

    setIsSendingInvites(true);

    try {
      const accessToken = await getInviteAccessToken();
      const now = new Date().toISOString();
      const successfulIds: string[] = [];
      const failures: string[] = [];

      for (const stakeholder of pendingStakeholders) {
        try {
          await requestSecureInvite(stakeholder.id, accessToken);
          successfulIds.push(stakeholder.id);
        } catch (error) {
          failures.push(
            `${stakeholder.email}: ${
              error instanceof Error ? error.message : "Invite failed."
            }`
          );
        }
      }

      if (successfulIds.length === 0) {
        throw new Error(
          failures[0] || "No stakeholder invites could be sent."
        );
      }

      if (isSupabaseConfigured && supabase) {
        const db = supabase as any;

        const { data, error } = await db
          .from("ventiq_invite_batches")
          .insert({
            fund_id: selectedFund.id,
            batch_name: `${selectedFund.fundName} invite batch`,
            total_invites: pendingStakeholders.length,
            sent_count: successfulIds.length,
            pending_count: failures.length,
            activated_count: 0,
            batch_status:
              failures.length === 0 ? "Sent" : "Partially Sent",
          })
          .select("*")
          .single();

        if (error) {
          setInviteMessage(
            `${successfulIds.length} invite(s) were sent, but the batch tracking row could not be saved: ${error.message}`
          );
        } else {
          setInviteBatches((currentBatches) => [
            mapInviteBatch(data as DataRow),
            ...currentBatches,
          ]);
        }
      }

      setStakeholders((currentStakeholders) =>
        currentStakeholders.map((stakeholder) =>
          successfulIds.includes(stakeholder.id)
            ? {
                ...stakeholder,
                inviteStatus: "Invite Sent",
                invitedAt: now.slice(0, 10),
              }
            : stakeholder
        )
      );

      if (failures.length === 0) {
        setInviteMessage(
          `${successfulIds.length} secure invite(s) sent successfully.`
        );
      } else {
        setInviteMessage(
          `${successfulIds.length} invite(s) sent; ${failures.length} failed. First failure: ${failures[0]}`
        );
      }
    } catch (error) {
      setInviteMessage(
        error instanceof Error ? error.message : "Unable to send invite batch."
      );
    } finally {
      setIsSendingInvites(false);
    }
  }

  return (
    <main className="onboarding-page">
      <style>{`
        .onboarding-page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top left, rgba(37, 99, 235, 0.22), transparent 34rem),
            radial-gradient(circle at top right, rgba(245, 200, 91, 0.16), transparent 32rem),
            #07101f;
          color: #f8fbff;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          padding: 34px;
        }

        .onboarding-shell {
          max-width: 1280px;
          margin: 0 auto;
        }

        .hero {
          border: 1px solid rgba(147, 197, 253, 0.16);
          background: rgba(15, 23, 42, 0.78);
          border-radius: 32px;
          padding: 34px;
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.26);
          margin-bottom: 22px;
        }

        .hero-top,
        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 22px;
        }

        .eyebrow {
          color: #f5c85b;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          font-size: 12px;
          font-weight: 950;
          margin: 0 0 14px;
        }

        h1 {
          margin: 0;
          font-size: clamp(42px, 6vw, 74px);
          line-height: 0.96;
          letter-spacing: -0.06em;
        }

        .hero-copy {
          margin: 20px 0 0;
          color: #c7d7f4;
          font-size: 18px;
          line-height: 1.65;
          max-width: 850px;
        }

        .actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .primary-button,
        .secondary-button,
        .small-button,
        .link-button {
          border-radius: 999px;
          border: 0;
          cursor: pointer;
          text-decoration: none;
          font-weight: 950;
          white-space: nowrap;
          font-family: inherit;
        }

        .primary-button {
          background: #f5c85b;
          color: #07101f;
          padding: 12px 17px;
          font-size: 14px;
        }

        .secondary-button,
        .link-button {
          background: rgba(15, 23, 42, 0.74);
          color: #dbeafe;
          border: 1px solid rgba(147, 197, 253, 0.24);
          padding: 12px 17px;
          font-size: 14px;
        }

        .small-button {
          background: rgba(245, 200, 91, 0.14);
          border: 1px solid rgba(245, 200, 91, 0.26);
          color: #fde68a;
          padding: 8px 11px;
          font-size: 12px;
        }

        .primary-button:disabled,
        .secondary-button:disabled,
        .small-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .ribbon {
          border: 1px solid rgba(245, 200, 91, 0.22);
          background: rgba(245, 200, 91, 0.10);
          color: #fde68a;
          border-radius: 18px;
          padding: 14px 18px;
          margin-bottom: 22px;
          font-weight: 850;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-top: 24px;
        }

        .stat-card,
        .panel,
        .setup-card,
        .role-card {
          border: 1px solid rgba(147, 197, 253, 0.16);
          background: rgba(15, 23, 42, 0.74);
          border-radius: 24px;
          box-shadow: 0 18px 60px rgba(0, 0, 0, 0.18);
        }

        .stat-card {
          padding: 20px;
        }

        .stat-card span {
          display: block;
          color: #9db3d7;
          font-size: 13px;
          margin-bottom: 8px;
        }

        .stat-card strong {
          display: block;
          font-size: 26px;
          letter-spacing: -0.04em;
        }

        .main-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 18px;
          margin-bottom: 18px;
        }

        .setup-card,
        .panel {
          padding: 24px;
        }

        .setup-card h2,
        .panel-header h2 {
          margin: 0;
          font-size: 25px;
          letter-spacing: -0.04em;
        }

        .setup-card p,
        .panel-header p {
          margin: 8px 0 0;
          color: #9db3d7;
          line-height: 1.55;
        }

        .form-grid {
          display: grid;
          gap: 12px;
          margin-top: 18px;
        }

        .field {
          display: grid;
          gap: 7px;
        }

        .field label {
          color: #c7d7f4;
          font-size: 12px;
          font-weight: 900;
        }

        .field input,
        .field select,
        .field textarea {
          width: 100%;
          border: 1px solid rgba(147, 197, 253, 0.18);
          background: rgba(2, 6, 23, 0.34);
          color: #ffffff;
          border-radius: 14px;
          padding: 11px 12px;
          outline: none;
          font: inherit;
        }

        .field textarea {
          min-height: 90px;
          resize: vertical;
        }

        .message {
          color: #bbf7d0;
          font-size: 13px;
          font-weight: 850;
          margin-top: 12px;
          line-height: 1.45;
        }

        .warning-message {
          color: #fde68a;
          font-size: 13px;
          font-weight: 850;
          margin-top: 12px;
          line-height: 1.45;
        }

        .panel {
          margin-bottom: 18px;
        }

        .panel-header {
          margin-bottom: 18px;
        }

        .fund-selector {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          align-items: center;
          margin-bottom: 18px;
        }

        .fund-selector select {
          border: 1px solid rgba(147, 197, 253, 0.18);
          background: rgba(2, 6, 23, 0.34);
          color: #ffffff;
          border-radius: 999px;
          padding: 11px 14px;
          outline: none;
          font: inherit;
          min-width: 280px;
        }

        .selected-fund-card {
          border: 1px solid rgba(245, 200, 91, 0.22);
          background: rgba(245, 200, 91, 0.08);
          border-radius: 20px;
          padding: 16px;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 18px;
        }

        .selected-fund-card span {
          display: block;
          color: #9db3d7;
          font-size: 12px;
          margin-bottom: 5px;
        }

        .selected-fund-card strong {
          color: #ffffff;
          font-size: 14px;
          line-height: 1.35;
        }

        .table-wrap {
          overflow-x: auto;
          border: 1px solid rgba(147, 197, 253, 0.14);
          border-radius: 20px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 960px;
        }

        th,
        td {
          padding: 14px;
          text-align: left;
          border-bottom: 1px solid rgba(147, 197, 253, 0.12);
          vertical-align: top;
        }

        th {
          color: #9db3d7;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        td {
          color: #eaf2ff;
          line-height: 1.45;
        }

        tr:last-child td {
          border-bottom: 0;
        }

        .status-pill {
          display: inline-flex;
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 11px;
          font-weight: 900;
          white-space: nowrap;
        }

        .status-activated,
        .status-active,
        .status-sent,
        .status-full-admin {
          background: rgba(22, 163, 74, 0.24);
          color: #bbf7d0;
        }

        .status-invite-sent,
        .status-implementation-review,
        .status-fund-created {
          background: rgba(245, 158, 11, 0.22);
          color: #fde68a;
        }

        .status-not-invited,
        .status-draft {
          background: rgba(59, 130, 246, 0.22);
          color: #bfdbfe;
        }

        .status-revoked {
          background: rgba(239, 68, 68, 0.22);
          color: #fecaca;
        }

        .role-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .role-card {
          padding: 18px;
        }

        .role-card span {
          display: inline-flex;
          border-radius: 999px;
          padding: 7px 10px;
          background: rgba(245, 200, 91, 0.12);
          color: #fde68a;
          font-size: 11px;
          font-weight: 950;
          margin-bottom: 12px;
        }

        .role-card h3 {
          margin: 0;
          font-size: 18px;
        }

        .role-card p {
          color: #c7d7f4;
          line-height: 1.5;
          font-size: 13px;
        }

        .two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
        }

        .audit-list {
          display: grid;
          gap: 10px;
        }

        .audit-item {
          border: 1px solid rgba(147, 197, 253, 0.12);
          background: rgba(2, 6, 23, 0.24);
          border-radius: 16px;
          padding: 13px;
        }

        .audit-item strong {
          display: block;
          color: #ffffff;
          margin-bottom: 5px;
        }

        .audit-item p {
          margin: 0;
          color: #c7d7f4;
          line-height: 1.45;
          font-size: 13px;
        }

        .security-box {
          border: 1px solid rgba(34, 197, 94, 0.26);
          background: rgba(22, 163, 74, 0.12);
          color: #bbf7d0;
          border-radius: 22px;
          padding: 18px;
          line-height: 1.55;
        }

        .security-box strong {
          display: block;
          color: #ffffff;
          margin-bottom: 8px;
          font-size: 18px;
        }

        @media (max-width: 1100px) {
          .summary-grid,
          .main-grid,
          .selected-fund-card,
          .role-grid,
          .two-col {
            grid-template-columns: 1fr;
          }

          .hero-top,
          .panel-header {
            flex-direction: column;
          }

          .actions {
            justify-content: flex-start;
          }
        }
      `}</style>

      <section className="onboarding-shell">
        <div className="hero">
          <div className="hero-top">
            <div>
              <p className="eyebrow">VENTIQ Implementation Layer</p>
              <h1>Fund Onboarding & Stakeholder Access</h1>
              <p className="hero-copy">
                Create a fund, add schemes, invite stakeholders, assign
                role-based dashboards and track activation from one workspace.
                This replaces unsafe password sharing with secure invite links
                where each stakeholder sets their own password.
              </p>
            </div>

            <div className="actions">
              <Link className="primary-button" href="/debt-lms">
                Debt LMS
              </Link>
              <Link className="secondary-button" href="/bank-reconciliation">
                Bank MIS
              </Link>
            </div>
          </div>

          <div className="summary-grid">
            <div className="stat-card">
              <span>Funds</span>
              <strong>{summary.totalFunds}</strong>
            </div>

            <div className="stat-card">
              <span>Schemes</span>
              <strong>{summary.totalSchemes}</strong>
            </div>

            <div className="stat-card">
              <span>Stakeholders</span>
              <strong>{summary.totalStakeholders}</strong>
            </div>

            <div className="stat-card">
              <span>Activated users</span>
              <strong>{summary.activated}</strong>
            </div>
          </div>
        </div>

        <div className="ribbon">
          {loading ? "Loading onboarding workspace..." : dataMessage} · Secure
          invite flow → role-based dashboard access → audit trail → onboarding
          readiness
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Selected Fund Workspace</h2>
              <p>
                All schemes, stakeholders, invites and access logs below are
                filtered for the selected fund.
              </p>
            </div>

            <div className="actions">
              <button
                className="primary-button"
                disabled={isSendingInvites}
                onClick={sendInviteBatch}
                type="button"
              >
                {isSendingInvites ? "Preparing..." : "Send Secure Invite Batch"}
              </button>
            </div>
          </div>

          <div className="fund-selector">
            <select
              value={selectedFundId}
              onChange={(event) => setSelectedFundId(event.target.value)}
            >
              {funds.map((fund) => (
                <option key={fund.id} value={fund.id}>
                  {fund.fundName}
                </option>
              ))}
            </select>

            {inviteMessage && <span className="message">{inviteMessage}</span>}
          </div>

          <div className="selected-fund-card">
            <div>
              <span>Fund</span>
              <strong>{selectedFund.fundName}</strong>
            </div>

            <div>
              <span>Type</span>
              <strong>{selectedFund.fundType}</strong>
            </div>

            <div>
              <span>Jurisdiction</span>
              <strong>{selectedFund.jurisdiction}</strong>
            </div>

            <div>
              <span>Status</span>
              <strong>{selectedFund.onboardingStatus}</strong>
            </div>
          </div>

          <div className="summary-grid">
            <div className="stat-card">
              <span>Not invited</span>
              <strong>{summary.notInvited}</strong>
            </div>

            <div className="stat-card">
              <span>Invite sent</span>
              <strong>{summary.invited}</strong>
            </div>

            <div className="stat-card">
              <span>Activated</span>
              <strong>{summary.activated}</strong>
            </div>

            <div className="stat-card">
              <span>Revoked</span>
              <strong>{summary.revoked}</strong>
            </div>
          </div>
        </div>

        <div className="main-grid">
          <form className="setup-card" onSubmit={submitFund}>
            <h2>Create Fund</h2>
            <p>
              Start client onboarding by creating the fund / platform master.
            </p>

            <div className="form-grid">
              <div className="field">
                <label>Fund Name</label>
                <input
                  value={fundForm.fundName}
                  onChange={(event) =>
                    updateFundForm("fundName", event.target.value)
                  }
                  placeholder="Enter fund name"
                />
              </div>

              <div className="field">
                <label>Fund Type</label>
                <select
                  value={fundForm.fundType}
                  onChange={(event) =>
                    updateFundForm("fundType", event.target.value)
                  }
                >
                  <option>Category I AIF</option>
                  <option>Category II AIF</option>
                  <option>Category III AIF</option>
                  <option>GIFT City Fund</option>
                  <option>Private Credit Fund</option>
                  <option>Venture Debt Fund</option>
                </select>
              </div>

              <div className="field">
                <label>Jurisdiction</label>
                <select
                  value={fundForm.jurisdiction}
                  onChange={(event) =>
                    updateFundForm("jurisdiction", event.target.value)
                  }
                >
                  <option>India</option>
                  <option>GIFT City</option>
                  <option>Offshore</option>
                  <option>Parallel Structure</option>
                </select>
              </div>

              <div className="field">
                <label>SEBI Registration No.</label>
                <input
                  value={fundForm.sebiRegistrationNumber}
                  onChange={(event) =>
                    updateFundForm(
                      "sebiRegistrationNumber",
                      event.target.value
                    )
                  }
                  placeholder="Optional"
                />
              </div>

              <div className="field">
                <label>GIFT City Registration No.</label>
                <input
                  value={fundForm.giftCityRegistrationNumber}
                  onChange={(event) =>
                    updateFundForm(
                      "giftCityRegistrationNumber",
                      event.target.value
                    )
                  }
                  placeholder="Optional"
                />
              </div>

              <div className="field">
                <label>Sponsor</label>
                <input
                  value={fundForm.sponsorName}
                  onChange={(event) =>
                    updateFundForm("sponsorName", event.target.value)
                  }
                  placeholder="Sponsor name"
                />
              </div>

              <div className="field">
                <label>Investment Manager</label>
                <input
                  value={fundForm.investmentManagerName}
                  onChange={(event) =>
                    updateFundForm("investmentManagerName", event.target.value)
                  }
                  placeholder="Investment manager name"
                />
              </div>

              <div className="field">
                <label>Trustee</label>
                <input
                  value={fundForm.trusteeName}
                  onChange={(event) =>
                    updateFundForm("trusteeName", event.target.value)
                  }
                  placeholder="Trustee name"
                />
              </div>

              <div className="field">
                <label>Data Mode</label>
                <select
                  value={fundForm.dataMode}
                  onChange={(event) =>
                    updateFundForm("dataMode", event.target.value)
                  }
                >
                  <option>Demo Data</option>
                  <option>Sample Client Data</option>
                  <option>Limited Real Data</option>
                  <option>Production Data</option>
                </select>
              </div>

              <button
                className="primary-button"
                disabled={isSavingFund}
                type="submit"
              >
                {isSavingFund ? "Creating..." : "Create Fund"}
              </button>

              {fundMessage && <div className="message">{fundMessage}</div>}
            </div>
          </form>

          <form className="setup-card" onSubmit={submitScheme}>
            <h2>Add Scheme</h2>
            <p>
              Add scheme or strategy under the selected fund for user mapping.
            </p>

            <div className="form-grid">
              <div className="field">
                <label>Scheme Name</label>
                <input
                  value={schemeForm.schemeName}
                  onChange={(event) =>
                    updateSchemeForm("schemeName", event.target.value)
                  }
                  placeholder="Enter scheme name"
                />
              </div>

              <div className="field">
                <label>Scheme Type</label>
                <select
                  value={schemeForm.schemeType}
                  onChange={(event) =>
                    updateSchemeForm("schemeType", event.target.value)
                  }
                >
                  <option>Close Ended</option>
                  <option>Open Ended</option>
                  <option>Evergreen</option>
                  <option>Drawdown Structure</option>
                </select>
              </div>

              <div className="field">
                <label>Category</label>
                <select
                  value={schemeForm.category}
                  onChange={(event) =>
                    updateSchemeForm("category", event.target.value)
                  }
                >
                  <option>Category I AIF</option>
                  <option>Category II AIF</option>
                  <option>Category III AIF</option>
                  <option>GIFT City Fund</option>
                  <option>Private Credit</option>
                </select>
              </div>

              <div className="field">
                <label>Strategy</label>
                <input
                  value={schemeForm.strategy}
                  onChange={(event) =>
                    updateSchemeForm("strategy", event.target.value)
                  }
                  placeholder="Private Credit / VC / PE / Debt"
                />
              </div>

              <div className="field">
                <label>Base Currency</label>
                <select
                  value={schemeForm.baseCurrency}
                  onChange={(event) =>
                    updateSchemeForm("baseCurrency", event.target.value)
                  }
                >
                  <option>INR</option>
                  <option>USD</option>
                  <option>EUR</option>
                  <option>GBP</option>
                </select>
              </div>

              <button
                className="primary-button"
                disabled={isSavingScheme}
                type="submit"
              >
                {isSavingScheme ? "Adding..." : "Add Scheme"}
              </button>

              {schemeMessage && (
                <div className="message">{schemeMessage}</div>
              )}
            </div>
          </form>

          <form className="setup-card" onSubmit={submitStakeholder}>
            <h2>Add Stakeholder</h2>
            <p>
              Add one stakeholder and assign dashboard access. Password is not
              shared; user receives secure invite.
            </p>

            <div className="form-grid">
              <div className="field">
                <label>Full Name</label>
                <input
                  value={stakeholderForm.fullName}
                  onChange={(event) =>
                    updateStakeholderForm("fullName", event.target.value)
                  }
                  placeholder="Stakeholder name"
                />
              </div>

              <div className="field">
                <label>Email</label>
                <input
                  type="email"
                  value={stakeholderForm.email}
                  onChange={(event) =>
                    updateStakeholderForm("email", event.target.value)
                  }
                  placeholder="stakeholder@example.com"
                />
              </div>

              <div className="field">
                <label>Organization</label>
                <input
                  value={stakeholderForm.organization}
                  onChange={(event) =>
                    updateStakeholderForm("organization", event.target.value)
                  }
                  placeholder="Company / investor / auditor"
                />
              </div>

              <div className="field">
                <label>Scheme Access</label>
                <select
                  value={stakeholderForm.schemeId}
                  onChange={(event) =>
                    updateStakeholderForm("schemeId", event.target.value)
                  }
                >
                  <option value="">Fund level access</option>
                  {selectedSchemes.map((scheme) => (
                    <option key={scheme.id} value={scheme.id}>
                      {scheme.schemeName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Role</label>
                <select
                  value={stakeholderForm.roleKey}
                  onChange={(event) => {
                    const nextRole = getRoleOption(event.target.value);
                    updateStakeholderForm("roleKey", nextRole.roleKey);
                    updateStakeholderForm(
                      "stakeholderType",
                      nextRole.stakeholderType
                    );
                  }}
                >
                  {roleOptions.map((role) => (
                    <option key={role.roleKey} value={role.roleKey}>
                      {role.roleLabel}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Stakeholder Type</label>
                <select
                  value={stakeholderForm.stakeholderType}
                  onChange={(event) =>
                    updateStakeholderForm("stakeholderType", event.target.value)
                  }
                >
                  <option>Internal</option>
                  <option>External</option>
                  <option>Investor</option>
                  <option>Auditor</option>
                  <option>Trustee</option>
                  <option>Service Provider</option>
                </select>
              </div>

              <div className="field">
                <label>Access Level</label>
                <select
                  value={stakeholderForm.accessLevel}
                  onChange={(event) =>
                    updateStakeholderForm("accessLevel", event.target.value)
                  }
                >
                  <option>Role Based</option>
                  <option>Full Admin</option>
                  <option>Read Only</option>
                  <option>Maker</option>
                  <option>Checker</option>
                  <option>Approver</option>
                  <option>Investor Read Only</option>
                </select>
              </div>

              <div className="warning-message">
                Selected role opens: {selectedRole.dashboardPath}
              </div>

              <button
                className="primary-button"
                disabled={isSavingStakeholder}
                type="submit"
              >
                {isSavingStakeholder ? "Adding..." : "Add Stakeholder"}
              </button>

              {stakeholderMessage && (
                <div className="message">{stakeholderMessage}</div>
              )}
            </div>
          </form>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Stakeholder Access Register</h2>
              <p>
                One-click invite tracking with activation and revocation
                controls. This is safer than sharing passwords.
              </p>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Dashboard</th>
                  <th>Access</th>
                  <th>Invite Status</th>
                  <th>Invited</th>
                  <th>Activated</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {selectedStakeholders.map((stakeholder) => (
                  <tr key={stakeholder.id}>
                    <td>
                      <strong>{stakeholder.fullName}</strong>
                      <br />
                      <span>{stakeholder.organization || "No organization"}</span>
                    </td>
                    <td>{stakeholder.email}</td>
                    <td>{stakeholder.roleLabel}</td>
                    <td>
                      <Link className="link-button" href={stakeholder.dashboardPath}>
                        Open
                      </Link>
                    </td>
                    <td>{stakeholder.accessLevel}</td>
                    <td>
                      <span
                        className={`status-pill status-${statusClass(
                          stakeholder.inviteStatus
                        )}`}
                      >
                        {stakeholder.inviteStatus}
                      </span>
                    </td>
                    <td>{formatDate(stakeholder.invitedAt)}</td>
                    <td>{formatDate(stakeholder.activatedAt)}</td>
                    <td>
                      <div className="actions">
                                              <button
                          className="small-button"
                          onClick={() => sendSecureInvite(stakeholder)}
                          type="button"
                        >
                          Invite
                        </button>

                        <button
                          className="small-button"
                          onClick={() =>
                            updateStakeholderStatus(stakeholder, "Activated")
                          }
                          type="button"
                        >
                          Activate
                        </button>

                        <button
                          className="small-button"
                          onClick={() =>
                            updateStakeholderStatus(stakeholder, "Revoked")
                          }
                          type="button"
                        >
                          Revoke
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {selectedStakeholders.length === 0 && (
                  <tr>
                    <td colSpan={9}>No stakeholders added for this fund yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Role-Based Access Matrix</h2>
              <p>
                Each role lands only on the dashboard relevant to that
                stakeholder.
              </p>
            </div>
          </div>

          <div className="role-grid">
            {roleOptions.map((role) => (
              <div className="role-card" key={role.roleKey}>
                <span>{role.stakeholderType}</span>
                <h3>{role.roleLabel}</h3>
                <p>{role.description}</p>
                <Link className="link-button" href={role.dashboardPath}>
                  {role.dashboardPath}
                </Link>
              </div>
            ))}
          </div>
        </div>

        <div className="two-col">
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Invite Batches</h2>
                <p>
                  Tracks secure invite batches prepared for the selected fund.
                </p>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Batch</th>
                    <th>Total</th>
                    <th>Sent</th>
                    <th>Pending</th>
                    <th>Activated</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {selectedInviteBatches.map((batch) => (
                    <tr key={batch.id}>
                      <td>{batch.batchName}</td>
                      <td>{batch.totalInvites}</td>
                      <td>{batch.sentCount}</td>
                      <td>{batch.pendingCount}</td>
                      <td>{batch.activatedCount}</td>
                      <td>
                        <span
                          className={`status-pill status-${statusClass(
                            batch.batchStatus
                          )}`}
                        >
                          {batch.batchStatus}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {selectedInviteBatches.length === 0 && (
                    <tr>
                      <td colSpan={6}>No invite batches created yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Access Audit Trail</h2>
                <p>
                  Captures key onboarding and access events for control review.
                </p>
              </div>
            </div>

            <div className="audit-list">
              {selectedAuditLogs.slice(0, 8).map((auditLog) => (
                <div className="audit-item" key={auditLog.id}>
                  <strong>{auditLog.eventTitle}</strong>
                  <p>
                    {auditLog.eventDescription}
                    <br />
                    {auditLog.actorName} · {formatDate(auditLog.createdAt)}
                  </p>
                </div>
              ))}

              {selectedAuditLogs.length === 0 && (
                <div className="audit-item">
                  <strong>No audit logs yet</strong>
                  <p>Access actions will appear here.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Data Protection Readiness</h2>
              <p>
                This is the bridge to the next module: Data Protection & Access
                Governance Console.
              </p>
            </div>

            <div className="actions">
              <Link className="secondary-button" href="/admin/data-protection">
                Data Protection Console
              </Link>
            </div>
          </div>

          <div className="selected-fund-card">
            <div>
              <span>Password policy</span>
              <strong>Invite link only</strong>
            </div>

            <div>
              <span>Access model</span>
              <strong>Role based</strong>
            </div>

            <div>
              <span>Data mode</span>
              <strong>{selectedFund.dataMode}</strong>
            </div>

            <div>
              <span>Audit trail</span>
              <strong>{selectedAuditLogs.length} event(s)</strong>
            </div>
          </div>

          <div className="security-box">
            <strong>Commercial positioning</strong>
            VENTIQ should not send passwords to stakeholders. The sellable flow
            is secure invite links, self-set password, optional MFA/OTP,
            role-based dashboard access, revocation control and full audit
            trail.
          </div>
        </div>
      </section>
    </main>
  );
}