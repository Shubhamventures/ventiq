"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../../lib/supabaseClient";

type DataRow = Record<string, unknown>;

type RoutePermission = {
  id: string;
  roleKey: string;
  roleLabel: string;
  routePath: string;
  routeLabel: string;
  accessType: string;
  canView: boolean;
  canEdit: boolean;
  canApprove: boolean;
  guardStatus: string;
  notes: string;
  createdAt: string;
};

type Stakeholder = {
  id: string;
  fullName: string;
  email: string;
  roleKey: string;
  roleLabel: string;
  dashboardPath: string;
  accessLevel: string;
  inviteStatus: string;
  accessStatus: string;
};

type PermissionForm = {
  roleKey: string;
  roleLabel: string;
  routePath: string;
  routeLabel: string;
  accessType: string;
  canView: boolean;
  canEdit: boolean;
  canApprove: boolean;
  guardStatus: string;
  notes: string;
};

const roleOptions = [
  {
    roleKey: "fund_admin",
    roleLabel: "Fund Admin",
  },
  {
    roleKey: "managing_partner",
    roleLabel: "Managing Partner",
  },
  {
    roleKey: "finance_head",
    roleLabel: "Finance Head",
  },
  {
    roleKey: "investment_team",
    roleLabel: "Investment Team",
  },
  {
    roleKey: "compliance_officer",
    roleLabel: "Compliance Officer",
  },
  {
    roleKey: "investor_relations",
    roleLabel: "Investor Relations",
  },
  {
    roleKey: "investor_lp",
    roleLabel: "Investor / LP",
  },
  {
    roleKey: "auditor_trustee",
    roleLabel: "Auditor / Trustee",
  },
];

const routeOptions = [
  {
    routePath: "/fund-onboarding",
    routeLabel: "Fund Onboarding",
  },
  {
    routePath: "/admin/client-readiness",
    routeLabel: "Client Readiness",
  },
  {
    routePath: "/admin/data-protection",
    routeLabel: "Data Protection",
  },
  {
    routePath: "/admin/audit-workflow",
    routeLabel: "Audit Workflow",
  },
  {
    routePath: "/admin/role-access",
    routeLabel: "Role Access",
  },
  {
    routePath: "/finance-head-ai",
    routeLabel: "Finance Head Dashboard",
  },
  {
    routePath: "/bank-reconciliation",
    routeLabel: "Bank MIS",
  },
  {
    routePath: "/debt-lms",
    routeLabel: "Debt LMS",
  },
  {
    routePath: "/document-studio",
    routeLabel: "Document Studio",
  },
  {
    routePath: "/managing-partner-ai",
    routeLabel: "Managing Partner Dashboard",
  },
  {
    routePath: "/investment-team-ai",
    routeLabel: "Investment Team Dashboard",
  },
  {
    routePath: "/investor-portal",
    routeLabel: "Investor Portal",
  },
  {
    routePath: "/compliance-ai",
    routeLabel: "Compliance AI",
  },
];

const emptyPermissionForm: PermissionForm = {
  roleKey: "finance_head",
  roleLabel: "Finance Head",
  routePath: "/finance-head-ai",
  routeLabel: "Finance Head Dashboard",
  accessType: "Operations",
  canView: true,
  canEdit: true,
  canApprove: true,
  guardStatus: "Active",
  notes: "",
};

const samplePermissions: RoutePermission[] = [
  {
    id: "perm-001",
    roleKey: "finance_head",
    roleLabel: "Finance Head",
    routePath: "/finance-head-ai",
    routeLabel: "Finance Head Dashboard",
    accessType: "Operations",
    canView: true,
    canEdit: true,
    canApprove: true,
    guardStatus: "Active",
    notes: "Primary finance workspace.",
    createdAt: "2026-08-03",
  },
  {
    id: "perm-002",
    roleKey: "finance_head",
    roleLabel: "Finance Head",
    routePath: "/bank-reconciliation",
    routeLabel: "Bank MIS",
    accessType: "Operations",
    canView: true,
    canEdit: true,
    canApprove: true,
    guardStatus: "Active",
    notes: "Daily cash and reconciliation control.",
    createdAt: "2026-08-03",
  },
  {
    id: "perm-003",
    roleKey: "finance_head",
    roleLabel: "Finance Head",
    routePath: "/debt-lms",
    routeLabel: "Debt LMS",
    accessType: "Operations",
    canView: true,
    canEdit: true,
    canApprove: true,
    guardStatus: "Active",
    notes: "Receipts, notices and repayment monitoring.",
    createdAt: "2026-08-03",
  },
  {
    id: "perm-004",
    roleKey: "managing_partner",
    roleLabel: "Managing Partner",
    routePath: "/managing-partner-ai",
    routeLabel: "Managing Partner Dashboard",
    accessType: "Executive",
    canView: true,
    canEdit: false,
    canApprove: true,
    guardStatus: "Active",
    notes: "Executive fund-level view.",
    createdAt: "2026-08-03",
  },
  {
    id: "perm-005",
    roleKey: "investor_lp",
    roleLabel: "Investor / LP",
    routePath: "/investor-portal",
    routeLabel: "Investor Portal",
    accessType: "Read Only",
    canView: true,
    canEdit: false,
    canApprove: false,
    guardStatus: "Active",
    notes: "Investor-facing restricted access.",
    createdAt: "2026-08-03",
  },
  {
    id: "perm-006",
    roleKey: "auditor_trustee",
    roleLabel: "Auditor / Trustee",
    routePath: "/document-studio",
    routeLabel: "Document Studio",
    accessType: "Evidence Read Only",
    canView: true,
    canEdit: false,
    canApprove: false,
    guardStatus: "Active",
    notes: "Evidence and document review access.",
    createdAt: "2026-08-03",
  },
];

const sampleStakeholders: Stakeholder[] = [
  {
    id: "stake-001",
    fullName: "Finance Head",
    email: "finance@example.com",
    roleKey: "finance_head",
    roleLabel: "Finance Head",
    dashboardPath: "/finance-head-ai",
    accessLevel: "Finance Operations",
    inviteStatus: "Activated",
    accessStatus: "Active",
  },
  {
    id: "stake-002",
    fullName: "Managing Partner",
    email: "mp@example.com",
    roleKey: "managing_partner",
    roleLabel: "Managing Partner",
    dashboardPath: "/managing-partner-ai",
    accessLevel: "Executive View",
    inviteStatus: "Activated",
    accessStatus: "Active",
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

function getBoolean(row: DataRow, keys: string[], fallback = false) {
  for (const key of keys) {
    const value = row[key];

    if (typeof value === "boolean") {
      return value;
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

function statusClass(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function mapPermission(row: DataRow): RoutePermission {
  return {
    id: getString(row, ["id"], crypto.randomUUID()),
    roleKey: getString(row, ["role_key"], ""),
    roleLabel: getString(row, ["role_label"], ""),
    routePath: getString(row, ["route_path"], ""),
    routeLabel: getString(row, ["route_label"], ""),
    accessType: getString(row, ["access_type"], "Read Only"),
    canView: getBoolean(row, ["can_view"], true),
    canEdit: getBoolean(row, ["can_edit"], false),
    canApprove: getBoolean(row, ["can_approve"], false),
    guardStatus: getString(row, ["guard_status"], "Draft"),
    notes: getString(row, ["notes"], ""),
    createdAt: getDateString(row, ["created_at"], ""),
  };
}

function mapStakeholder(row: DataRow): Stakeholder {
  return {
    id: getString(row, ["id"], crypto.randomUUID()),
    fullName: getString(row, ["full_name"], "Unnamed User"),
    email: getString(row, ["email"], ""),
    roleKey: getString(row, ["role_key"], ""),
    roleLabel: getString(row, ["role_label"], ""),
    dashboardPath: getString(row, ["dashboard_path"], ""),
    accessLevel: getString(row, ["access_level"], ""),
    inviteStatus: getString(row, ["invite_status"], "Not Invited"),
    accessStatus: getString(row, ["access_status"], "Active"),
  };
}

function getAllowedRoutes(roleKey: string, permissions: RoutePermission[]) {
  return permissions
    .filter((permission) => permission.roleKey === roleKey && permission.canView)
    .map((permission) => permission.routePath);
}

export default function RoleAccessPage() {
  const [permissions, setPermissions] =
    useState<RoutePermission[]>(samplePermissions);
  const [stakeholders, setStakeholders] =
    useState<Stakeholder[]>(sampleStakeholders);

  const [permissionForm, setPermissionForm] =
    useState<PermissionForm>(emptyPermissionForm);

  const [loading, setLoading] = useState(true);
  const [dataMessage, setDataMessage] = useState(
    "Loading role access console..."
  );
  const [formMessage, setFormMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadAccessData() {
      if (!isSupabaseConfigured || !supabase) {
        setDataMessage("Using sample access data. Supabase is not configured.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const db = supabase as any;

        const [permissionsResult, stakeholdersResult] = await Promise.all([
          db
            .from("ventiq_role_route_permissions")
            .select("*")
            .order("created_at", { ascending: false }),

          db
            .from("ventiq_stakeholders")
            .select("*")
            .order("created_at", { ascending: false }),
        ]);

        if (permissionsResult.error) {
          throw new Error(permissionsResult.error.message);
        }

        if (stakeholdersResult.error) {
          throw new Error(stakeholdersResult.error.message);
        }

        const nextPermissions =
          permissionsResult.data && permissionsResult.data.length > 0
            ? (permissionsResult.data as DataRow[]).map(mapPermission)
            : samplePermissions;

        const nextStakeholders =
          stakeholdersResult.data && stakeholdersResult.data.length > 0
            ? (stakeholdersResult.data as DataRow[]).map(mapStakeholder)
            : sampleStakeholders;

        setPermissions(nextPermissions);
        setStakeholders(nextStakeholders);

        setDataMessage(
          permissionsResult.data && permissionsResult.data.length > 0
            ? "Connected to Supabase route permission records."
            : "Route permission table is ready. Showing sample access rules until rules are created."
        );
      } catch (error) {
        setDataMessage(
          error instanceof Error
            ? `Role access database issue: ${error.message}`
            : "Unable to load role access data. Showing sample data."
        );
        setPermissions(samplePermissions);
        setStakeholders(sampleStakeholders);
      } finally {
        setLoading(false);
      }
    }

    loadAccessData();
  }, []);

  const summary = useMemo(() => {
    const activeRules = permissions.filter(
      (permission) => permission.guardStatus === "Active"
    ).length;

    const uniqueRoles = new Set(
      permissions.map((permission) => permission.roleKey)
    ).size;

    const protectedRoutes = new Set(
      permissions.map((permission) => permission.routePath)
    ).size;

    const activeUsers = stakeholders.filter(
      (stakeholder) => stakeholder.accessStatus !== "Revoked"
    ).length;

    return {
      totalRules: permissions.length,
      activeRules,
      uniqueRoles,
      protectedRoutes,
      activeUsers,
    };
  }, [permissions, stakeholders]);

  function updatePermissionForm(field: keyof PermissionForm, value: string) {
    setPermissionForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function updatePermissionBoolean(
    field: "canView" | "canEdit" | "canApprove",
    value: boolean
  ) {
    setPermissionForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function handleRoleChange(roleKey: string) {
    const role = roleOptions.find((item) => item.roleKey === roleKey);

    setPermissionForm((currentForm) => ({
      ...currentForm,
      roleKey,
      roleLabel: role?.roleLabel || currentForm.roleLabel,
    }));
  }

  function handleRouteChange(routePath: string) {
    const route = routeOptions.find((item) => item.routePath === routePath);

    setPermissionForm((currentForm) => ({
      ...currentForm,
      routePath,
      routeLabel: route?.routeLabel || currentForm.routeLabel,
    }));
  }

  async function submitPermission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormMessage("");

    if (!permissionForm.routePath.trim()) {
      setFormMessage("Route path is required.");
      return;
    }

    setSaving(true);

    const payload = {
      role_key: permissionForm.roleKey,
      role_label: permissionForm.roleLabel,
      route_path: permissionForm.routePath,
      route_label: permissionForm.routeLabel,
      access_type: permissionForm.accessType,
      can_view: permissionForm.canView,
      can_edit: permissionForm.canEdit,
      can_approve: permissionForm.canApprove,
      guard_status: permissionForm.guardStatus,
      notes: permissionForm.notes,
    };

    try {
      let savedPermission: RoutePermission;

      if (!isSupabaseConfigured || !supabase) {
        savedPermission = {
          id: crypto.randomUUID(),
          roleKey: payload.role_key,
          roleLabel: payload.role_label,
          routePath: payload.route_path,
          routeLabel: payload.route_label,
          accessType: payload.access_type,
          canView: payload.can_view,
          canEdit: payload.can_edit,
          canApprove: payload.can_approve,
          guardStatus: payload.guard_status,
          notes: payload.notes,
          createdAt: new Date().toISOString().slice(0, 10),
        };
      } else {
        const db = supabase as any;

        const { data, error } = await db
          .from("ventiq_role_route_permissions")
          .insert(payload)
          .select("*")
          .single();

        if (error) throw new Error(error.message);

        savedPermission = mapPermission(data as DataRow);
      }

      setPermissions((currentPermissions) => [
        savedPermission,
        ...currentPermissions,
      ]);
      setPermissionForm(emptyPermissionForm);
      setFormMessage("Route permission rule added.");
    } catch (error) {
      setFormMessage(
        error instanceof Error
          ? error.message
          : "Unable to add route permission."
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateGuardStatus(permission: RoutePermission, nextStatus: string) {
    try {
      if (isSupabaseConfigured && supabase && !permission.id.startsWith("perm-")) {
        const db = supabase as any;

        const { error } = await db
          .from("ventiq_role_route_permissions")
          .update({ guard_status: nextStatus })
          .eq("id", permission.id);

        if (error) throw new Error(error.message);
      }

      setPermissions((currentPermissions) =>
        currentPermissions.map((item) =>
          item.id === permission.id
            ? { ...item, guardStatus: nextStatus }
            : item
        )
      );
    } catch (error) {
      setFormMessage(
        error instanceof Error
          ? error.message
          : "Unable to update guard status."
      );
    }
  }

  return (
    <main className="role-access-page">
      <style>{`
        .role-access-page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top left, rgba(37, 99, 235, 0.22), transparent 34rem),
            radial-gradient(circle at top right, rgba(245, 200, 91, 0.16), transparent 32rem),
            #07101f;
          color: #f8fbff;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
          padding: 34px;
        }

        .role-access-shell {
          max-width: 1280px;
          margin: 0 auto;
        }

        .hero,
        .panel,
        .stat-card,
        .form-card,
        .matrix-card {
          border: 1px solid rgba(147, 197, 253, 0.16);
          background: rgba(15, 23, 42, 0.74);
          border-radius: 24px;
          box-shadow: 0 18px 60px rgba(0, 0, 0, 0.18);
        }

        .hero {
          border-radius: 32px;
          padding: 34px;
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
          max-width: 870px;
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
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 14px;
          margin-top: 24px;
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
          grid-template-columns: 1fr;
          gap: 18px;
          margin-bottom: 18px;
        }

        .form-card,
        .panel {
          padding: 24px;
          margin-bottom: 18px;
        }

        .form-card h2,
        .panel-header h2 {
          margin: 0;
          font-size: 25px;
          letter-spacing: -0.04em;
        }

        .form-card p,
        .panel-header p {
          margin: 8px 0 0;
          color: #9db3d7;
          line-height: 1.55;
        }

                .form-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-top: 18px;
          align-items: end;
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
          box-sizing: border-box;
          border: 1px solid rgba(147, 197, 253, 0.18);
          background: rgba(2, 6, 23, 0.34);
          color: #ffffff;
          border-radius: 14px;
          padding: 11px 12px;
          outline: none;
          font: inherit;
        }

                .field textarea {
          min-height: 110px;
          resize: vertical;
        }

        .form-grid .field:nth-of-type(5) {
          grid-column: 1 / -1;
        }

        .form-grid .check-row {
          grid-column: 1 / -1;
        }

        .form-card .primary-button {
          width: fit-content;
          min-width: 260px;
          height: 54px;
          font-size: 15px;
        }

        .check-row {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
          margin-top: 8px;
        }

        .check-row label {
          display: flex;
          gap: 8px;
          align-items: center;
          color: #dbeafe;
          font-size: 13px;
          font-weight: 850;
        }

        .message {
          color: #bbf7d0;
          font-size: 13px;
          font-weight: 850;
          margin-top: 12px;
          line-height: 1.45;
        }

        .table-wrap {
          overflow-x: auto;
          border: 1px solid rgba(147, 197, 253, 0.14);
          border-radius: 20px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 980px;
          table-layout: fixed;
        }

        th,
        td {
          padding: 14px;
          text-align: left;
          border-bottom: 1px solid rgba(147, 197, 253, 0.12);
          vertical-align: top;
          word-break: break-word;
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

        .status-active,
        .status-activated,
        .status-allowed {
          background: rgba(22, 163, 74, 0.24);
          color: #bbf7d0;
        }

        .status-draft,
        .status-invite-sent,
        .status-operations {
          background: rgba(245, 158, 11, 0.22);
          color: #fde68a;
        }

        .status-paused,
        .status-read-only,
        .status-evidence-read-only {
          background: rgba(59, 130, 246, 0.22);
          color: #bfdbfe;
        }

        .status-revoked,
        .status-blocked {
          background: rgba(239, 68, 68, 0.22);
          color: #fecaca;
        }

        .matrix-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .matrix-card {
          padding: 18px;
        }

        .matrix-card span {
          display: inline-flex;
          border-radius: 999px;
          padding: 7px 10px;
          background: rgba(245, 200, 91, 0.12);
          color: #fde68a;
          font-size: 11px;
          font-weight: 950;
          margin-bottom: 12px;
        }

        .matrix-card h3 {
          margin: 0;
          font-size: 18px;
        }

        .matrix-card p {
          color: #c7d7f4;
          line-height: 1.5;
          font-size: 13px;
        }

        .route-list {
          margin-top: 12px;
          display: grid;
          gap: 8px;
        }

        .route-item {
          border: 1px solid rgba(147, 197, 253, 0.12);
          background: rgba(2, 6, 23, 0.24);
          border-radius: 14px;
          padding: 10px;
          font-size: 12px;
          color: #dbeafe;
        }

        .control-box {
          border: 1px solid rgba(34, 197, 94, 0.26);
          background: rgba(22, 163, 74, 0.12);
          color: #bbf7d0;
          border-radius: 22px;
          padding: 18px;
          line-height: 1.55;
        }

        .control-box strong {
          display: block;
          color: #ffffff;
          margin-bottom: 8px;
          font-size: 18px;
        }

               @media (max-width: 1100px) {
          .summary-grid,
          .main-grid,
          .matrix-grid,
          .form-grid {
            grid-template-columns: 1fr;
          }

          .form-grid .field:nth-of-type(5),
          .form-grid .check-row {
            grid-column: auto;
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

      <section className="role-access-shell">
        <div className="hero">
          <div className="hero-top">
            <div>
              <p className="eyebrow">VENTIQ Access Layer</p>
              <h1>Role Access & Route Protection</h1>
              <p className="hero-copy">
                Define which stakeholder role can access each VENTIQ workspace.
                This page is the permission control center before we wire actual
                route blocking into the application guard.
              </p>
            </div>

            <div className="actions">
              <Link className="primary-button" href="/fund-onboarding">
                Fund Onboarding
              </Link>
              <Link className="secondary-button" href="/admin/audit-workflow">
                Audit Workflow
              </Link>
              <Link className="secondary-button" href="/admin/data-protection">
                Data Protection
              </Link>
            </div>
          </div>

          <div className="summary-grid">
            <div className="stat-card">
              <span>Total rules</span>
              <strong>{summary.totalRules}</strong>
            </div>

            <div className="stat-card">
              <span>Active rules</span>
              <strong>{summary.activeRules}</strong>
            </div>

            <div className="stat-card">
              <span>Protected routes</span>
              <strong>{summary.protectedRoutes}</strong>
            </div>

            <div className="stat-card">
              <span>Roles mapped</span>
              <strong>{summary.uniqueRoles}</strong>
            </div>

            <div className="stat-card">
              <span>Active users</span>
              <strong>{summary.activeUsers}</strong>
            </div>
          </div>
        </div>

        <div className="ribbon">
          {loading ? "Loading role access console..." : dataMessage} · Invite
          user → user sets password → role is mapped → allowed routes are
          enforced
        </div>

        <div className="main-grid">
          <form className="form-card" onSubmit={submitPermission}>
            <h2>Add Route Permission</h2>
            <p>
              Create a role-to-route rule. This becomes the base for actual
              route protection.
            </p>

            <div className="form-grid">
              <div className="field">
                <label>Role</label>
                <select
                  value={permissionForm.roleKey}
                  onChange={(event) => handleRoleChange(event.target.value)}
                >
                  {roleOptions.map((role) => (
                    <option key={role.roleKey} value={role.roleKey}>
                      {role.roleLabel}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Route</label>
                <select
                  value={permissionForm.routePath}
                  onChange={(event) => handleRouteChange(event.target.value)}
                >
                  {routeOptions.map((route) => (
                    <option key={route.routePath} value={route.routePath}>
                      {route.routeLabel} — {route.routePath}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Access Type</label>
                <select
                  value={permissionForm.accessType}
                  onChange={(event) =>
                    updatePermissionForm("accessType", event.target.value)
                  }
                >
                  <option>Read Only</option>
                  <option>Operations</option>
                  <option>Executive</option>
                  <option>Approver</option>
                  <option>Evidence Read Only</option>
                  <option>Admin</option>
                </select>
              </div>

              <div className="field">
                <label>Guard Status</label>
                <select
                  value={permissionForm.guardStatus}
                  onChange={(event) =>
                    updatePermissionForm("guardStatus", event.target.value)
                  }
                >
                  <option>Active</option>
                  <option>Draft</option>
                  <option>Paused</option>
                </select>
              </div>

              <div className="check-row">
                <label>
                  <input
                    type="checkbox"
                    checked={permissionForm.canView}
                    onChange={(event) =>
                      updatePermissionBoolean("canView", event.target.checked)
                    }
                  />
                  Can View
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={permissionForm.canEdit}
                    onChange={(event) =>
                      updatePermissionBoolean("canEdit", event.target.checked)
                    }
                  />
                  Can Edit
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={permissionForm.canApprove}
                    onChange={(event) =>
                      updatePermissionBoolean(
                        "canApprove",
                        event.target.checked
                      )
                    }
                  />
                  Can Approve
                </label>
              </div>

              <div className="field">
                <label>Notes</label>
                <textarea
                  value={permissionForm.notes}
                  onChange={(event) =>
                    updatePermissionForm("notes", event.target.value)
                  }
                  placeholder="Example: Finance Head can approve Bank MIS and Debt LMS actions."
                />
              </div>

              <button className="primary-button" disabled={saving} type="submit">
                {saving ? "Adding..." : "Add Permission Rule"}
              </button>

              {formMessage && <div className="message">{formMessage}</div>}
            </div>
          </form>

          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Current Stakeholder Access</h2>
                <p>
                  These users came from Fund Onboarding and will later be
                  restricted to their permitted route set.
                </p>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Dashboard</th>
                    <th>Invite</th>
                    <th>Access</th>
                    <th>Allowed Routes</th>
                  </tr>
                </thead>

                <tbody>
                  {stakeholders.map((stakeholder) => {
                    const allowedRoutes = getAllowedRoutes(
                      stakeholder.roleKey,
                      permissions
                    );

                    return (
                      <tr key={stakeholder.id}>
                        <td>
                          <strong>{stakeholder.fullName}</strong>
                          <br />
                          <span>{stakeholder.email}</span>
                        </td>
                        <td>{stakeholder.roleLabel}</td>
                        <td>
                          <Link
                            className="link-button"
                            href={stakeholder.dashboardPath || "/fund-onboarding"}
                          >
                            Open
                          </Link>
                        </td>
                        <td>
                          <span
                            className={`status-pill status-${statusClass(
                              stakeholder.inviteStatus
                            )}`}
                          >
                            {stakeholder.inviteStatus}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`status-pill status-${statusClass(
                              stakeholder.accessStatus
                            )}`}
                          >
                            {stakeholder.accessStatus}
                          </span>
                        </td>
                        <td>
                          {allowedRoutes.length > 0
                            ? allowedRoutes.join(", ")
                            : "No route rules mapped"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Route Permission Register</h2>
              <p>
                This is the master access matrix for VENTIQ role-based route
                protection.
              </p>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Route</th>
                  <th>Access Type</th>
                  <th>View</th>
                  <th>Edit</th>
                  <th>Approve</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {permissions.map((permission) => (
                  <tr key={permission.id}>
                    <td>
                      <strong>{permission.roleLabel}</strong>
                      <br />
                      <span>{permission.roleKey}</span>
                    </td>
                    <td>
                      <strong>{permission.routeLabel}</strong>
                      <br />
                      <span>{permission.routePath}</span>
                    </td>
                    <td>
                      <span
                        className={`status-pill status-${statusClass(
                          permission.accessType
                        )}`}
                      >
                        {permission.accessType}
                      </span>
                    </td>
                    <td>{permission.canView ? "Yes" : "No"}</td>
                    <td>{permission.canEdit ? "Yes" : "No"}</td>
                    <td>{permission.canApprove ? "Yes" : "No"}</td>
                    <td>
                      <span
                        className={`status-pill status-${statusClass(
                          permission.guardStatus
                        )}`}
                      >
                        {permission.guardStatus}
                      </span>
                    </td>
                    <td>
                      <div className="actions">
                        <button
                          className="small-button"
                          type="button"
                          onClick={() => updateGuardStatus(permission, "Active")}
                        >
                          Active
                        </button>
                        <button
                          className="small-button"
                          type="button"
                          onClick={() => updateGuardStatus(permission, "Paused")}
                        >
                          Pause
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Role Route Matrix</h2>
              <p>
                Quick visual map of each role and the routes currently allowed.
              </p>
            </div>
          </div>

          <div className="matrix-grid">
            {roleOptions.map((role) => {
              const allowedRoutes = getAllowedRoutes(role.roleKey, permissions);

              return (
                <div className="matrix-card" key={role.roleKey}>
                  <span>{role.roleKey}</span>
                  <h3>{role.roleLabel}</h3>
                  <p>
                    {allowedRoutes.length} route(s) currently mapped for this
                    role.
                  </p>

                  <div className="route-list">
                    {allowedRoutes.slice(0, 6).map((route) => (
                      <div className="route-item" key={route}>
                        {route}
                      </div>
                    ))}

                    {allowedRoutes.length === 0 && (
                      <div className="route-item">No routes mapped yet</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel">
          <div className="control-box">
            <strong>Next technical step</strong>
            This page defines the route permission rules. The next step is to
            wire these rules into the app guard so unauthorised users are
            redirected away from pages they cannot access.
          </div>
        </div>
      </section>
    </main>
  );
}