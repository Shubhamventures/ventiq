"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../../lib/supabaseClient";

type DataRow = Record<string, unknown>;

type ApprovalRequest = {
  id: string;
  sourceModule: string;
  linkedRecordId: string;
  linkedRecordType: string;
  actionType: string;
  actionTitle: string;
  actionDescription: string;
  requestedByName: string;
  requestedByEmail: string;
  makerRole: string;
  checkerRole: string;
  approverRole: string;
  priority: string;
  approvalStatus: string;
  currentStep: string;
  businessImpact: string;
  requestedAt: string;
  approvedAt: string;
  rejectedAt: string;
};

type ApprovalStep = {
  id: string;
  approvalRequestId: string;
  stepOrder: number;
  stepName: string;
  assignedRole: string;
  assignedToName: string;
  assignedToEmail: string;
  stepStatus: string;
  actionedByName: string;
  actionedByEmail: string;
  actionedAt: string;
  comments: string;
};

type AuditLog = {
  id: string;
  sourceModule: string;
  linkedRecordId: string;
  linkedRecordType: string;
  eventType: string;
  eventTitle: string;
  eventDescription: string;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  eventStatus: string;
  riskLevel: string;
  evidenceUrl: string;
  createdAt: string;
};

type ApprovalForm = {
  sourceModule: string;
  linkedRecordId: string;
  linkedRecordType: string;
  actionType: string;
  actionTitle: string;
  actionDescription: string;
  priority: string;
  businessImpact: string;
};

type WorkflowActor = {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  organisationId: string;
};

type WorkflowCapabilities = {
  canCreate: boolean;
  canCheckerReview: boolean;
  canFinalApprove: boolean;
};

const emptyApprovalForm: ApprovalForm = {
  sourceModule: "Debt LMS",
  linkedRecordId: "",
  linkedRecordType: "Repayment Schedule",
  actionType: "Receipt Update",
  actionTitle: "",
  actionDescription: "",
  priority: "Medium",
  businessImpact: "",
};


const criticalActions = [
  "Bank transaction approval",
  "Debt LMS receipt update",
  "Penalty waiver",
  "Default marking",
  "Repayment notice dispatch",
  "Capital call approval",
  "Distribution approval",
  "Investor invite",
  "Access revocation",
  "Covenant breach closure",
  "Security status update",
  "Data deletion request",
];

function getString(row: DataRow, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return fallback;
}

function getNumber(row: DataRow, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }
  return fallback;
}

function getDateString(row: DataRow, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.slice(0, 10);
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

function mapApproval(row: DataRow): ApprovalRequest {
  return {
    id: getString(row, ["id"], crypto.randomUUID()),
    sourceModule: getString(row, ["source_module"], "VENTIQ"),
    linkedRecordId: getString(row, ["linked_record_id"], ""),
    linkedRecordType: getString(row, ["linked_record_type"], ""),
    actionType: getString(row, ["action_type"], ""),
    actionTitle: getString(row, ["action_title"], "Approval request"),
    actionDescription: getString(row, ["action_description"], ""),
    requestedByName: getString(row, ["requested_by_name"], ""),
    requestedByEmail: getString(row, ["requested_by_email"], ""),
    makerRole: getString(row, ["maker_role"], ""),
    checkerRole: getString(row, ["checker_role"], ""),
    approverRole: getString(row, ["approver_role"], ""),
    priority: getString(row, ["priority"], "Medium"),
    approvalStatus: getString(row, ["approval_status"], "Pending Review"),
    currentStep: getString(row, ["current_step"], "Checker Review"),
    businessImpact: getString(row, ["business_impact"], ""),
    requestedAt: getDateString(row, ["requested_at", "created_at"], ""),
    approvedAt: getDateString(row, ["approved_at"], ""),
    rejectedAt: getDateString(row, ["rejected_at"], ""),
  };
}

function mapStep(row: DataRow): ApprovalStep {
  return {
    id: getString(row, ["id"], crypto.randomUUID()),
    approvalRequestId: getString(row, ["approval_request_id"], ""),
    stepOrder: getNumber(row, ["step_order"], 1),
    stepName: getString(row, ["step_name"], ""),
    assignedRole: getString(row, ["assigned_role"], ""),
    assignedToName: getString(row, ["assigned_to_name"], ""),
    assignedToEmail: getString(row, ["assigned_to_email"], ""),
    stepStatus: getString(row, ["step_status"], "Pending"),
    actionedByName: getString(row, ["actioned_by_name"], ""),
    actionedByEmail: getString(row, ["actioned_by_email"], ""),
    actionedAt: getDateString(row, ["actioned_at"], ""),
    comments: getString(row, ["comments"], ""),
  };
}

function mapAudit(row: DataRow): AuditLog {
  return {
    id: getString(row, ["id"], crypto.randomUUID()),
    sourceModule: getString(row, ["source_module"], ""),
    linkedRecordId: getString(row, ["linked_record_id"], ""),
    linkedRecordType: getString(row, ["linked_record_type"], ""),
    eventType: getString(row, ["event_type"], ""),
    eventTitle: getString(row, ["event_title"], "Audit event"),
    eventDescription: getString(row, ["event_description"], ""),
    actorName: getString(row, ["actor_name"], ""),
    actorEmail: getString(row, ["actor_email"], ""),
    actorRole: getString(row, ["actor_role"], ""),
    eventStatus: getString(row, ["event_status"], "Recorded"),
    riskLevel: getString(row, ["risk_level"], "Low"),
    evidenceUrl: getString(row, ["evidence_url"], ""),
    createdAt: getDateString(row, ["created_at"], ""),
  };
}

async function getAccessToken() {
  if (!supabase) throw new Error("Supabase client is not available.");
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  const token = data.session?.access_token;
  if (!token) throw new Error("Please sign in before opening the approval workflow.");
  return token;
}

export default function AuditWorkflowPage() {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [approvalSteps, setApprovalSteps] = useState<ApprovalStep[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [actor, setActor] = useState<WorkflowActor | null>(null);
  const [capabilities, setCapabilities] = useState<WorkflowCapabilities>({
    canCreate: false,
    canCheckerReview: false,
    canFinalApprove: false,
  });
  const [approvalForm, setApprovalForm] = useState<ApprovalForm>(emptyApprovalForm);
  const [selectedApprovalId, setSelectedApprovalId] = useState("");
  const [loading, setLoading] = useState(true);
  const [dataMessage, setDataMessage] = useState("Loading secured approval workflow...");
  const [formMessage, setFormMessage] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const applyWorkflowPayload = useCallback((payload: any) => {
    const nextApprovals = Array.isArray(payload?.approvals)
      ? (payload.approvals as DataRow[]).map(mapApproval)
      : [];
    const nextSteps = Array.isArray(payload?.steps)
      ? (payload.steps as DataRow[]).map(mapStep)
      : [];
    const nextAuditLogs = Array.isArray(payload?.auditLogs)
      ? (payload.auditLogs as DataRow[]).map(mapAudit)
      : [];

    setApprovals(nextApprovals);
    setApprovalSteps(nextSteps);
    setAuditLogs(nextAuditLogs);
    setActor(payload?.actor || null);
    setCapabilities(
      payload?.capabilities || {
        canCreate: false,
        canCheckerReview: false,
        canFinalApprove: false,
      }
    );
    setSelectedApprovalId((current) => {
      if (current && nextApprovals.some((item) => item.id === current)) return current;
      return nextApprovals[0]?.id || "";
    });
  }, []);

  const loadWorkflowData = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setApprovals([]);
      setApprovalSteps([]);
      setAuditLogs([]);
      setActor(null);
      setCapabilities({ canCreate: false, canCheckerReview: false, canFinalApprove: false });
      setSelectedApprovalId("");
      setDataMessage(
        "Supabase is not configured. No approval workflow or audit records are displayed."
      );
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const token = await getAccessToken();
      const response = await fetch("/api/admin/approval-workflow", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to load approval workflow.");
      }
      applyWorkflowPayload(payload);
      setDataMessage(
        payload?.actor
          ? `Secure server workflow · ${payload.actor.fullName} · ${payload.actor.role}`
          : "Secure server workflow connected."
      );
    } catch (error) {
      setApprovals([]);
      setApprovalSteps([]);
      setAuditLogs([]);
      setActor(null);
      setCapabilities({ canCreate: false, canCheckerReview: false, canFinalApprove: false });
      setDataMessage(error instanceof Error ? error.message : "Unable to load approval workflow.");
    } finally {
      setLoading(false);
    }
  }, [applyWorkflowPayload]);

  useEffect(() => {
    loadWorkflowData();
  }, [loadWorkflowData]);

  const selectedApproval =
    approvals.find((item) => item.id === selectedApprovalId) ?? approvals[0] ?? null;

  const selectedSteps = selectedApproval
    ? approvalSteps
        .filter((step) => step.approvalRequestId === selectedApproval.id)
        .sort((a, b) => a.stepOrder - b.stepOrder)
    : [];

  const summary = useMemo(() => {
    const pending = approvals.filter((item) =>
      item.approvalStatus.toLowerCase().includes("pending")
    ).length;
    const approved = approvals.filter((item) => item.approvalStatus === "Approved").length;
    const rejected = approvals.filter((item) => item.approvalStatus === "Rejected").length;
    const highRisk = approvals.filter(
      (item) => item.priority === "High" || item.priority === "Critical"
    ).length;
    return {
      total: approvals.length,
      pending,
      approved,
      rejected,
      highRisk,
      auditEvents: auditLogs.length,
    };
  }, [approvals, auditLogs]);

  function updateApprovalForm(field: keyof ApprovalForm, value: string) {
    setApprovalForm((currentForm) => {
      const nextForm = { ...currentForm, [field]: value };

      if (field === "actionType" && value === "Fund Memory Approval") {
        nextForm.sourceModule = "Document Studio";
        nextForm.linkedRecordType = "Fund Memory Snapshot";
        nextForm.priority = "High";
      }

      if (field === "actionType" && value === "Capital Call Approval") {
        nextForm.sourceModule = "Capital Call";
        nextForm.linkedRecordType = "Capital Call";
        nextForm.priority = "High";
      }

      return nextForm;
    });
  }

  function canActOnApproval(approval: ApprovalRequest) {
    if (!actor) return false;
    if (approval.requestedByEmail.toLowerCase() === actor.email.toLowerCase()) return false;
    if (approval.currentStep === "Checker Review") return capabilities.canCheckerReview;
    if (approval.currentStep === "Final Approval") return capabilities.canFinalApprove;
    return false;
  }

  function approvalStepsFor(approvalId: string) {
    return approvalSteps
      .filter((step) => step.approvalRequestId === approvalId)
      .sort((a, b) => a.stepOrder - b.stepOrder);
  }

  function isOwnRequest(approval: ApprovalRequest) {
    if (!actor) return false;
    return approval.requestedByEmail.toLowerCase() === actor.email.toLowerCase();
  }

  function approvalDisplayTitle(approval: ApprovalRequest) {
    const prefix = "Institutional onboarding:";
    if (approval.actionTitle.toLowerCase().startsWith(prefix.toLowerCase())) {
      return approval.actionTitle.slice(prefix.length).trim() || approval.actionTitle;
    }
    return approval.actionTitle;
  }

  function approvalDisplayKicker(approval: ApprovalRequest) {
    return approval.actionTitle.toLowerCase().startsWith("institutional onboarding:")
      ? "Institutional onboarding"
      : approval.actionType || "Governed approval";
  }

  function workflowStatusLabel(approval: ApprovalRequest) {
    if (approval.approvalStatus === "Approved") return "Approved";
    if (approval.approvalStatus === "Rejected") return "Rejected";
    if (approval.currentStep === "Checker Review") return "Awaiting Checker";
    if (approval.currentStep === "Final Approval") return "Awaiting Final Approval";
    return approval.approvalStatus;
  }

  function governanceStageState(
    approval: ApprovalRequest,
    stageName: "Maker Submitted" | "Checker Review" | "Final Approval"
  ) {
    const step = approvalStepsFor(approval.id).find((item) => item.stepName === stageName);
    const status = step?.stepStatus.toLowerCase() || "";
    if (status === "completed") return "complete";
    if (status === "rejected") return "rejected";
    if (
      approval.currentStep === stageName &&
      approval.approvalStatus !== "Approved" &&
      approval.approvalStatus !== "Rejected"
    ) return "current";
    return "pending";
  }

  function governanceStageLabel(
    stageName: "Maker Submitted" | "Checker Review" | "Final Approval",
    state: string
  ) {
    if (stageName === "Maker Submitted") return "Maker submitted";
    if (stageName === "Checker Review") return state === "complete" ? "Checker approved" : "Checker review";
    return state === "complete" ? "Final approved" : "Final approval";
  }

  function governanceStagePerson(
    approval: ApprovalRequest,
    stageName: "Maker Submitted" | "Checker Review" | "Final Approval",
    state: string
  ) {
    const step = approvalStepsFor(approval.id).find((item) => item.stepName === stageName);
    if (step?.actionedByName) return step.actionedByName;
    if (stageName === "Maker Submitted") return approval.requestedByName || "Recorded maker";
    if (state === "current") return "Awaiting action";
    return "Pending";
  }

  function governanceMessage(approval: ApprovalRequest, canAct: boolean) {
    if (approval.approvalStatus === "Approved") return { tone: "complete", title: "Governance complete", detail: "The request completed maker, checker and final approval." };
    if (approval.approvalStatus === "Rejected") return { tone: "rejected", title: "Request rejected", detail: "The approval workflow is closed for this request." };
    if (isOwnRequest(approval)) return { tone: "locked", title: "Independent approval required", detail: "You submitted this request. Approval must be performed by another authorised user." };
    if (canAct && approval.currentStep === "Checker Review") return { tone: "action", title: "Your checker review is required", detail: "Review the request evidence before approving or rejecting this stage." };
    if (canAct && approval.currentStep === "Final Approval") return { tone: "action", title: "Your final approval is required", detail: "Checker review is complete. Perform the independent final decision." };
    return { tone: "waiting", title: "Awaiting authorised reviewer", detail: "The request is waiting for an authorised user at the current governance stage." };
  }

  async function submitApprovalRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormMessage("");
    if (!capabilities.canCreate) {
      setFormMessage("Your role cannot create approval requests.");
      return;
    }
    if (!approvalForm.actionTitle.trim()) {
      setFormMessage("Action title is required.");
      return;
    }
    if (!approvalForm.actionDescription.trim()) {
      setFormMessage("Action description is required.");
      return;
    }
    if (
      (approvalForm.actionType === "Capital Call Approval" ||
        approvalForm.actionType === "Fund Memory Approval") &&
      !approvalForm.linkedRecordId.trim()
    ) {
      setFormMessage(
        approvalForm.actionType === "Fund Memory Approval"
          ? "Paste the canonical Fund Memory snapshot ID before submitting."
          : "Paste the saved capital call ID before submitting."
      );
      return;
    }

    try {
      setSaving(true);
      const token = await getAccessToken();
      const response = await fetch("/api/admin/approval-workflow", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "create_request", ...approvalForm }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Unable to create approval request.");
      setApprovalForm(emptyApprovalForm);
      setShowCreateForm(false);
      setFormMessage("Approval request created and sent to checker review.");
      await loadWorkflowData();
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Unable to create approval request.");
    } finally {
      setSaving(false);
    }
  }

  async function updateApprovalStatus(
    approval: ApprovalRequest,
    decision: "Approved" | "Rejected"
  ) {
    setActionMessage("");
    if (!canActOnApproval(approval)) {
      setActionMessage("Your role cannot action this approval at its current stage.");
      return;
    }

    try {
      setSaving(true);
      const token = await getAccessToken();
      const response = await fetch("/api/admin/approval-workflow", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "decide_request",
          approvalId: approval.id,
          decision,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Unable to update approval request.");
      setActionMessage(payload?.message || `${approval.actionTitle} updated.`);
      await loadWorkflowData();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Unable to update approval request.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="workflow-page">
      <style>{`
        .workflow-page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top left, rgba(37, 99, 235, 0.22), transparent 34rem),
            radial-gradient(circle at top right, rgba(245, 200, 91, 0.16), transparent 32rem),
            #07101f;
          color: #f8fbff;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          padding: 34px;
        }

        .workflow-shell {
          max-width: 1280px;
          margin: 0 auto;
        }

        .hero,
        .panel,
        .stat-card,
        .form-card,
        .step-card,
        .action-card {
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

        .small-button.danger {
          background: rgba(239, 68, 68, 0.14);
          border-color: rgba(239, 68, 68, 0.28);
          color: #fecaca;
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
          grid-template-columns: repeat(6, minmax(0, 1fr));
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
          grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.4fr);
          gap: 18px;
          margin-bottom: 18px;
        }

        .form-card,
        .panel {
          min-width: 0;
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

        .table-wrap {
          min-width: 0;
          max-width: 100%;
          overflow-x: auto;
          border: 1px solid rgba(147, 197, 253, 0.14);
          border-radius: 20px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1020px;
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

        .status-approved,
        .status-completed,
        .status-recorded {
          background: rgba(22, 163, 74, 0.24);
          color: #bbf7d0;
        }

        .status-pending-review,
        .status-checker-review,
        .status-pending {
          background: rgba(245, 158, 11, 0.22);
          color: #fde68a;
        }

        .status-rejected,
        .status-critical {
          background: rgba(239, 68, 68, 0.22);
          color: #fecaca;
        }

        .status-high {
          background: rgba(249, 115, 22, 0.22);
          color: #fed7aa;
        }

        .status-medium {
          background: rgba(59, 130, 246, 0.22);
          color: #bfdbfe;
        }

        .status-low {
          background: rgba(34, 197, 94, 0.18);
          color: #bbf7d0;
        }

        .step-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .step-card,
        .action-card {
          padding: 18px;
        }

        .step-card span,
        .action-card span {
          display: inline-flex;
          border-radius: 999px;
          padding: 7px 10px;
          background: rgba(245, 200, 91, 0.12);
          color: #fde68a;
          font-size: 11px;
          font-weight: 950;
          margin-bottom: 12px;
        }

        .step-card h3,
        .action-card h3 {
          margin: 0;
          font-size: 18px;
        }

        .step-card p,
        .action-card p {
          color: #c7d7f4;
          line-height: 1.5;
          font-size: 13px;
        }

        .action-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
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
        /* VENTIQ UI FIX — Audit Workflow Premium Layout */
        .workflow-page .main-grid {
          grid-template-columns: 1fr;
          gap: 18px;
        }

        .workflow-page .form-card {
          padding: 28px;
        }

        .workflow-page .form-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
          align-items: end;
          gap: 16px;
        }

        .workflow-page .form-grid .field {
          min-width: 0;
        }

        .workflow-page .form-grid .field:nth-of-type(4),
        .workflow-page .form-grid .field:nth-of-type(5),
        .workflow-page .form-grid .field:nth-of-type(6) {
          grid-column: 1 / -1;
        }

        .workflow-page .field input,
        .workflow-page .field select,
        .workflow-page .field textarea {
          box-sizing: border-box;
          min-height: 52px;
          font-size: 15px;
        }

        .workflow-page .field textarea {
          min-height: 110px;
        }

        .workflow-page .form-card .primary-button {
          min-width: 260px;
          height: 54px;
          justify-self: start;
          font-size: 15px;
        }

        .workflow-page .table-wrap {
          overflow-x: auto;
        }

        .workflow-page table {
          min-width: 920px;
          table-layout: fixed;
        }

        .workflow-page th,
        .workflow-page td {
          word-break: break-word;
        }

        .workflow-page th:nth-child(1),
        .workflow-page td:nth-child(1) {
          width: 25%;
        }

        .workflow-page th:nth-child(2),
        .workflow-page td:nth-child(2) {
          width: 12%;
        }

        .workflow-page th:nth-child(3),
        .workflow-page td:nth-child(3) {
          width: 10%;
        }

        .workflow-page th:nth-child(4),
        .workflow-page td:nth-child(4) {
          width: 13%;
        }

        .workflow-page th:nth-child(5),
        .workflow-page td:nth-child(5) {
          width: 13%;
        }

        .workflow-page th:nth-child(6),
        .workflow-page td:nth-child(6) {
          width: 15%;
        }

        .workflow-page th:nth-child(7),
        .workflow-page td:nth-child(7) {
          width: 12%;
        }

        .workflow-page td .actions {
          justify-content: flex-start;
          gap: 8px;
        }

        .workflow-page td .small-button {
          min-width: 82px;
          text-align: center;
        }

        .workflow-page .panel {
          overflow: hidden;
        }

        .workflow-page .status-pill {
          justify-content: center;
        }

        @container ventiq-workspace (max-width: 900px) {
          .workflow-page .form-grid {
            grid-template-columns: 1fr;
          }

          .workflow-page .form-grid .field:nth-of-type(4),
          .workflow-page .form-grid .field:nth-of-type(5),
          .workflow-page .form-grid .field:nth-of-type(6) {
            grid-column: auto;
          }
        }
        .approval-list { display: grid; gap: 14px; }
        .approval-request-card { border: 1px solid rgba(147,197,253,.14); background: rgba(6,14,31,.48); border-radius: 20px; padding: 18px; transition: border-color .16s ease, background .16s ease; }
        .approval-request-card.is-selected { border-color: rgba(245,200,91,.42); background: rgba(12,24,48,.7); }
        .approval-request-card:hover { border-color: rgba(147,197,253,.3); }
        .approval-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }
        .approval-card-kicker { color: #93c5fd; font-size: 11px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 7px; }
        .approval-card-title { margin: 0; color: #f8fbff; font-size: 18px; line-height: 1.25; letter-spacing: -.025em; overflow-wrap: anywhere; }
        .approval-card-meta { display: flex; flex-wrap: wrap; gap: 7px 12px; margin-top: 9px; color: #9db3d7; font-size: 12px; }
        .approval-card-badges { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; flex-shrink: 0; }
        .status-awaiting-checker, .status-awaiting-final-approval { background: rgba(245,158,11,.18); color: #fde68a; }
        .approval-stage-track { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 10px; margin-top: 18px; }
        .approval-stage { min-width: 0; border: 1px solid rgba(147,197,253,.12); border-radius: 16px; padding: 13px; background: rgba(2,6,23,.3); }
        .approval-stage.complete { border-color: rgba(34,197,94,.25); background: rgba(22,163,74,.08); }
        .approval-stage.current { border-color: rgba(245,200,91,.38); background: rgba(245,200,91,.08); }
        .approval-stage.rejected { border-color: rgba(239,68,68,.28); background: rgba(239,68,68,.08); }
        .approval-stage-top { display: flex; align-items: center; gap: 8px; }
        .approval-stage-marker { display: inline-flex; align-items: center; justify-content: center; width: 23px; height: 23px; border-radius: 999px; border: 1px solid rgba(147,197,253,.2); color: #9db3d7; font-size: 12px; font-weight: 950; flex: 0 0 auto; }
        .approval-stage.complete .approval-stage-marker { border-color: rgba(34,197,94,.34); background: rgba(22,163,74,.18); color: #bbf7d0; }
        .approval-stage.current .approval-stage-marker { border-color: rgba(245,200,91,.42); background: rgba(245,200,91,.14); color: #fde68a; }
        .approval-stage.rejected .approval-stage-marker { border-color: rgba(239,68,68,.35); background: rgba(239,68,68,.14); color: #fecaca; }
        .approval-stage-label { color: #eef5ff; font-size: 12px; font-weight: 900; line-height: 1.3; }
        .approval-stage-person { display: block; margin-top: 9px; color: #c7d7f4; font-size: 12px; line-height: 1.35; overflow-wrap: anywhere; }
        .approval-stage-time { display: block; margin-top: 4px; color: #7890b7; font-size: 11px; }
        .approval-requested-by { margin-top: 14px; color: #9db3d7; font-size: 12px; line-height: 1.45; overflow-wrap: anywhere; }
        .approval-requested-by strong { color: #eaf2ff; font-weight: 850; }
        .approval-card-footer { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 12px; align-items: center; margin-top: 14px; }
        .approval-governance-note { display: grid; gap: 3px; min-width: 0; border-radius: 14px; padding: 11px 13px; border: 1px solid rgba(147,197,253,.12); background: rgba(2,6,23,.26); }
        .approval-governance-note strong { color: #f8fbff; font-size: 12px; }
        .approval-governance-note span { color: #9db3d7; font-size: 11px; line-height: 1.4; }
        .approval-governance-note.locked { border-color: rgba(245,200,91,.24); background: rgba(245,200,91,.06); }
        .approval-governance-note.action { border-color: rgba(96,165,250,.3); background: rgba(59,130,246,.08); }
        .approval-governance-note.complete { border-color: rgba(34,197,94,.24); background: rgba(22,163,74,.06); }
        .approval-governance-note.rejected { border-color: rgba(239,68,68,.24); background: rgba(239,68,68,.06); }
        .approval-card-actions { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 8px; }
        .approval-action-button { border: 1px solid rgba(147,197,253,.2); background: rgba(10,24,49,.72); color: #eaf2ff; border-radius: 11px; padding: 9px 12px; font: inherit; font-size: 12px; font-weight: 850; cursor: pointer; }
        .approval-action-button:hover { border-color: rgba(147,197,253,.42); background: rgba(18,40,78,.82); }
        .approval-action-button.primary { border-color: rgba(96,165,250,.42); background: rgba(37,99,235,.28); color: #dbeafe; }
        .approval-action-button.danger { border-color: rgba(248,113,113,.3); background: rgba(127,29,29,.2); color: #fecaca; }
        .approval-action-button:disabled { opacity: .55; cursor: wait; }
        .approval-detail-summary { display: grid; gap: 16px; }
        .approval-detail-header { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 14px; align-items: start; padding: 16px; border-radius: 18px; border: 1px solid rgba(147,197,253,.14); background: rgba(2,6,23,.3); }
        .approval-detail-header h3 { margin: 4px 0 0; color: #f8fbff; font-size: 19px; line-height: 1.3; }
        .approval-detail-grid { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 10px; }
        .approval-detail-field { min-width: 0; border: 1px solid rgba(147,197,253,.1); border-radius: 14px; padding: 12px; background: rgba(2,6,23,.22); }
        .approval-detail-field span { display: block; color: #7890b7; font-size: 10px; font-weight: 900; letter-spacing: .07em; text-transform: uppercase; margin-bottom: 6px; }
        .approval-detail-field strong { display: block; color: #eaf2ff; font-size: 12px; line-height: 1.4; overflow-wrap: anywhere; }
        .approval-detail-copy { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; }
        .approval-detail-copy > div, .approval-evidence-step { border: 1px solid rgba(147,197,253,.1); border-radius: 14px; padding: 13px; background: rgba(2,6,23,.22); }
        .approval-detail-copy strong { display: block; color: #c7d7f4; font-size: 11px; margin-bottom: 7px; }
        .approval-detail-copy p, .approval-evidence-step p { margin: 0; color: #9db3d7; font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
        .approval-evidence-track { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 10px; }
        .approval-evidence-step h4 { margin: 8px 0 0; color: #eef5ff; font-size: 14px; }
        .approval-evidence-step p { margin-top: 8px; font-size: 11px; line-height: 1.55; }
        @container ventiq-workspace (max-width: 760px) {
          .approval-card-head { flex-direction: column; }
          .approval-card-badges { justify-content: flex-start; }
          .approval-stage-track, .approval-detail-grid, .approval-detail-copy, .approval-evidence-track { grid-template-columns: 1fr; }
          .approval-card-footer, .approval-detail-header { grid-template-columns: 1fr; }
          .approval-card-actions { justify-content: flex-start; }
        }
        @container ventiq-workspace (max-width: 1100px) {
          .summary-grid,
          .main-grid,
          .step-grid,
          .action-grid {
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
        /* t2-ux1a1-density-refinement */
        .workflow-page .hero {
          padding: 24px 28px;
          margin-bottom: 14px;
        }
        .workflow-page .hero-top {
          align-items: center;
          gap: 20px;
        }
        .workflow-page .hero h1 {
          font-size: clamp(34px, 4vw, 52px);
          line-height: 1.02;
          margin-bottom: 10px;
        }
        .workflow-page .hero-copy {
          max-width: 840px;
          margin-top: 8px;
          font-size: 15px;
          line-height: 1.5;
        }
        .workflow-page .hero .actions {
          gap: 8px;
        }
        .workflow-page .hero .primary-button,
        .workflow-page .hero .secondary-button {
          min-height: 42px;
          padding: 9px 14px;
          border-radius: 12px;
          font-size: 12px;
        }
        .workflow-page .summary-grid {
          grid-template-columns: repeat(6, minmax(100px, 1fr));
          gap: 8px;
          margin-top: 16px;
        }
        .workflow-page .stat-card {
          padding: 12px 14px;
          border-radius: 14px;
        }
        .workflow-page .stat-card span {
          font-size: 10px;
          margin-bottom: 5px;
        }
        .workflow-page .stat-card strong {
          font-size: 20px;
        }
        .workflow-page .ribbon {
          padding: 9px 12px;
          margin-bottom: 14px;
          border-radius: 12px;
          border-color: rgba(147, 197, 253, 0.14);
          background: rgba(9, 18, 36, 0.72);
          color: #9db3d7;
          font-size: 11px;
          font-weight: 800;
          line-height: 1.4;
        }
        .workflow-page .main-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
          margin-bottom: 14px;
        }
        .workflow-page .main-grid > .panel {
          order: 1;
          margin-bottom: 0;
        }
        .workflow-page .main-grid > .form-card {
          order: 2;
          margin-bottom: 0;
        }
        .workflow-page .panel,
        .workflow-page .form-card {
          padding: 20px;
          margin-bottom: 14px;
        }
        .workflow-page .form-card {
          border-color: rgba(245, 200, 91, 0.18);
        }
        .workflow-page .form-card h2,
        .workflow-page .panel-header h2 {
          font-size: 22px;
        }
        .workflow-page .form-card p,
        .workflow-page .panel-header p {
          margin-top: 6px;
          font-size: 13px;
          line-height: 1.45;
        }
        .workflow-page .form-grid {
          gap: 12px;
          margin-top: 14px;
        }
        .workflow-page .field textarea {
          min-height: 84px;
        }
        .workflow-page .form-card .primary-button {
          min-width: 220px;
          height: 46px;
          font-size: 13px;
        }
        .queue-header-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          flex-wrap: wrap;
          gap: 8px;
        }
        .queue-create-button {
          white-space: nowrap;
        }
        .queue-message {
          flex-basis: 100%;
          margin-top: 2px;
          text-align: right;
        }
        .workflow-page .approval-list {
          gap: 10px;
        }
        .workflow-page .approval-request-card {
          padding: 16px;
          border-radius: 18px;
        }
        .workflow-page .approval-stage-track {
          gap: 8px;
          margin-top: 14px;
        }
        .workflow-page .approval-stage {
          padding: 11px;
          border-radius: 14px;
        }
        .workflow-page .approval-requested-by,
        .workflow-page .approval-card-footer {
          margin-top: 11px;
        }
        .workflow-page .approval-detail-summary {
          gap: 12px;
        }
        .workflow-page .approval-detail-header {
          padding: 13px;
          border-radius: 15px;
        }
        .workflow-page .approval-detail-grid,
        .workflow-page .approval-detail-copy,
        .workflow-page .approval-evidence-track {
          gap: 8px;
        }
        .workflow-page .approval-detail-field,
        .workflow-page .approval-detail-copy > div,
        .workflow-page .approval-evidence-step {
          padding: 10px 11px;
          border-radius: 12px;
        }
        .workflow-page .action-grid {
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 8px;
        }
        .workflow-page .action-card {
          min-width: 0;
          padding: 11px 12px;
          border-radius: 14px;
        }
        .workflow-page .action-card span {
          padding: 5px 7px;
          margin-bottom: 7px;
          font-size: 9px;
        }
        .workflow-page .action-card h3 {
          font-size: 13px;
          line-height: 1.3;
          overflow-wrap: anywhere;
        }
        .workflow-page .audit-list {
          gap: 7px;
        }
        .workflow-page .audit-item {
          padding: 10px 12px;
          border-radius: 13px;
        }
        .workflow-page .audit-item strong {
          margin-bottom: 3px;
          font-size: 13px;
          line-height: 1.35;
        }
        .workflow-page .audit-item p {
          font-size: 11px;
          line-height: 1.4;
        }
        .compact-readonly-card {
          padding: 15px 18px !important;
        }
        @container ventiq-workspace (max-width: 1100px) {
          .workflow-page .summary-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
          .workflow-page .action-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
          .queue-header-actions {
            justify-content: flex-start;
          }
        }
        @container ventiq-workspace (max-width: 760px) {
          .workflow-page .hero {
            padding: 18px;
          }
          .workflow-page .hero h1 {
            font-size: 34px;
          }
          .workflow-page .summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .workflow-page .action-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .queue-header-actions {
            justify-content: flex-start;
          }
          .queue-message {
            text-align: left;
          }
        }

`}</style>

      <section className="workflow-shell">
        <div className="hero">
          <div className="hero-top">
            <div>
              <p className="eyebrow">VENTIQ Control Layer</p>
              <h1>Audit Trail & Approval Workflow</h1>
              <p className="hero-copy">
                Server-authorised maker-checker control and auditable approval evidence for critical fund operations.
              </p>
            </div>
            <div className="actions">
              <Link className="primary-button" href="/workspace">My Workspace</Link>
              <Link className="secondary-button" href="/migration/activation">Fund Activation</Link>
              <Link className="secondary-button" href="/admin/data-protection">Data Protection</Link>
            </div>
          </div>

          <div className="summary-grid">
            <div className="stat-card"><span>Total requests</span><strong>{summary.total}</strong></div>
            <div className="stat-card"><span>Pending</span><strong>{summary.pending}</strong></div>
            <div className="stat-card"><span>Approved</span><strong>{summary.approved}</strong></div>
            <div className="stat-card"><span>Rejected</span><strong>{summary.rejected}</strong></div>
            <div className="stat-card"><span>High risk</span><strong>{summary.highRisk}</strong></div>
            <div className="stat-card"><span>Audit events</span><strong>{summary.auditEvents}</strong></div>
          </div>
        </div>

        <div className="ribbon">
          {loading ? "Loading secured workflow..." : dataMessage} | Maker submission | Checker review | Final approval | Audit evidence
        </div>

        <div className="main-grid">
          {capabilities.canCreate ? (
            showCreateForm ? (
              <form className="form-card" onSubmit={submitApprovalRequest}>
              <h2>Create Approval Request</h2>
              <p>
                The signed-in user becomes the recorded maker. Name, email and role are resolved on the server and cannot be spoofed by the form.
              </p>
              <div className="form-grid">
                <div className="field">
                  <label>Source Module</label>
                  <select value={approvalForm.sourceModule} onChange={(e) => updateApprovalForm("sourceModule", e.target.value)}>
                    <option>Debt LMS</option><option>Bank MIS</option><option>Fund Onboarding</option><option>Data Protection</option><option>Investor Portal</option><option>Document Studio</option><option>Compliance AI</option>
                  </select>
                </div>
                <div className="field">
                  <label>Linked Record ID</label>
                  <input
                    value={approvalForm.linkedRecordId}
                    onChange={(e) => updateApprovalForm("linkedRecordId", e.target.value)}
                    placeholder={
                      approvalForm.actionType === "Fund Memory Approval"
                        ? "Canonical snapshot UUID"
                        : approvalForm.actionType === "Capital Call Approval"
                        ? "Saved capital call UUID"
                        : "Optional for generic approval requests"
                    }
                  />
                  {(approvalForm.actionType === "Fund Memory Approval" ||
                    approvalForm.actionType === "Capital Call Approval") && (
                    <div className="field-hint">
                      Required for this approval type. The server validates the linked record and your governed fund access.
                    </div>
                  )}
                </div>

                <div className="field">
                  <label>Linked Record Type</label>
                  <select value={approvalForm.linkedRecordType} onChange={(e) => updateApprovalForm("linkedRecordType", e.target.value)}>
                    <option>Repayment Schedule</option><option>Bank Transaction</option><option>Stakeholder Access</option><option>Investor Notice</option><option>Capital Call</option><option>Distribution</option><option>Data Request</option><option>Covenant Breach</option><option>Security Tracker</option><option>Fund Memory Snapshot</option>
                  </select>
                </div>
                <div className="field">
                  <label>Action Type</label>
                  <select value={approvalForm.actionType} onChange={(e) => updateApprovalForm("actionType", e.target.value)}>
                    <option>Receipt Update</option><option>AI Mapping Approval</option><option>Penalty Waiver</option><option>Default Marking</option><option>Notice Dispatch</option><option>Investor Invite</option><option>Access Revocation</option><option>Capital Call Approval</option><option>Distribution Approval</option><option>Data Deletion Approval</option><option>Fund Memory Approval</option>
                  </select>
                </div>
                <div className="field">
                  <label>Action Title</label>
                  <input value={approvalForm.actionTitle} onChange={(e) => updateApprovalForm("actionTitle", e.target.value)} placeholder="Example: Approve repayment receipt update" />
                </div>
                <div className="field">
                  <label>Action Description</label>
                  <textarea value={approvalForm.actionDescription} onChange={(e) => updateApprovalForm("actionDescription", e.target.value)} placeholder="Explain what is being approved and why." />
                </div>
                <div className="field">
                  <label>Business Impact</label>
                  <textarea value={approvalForm.businessImpact} onChange={(e) => updateApprovalForm("businessImpact", e.target.value)} placeholder="Explain the downstream operational impact." />
                </div>
                <div className="field">
                  <label>Priority</label>
                  <select value={approvalForm.priority} onChange={(e) => updateApprovalForm("priority", e.target.value)}>
                    <option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
                  </select>
                </div>
                <button className="primary-button" disabled={saving} type="submit">{saving ? "Creating..." : "Create Approval Request"}</button>
                {formMessage && <div className="message">{formMessage}</div>}
              </div>
              </form>
            ) : null
          ) : (
            <div className="form-card compact-readonly-card">
              <h2>Read-only access</h2>
              <p>
                {actor
                  ? `${actor.fullName} is signed in as ${actor.role}. This role can review workflow evidence but cannot create maker requests.`
                  : "Sign in with an authorised internal VENTIQ role to use this workflow."}
              </p>
            </div>
          )}

          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Approval Queue</h2>
                <p>Governed requests scoped to your active organisation, with actions shown only when you can act.</p>
              </div>
              <div className="queue-header-actions">
                <span className={`status-pill ${summary.pending > 0 ? "status-pending" : "status-approved"}`}>{summary.pending} pending</span>
                {capabilities.canCreate && (
                  <button
                    className="approval-action-button primary queue-create-button"
                    onClick={() => setShowCreateForm((value) => !value)}
                    type="button"
                  >
                    {showCreateForm ? "Close request form" : "+ New approval request"}
                  </button>
                )}
                {actionMessage && <div className="message queue-message">{actionMessage}</div>}
              </div>
            </div>

            <div className="approval-list">
              {approvals.map((approval) => {
                const canAct = canActOnApproval(approval);
                const governance = governanceMessage(approval, canAct);
                const steps = approvalStepsFor(approval.id);
                const isSelected = selectedApprovalId === approval.id;
                const stages = ["Maker Submitted", "Checker Review", "Final Approval"] as const;
                return (
                  <article className={`approval-request-card${isSelected ? " is-selected" : ""}`} key={approval.id}>
                    <div className="approval-card-head">
                      <div>
                        <div className="approval-card-kicker">{approvalDisplayKicker(approval)}</div>
                        <h3 className="approval-card-title">{approvalDisplayTitle(approval)}</h3>
                        <div className="approval-card-meta">
                          <span>{approval.sourceModule}</span><span>{approval.actionType}</span><span>Requested {formatDate(approval.requestedAt)}</span>
                        </div>
                      </div>
                      <div className="approval-card-badges">
                        <span className={`status-pill status-${statusClass(approval.priority)}`}>{approval.priority}</span>
                        <span className={`status-pill status-${statusClass(workflowStatusLabel(approval))}`}>{workflowStatusLabel(approval)}</span>
                      </div>
                    </div>

                    <div className="approval-stage-track">
                      {stages.map((stageName) => {
                        const state = governanceStageState(approval, stageName);
                        const step = steps.find((item) => item.stepName === stageName);
                        const marker = state === "complete" ? "\u2713" : state === "current" ? "\u25CF" : state === "rejected" ? "!" : "\u25CB";
                        return (
                          <div className={`approval-stage ${state}`} key={stageName}>
                            <div className="approval-stage-top"><span className="approval-stage-marker">{marker}</span><span className="approval-stage-label">{governanceStageLabel(stageName, state)}</span></div>
                            <span className="approval-stage-person">{governanceStagePerson(approval, stageName, state)}</span>
                            {step?.actionedAt && <span className="approval-stage-time">{formatDate(step.actionedAt)}</span>}
                          </div>
                        );
                      })}
                    </div>

                    <div className="approval-requested-by">Requested by <strong>{approval.requestedByName || "Recorded maker"}</strong>{approval.requestedByEmail ? ` | ${approval.requestedByEmail}` : ""}</div>
                    <div className="approval-card-footer">
                      <div className={`approval-governance-note ${governance.tone}`}><strong>{governance.title}</strong><span>{governance.detail}</span></div>
                      <div className="approval-card-actions">
                        <button className="approval-action-button" onClick={() => setSelectedApprovalId(approval.id)} type="button">{isSelected ? "Details selected" : "View details"}</button>
                        {canAct && <>
                          <button className="approval-action-button danger" disabled={saving} onClick={() => updateApprovalStatus(approval, "Rejected")} type="button">Reject</button>
                          <button className="approval-action-button primary" disabled={saving} onClick={() => updateApprovalStatus(approval, "Approved")} type="button">{approval.currentStep === "Final Approval" ? "Final approve" : "Approve"}</button>
                        </>}
                      </div>
                    </div>
                  </article>
                );
              })}
              {!loading && approvals.length === 0 && <div className="control-box"><strong>No approval requests</strong>No approval requests are visible for your active organisation.</div>}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div><h2>Approval Details &amp; Evidence</h2><p>Decision context, governance path and authenticated action evidence for the selected request.</p></div>
            {selectedApproval && <span className={`status-pill status-${statusClass(workflowStatusLabel(selectedApproval))}`}>{workflowStatusLabel(selectedApproval)}</span>}
          </div>
          {selectedApproval ? (
            <div className="approval-detail-summary">
              <div className="approval-detail-header">
                <div><div className="approval-card-kicker">{approvalDisplayKicker(selectedApproval)}</div><h3>{approvalDisplayTitle(selectedApproval)}</h3></div>
                <span className={`status-pill status-${statusClass(selectedApproval.priority)}`}>{selectedApproval.priority}</span>
              </div>
              <div className="approval-detail-grid">
                <div className="approval-detail-field"><span>Source module</span><strong>{selectedApproval.sourceModule}</strong></div>
                <div className="approval-detail-field"><span>Action</span><strong>{selectedApproval.actionType}</strong></div>
                <div className="approval-detail-field"><span>Requested by</span><strong>{selectedApproval.requestedByName || "Recorded maker"}{selectedApproval.requestedByEmail ? ` | ${selectedApproval.requestedByEmail}` : ""}</strong></div>
                <div className="approval-detail-field"><span>Linked record</span><strong>{selectedApproval.linkedRecordId || "Not linked"}</strong></div>
              </div>
              <div className="approval-detail-copy">
                <div><strong>Decision context</strong><p>{selectedApproval.actionDescription || "No description provided."}</p></div>
                <div><strong>Business impact</strong><p>{selectedApproval.businessImpact || "Not provided."}</p></div>
              </div>
              <div className="approval-evidence-track">
                {selectedSteps.map((step) => <div className="approval-evidence-step" key={step.id}>
                  <span className={`status-pill status-${statusClass(step.stepStatus)}`}>{step.stepStatus}</span><h4>{step.stepName}</h4>
                  <p>Assigned role: {step.assignedRole || "Role-based"}<br />Assigned to: {step.assignedToName || "Role-based assignment"}<br />Actioned by: {step.actionedByName || "Not actioned"}{step.actionedByEmail ? ` | ${step.actionedByEmail}` : ""}<br />Actioned: {step.actionedAt ? formatDate(step.actionedAt) : "Pending"}</p>
                </div>)}
              </div>
            </div>
          ) : <div className="control-box"><strong>No approval selected</strong>Select View details on a governed request to inspect its decision evidence.</div>}
        </div>

        <div className="panel">
          <div className="panel-header"><div><h2>Critical Action Coverage</h2><p>Operational actions that can be routed into this enterprise control layer.</p></div></div>
          <div className="action-grid">
            {criticalActions.map((action) => <div className="action-card" key={action}><span>Controlled action</span><h3>{action}</h3></div>)}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header"><div><h2>Enterprise Audit Log</h2><p>Actor identity comes from the authenticated VENTIQ profile, not editable browser fields.</p></div></div>
          <div className="audit-list">
            {auditLogs.map((auditLog) => (
              <div className="audit-item" key={auditLog.id}>
                <strong>{auditLog.eventTitle}</strong>
                <p>{auditLog.eventDescription}<br />{auditLog.sourceModule} · {auditLog.actorName} · {auditLog.actorRole} · {formatDate(auditLog.createdAt)} · Risk: {auditLog.riskLevel}</p>
              </div>
            ))}
            {!loading && auditLogs.length === 0 && <div className="audit-item"><strong>No audit events yet</strong><p>Events will appear after secured workflow actions are performed.</p></div>}
          </div>
        </div>
      </section>
    </main>
  );
}
