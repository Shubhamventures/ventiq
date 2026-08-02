"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
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
  businessImpact: string;
};

const emptyApprovalForm: ApprovalForm = {
  sourceModule: "Debt LMS",
  linkedRecordType: "Repayment Schedule",
  actionType: "Receipt Update",
  actionTitle: "",
  actionDescription: "",
  requestedByName: "Finance Maker",
  requestedByEmail: "maker@useventiq.com",
  makerRole: "Finance Maker",
  checkerRole: "Finance Checker",
  approverRole: "Finance Head",
  priority: "Medium",
  businessImpact: "",
};

const sampleApprovals: ApprovalRequest[] = [
  {
    id: "approval-001",
    sourceModule: "Debt LMS",
    linkedRecordId: "loan-alpha-001",
    linkedRecordType: "Repayment Schedule",
    actionType: "Receipt Update",
    actionTitle: "Approve Alpha Fintech repayment receipt",
    actionDescription:
      "Receipt of principal and interest needs checker approval before schedule status is closed.",
    requestedByName: "Finance Maker",
    requestedByEmail: "maker@useventiq.com",
    makerRole: "Finance Maker",
    checkerRole: "Finance Checker",
    approverRole: "Finance Head",
    priority: "High",
    approvalStatus: "Pending Review",
    currentStep: "Checker Review",
    businessImpact: "Updates Debt LMS outstanding amount and collection status.",
    requestedAt: "2026-08-02",
    approvedAt: "",
    rejectedAt: "",
  },
  {
    id: "approval-002",
    sourceModule: "Bank MIS",
    linkedRecordId: "bank-match-001",
    linkedRecordType: "Bank Transaction",
    actionType: "AI Mapping Approval",
    actionTitle: "Approve bank receipt mapping to Debt LMS",
    actionDescription:
      "Bank MIS identified receipt as debt repayment. Approval will sync receipt to Debt LMS.",
    requestedByName: "Bank MIS AI",
    requestedByEmail: "ai@useventiq.com",
    makerRole: "AI System",
    checkerRole: "Finance Checker",
    approverRole: "Finance Head",
    priority: "Medium",
    approvalStatus: "Approved",
    currentStep: "Completed",
    businessImpact: "Creates approved receipt bridge for Debt LMS sync.",
    requestedAt: "2026-08-02",
    approvedAt: "2026-08-02",
    rejectedAt: "",
  },
  {
    id: "approval-003",
    sourceModule: "Fund Onboarding",
    linkedRecordId: "stakeholder-001",
    linkedRecordType: "Stakeholder Access",
    actionType: "Access Revocation",
    actionTitle: "Revoke external reviewer access",
    actionDescription:
      "External reviewer access needs approval before revocation is recorded.",
    requestedByName: "Fund Admin",
    requestedByEmail: "admin@useventiq.com",
    makerRole: "Fund Admin",
    checkerRole: "Compliance Officer",
    approverRole: "Managing Partner",
    priority: "Low",
    approvalStatus: "Rejected",
    currentStep: "Rejected",
    businessImpact: "Controls external stakeholder access to documents.",
    requestedAt: "2026-08-02",
    approvedAt: "",
    rejectedAt: "2026-08-02",
  },
];

const sampleSteps: ApprovalStep[] = [
  {
    id: "step-001",
    approvalRequestId: "approval-001",
    stepOrder: 1,
    stepName: "Maker Submitted",
    assignedRole: "Finance Maker",
    assignedToName: "Finance Maker",
    assignedToEmail: "maker@useventiq.com",
    stepStatus: "Completed",
    actionedByName: "Finance Maker",
    actionedByEmail: "maker@useventiq.com",
    actionedAt: "2026-08-02",
    comments: "Receipt update submitted for review.",
  },
  {
    id: "step-002",
    approvalRequestId: "approval-001",
    stepOrder: 2,
    stepName: "Checker Review",
    assignedRole: "Finance Checker",
    assignedToName: "Finance Checker",
    assignedToEmail: "checker@useventiq.com",
    stepStatus: "Pending",
    actionedByName: "",
    actionedByEmail: "",
    actionedAt: "",
    comments: "",
  },
  {
    id: "step-003",
    approvalRequestId: "approval-001",
    stepOrder: 3,
    stepName: "Final Approval",
    assignedRole: "Finance Head",
    assignedToName: "Finance Head",
    assignedToEmail: "finance.head@useventiq.com",
    stepStatus: "Pending",
    actionedByName: "",
    actionedByEmail: "",
    actionedAt: "",
    comments: "",
  },
];

const sampleAuditLogs: AuditLog[] = [
  {
    id: "audit-001",
    sourceModule: "Debt LMS",
    linkedRecordId: "loan-alpha-001",
    linkedRecordType: "Repayment Schedule",
    eventType: "Approval Requested",
    eventTitle: "Receipt update sent for approval",
    eventDescription:
      "Maker submitted Alpha Fintech repayment receipt for checker review.",
    actorName: "Finance Maker",
    actorEmail: "maker@useventiq.com",
    actorRole: "Finance Maker",
    eventStatus: "Recorded",
    riskLevel: "Medium",
    evidenceUrl: "",
    createdAt: "2026-08-02",
  },
  {
    id: "audit-002",
    sourceModule: "Bank MIS",
    linkedRecordId: "bank-match-001",
    linkedRecordType: "Bank Transaction",
    eventType: "Approved",
    eventTitle: "Bank mapping approved",
    eventDescription:
      "Bank receipt mapping was approved and made ready for Debt LMS sync.",
    actorName: "Finance Head",
    actorEmail: "finance.head@useventiq.com",
    actorRole: "Approver",
    eventStatus: "Recorded",
    riskLevel: "Low",
    evidenceUrl: "",
    createdAt: "2026-08-02",
  },
];

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
    currentStep: getString(row, ["current_step"], "Maker Submitted"),
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

export default function AuditWorkflowPage() {
  const [approvals, setApprovals] =
    useState<ApprovalRequest[]>(sampleApprovals);
  const [approvalSteps, setApprovalSteps] =
    useState<ApprovalStep[]>(sampleSteps);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(sampleAuditLogs);

  const [approvalForm, setApprovalForm] =
    useState<ApprovalForm>(emptyApprovalForm);
  const [selectedApprovalId, setSelectedApprovalId] = useState(
    sampleApprovals[0].id
  );

  const [loading, setLoading] = useState(true);
  const [dataMessage, setDataMessage] = useState(
    "Loading approval workflow..."
  );
  const [formMessage, setFormMessage] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadWorkflowData() {
      if (!isSupabaseConfigured || !supabase) {
        setDataMessage("Using sample workflow data. Supabase is not configured.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const db = supabase as any;

        const [approvalsResult, stepsResult, auditResult] = await Promise.all([
          db
            .from("ventiq_approval_requests")
            .select("*")
            .order("created_at", { ascending: false }),
          db
            .from("ventiq_approval_steps")
            .select("*")
            .order("step_order", { ascending: true }),
          db
            .from("ventiq_enterprise_audit_logs")
            .select("*")
            .order("created_at", { ascending: false }),
        ]);

        if (approvalsResult.error) throw new Error(approvalsResult.error.message);
        if (stepsResult.error) throw new Error(stepsResult.error.message);
        if (auditResult.error) throw new Error(auditResult.error.message);

        const nextApprovals =
          approvalsResult.data && approvalsResult.data.length > 0
            ? (approvalsResult.data as DataRow[]).map(mapApproval)
            : sampleApprovals;

        const nextSteps =
          stepsResult.data && stepsResult.data.length > 0
            ? (stepsResult.data as DataRow[]).map(mapStep)
            : sampleSteps;

        const nextAuditLogs =
          auditResult.data && auditResult.data.length > 0
            ? (auditResult.data as DataRow[]).map(mapAudit)
            : sampleAuditLogs;

        setApprovals(nextApprovals);
        setApprovalSteps(nextSteps);
        setAuditLogs(nextAuditLogs);
        setSelectedApprovalId(nextApprovals[0]?.id || sampleApprovals[0].id);

        setDataMessage(
          approvalsResult.data && approvalsResult.data.length > 0
            ? "Connected to Supabase approval workflow records."
            : "Approval workflow tables are ready. Showing sample data until requests are created."
        );
      } catch (error) {
        setDataMessage(
          error instanceof Error
            ? `Workflow database issue: ${error.message}`
            : "Unable to load workflow data. Showing sample data."
        );
        setApprovals(sampleApprovals);
        setApprovalSteps(sampleSteps);
        setAuditLogs(sampleAuditLogs);
      } finally {
        setLoading(false);
      }
    }

    loadWorkflowData();
  }, []);

  const selectedApproval =
    approvals.find((item) => item.id === selectedApprovalId) ??
    approvals[0] ??
    sampleApprovals[0];

  const selectedSteps = approvalSteps
    .filter((step) => step.approvalRequestId === selectedApproval.id)
    .sort((a, b) => a.stepOrder - b.stepOrder);

  const summary = useMemo(() => {
    const pending = approvals.filter((item) =>
      item.approvalStatus.toLowerCase().includes("pending")
    ).length;

    const approved = approvals.filter(
      (item) => item.approvalStatus === "Approved"
    ).length;

    const rejected = approvals.filter(
      (item) => item.approvalStatus === "Rejected"
    ).length;

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
    setApprovalForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  async function createAuditLog(payload: {
    sourceModule: string;
    linkedRecordId?: string;
    linkedRecordType?: string;
    eventType: string;
    eventTitle: string;
    eventDescription: string;
    actorName: string;
    actorEmail: string;
    actorRole: string;
    riskLevel: string;
  }) {
    const localAudit: AuditLog = {
      id: crypto.randomUUID(),
      sourceModule: payload.sourceModule,
      linkedRecordId: payload.linkedRecordId || "",
      linkedRecordType: payload.linkedRecordType || "",
      eventType: payload.eventType,
      eventTitle: payload.eventTitle,
      eventDescription: payload.eventDescription,
      actorName: payload.actorName,
      actorEmail: payload.actorEmail,
      actorRole: payload.actorRole,
      eventStatus: "Recorded",
      riskLevel: payload.riskLevel,
      evidenceUrl: "",
      createdAt: new Date().toISOString().slice(0, 10),
    };

    if (!isSupabaseConfigured || !supabase) {
      setAuditLogs((currentLogs) => [localAudit, ...currentLogs]);
      return;
    }

    try {
      const db = supabase as any;

      const { data, error } = await db
        .from("ventiq_enterprise_audit_logs")
        .insert({
          source_module: payload.sourceModule,
          linked_record_id: payload.linkedRecordId || null,
          linked_record_type: payload.linkedRecordType || null,
          event_type: payload.eventType,
          event_title: payload.eventTitle,
          event_description: payload.eventDescription,
          actor_name: payload.actorName,
          actor_email: payload.actorEmail,
          actor_role: payload.actorRole,
          event_status: "Recorded",
          risk_level: payload.riskLevel,
        })
        .select("*")
        .single();

      if (error) {
        setAuditLogs((currentLogs) => [localAudit, ...currentLogs]);
        return;
      }

      setAuditLogs((currentLogs) => [mapAudit(data as DataRow), ...currentLogs]);
    } catch {
      setAuditLogs((currentLogs) => [localAudit, ...currentLogs]);
    }
  }

  async function submitApprovalRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormMessage("");

    if (!approvalForm.actionTitle.trim()) {
      setFormMessage("Action title is required.");
      return;
    }

    if (!approvalForm.actionDescription.trim()) {
      setFormMessage("Action description is required.");
      return;
    }

    setSaving(true);

    const payload = {
      source_module: approvalForm.sourceModule,
      linked_record_id: crypto.randomUUID(),
      linked_record_type: approvalForm.linkedRecordType,
      action_type: approvalForm.actionType,
      action_title: approvalForm.actionTitle.trim(),
      action_description: approvalForm.actionDescription.trim(),
      requested_by_name: approvalForm.requestedByName,
      requested_by_email: approvalForm.requestedByEmail,
      maker_role: approvalForm.makerRole,
      checker_role: approvalForm.checkerRole,
      approver_role: approvalForm.approverRole,
      priority: approvalForm.priority,
      approval_status: "Pending Review",
      current_step: "Checker Review",
      business_impact: approvalForm.businessImpact,
    };

    try {
      let savedApproval: ApprovalRequest;

      if (!isSupabaseConfigured || !supabase) {
        savedApproval = {
          id: crypto.randomUUID(),
          sourceModule: payload.source_module,
          linkedRecordId: payload.linked_record_id,
          linkedRecordType: payload.linked_record_type,
          actionType: payload.action_type,
          actionTitle: payload.action_title,
          actionDescription: payload.action_description,
          requestedByName: payload.requested_by_name,
          requestedByEmail: payload.requested_by_email,
          makerRole: payload.maker_role,
          checkerRole: payload.checker_role,
          approverRole: payload.approver_role,
          priority: payload.priority,
          approvalStatus: payload.approval_status,
          currentStep: payload.current_step,
          businessImpact: payload.business_impact,
          requestedAt: new Date().toISOString().slice(0, 10),
          approvedAt: "",
          rejectedAt: "",
        };
      } else {
        const db = supabase as any;

        const { data, error } = await db
          .from("ventiq_approval_requests")
          .insert(payload)
          .select("*")
          .single();

        if (error) throw new Error(error.message);

        savedApproval = mapApproval(data as DataRow);

        await db.from("ventiq_approval_steps").insert([
          {
            approval_request_id: savedApproval.id,
            step_order: 1,
            step_name: "Maker Submitted",
            assigned_role: savedApproval.makerRole,
            assigned_to_name: savedApproval.requestedByName,
            assigned_to_email: savedApproval.requestedByEmail,
            step_status: "Completed",
            actioned_by_name: savedApproval.requestedByName,
            actioned_by_email: savedApproval.requestedByEmail,
            actioned_at: new Date().toISOString(),
            comments: "Request submitted by maker.",
          },
          {
            approval_request_id: savedApproval.id,
            step_order: 2,
            step_name: "Checker Review",
            assigned_role: savedApproval.checkerRole,
            assigned_to_name: "Finance Checker",
            assigned_to_email: "checker@useventiq.com",
            step_status: "Pending",
          },
          {
            approval_request_id: savedApproval.id,
            step_order: 3,
            step_name: "Final Approval",
            assigned_role: savedApproval.approverRole,
            assigned_to_name: "Approver",
            assigned_to_email: "approver@useventiq.com",
            step_status: "Pending",
          },
        ]);
      }

      const localSteps: ApprovalStep[] = [
        {
          id: crypto.randomUUID(),
          approvalRequestId: savedApproval.id,
          stepOrder: 1,
          stepName: "Maker Submitted",
          assignedRole: savedApproval.makerRole,
          assignedToName: savedApproval.requestedByName,
          assignedToEmail: savedApproval.requestedByEmail,
          stepStatus: "Completed",
          actionedByName: savedApproval.requestedByName,
          actionedByEmail: savedApproval.requestedByEmail,
          actionedAt: new Date().toISOString().slice(0, 10),
          comments: "Request submitted by maker.",
        },
        {
          id: crypto.randomUUID(),
          approvalRequestId: savedApproval.id,
          stepOrder: 2,
          stepName: "Checker Review",
          assignedRole: savedApproval.checkerRole,
          assignedToName: "Finance Checker",
          assignedToEmail: "checker@useventiq.com",
          stepStatus: "Pending",
          actionedByName: "",
          actionedByEmail: "",
          actionedAt: "",
          comments: "",
        },
        {
          id: crypto.randomUUID(),
          approvalRequestId: savedApproval.id,
          stepOrder: 3,
          stepName: "Final Approval",
          assignedRole: savedApproval.approverRole,
          assignedToName: "Approver",
          assignedToEmail: "approver@useventiq.com",
          stepStatus: "Pending",
          actionedByName: "",
          actionedByEmail: "",
          actionedAt: "",
          comments: "",
        },
      ];

      setApprovals((currentApprovals) => [savedApproval, ...currentApprovals]);
      setApprovalSteps((currentSteps) => [...localSteps, ...currentSteps]);
      setSelectedApprovalId(savedApproval.id);
      setApprovalForm(emptyApprovalForm);
      setFormMessage("Approval request created successfully.");

      await createAuditLog({
        sourceModule: savedApproval.sourceModule,
        linkedRecordId: savedApproval.linkedRecordId,
        linkedRecordType: savedApproval.linkedRecordType,
        eventType: "Approval Requested",
        eventTitle: savedApproval.actionTitle,
        eventDescription: savedApproval.actionDescription,
        actorName: savedApproval.requestedByName,
        actorEmail: savedApproval.requestedByEmail,
        actorRole: savedApproval.makerRole,
        riskLevel: savedApproval.priority,
      });
    } catch (error) {
      setFormMessage(
        error instanceof Error
          ? error.message
          : "Unable to create approval request."
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateApprovalStatus(
    approval: ApprovalRequest,
    nextStatus: "Approved" | "Rejected"
  ) {
    setActionMessage("");

    const now = new Date().toISOString();

    try {
      if (isSupabaseConfigured && supabase && !approval.id.startsWith("approval-")) {
        const db = supabase as any;

        const { error } = await db
          .from("ventiq_approval_requests")
          .update({
            approval_status: nextStatus,
            current_step: nextStatus === "Approved" ? "Completed" : "Rejected",
            approved_at: nextStatus === "Approved" ? now : null,
            rejected_at: nextStatus === "Rejected" ? now : null,
          })
          .eq("id", approval.id);

        if (error) throw new Error(error.message);

        await db
          .from("ventiq_approval_steps")
          .update({
            step_status: nextStatus === "Approved" ? "Completed" : "Rejected",
            actioned_by_name: "Finance Head",
            actioned_by_email: "finance.head@useventiq.com",
            actioned_at: now,
            comments:
              nextStatus === "Approved"
                ? "Approved through VENTIQ approval workflow."
                : "Rejected through VENTIQ approval workflow.",
          })
          .eq("approval_request_id", approval.id)
          .eq("step_status", "Pending");
      }

      setApprovals((currentApprovals) =>
        currentApprovals.map((item) =>
          item.id === approval.id
            ? {
                ...item,
                approvalStatus: nextStatus,
                currentStep: nextStatus === "Approved" ? "Completed" : "Rejected",
                approvedAt:
                  nextStatus === "Approved" ? now.slice(0, 10) : item.approvedAt,
                rejectedAt:
                  nextStatus === "Rejected" ? now.slice(0, 10) : item.rejectedAt,
              }
            : item
        )
      );

      setApprovalSteps((currentSteps) =>
        currentSteps.map((step) =>
          step.approvalRequestId === approval.id && step.stepStatus === "Pending"
            ? {
                ...step,
                stepStatus: nextStatus === "Approved" ? "Completed" : "Rejected",
                actionedByName: "Finance Head",
                actionedByEmail: "finance.head@useventiq.com",
                actionedAt: now.slice(0, 10),
                comments:
                  nextStatus === "Approved"
                    ? "Approved through VENTIQ approval workflow."
                    : "Rejected through VENTIQ approval workflow.",
              }
            : step
        )
      );

      await createAuditLog({
        sourceModule: approval.sourceModule,
        linkedRecordId: approval.linkedRecordId,
        linkedRecordType: approval.linkedRecordType,
        eventType: nextStatus,
        eventTitle: `${approval.actionTitle} ${nextStatus.toLowerCase()}`,
        eventDescription: `${approval.actionTitle} was ${nextStatus.toLowerCase()} by Finance Head.`,
        actorName: "Finance Head",
        actorEmail: "finance.head@useventiq.com",
        actorRole: "Approver",
        riskLevel: approval.priority,
      });

      setActionMessage(`${approval.actionTitle} marked as ${nextStatus}.`);
    } catch (error) {
      setActionMessage(
        error instanceof Error
          ? error.message
          : "Unable to update approval request."
      );
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
          grid-template-columns: 0.9fr 1.4fr;
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

        @media (max-width: 900px) {
          .workflow-page .form-grid {
            grid-template-columns: 1fr;
          }

          .workflow-page .form-grid .field:nth-of-type(4),
          .workflow-page .form-grid .field:nth-of-type(5),
          .workflow-page .form-grid .field:nth-of-type(6) {
            grid-column: auto;
          }
        }
        @media (max-width: 1100px) {
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
      `}</style>

      <section className="workflow-shell">
        <div className="hero">
          <div className="hero-top">
            <div>
              <p className="eyebrow">VENTIQ Control Layer</p>
              <h1>Audit Trail & Approval Workflow</h1>
              <p className="hero-copy">
                Central maker-checker and audit evidence layer for critical fund
                operations. Every important action can be submitted, reviewed,
                approved, rejected and logged before it impacts downstream
                modules.
              </p>
            </div>

            <div className="actions">
              <Link className="primary-button" href="/fund-onboarding">
                Fund Onboarding
              </Link>
              <Link className="secondary-button" href="/admin/data-protection">
                Data Protection
              </Link>
            </div>
          </div>

          <div className="summary-grid">
            <div className="stat-card">
              <span>Total requests</span>
              <strong>{summary.total}</strong>
            </div>

            <div className="stat-card">
              <span>Pending</span>
              <strong>{summary.pending}</strong>
            </div>

            <div className="stat-card">
              <span>Approved</span>
              <strong>{summary.approved}</strong>
            </div>

            <div className="stat-card">
              <span>Rejected</span>
              <strong>{summary.rejected}</strong>
            </div>

            <div className="stat-card">
              <span>High risk</span>
              <strong>{summary.highRisk}</strong>
            </div>

            <div className="stat-card">
              <span>Audit events</span>
              <strong>{summary.auditEvents}</strong>
            </div>
          </div>
        </div>

        <div className="ribbon">
          {loading ? "Loading approval workflow..." : dataMessage} ·
          Maker-checker controls → approval queue → immutable-style audit log →
          evidence trail
        </div>

        <div className="main-grid">
          <form className="form-card" onSubmit={submitApprovalRequest}>
            <h2>Create Approval Request</h2>
            <p>
              Simulate how Debt LMS, Bank MIS, onboarding and data protection
              actions enter a controlled approval workflow.
            </p>

            <div className="form-grid">
              <div className="field">
                <label>Source Module</label>
                <select
                  value={approvalForm.sourceModule}
                  onChange={(event) =>
                    updateApprovalForm("sourceModule", event.target.value)
                  }
                >
                  <option>Debt LMS</option>
                  <option>Bank MIS</option>
                  <option>Fund Onboarding</option>
                  <option>Data Protection</option>
                  <option>Investor Portal</option>
                  <option>Document Studio</option>
                  <option>Compliance AI</option>
                </select>
              </div>

              <div className="field">
                <label>Linked Record Type</label>
                <select
                  value={approvalForm.linkedRecordType}
                  onChange={(event) =>
                    updateApprovalForm("linkedRecordType", event.target.value)
                  }
                >
                  <option>Repayment Schedule</option>
                  <option>Bank Transaction</option>
                  <option>Stakeholder Access</option>
                  <option>Investor Notice</option>
                  <option>Capital Call</option>
                  <option>Distribution</option>
                  <option>Data Request</option>
                  <option>Covenant Breach</option>
                  <option>Security Tracker</option>
                </select>
              </div>

              <div className="field">
                <label>Action Type</label>
                <select
                  value={approvalForm.actionType}
                  onChange={(event) =>
                    updateApprovalForm("actionType", event.target.value)
                  }
                >
                  <option>Receipt Update</option>
                  <option>AI Mapping Approval</option>
                  <option>Penalty Waiver</option>
                  <option>Default Marking</option>
                  <option>Notice Dispatch</option>
                  <option>Investor Invite</option>
                  <option>Access Revocation</option>
                  <option>Capital Call Approval</option>
                  <option>Distribution Approval</option>
                  <option>Data Deletion Approval</option>
                </select>
              </div>

              <div className="field">
                <label>Action Title</label>
                <input
                  value={approvalForm.actionTitle}
                  onChange={(event) =>
                    updateApprovalForm("actionTitle", event.target.value)
                  }
                  placeholder="Example: Approve Alpha Fintech receipt update"
                />
              </div>

              <div className="field">
                <label>Action Description</label>
                <textarea
                  value={approvalForm.actionDescription}
                  onChange={(event) =>
                    updateApprovalForm("actionDescription", event.target.value)
                  }
                  placeholder="Explain what is being approved and why."
                />
              </div>

              <div className="field">
                <label>Business Impact</label>
                <textarea
                  value={approvalForm.businessImpact}
                  onChange={(event) =>
                    updateApprovalForm("businessImpact", event.target.value)
                  }
                  placeholder="Example: This updates outstanding amount and notice status in Debt LMS."
                />
              </div>

              <div className="field">
                <label>Priority</label>
                <select
                  value={approvalForm.priority}
                  onChange={(event) =>
                    updateApprovalForm("priority", event.target.value)
                  }
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                  <option>Critical</option>
                </select>
              </div>

              <button className="primary-button" disabled={saving} type="submit">
                {saving ? "Creating..." : "Create Approval Request"}
              </button>

              {formMessage && <div className="message">{formMessage}</div>}
            </div>
          </form>

          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Approval Queue</h2>
                <p>
                  Finance Head, Compliance Officer or Managing Partner can
                  review and approve controlled actions.
                </p>
              </div>

              {actionMessage && <span className="message">{actionMessage}</span>}
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Module</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Current Step</th>
                    <th>Requested By</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {approvals.map((approval) => (
                    <tr key={approval.id}>
                      <td>
                        <strong>{approval.actionTitle}</strong>
                        <br />
                        <span>{approval.actionType}</span>
                      </td>
                      <td>{approval.sourceModule}</td>
                      <td>
                        <span
                          className={`status-pill status-${statusClass(
                            approval.priority
                          )}`}
                        >
                          {approval.priority}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`status-pill status-${statusClass(
                            approval.approvalStatus
                          )}`}
                        >
                          {approval.approvalStatus}
                        </span>
                      </td>
                      <td>{approval.currentStep}</td>
                      <td>
                        {approval.requestedByName}
                        <br />
                        <span>{approval.requestedByEmail}</span>
                      </td>
                      <td>
                        <div className="actions">
                          <button
                            className="small-button"
                            onClick={() => setSelectedApprovalId(approval.id)}
                            type="button"
                          >
                            View
                          </button>

                          <button
                            className="small-button"
                            disabled={approval.approvalStatus === "Approved"}
                            onClick={() =>
                              updateApprovalStatus(approval, "Approved")
                            }
                            type="button"
                          >
                            Approve
                          </button>

                          <button
                            className="small-button danger"
                            disabled={approval.approvalStatus === "Rejected"}
                            onClick={() =>
                              updateApprovalStatus(approval, "Rejected")
                            }
                            type="button"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Selected Approval Evidence</h2>
              <p>
                Shows the exact maker-checker path for the selected approval
                request.
              </p>
            </div>

            <span
              className={`status-pill status-${statusClass(
                selectedApproval.approvalStatus
              )}`}
            >
              {selectedApproval.approvalStatus}
            </span>
          </div>

          <div className="control-box">
            <strong>{selectedApproval.actionTitle}</strong>
            {selectedApproval.actionDescription}
            <br />
            <br />
            Business impact: {selectedApproval.businessImpact || "Not provided"}
          </div>

          <div className="step-grid" style={{ marginTop: 16 }}>
            {selectedSteps.map((step) => (
              <div className="step-card" key={step.id}>
                <span>Step {step.stepOrder}</span>
                <h3>{step.stepName}</h3>
                <p>
                  Assigned role: {step.assignedRole}
                  <br />
                  Assigned to: {step.assignedToName || "Pending assignment"}
                  <br />
                  Status: {step.stepStatus}
                  <br />
                  Actioned by: {step.actionedByName || "Not actioned"}
                </p>
              </div>
            ))}

            {selectedSteps.length === 0 && (
              <div className="step-card">
                <span>No steps</span>
                <h3>Approval steps pending</h3>
                <p>Steps will appear after request creation.</p>
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Critical Action Coverage</h2>
              <p>
                These are the actions we should eventually wire from actual
                product modules into this approval engine.
              </p>
            </div>
          </div>

          <div className="action-grid">
            {criticalActions.map((action) => (
              <div className="action-card" key={action}>
                <span>Controlled</span>
                <h3>{action}</h3>
                <p>Should create approval request and audit log before final impact.</p>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Enterprise Audit Log</h2>
              <p>
                Complete evidence trail across Debt LMS, Bank MIS, onboarding,
                access and data protection workflows.
              </p>
            </div>
          </div>

          <div className="audit-list">
            {auditLogs.slice(0, 12).map((auditLog) => (
              <div className="audit-item" key={auditLog.id}>
                <strong>{auditLog.eventTitle}</strong>
                <p>
                  {auditLog.eventDescription}
                  <br />
                  {auditLog.sourceModule} · {auditLog.actorName} ·{" "}
                  {auditLog.actorRole} · {formatDate(auditLog.createdAt)} · Risk:{" "}
                  {auditLog.riskLevel}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}