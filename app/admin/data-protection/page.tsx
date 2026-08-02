"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../../lib/supabaseClient";

type DataRow = Record<string, unknown>;

type ProtectionControl = {
  id: string;
  controlArea: string;
  controlName: string;
  controlDescription: string;
  controlOwner: string;
  controlStatus: string;
  evidenceStatus: string;
  lastReviewedAt: string;
  nextReviewDue: string;
};

type SensitiveField = {
  id: string;
  moduleName: string;
  fieldName: string;
  dataCategory: string;
  sensitivityLevel: string;
  protectionMeasure: string;
  retentionPeriod: string;
  accessRoles: string;
};

type RetentionPolicy = {
  id: string;
  policyName: string;
  moduleName: string;
  retentionPeriod: string;
  deletionTrigger: string;
  policyStatus: string;
};

type IncidentRow = {
  id: string;
  incidentTitle: string;
  incidentType: string;
  severity: string;
  incidentStatus: string;
  reportedBy: string;
  reportedAt: string;
  description: string;
};

type DataRequestRow = {
  id: string;
  requesterName: string;
  requesterEmail: string;
  requestType: string;
  relatedModule: string;
  requestStatus: string;
  receivedAt: string;
  dueDate: string;
};

type AccessAuditRow = {
  id: string;
  eventType: string;
  eventTitle: string;
  eventDescription: string;
  actorName: string;
  actorEmail: string;
  createdAt: string;
};

type IncidentForm = {
  incidentTitle: string;
  incidentType: string;
  severity: string;
  reportedBy: string;
  description: string;
};

type DataRequestForm = {
  requesterName: string;
  requesterEmail: string;
  requestType: string;
  relatedModule: string;
};

const sampleControls: ProtectionControl[] = [
  {
    id: "ctrl-001",
    controlArea: "Access Control",
    controlName: "Role-based dashboard access",
    controlDescription:
      "Stakeholders should only access dashboards mapped to their role and fund/scheme scope.",
    controlOwner: "Fund Admin",
    controlStatus: "Implemented",
    evidenceStatus: "Evidence Available",
    lastReviewedAt: "2026-08-02",
    nextReviewDue: "2026-09-02",
  },
  {
    id: "ctrl-002",
    controlArea: "Authentication",
    controlName: "Secure invite link flow",
    controlDescription:
      "Users should set their own password through invite links. Passwords should not be shared manually.",
    controlOwner: "Implementation Admin",
    controlStatus: "Implemented",
    evidenceStatus: "Evidence Available",
    lastReviewedAt: "2026-08-02",
    nextReviewDue: "2026-09-02",
  },
  {
    id: "ctrl-003",
    controlArea: "Audit Trail",
    controlName: "Access and workflow event logs",
    controlDescription:
      "Key operational events should be recorded with actor, timestamp, module and event description.",
    controlOwner: "Compliance Officer",
    controlStatus: "In Progress",
    evidenceStatus: "Partial Evidence",
    lastReviewedAt: "2026-08-02",
    nextReviewDue: "2026-09-02",
  },
  {
    id: "ctrl-004",
    controlArea: "Data Segregation",
    controlName: "Fund and scheme-level isolation",
    controlDescription:
      "Client data should be logically segregated by fund, scheme and user role before real data onboarding.",
    controlOwner: "Product Admin",
    controlStatus: "Planned",
    evidenceStatus: "Pending Evidence",
    lastReviewedAt: "",
    nextReviewDue: "2026-09-15",
  },
];

const sampleSensitiveFields: SensitiveField[] = [
  {
    id: "field-001",
    moduleName: "Fund Onboarding",
    fieldName: "Stakeholder email",
    dataCategory: "Contact data",
    sensitivityLevel: "Personal Data",
    protectionMeasure: "Role access + invite flow + audit log",
    retentionPeriod: "Client contract period + legal retention",
    accessRoles: "Fund Admin, Compliance Officer",
  },
  {
    id: "field-002",
    moduleName: "Bank MIS",
    fieldName: "Bank narration / reference",
    dataCategory: "Financial transaction data",
    sensitivityLevel: "Confidential",
    protectionMeasure: "Restricted finance role access + audit log",
    retentionPeriod: "Fund accounting retention period",
    accessRoles: "Finance Head, Fund Admin, Auditor read-only",
  },
  {
    id: "field-003",
    moduleName: "Debt LMS",
    fieldName: "Borrower repayment schedule",
    dataCategory: "Commercial financial data",
    sensitivityLevel: "Confidential",
    protectionMeasure: "Role-based access + approval workflow",
    retentionPeriod: "Loan life + audit retention",
    accessRoles: "Finance Head, Investment Team, Managing Partner",
  },
  {
    id: "field-004",
    moduleName: "Investor Portal",
    fieldName: "Investor statements and notices",
    dataCategory: "Investor communication data",
    sensitivityLevel: "Personal / Confidential",
    protectionMeasure: "Investor-specific portal access + document logs",
    retentionPeriod: "Client contract period + regulatory retention",
    accessRoles: "Investor / LP, Investor Relations, Fund Admin",
  },
];

const sampleRetentionPolicies: RetentionPolicy[] = [
  {
    id: "ret-001",
    policyName: "Stakeholder access data retention",
    moduleName: "Fund Onboarding",
    retentionPeriod: "Client contract period + agreed archival period",
    deletionTrigger: "Client offboarding / access revocation / legal review",
    policyStatus: "Draft",
  },
  {
    id: "ret-002",
    policyName: "Bank MIS transaction data retention",
    moduleName: "Bank MIS",
    retentionPeriod: "Fund accounting and audit retention period",
    deletionTrigger: "Client offboarding subject to audit/legal hold",
    policyStatus: "Draft",
  },
  {
    id: "ret-003",
    policyName: "Debt LMS servicing data retention",
    moduleName: "Debt LMS",
    retentionPeriod: "Loan life + audit retention period",
    deletionTrigger: "Loan closure + client retention policy approval",
    policyStatus: "Draft",
  },
];

const sampleIncidents: IncidentRow[] = [
  {
    id: "inc-001",
    incidentTitle: "No active incidents",
    incidentType: "Readiness placeholder",
    severity: "Low",
    incidentStatus: "Closed",
    reportedBy: "VENTIQ Admin",
    reportedAt: "2026-08-02",
    description: "Placeholder incident row for readiness demonstration.",
  },
];

const sampleRequests: DataRequestRow[] = [
  {
    id: "req-001",
    requesterName: "Demo Investor",
    requesterEmail: "investor@example.com",
    requestType: "Access request",
    relatedModule: "Investor Portal",
    requestStatus: "Open",
    receivedAt: "2026-08-02",
    dueDate: "2026-08-09",
  },
];

const sampleAuditRows: AccessAuditRow[] = [
  {
    id: "audit-001",
    eventType: "Access Control",
    eventTitle: "Data Protection Console opened",
    eventDescription: "Fund Admin reviewed data protection and access readiness controls.",
    actorName: "VENTIQ Admin",
    actorEmail: "admin@useventiq.com",
    createdAt: "2026-08-02",
  },
];

const emptyIncidentForm: IncidentForm = {
  incidentTitle: "",
  incidentType: "Access issue",
  severity: "Medium",
  reportedBy: "VENTIQ Admin",
  description: "",
};

const emptyDataRequestForm: DataRequestForm = {
  requesterName: "",
  requesterEmail: "",
  requestType: "Access request",
  relatedModule: "Investor Portal",
};

function getString(row: DataRow, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = row[key];

    if (typeof value === "string" && value.trim()) {
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

function mapControl(row: DataRow): ProtectionControl {
  return {
    id: getString(row, ["id"], crypto.randomUUID()),
    controlArea: getString(row, ["control_area"], "Access Control"),
    controlName: getString(row, ["control_name"], "Control"),
    controlDescription: getString(row, ["control_description"], ""),
    controlOwner: getString(row, ["control_owner"], "Fund Admin"),
    controlStatus: getString(row, ["control_status"], "Planned"),
    evidenceStatus: getString(row, ["evidence_status"], "Pending Evidence"),
    lastReviewedAt: getDateString(row, ["last_reviewed_at"], ""),
    nextReviewDue: getDateString(row, ["next_review_due"], ""),
  };
}

function mapSensitiveField(row: DataRow): SensitiveField {
  return {
    id: getString(row, ["id"], crypto.randomUUID()),
    moduleName: getString(row, ["module_name"], "Module"),
    fieldName: getString(row, ["field_name"], "Field"),
    dataCategory: getString(row, ["data_category"], "Data"),
    sensitivityLevel: getString(row, ["sensitivity_level"], "Confidential"),
    protectionMeasure: getString(row, ["protection_measure"], "Role access"),
    retentionPeriod: getString(row, ["retention_period"], "Client policy"),
    accessRoles: getString(row, ["access_roles"], "Role based"),
  };
}

function mapRetentionPolicy(row: DataRow): RetentionPolicy {
  return {
    id: getString(row, ["id"], crypto.randomUUID()),
    policyName: getString(row, ["policy_name"], "Retention policy"),
    moduleName: getString(row, ["module_name"], "Module"),
    retentionPeriod: getString(row, ["retention_period"], "Client policy"),
    deletionTrigger: getString(row, ["deletion_trigger"], "Client approval"),
    policyStatus: getString(row, ["policy_status"], "Draft"),
  };
}

function mapIncident(row: DataRow): IncidentRow {
  return {
    id: getString(row, ["id"], crypto.randomUUID()),
    incidentTitle: getString(row, ["incident_title"], "Incident"),
    incidentType: getString(row, ["incident_type"], "Access issue"),
    severity: getString(row, ["severity"], "Medium"),
    incidentStatus: getString(row, ["incident_status"], "Open"),
    reportedBy: getString(row, ["reported_by"], "VENTIQ Admin"),
    reportedAt: getDateString(row, ["reported_at", "created_at"], ""),
    description: getString(row, ["description"], ""),
  };
}

function mapDataRequest(row: DataRow): DataRequestRow {
  return {
    id: getString(row, ["id"], crypto.randomUUID()),
    requesterName: getString(row, ["requester_name"], "Requester"),
    requesterEmail: getString(row, ["requester_email"], ""),
    requestType: getString(row, ["request_type"], "Access request"),
    relatedModule: getString(row, ["related_module"], "Investor Portal"),
    requestStatus: getString(row, ["request_status"], "Open"),
    receivedAt: getDateString(row, ["received_at", "created_at"], ""),
    dueDate: getDateString(row, ["due_date"], ""),
  };
}

function mapAudit(row: DataRow): AccessAuditRow {
  return {
    id: getString(row, ["id"], crypto.randomUUID()),
    eventType: getString(row, ["event_type"], "Audit"),
    eventTitle: getString(row, ["event_title"], "Audit event"),
    eventDescription: getString(row, ["event_description"], ""),
    actorName: getString(row, ["actor_name"], "VENTIQ Admin"),
    actorEmail: getString(row, ["actor_email"], "admin@useventiq.com"),
    createdAt: getDateString(row, ["created_at"], ""),
  };
}

export default function DataProtectionPage() {
  const [controls, setControls] = useState<ProtectionControl[]>(sampleControls);
  const [sensitiveFields, setSensitiveFields] =
    useState<SensitiveField[]>(sampleSensitiveFields);
  const [retentionPolicies, setRetentionPolicies] =
    useState<RetentionPolicy[]>(sampleRetentionPolicies);
  const [incidents, setIncidents] = useState<IncidentRow[]>(sampleIncidents);
  const [dataRequests, setDataRequests] =
    useState<DataRequestRow[]>(sampleRequests);
  const [auditRows, setAuditRows] = useState<AccessAuditRow[]>(sampleAuditRows);

  const [incidentForm, setIncidentForm] =
    useState<IncidentForm>(emptyIncidentForm);
  const [dataRequestForm, setDataRequestForm] =
    useState<DataRequestForm>(emptyDataRequestForm);

  const [loading, setLoading] = useState(true);
  const [dataMessage, setDataMessage] = useState(
    "Loading data protection workspace..."
  );
  const [incidentMessage, setIncidentMessage] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [controlMessage, setControlMessage] = useState("");
  const [isSavingIncident, setIsSavingIncident] = useState(false);
  const [isSavingRequest, setIsSavingRequest] = useState(false);

  useEffect(() => {
    async function loadDataProtectionWorkspace() {
      if (!isSupabaseConfigured || !supabase) {
        setDataMessage(
          "Using sample data protection controls. Supabase is not configured."
        );
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const db = supabase as any;

        const [
          controlsResult,
          fieldsResult,
          retentionResult,
          incidentsResult,
          requestsResult,
          auditResult,
        ] = await Promise.all([
          db.from("ventiq_data_protection_controls").select("*").order("created_at", { ascending: false }),
          db.from("ventiq_sensitive_data_register").select("*").order("created_at", { ascending: false }),
          db.from("ventiq_data_retention_policies").select("*").order("created_at", { ascending: false }),
          db.from("ventiq_incident_register").select("*").order("created_at", { ascending: false }),
          db.from("ventiq_data_requests").select("*").order("created_at", { ascending: false }),
          db.from("ventiq_access_audit_logs").select("*").order("created_at", { ascending: false }).limit(12),
        ]);

        if (controlsResult.error) throw new Error(controlsResult.error.message);
        if (fieldsResult.error) throw new Error(fieldsResult.error.message);
        if (retentionResult.error) throw new Error(retentionResult.error.message);
        if (incidentsResult.error) throw new Error(incidentsResult.error.message);
        if (requestsResult.error) throw new Error(requestsResult.error.message);
        if (auditResult.error) throw new Error(auditResult.error.message);

        setControls(
          controlsResult.data && controlsResult.data.length > 0
            ? (controlsResult.data as DataRow[]).map(mapControl)
            : sampleControls
        );
        setSensitiveFields(
          fieldsResult.data && fieldsResult.data.length > 0
            ? (fieldsResult.data as DataRow[]).map(mapSensitiveField)
            : sampleSensitiveFields
        );
        setRetentionPolicies(
          retentionResult.data && retentionResult.data.length > 0
            ? (retentionResult.data as DataRow[]).map(mapRetentionPolicy)
            : sampleRetentionPolicies
        );
        setIncidents(
          incidentsResult.data && incidentsResult.data.length > 0
            ? (incidentsResult.data as DataRow[]).map(mapIncident)
            : sampleIncidents
        );
        setDataRequests(
          requestsResult.data && requestsResult.data.length > 0
            ? (requestsResult.data as DataRow[]).map(mapDataRequest)
            : sampleRequests
        );
        setAuditRows(
          auditResult.data && auditResult.data.length > 0
            ? (auditResult.data as DataRow[]).map(mapAudit)
            : sampleAuditRows
        );
        setDataMessage("Connected to VENTIQ data protection records.");
      } catch (error) {
        setDataMessage(
          error instanceof Error
            ? `Data protection database issue: ${error.message}`
            : "Unable to load data protection workspace. Showing sample data."
        );
        setControls(sampleControls);
        setSensitiveFields(sampleSensitiveFields);
        setRetentionPolicies(sampleRetentionPolicies);
        setIncidents(sampleIncidents);
        setDataRequests(sampleRequests);
        setAuditRows(sampleAuditRows);
      } finally {
        setLoading(false);
      }
    }

    loadDataProtectionWorkspace();
  }, []);

  const summary = useMemo(() => {
    const implemented = controls.filter(
      (control) => control.controlStatus === "Implemented"
    ).length;
    const inProgress = controls.filter(
      (control) => control.controlStatus === "In Progress"
    ).length;
    const planned = controls.filter(
      (control) => control.controlStatus === "Planned"
    ).length;
    const openIncidents = incidents.filter(
      (incident) => incident.incidentStatus !== "Closed"
    ).length;
    const openRequests = dataRequests.filter(
      (request) => request.requestStatus !== "Closed"
    ).length;

    return {
      implemented,
      inProgress,
      planned,
      openIncidents,
      openRequests,
      totalSensitiveFields: sensitiveFields.length,
    };
  }, [controls, incidents, dataRequests, sensitiveFields]);

  function updateIncidentForm(field: keyof IncidentForm, value: string) {
    setIncidentForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  function updateDataRequestForm(field: keyof DataRequestForm, value: string) {
    setDataRequestForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  async function updateControlStatus(control: ProtectionControl, nextStatus: string) {
    setControlMessage("");

    try {
      if (isSupabaseConfigured && supabase && !control.id.startsWith("ctrl-")) {
        const db = supabase as any;
        const { error } = await db
          .from("ventiq_data_protection_controls")
          .update({
            control_status: nextStatus,
            last_reviewed_at: new Date().toISOString(),
          })
          .eq("id", control.id);

        if (error) throw new Error(error.message);
      }

      setControls((currentControls) =>
        currentControls.map((item) =>
          item.id === control.id
            ? {
                ...item,
                controlStatus: nextStatus,
                lastReviewedAt: new Date().toISOString().slice(0, 10),
              }
            : item
        )
      );

      setControlMessage(`${control.controlName} moved to ${nextStatus}.`);
    } catch (error) {
      setControlMessage(
        error instanceof Error ? error.message : "Unable to update control."
      );
    }
  }

  async function submitIncident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIncidentMessage("");

    if (!incidentForm.incidentTitle.trim()) {
      setIncidentMessage("Incident title is required.");
      return;
    }

    setIsSavingIncident(true);

    const payload = {
      incident_title: incidentForm.incidentTitle.trim(),
      incident_type: incidentForm.incidentType,
      severity: incidentForm.severity,
      incident_status: "Open",
      reported_by: incidentForm.reportedBy.trim() || "VENTIQ Admin",
      description: incidentForm.description.trim(),
      reported_at: new Date().toISOString(),
    };

    try {
      if (!isSupabaseConfigured || !supabase) {
        const localIncident: IncidentRow = {
          id: crypto.randomUUID(),
          incidentTitle: payload.incident_title,
          incidentType: payload.incident_type,
          severity: payload.severity,
          incidentStatus: payload.incident_status,
          reportedBy: payload.reported_by,
          reportedAt: new Date().toISOString().slice(0, 10),
          description: payload.description,
        };

        setIncidents((currentIncidents) => [localIncident, ...currentIncidents]);
        setIncidentForm(emptyIncidentForm);
        setIncidentMessage("Incident logged locally.");
        return;
      }

      const db = supabase as any;
      const { data, error } = await db
        .from("ventiq_incident_register")
        .insert(payload)
        .select("*")
        .single();

      if (error) throw new Error(error.message);

      setIncidents((currentIncidents) => [
        mapIncident(data as DataRow),
        ...currentIncidents,
      ]);
      setIncidentForm(emptyIncidentForm);
      setIncidentMessage("Incident logged successfully.");
    } catch (error) {
      setIncidentMessage(
        error instanceof Error ? error.message : "Unable to log incident."
      );
    } finally {
      setIsSavingIncident(false);
    }
  }

  async function submitDataRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestMessage("");

    if (!dataRequestForm.requesterName.trim()) {
      setRequestMessage("Requester name is required.");
      return;
    }

    if (!dataRequestForm.requesterEmail.trim()) {
      setRequestMessage("Requester email is required.");
      return;
    }

    setIsSavingRequest(true);

    const receivedDate = new Date();
    const dueDate = new Date(receivedDate);
    dueDate.setDate(receivedDate.getDate() + 7);

    const payload = {
      requester_name: dataRequestForm.requesterName.trim(),
      requester_email: dataRequestForm.requesterEmail.trim(),
      request_type: dataRequestForm.requestType,
      related_module: dataRequestForm.relatedModule,
      request_status: "Open",
      received_at: receivedDate.toISOString(),
      due_date: dueDate.toISOString().slice(0, 10),
    };

    try {
      if (!isSupabaseConfigured || !supabase) {
        const localRequest: DataRequestRow = {
          id: crypto.randomUUID(),
          requesterName: payload.requester_name,
          requesterEmail: payload.requester_email,
          requestType: payload.request_type,
          relatedModule: payload.related_module,
          requestStatus: payload.request_status,
          receivedAt: receivedDate.toISOString().slice(0, 10),
          dueDate: payload.due_date,
        };

        setDataRequests((currentRequests) => [localRequest, ...currentRequests]);
        setDataRequestForm(emptyDataRequestForm);
        setRequestMessage("Data request logged locally.");
        return;
      }

      const db = supabase as any;
      const { data, error } = await db
        .from("ventiq_data_requests")
        .insert(payload)
        .select("*")
        .single();

      if (error) throw new Error(error.message);

      setDataRequests((currentRequests) => [
        mapDataRequest(data as DataRow),
        ...currentRequests,
      ]);
      setDataRequestForm(emptyDataRequestForm);
      setRequestMessage("Data request logged successfully.");
    } catch (error) {
      setRequestMessage(
        error instanceof Error ? error.message : "Unable to log data request."
      );
    } finally {
      setIsSavingRequest(false);
    }
  }

  return (
    <main className="protection-page">
      <style>{`
        .protection-page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top left, rgba(37, 99, 235, 0.22), transparent 34rem),
            radial-gradient(circle at top right, rgba(245, 200, 91, 0.16), transparent 32rem),
            #07101f;
          color: #f8fbff;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          padding: 34px;
        }

        .protection-shell {
          max-width: 1280px;
          margin: 0 auto;
        }

        .hero,
        .panel,
        .stat-card,
        .control-card {
          border: 1px solid rgba(147, 197, 253, 0.16);
          background: rgba(15, 23, 42, 0.76);
          border-radius: 26px;
          box-shadow: 0 22px 70px rgba(0, 0, 0, 0.22);
        }

        .hero {
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
          max-width: 860px;
        }

        .actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .primary-link,
        .secondary-link,
        .small-button {
          border-radius: 999px;
          text-decoration: none;
          font-weight: 950;
          white-space: nowrap;
          border: 0;
          cursor: pointer;
          font-family: inherit;
        }

        .primary-link {
          background: #f5c85b;
          color: #07101f;
          padding: 12px 17px;
          font-size: 14px;
        }

        .secondary-link {
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
          padding: 19px;
        }

        .stat-card span {
          display: block;
          color: #9db3d7;
          font-size: 12px;
          margin-bottom: 8px;
        }

        .stat-card strong {
          display: block;
          font-size: 24px;
          letter-spacing: -0.04em;
        }

        .panel {
          padding: 24px;
          margin-bottom: 18px;
        }

        .panel-header {
          margin-bottom: 18px;
        }

        .panel-header h2 {
          margin: 0;
          font-size: 26px;
          letter-spacing: -0.04em;
        }

        .panel-header p {
          margin: 8px 0 0;
          color: #9db3d7;
          line-height: 1.55;
        }

        .control-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .control-card {
          padding: 18px;
        }

        .control-card-top {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          margin-bottom: 12px;
        }

        .control-card h3 {
          margin: 0;
          font-size: 19px;
        }

        .control-card p {
          color: #c7d7f4;
          line-height: 1.55;
          margin: 8px 0;
        }

        .status-pill {
          display: inline-flex;
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 11px;
          font-weight: 900;
          white-space: nowrap;
        }

        .status-implemented,
        .status-evidence-available,
        .status-closed {
          background: rgba(22, 163, 74, 0.24);
          color: #bbf7d0;
        }

        .status-in-progress,
        .status-partial-evidence,
        .status-open,
        .status-medium {
          background: rgba(245, 158, 11, 0.22);
          color: #fde68a;
        }

        .status-planned,
        .status-draft,
        .status-pending-evidence,
        .status-low {
          background: rgba(59, 130, 246, 0.22);
          color: #bfdbfe;
        }

        .status-high,
        .status-critical {
          background: rgba(239, 68, 68, 0.22);
          color: #fecaca;
        }

        .table-wrap {
          overflow-x: auto;
          border: 1px solid rgba(147, 197, 253, 0.14);
          border-radius: 20px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 920px;
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

        .two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
        }

        .form-grid {
          display: grid;
          gap: 12px;
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

        .go-live-box {
          border: 1px solid rgba(34, 197, 94, 0.26);
          background: rgba(22, 163, 74, 0.12);
          color: #bbf7d0;
          border-radius: 22px;
          padding: 18px;
          line-height: 1.55;
        }

        .go-live-box strong {
          display: block;
          color: #ffffff;
          margin-bottom: 8px;
          font-size: 18px;
        }

        @media (max-width: 1100px) {
          .summary-grid,
          .control-grid,
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

      <section className="protection-shell">
        <div className="hero">
          <div className="hero-top">
            <div>
              <p className="eyebrow">VENTIQ Trust Layer</p>
              <h1>Data Protection & Access Governance</h1>
              <p className="hero-copy">
                A client-facing control console for data protection readiness,
                role-based access governance, sensitive field mapping, retention,
                incidents and audit evidence. This is the trust layer required
                before moving from demo to pilot onboarding.
              </p>
            </div>

            <div className="actions">
              <Link className="primary-link" href="/fund-onboarding">
                Fund Onboarding
              </Link>
              <Link className="secondary-link" href="/debt-lms">
                Debt LMS
              </Link>
              <Link className="secondary-link" href="/bank-reconciliation">
                Bank MIS
              </Link>
            </div>
          </div>

          <div className="summary-grid">
            <div className="stat-card">
              <span>Implemented</span>
              <strong>{summary.implemented}</strong>
            </div>
            <div className="stat-card">
              <span>In progress</span>
              <strong>{summary.inProgress}</strong>
            </div>
            <div className="stat-card">
              <span>Planned</span>
              <strong>{summary.planned}</strong>
            </div>
            <div className="stat-card">
              <span>Sensitive fields</span>
              <strong>{summary.totalSensitiveFields}</strong>
            </div>
            <div className="stat-card">
              <span>Open incidents</span>
              <strong>{summary.openIncidents}</strong>
            </div>
            <div className="stat-card">
              <span>Open requests</span>
              <strong>{summary.openRequests}</strong>
            </div>
          </div>
        </div>

        <div className="ribbon">
          {loading ? "Loading data protection workspace..." : dataMessage} ·
          SEBI-aligned controls → DPDP-ready workflows → audit evidence → pilot
          onboarding readiness
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Control Register</h2>
              <p>
                Tracks product controls required for role-based access, secure
                onboarding, audit trail, retention and incident governance.
              </p>
            </div>
            {controlMessage && <span className="message">{controlMessage}</span>}
          </div>

          <div className="control-grid">
            {controls.map((control) => (
              <div className="control-card" key={control.id}>
                <div className="control-card-top">
                  <div>
                    <span className={`status-pill status-${statusClass(control.controlArea)}`}>
                      {control.controlArea}
                    </span>
                    <h3>{control.controlName}</h3>
                  </div>
                  <span className={`status-pill status-${statusClass(control.controlStatus)}`}>
                    {control.controlStatus}
                  </span>
                </div>
                <p>{control.controlDescription}</p>
                <p>
                  Owner: <strong>{control.controlOwner}</strong>
                  <br />
                  Evidence: <strong>{control.evidenceStatus}</strong>
                  <br />
                  Last review: <strong>{formatDate(control.lastReviewedAt)}</strong>
                </p>
                <div className="actions">
                  <button
                    className="small-button"
                    onClick={() => updateControlStatus(control, "Implemented")}
                    type="button"
                  >
                    Mark Implemented
                  </button>
                  <button
                    className="small-button"
                    onClick={() => updateControlStatus(control, "In Progress")}
                    type="button"
                  >
                    In Progress
                  </button>
                  <button
                    className="small-button"
                    onClick={() => updateControlStatus(control, "Planned")}
                    type="button"
                  >
                    Planned
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Sensitive Data Register</h2>
              <p>
                Identifies sensitive fields across modules and explains how each
                field is protected and who can access it.
              </p>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Field</th>
                  <th>Category</th>
                  <th>Sensitivity</th>
                  <th>Protection</th>
                  <th>Retention</th>
                  <th>Access roles</th>
                </tr>
              </thead>
              <tbody>
                {sensitiveFields.map((field) => (
                  <tr key={field.id}>
                    <td>{field.moduleName}</td>
                    <td><strong>{field.fieldName}</strong></td>
                    <td>{field.dataCategory}</td>
                    <td>
                      <span className={`status-pill status-${statusClass(field.sensitivityLevel)}`}>
                        {field.sensitivityLevel}
                      </span>
                    </td>
                    <td>{field.protectionMeasure}</td>
                    <td>{field.retentionPeriod}</td>
                    <td>{field.accessRoles}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="two-col">
          <form className="panel" onSubmit={submitIncident}>
            <div className="panel-header">
              <div>
                <h2>Incident Register</h2>
                <p>Log access, data, cyber or operational incidents.</p>
              </div>
            </div>

            <div className="form-grid">
              <div className="field">
                <label>Incident Title</label>
                <input
                  value={incidentForm.incidentTitle}
                  onChange={(event) =>
                    updateIncidentForm("incidentTitle", event.target.value)
                  }
                  placeholder="Example: Incorrect dashboard access"
                />
              </div>

              <div className="field">
                <label>Incident Type</label>
                <select
                  value={incidentForm.incidentType}
                  onChange={(event) =>
                    updateIncidentForm("incidentType", event.target.value)
                  }
                >
                  <option>Access issue</option>
                  <option>Data issue</option>
                  <option>Cyber event</option>
                  <option>Operational incident</option>
                  <option>Client request</option>
                </select>
              </div>

              <div className="field">
                <label>Severity</label>
                <select
                  value={incidentForm.severity}
                  onChange={(event) =>
                    updateIncidentForm("severity", event.target.value)
                  }
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                  <option>Critical</option>
                </select>
              </div>

              <div className="field">
                <label>Reported By</label>
                <input
                  value={incidentForm.reportedBy}
                  onChange={(event) =>
                    updateIncidentForm("reportedBy", event.target.value)
                  }
                />
              </div>

              <div className="field">
                <label>Description</label>
                <textarea
                  value={incidentForm.description}
                  onChange={(event) =>
                    updateIncidentForm("description", event.target.value)
                  }
                  placeholder="What happened, who is impacted, what action is needed?"
                />
              </div>

              <button
                className="primary-link"
                disabled={isSavingIncident}
                type="submit"
              >
                {isSavingIncident ? "Logging..." : "Log Incident"}
              </button>

              {incidentMessage && <div className="message">{incidentMessage}</div>}
            </div>
          </form>

          <form className="panel" onSubmit={submitDataRequest}>
            <div className="panel-header">
              <div>
                <h2>Data Request Tracker</h2>
                <p>Track access, correction, export or deletion requests.</p>
              </div>
            </div>

            <div className="form-grid">
              <div className="field">
                <label>Requester Name</label>
                <input
                  value={dataRequestForm.requesterName}
                  onChange={(event) =>
                    updateDataRequestForm("requesterName", event.target.value)
                  }
                  placeholder="Investor / stakeholder name"
                />
              </div>

              <div className="field">
                <label>Requester Email</label>
                <input
                  type="email"
                  value={dataRequestForm.requesterEmail}
                  onChange={(event) =>
                    updateDataRequestForm("requesterEmail", event.target.value)
                  }
                  placeholder="requester@example.com"
                />
              </div>

              <div className="field">
                <label>Request Type</label>
                <select
                  value={dataRequestForm.requestType}
                  onChange={(event) =>
                    updateDataRequestForm("requestType", event.target.value)
                  }
                >
                  <option>Access request</option>
                  <option>Correction request</option>
                  <option>Export request</option>
                  <option>Deletion request</option>
                  <option>Consent / notice query</option>
                </select>
              </div>

              <div className="field">
                <label>Related Module</label>
                <select
                  value={dataRequestForm.relatedModule}
                  onChange={(event) =>
                    updateDataRequestForm("relatedModule", event.target.value)
                  }
                >
                  <option>Investor Portal</option>
                  <option>Fund Onboarding</option>
                  <option>Debt LMS</option>
                  <option>Bank MIS</option>
                  <option>Document Studio</option>
                </select>
              </div>

              <button
                className="primary-link"
                disabled={isSavingRequest}
                type="submit"
              >
                {isSavingRequest ? "Logging..." : "Log Data Request"}
              </button>

              {requestMessage && <div className="message">{requestMessage}</div>}
            </div>
          </form>
        </div>

        <div className="two-col">
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Retention Policy Register</h2>
                <p>Module-level retention and deletion trigger tracking.</p>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Policy</th>
                    <th>Module</th>
                    <th>Retention</th>
                    <th>Deletion Trigger</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {retentionPolicies.map((policy) => (
                    <tr key={policy.id}>
                      <td><strong>{policy.policyName}</strong></td>
                      <td>{policy.moduleName}</td>
                      <td>{policy.retentionPeriod}</td>
                      <td>{policy.deletionTrigger}</td>
                      <td>
                        <span className={`status-pill status-${statusClass(policy.policyStatus)}`}>
                          {policy.policyStatus}
                        </span>
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
                <h2>Access Audit Evidence</h2>
                <p>Recent access and implementation events.</p>
              </div>
            </div>

            <div className="audit-list">
              {auditRows.slice(0, 8).map((audit) => (
                <div className="audit-item" key={audit.id}>
                  <strong>{audit.eventTitle}</strong>
                  <p>
                    {audit.eventDescription}
                    <br />
                    {audit.actorName} · {audit.actorEmail} · {formatDate(audit.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Commercial Readiness Positioning</h2>
              <p>
                Use this language in client conversations until legal/security
                review is complete.
              </p>
            </div>
          </div>

          <div className="go-live-box">
            <strong>Correct positioning</strong>
            VENTIQ is building SEBI-aligned and DPDP-ready controls for access
            governance, role-based dashboards, audit logs, incident tracking,
            retention visibility and secure stakeholder onboarding. Do not call
            the product “SEBI compliant” until reviewed by a qualified legal and
            cybersecurity professional.
          </div>
        </div>
      </section>
    </main>
  );
}