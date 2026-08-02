"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../../lib/supabaseClient";

type DataRow = Record<string, unknown>;

type PilotClient = {
  id: string;
  clientName: string;
  fundType: string;
  jurisdiction: string;
  pilotStage: string;
  dataMode: string;
  targetOnboardingDate: string;
  readinessScore: number;
  riskStatus: string;
  primaryContactName: string;
  primaryContactEmail: string;
  selectedModules: string[];
  createdAt: string;
};

type ReadinessItem = {
  id: string;
  clientId: string;
  readinessArea: string;
  checklistItem: string;
  ownerRole: string;
  priority: string;
  readinessStatus: string;
  evidenceNotes: string;
  dueDate: string;
};

type ClientForm = {
  clientName: string;
  fundType: string;
  jurisdiction: string;
  pilotStage: string;
  dataMode: string;
  targetOnboardingDate: string;
  riskStatus: string;
  primaryContactName: string;
  primaryContactEmail: string;
};

type ReadinessForm = {
  readinessArea: string;
  checklistItem: string;
  ownerRole: string;
  priority: string;
  readinessStatus: string;
  evidenceNotes: string;
  dueDate: string;
};

const emptyClientForm: ClientForm = {
  clientName: "",
  fundType: "Category II AIF",
  jurisdiction: "India",
  pilotStage: "Discovery",
  dataMode: "Demo Data",
  targetOnboardingDate: "",
  riskStatus: "Medium",
  primaryContactName: "",
  primaryContactEmail: "",
};

const emptyReadinessForm: ReadinessForm = {
  readinessArea: "Client Data",
  checklistItem: "",
  ownerRole: "VENTIQ Admin",
  priority: "Medium",
  readinessStatus: "Pending",
  evidenceNotes: "",
  dueDate: "",
};

const moduleOptions = [
  "Debt LMS",
  "Bank MIS",
  "Fund Onboarding",
  "Data Protection Console",
  "Audit Workflow",
  "Document Studio",
  "Investor Portal",
  "Finance Head Dashboard",
];

const defaultChecklistTemplates = [
  {
    readinessArea: "Legal / Commercial",
    checklistItem: "NDA signed before receiving client-sensitive data",
    ownerRole: "Founder / Legal",
    priority: "High",
  },
  {
    readinessArea: "Legal / Commercial",
    checklistItem: "Pilot scope agreed with modules, users and data mode",
    ownerRole: "Founder",
    priority: "High",
  },
    {
    readinessArea: "Client Data",
    checklistItem: "Migration Workspace opened and required data sets selected",
    ownerRole: "VENTIQ Admin / Client Finance Team",
    priority: "High",
  },
  {
    readinessArea: "Client Data",
    checklistItem: "Required source files uploaded or marked as not applicable in Migration Workspace",
    ownerRole: "Client Finance Team",
    priority: "High",
  },
  {
    readinessArea: "Client Data",
    checklistItem: "Migration mapping reviewed before activating Debt LMS, Bank MIS or Investor Portal",
    ownerRole: "VENTIQ Admin / Product",
    priority: "High",
  },
  {
    readinessArea: "Access",
    checklistItem: "Stakeholder roles mapped to dashboards",
    ownerRole: "VENTIQ Admin",
    priority: "Medium",
  },
  {
    readinessArea: "Access",
    checklistItem: "Secure invite flow tested with one internal user",
    ownerRole: "VENTIQ Admin",
    priority: "High",
  },
  {
    readinessArea: "Security",
    checklistItem: "Demo / sample / limited real data mode confirmed",
    ownerRole: "Founder",
    priority: "High",
  },
  {
    readinessArea: "Security",
    checklistItem: "No passwords shared manually with stakeholders",
    ownerRole: "VENTIQ Admin",
    priority: "Critical",
  },
  {
    readinessArea: "Product",
    checklistItem: "Debt LMS demo flow tested end-to-end",
    ownerRole: "Product",
    priority: "High",
  },
  {
    readinessArea: "Product",
    checklistItem: "Bank MIS demo flow tested end-to-end",
    ownerRole: "Product",
    priority: "High",
  },
  {
    readinessArea: "Controls",
    checklistItem: "Audit workflow tested for approval and rejection",
    ownerRole: "Product",
    priority: "Medium",
  },
  {
    readinessArea: "Controls",
    checklistItem: "Data protection console reviewed before pilot",
    ownerRole: "Compliance / Founder",
    priority: "Medium",
  },
];

const sampleClients: PilotClient[] = [
  {
    id: "client-001",
    clientName: "Demo Private Credit Fund",
    fundType: "Category II AIF",
    jurisdiction: "India",
    pilotStage: "Controlled Pilot",
    dataMode: "Sample Client Data",
    targetOnboardingDate: "2026-08-15",
    readinessScore: 62,
    riskStatus: "Medium",
    primaryContactName: "Finance Head",
    primaryContactEmail: "finance@example.com",
    selectedModules: ["Debt LMS", "Bank MIS", "Audit Workflow"],
    createdAt: "2026-08-02",
  },
];

const sampleItems: ReadinessItem[] = defaultChecklistTemplates.map((item, index) => ({
  id: `item-${index + 1}`,
  clientId: "client-001",
  readinessArea: item.readinessArea,
  checklistItem: item.checklistItem,
  ownerRole: item.ownerRole,
  priority: item.priority,
  readinessStatus: index < 6 ? "Completed" : "Pending",
  evidenceNotes:
    index < 6 ? "Demo evidence available for walkthrough." : "Pending before paid pilot.",
  dueDate: "2026-08-10",
}));

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

    if (typeof value === "number" && Number.isFinite(value)) return value;

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

function getStringArray(row: DataRow, keys: string[], fallback: string[] = []) {
  for (const key of keys) {
    const value = row[key];

    if (Array.isArray(value)) {
      return value.filter((item) => typeof item === "string") as string[];
    }
  }

  return fallback;
}

function formatDate(value: string) {
  if (!value) return "Not set";

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

function mapClient(row: DataRow): PilotClient {
  return {
    id: getString(row, ["id"], crypto.randomUUID()),
    clientName: getString(row, ["client_name"], "Unnamed Client"),
    fundType: getString(row, ["fund_type"], "AIF"),
    jurisdiction: getString(row, ["jurisdiction"], "India"),
    pilotStage: getString(row, ["pilot_stage"], "Discovery"),
    dataMode: getString(row, ["data_mode"], "Demo Data"),
    targetOnboardingDate: getDateString(row, ["target_onboarding_date"], ""),
    readinessScore: getNumber(row, ["readiness_score"], 0),
    riskStatus: getString(row, ["risk_status"], "Medium"),
    primaryContactName: getString(row, ["primary_contact_name"], ""),
    primaryContactEmail: getString(row, ["primary_contact_email"], ""),
    selectedModules: getStringArray(row, ["selected_modules"], []),
    createdAt: getDateString(row, ["created_at"], ""),
  };
}

function mapReadinessItem(row: DataRow): ReadinessItem {
  return {
    id: getString(row, ["id"], crypto.randomUUID()),
    clientId: getString(row, ["client_id"], ""),
    readinessArea: getString(row, ["readiness_area"], "General"),
    checklistItem: getString(row, ["checklist_item"], "Checklist item"),
    ownerRole: getString(row, ["owner_role"], "VENTIQ Admin"),
    priority: getString(row, ["priority"], "Medium"),
    readinessStatus: getString(row, ["readiness_status"], "Pending"),
    evidenceNotes: getString(row, ["evidence_notes"], ""),
    dueDate: getDateString(row, ["due_date"], ""),
  };
}

function getReadinessScore(items: ReadinessItem[]) {
  if (items.length === 0) return 0;

  const completed = items.filter(
    (item) => item.readinessStatus === "Completed"
  ).length;

  return Math.round((completed / items.length) * 100);
}

function getPilotDecision(score: number, blockers: number) {
  if (blockers > 0) return "Not ready for real data";
  if (score >= 85) return "Ready for controlled pilot";
  if (score >= 65) return "Ready for guided demo";
  return "Discovery / setup pending";
}

export default function ClientReadinessPage() {
  const [clients, setClients] = useState<PilotClient[]>(sampleClients);
  const [items, setItems] = useState<ReadinessItem[]>(sampleItems);
  const [selectedClientId, setSelectedClientId] = useState(sampleClients[0].id);

  const [clientForm, setClientForm] = useState<ClientForm>(emptyClientForm);
  const [readinessForm, setReadinessForm] =
    useState<ReadinessForm>(emptyReadinessForm);

  const [loading, setLoading] = useState(true);
  const [dataMessage, setDataMessage] = useState(
    "Loading client readiness center..."
  );
  const [clientMessage, setClientMessage] = useState("");
  const [itemMessage, setItemMessage] = useState("");
  const [savingClient, setSavingClient] = useState(false);
  const [savingItem, setSavingItem] = useState(false);

  useEffect(() => {
    async function loadReadinessData() {
      if (!isSupabaseConfigured || !supabase) {
        setDataMessage("Using sample readiness data. Supabase is not configured.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const db = supabase as any;

        const [clientsResult, itemsResult] = await Promise.all([
          db
            .from("ventiq_pilot_clients")
            .select("*")
            .order("created_at", { ascending: false }),

          db
            .from("ventiq_client_readiness_items")
            .select("*")
            .order("created_at", { ascending: false }),
        ]);

        if (clientsResult.error) throw new Error(clientsResult.error.message);
        if (itemsResult.error) throw new Error(itemsResult.error.message);

        const nextClients =
          clientsResult.data && clientsResult.data.length > 0
            ? (clientsResult.data as DataRow[]).map(mapClient)
            : sampleClients;

        const nextItems =
          itemsResult.data && itemsResult.data.length > 0
            ? (itemsResult.data as DataRow[]).map(mapReadinessItem)
            : sampleItems;

        setClients(nextClients);
        setItems(nextItems);
        setSelectedClientId(nextClients[0]?.id || sampleClients[0].id);

        setDataMessage(
          clientsResult.data && clientsResult.data.length > 0
            ? "Connected to Supabase client readiness records."
            : "Readiness tables are ready. Showing sample data until a pilot client is created."
        );
      } catch (error) {
        setDataMessage(
          error instanceof Error
            ? `Client readiness database issue: ${error.message}`
            : "Unable to load readiness data. Showing sample data."
        );
        setClients(sampleClients);
        setItems(sampleItems);
      } finally {
        setLoading(false);
      }
    }

    loadReadinessData();
  }, []);

  const selectedClient =
    clients.find((client) => client.id === selectedClientId) ??
    clients[0] ??
    sampleClients[0];

  const selectedItems = items.filter((item) => item.clientId === selectedClient.id);

  const score = getReadinessScore(selectedItems);

  const blockers = selectedItems.filter(
    (item) =>
      item.priority === "Critical" && item.readinessStatus !== "Completed"
  ).length;

  const decision = getPilotDecision(score, blockers);

  const summary = useMemo(() => {
    const completed = selectedItems.filter(
      (item) => item.readinessStatus === "Completed"
    ).length;
    const pending = selectedItems.filter(
      (item) => item.readinessStatus === "Pending"
    ).length;
    const inProgress = selectedItems.filter(
      (item) => item.readinessStatus === "In Progress"
    ).length;
    const critical = selectedItems.filter(
      (item) => item.priority === "Critical"
    ).length;

    return {
      total: selectedItems.length,
      completed,
      pending,
      inProgress,
      critical,
    };
  }, [selectedItems]);

  function updateClientForm(field: keyof ClientForm, value: string) {
    setClientForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function updateReadinessForm(field: keyof ReadinessForm, value: string) {
    setReadinessForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  async function createDefaultChecklist(clientId: string) {
    const rows = defaultChecklistTemplates.map((item) => ({
      client_id: clientId,
      readiness_area: item.readinessArea,
      checklist_item: item.checklistItem,
      owner_role: item.ownerRole,
      priority: item.priority,
      readiness_status: "Pending",
      evidence_notes: "",
    }));

    const localItems: ReadinessItem[] = rows.map((row) => ({
      id: crypto.randomUUID(),
      clientId,
      readinessArea: row.readiness_area,
      checklistItem: row.checklist_item,
      ownerRole: row.owner_role,
      priority: row.priority,
      readinessStatus: row.readiness_status,
      evidenceNotes: row.evidence_notes,
      dueDate: "",
    }));

    if (!isSupabaseConfigured || !supabase) {
      setItems((currentItems) => [...localItems, ...currentItems]);
      return;
    }

    try {
      const db = supabase as any;

      const { data, error } = await db
        .from("ventiq_client_readiness_items")
        .insert(rows)
        .select("*");

      if (error) {
        setItems((currentItems) => [...localItems, ...currentItems]);
        return;
      }

      setItems((currentItems) => [
        ...(data as DataRow[]).map(mapReadinessItem),
        ...currentItems,
      ]);
    } catch {
      setItems((currentItems) => [...localItems, ...currentItems]);
    }
  }

  async function submitClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setClientMessage("");

    if (!clientForm.clientName.trim()) {
      setClientMessage("Client name is required.");
      return;
    }

    setSavingClient(true);

    const payload = {
      client_name: clientForm.clientName.trim(),
      fund_type: clientForm.fundType,
      jurisdiction: clientForm.jurisdiction,
      pilot_stage: clientForm.pilotStage,
      data_mode: clientForm.dataMode,
      target_onboarding_date: clientForm.targetOnboardingDate || null,
      readiness_score: 0,
      risk_status: clientForm.riskStatus,
      primary_contact_name: clientForm.primaryContactName.trim(),
      primary_contact_email: clientForm.primaryContactEmail.trim(),
      selected_modules: ["Debt LMS", "Bank MIS", "Audit Workflow"],
    };

    try {
      let savedClient: PilotClient;

      if (!isSupabaseConfigured || !supabase) {
        savedClient = {
          id: crypto.randomUUID(),
          clientName: payload.client_name,
          fundType: payload.fund_type,
          jurisdiction: payload.jurisdiction,
          pilotStage: payload.pilot_stage,
          dataMode: payload.data_mode,
          targetOnboardingDate: clientForm.targetOnboardingDate,
          readinessScore: 0,
          riskStatus: payload.risk_status,
          primaryContactName: payload.primary_contact_name,
          primaryContactEmail: payload.primary_contact_email,
          selectedModules: payload.selected_modules,
          createdAt: new Date().toISOString().slice(0, 10),
        };
      } else {
        const db = supabase as any;

        const { data, error } = await db
          .from("ventiq_pilot_clients")
          .insert(payload)
          .select("*")
          .single();

        if (error) throw new Error(error.message);

        savedClient = mapClient(data as DataRow);
      }

      setClients((currentClients) => [savedClient, ...currentClients]);
      setSelectedClientId(savedClient.id);
      setClientForm(emptyClientForm);
      setClientMessage("Pilot client created. Default readiness checklist added.");

      await createDefaultChecklist(savedClient.id);
    } catch (error) {
      setClientMessage(
        error instanceof Error ? error.message : "Unable to create pilot client."
      );
    } finally {
      setSavingClient(false);
    }
  }

  async function submitReadinessItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setItemMessage("");

    if (!readinessForm.checklistItem.trim()) {
      setItemMessage("Checklist item is required.");
      return;
    }

    setSavingItem(true);

    const payload = {
      client_id: selectedClient.id,
      readiness_area: readinessForm.readinessArea,
      checklist_item: readinessForm.checklistItem.trim(),
      owner_role: readinessForm.ownerRole,
      priority: readinessForm.priority,
      readiness_status: readinessForm.readinessStatus,
      evidence_notes: readinessForm.evidenceNotes,
      due_date: readinessForm.dueDate || null,
    };

    try {
      if (!isSupabaseConfigured || !supabase) {
        const localItem: ReadinessItem = {
          id: crypto.randomUUID(),
          clientId: selectedClient.id,
          readinessArea: payload.readiness_area,
          checklistItem: payload.checklist_item,
          ownerRole: payload.owner_role,
          priority: payload.priority,
          readinessStatus: payload.readiness_status,
          evidenceNotes: payload.evidence_notes,
          dueDate: readinessForm.dueDate,
        };

        setItems((currentItems) => [localItem, ...currentItems]);
        setReadinessForm(emptyReadinessForm);
        setItemMessage("Readiness item added locally.");
        return;
      }

      const db = supabase as any;

      const { data, error } = await db
        .from("ventiq_client_readiness_items")
        .insert(payload)
        .select("*")
        .single();

      if (error) throw new Error(error.message);

      setItems((currentItems) => [
        mapReadinessItem(data as DataRow),
        ...currentItems,
      ]);
      setReadinessForm(emptyReadinessForm);
      setItemMessage("Readiness item added.");
    } catch (error) {
      setItemMessage(
        error instanceof Error ? error.message : "Unable to add readiness item."
      );
    } finally {
      setSavingItem(false);
    }
  }

  async function updateItemStatus(item: ReadinessItem, nextStatus: string) {
    try {
      if (isSupabaseConfigured && supabase && !item.id.startsWith("item-")) {
        const db = supabase as any;

        const { error } = await db
          .from("ventiq_client_readiness_items")
          .update({ readiness_status: nextStatus })
          .eq("id", item.id);

        if (error) throw new Error(error.message);
      }

      setItems((currentItems) =>
        currentItems.map((currentItem) =>
          currentItem.id === item.id
            ? { ...currentItem, readinessStatus: nextStatus }
            : currentItem
        )
      );
    } catch (error) {
      setItemMessage(
        error instanceof Error ? error.message : "Unable to update checklist item."
      );
    }
  }

  return (
    <main className="readiness-page">
      <style>{`
        .readiness-page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top left, rgba(37, 99, 235, 0.22), transparent 34rem),
            radial-gradient(circle at top right, rgba(245, 200, 91, 0.16), transparent 32rem),
            #07101f;
          color: #f8fbff;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          padding: 34px;
        }

        .readiness-shell {
          max-width: 1280px;
          margin: 0 auto;
        }

        .hero,
        .panel,
        .stat-card,
        .form-card,
        .decision-card,
        .module-pill {
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
          max-width: 880px;
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
          grid-template-columns: 0.95fr 1.35fr;
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

        .selector-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          align-items: center;
          margin-bottom: 18px;
        }

        .selector-row select {
          border: 1px solid rgba(147, 197, 253, 0.18);
          background: rgba(2, 6, 23, 0.34);
          color: #ffffff;
          border-radius: 999px;
          padding: 11px 14px;
          outline: none;
          font: inherit;
          min-width: 280px;
        }

        .decision-card {
          padding: 24px;
          border-color: rgba(245, 200, 91, 0.26);
          background: rgba(245, 200, 91, 0.08);
          margin-bottom: 18px;
        }

        .decision-card span {
          display: block;
          color: #fde68a;
          font-size: 12px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          margin-bottom: 10px;
        }

        .decision-card strong {
          display: block;
          font-size: 34px;
          letter-spacing: -0.05em;
          margin-bottom: 8px;
        }

        .decision-card p {
          color: #dbeafe;
          line-height: 1.55;
          margin: 0;
        }

        .module-grid {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 14px;
        }

        .module-pill {
          padding: 10px 12px;
          color: #dbeafe;
          font-size: 13px;
          font-weight: 850;
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

        .status-completed,
        .status-controlled-pilot,
        .status-low {
          background: rgba(22, 163, 74, 0.24);
          color: #bbf7d0;
        }

        .status-in-progress,
        .status-sample-client-data,
        .status-medium,
        .status-discovery {
          background: rgba(245, 158, 11, 0.22);
          color: #fde68a;
        }

        .status-pending,
        .status-demo-data,
        .status-high {
          background: rgba(59, 130, 246, 0.22);
          color: #bfdbfe;
        }

        .status-blocked,
        .status-critical,
        .status-limited-real-data {
          background: rgba(239, 68, 68, 0.22);
          color: #fecaca;
        }

        .timeline-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .timeline-card {
          border: 1px solid rgba(147, 197, 253, 0.14);
          background: rgba(2, 6, 23, 0.24);
          border-radius: 20px;
          padding: 18px;
        }

        .timeline-card span {
          color: #f5c85b;
          font-size: 12px;
          font-weight: 950;
        }

        .timeline-card h3 {
          margin: 8px 0;
          font-size: 18px;
        }

        .timeline-card p {
          color: #c7d7f4;
          line-height: 1.5;
          margin: 0;
          font-size: 13px;
        }

        @media (max-width: 1100px) {
          .summary-grid,
          .main-grid,
          .timeline-grid {
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

      <section className="readiness-shell">
        <div className="hero">
          <div className="hero-top">
            <div>
              <p className="eyebrow">VENTIQ Commercial Layer</p>
              <h1>Client Onboarding & Pilot Readiness Center</h1>
              <p className="hero-copy">
                Decide whether a fund is ready for a demo, controlled pilot,
                limited real-data pilot or production onboarding. This center
                connects legal readiness, client data, stakeholder access,
                product activation, data protection and approval workflow into
                one go-live view.
              </p>
            </div>

                        <div className="actions">
              <Link className="primary-button" href="/migration">
                Migration Workspace
              </Link>
              <Link className="secondary-button" href="/fund-onboarding">
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
              <span>Readiness Score</span>
              <strong>{score}%</strong>
            </div>

            <div className="stat-card">
              <span>Total Items</span>
              <strong>{summary.total}</strong>
            </div>

            <div className="stat-card">
              <span>Completed</span>
              <strong>{summary.completed}</strong>
            </div>

            <div className="stat-card">
              <span>Pending</span>
              <strong>{summary.pending}</strong>
            </div>

            <div className="stat-card">
              <span>Critical Items</span>
              <strong>{summary.critical}</strong>
            </div>
          </div>
        </div>

        <div className="ribbon">
          {loading ? "Loading client readiness center..." : dataMessage} · Demo
          readiness → controlled pilot → limited real data → paid pilot
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Selected Client</h2>
              <p>
                Select a pilot client and review whether VENTIQ can safely
                onboard them.
              </p>
            </div>
          </div>

          <div className="selector-row">
            <select
              value={selectedClientId}
              onChange={(event) => setSelectedClientId(event.target.value)}
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.clientName}
                </option>
              ))}
            </select>

            <span
              className={`status-pill status-${statusClass(
                selectedClient.pilotStage
              )}`}
            >
              {selectedClient.pilotStage}
            </span>

            <span
              className={`status-pill status-${statusClass(
                selectedClient.dataMode
              )}`}
            >
              {selectedClient.dataMode}
            </span>
          </div>

          <div className="decision-card">
            <span>VENTIQ Readiness Decision</span>
            <strong>{decision}</strong>
            <p>
              Client: {selectedClient.clientName} · Fund Type:{" "}
              {selectedClient.fundType} · Target onboarding:{" "}
              {formatDate(selectedClient.targetOnboardingDate)} · Risk:{" "}
              {selectedClient.riskStatus}
            </p>

            <div className="module-grid">
              {selectedClient.selectedModules.map((module) => (
                <div className="module-pill" key={module}>
                  {module}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Migration Workspace Handoff</h2>
              <p>
                Client Readiness does not collect detailed data again. It checks
                whether the Migration Workspace has been opened, source files
                have been uploaded and mappings are ready for module activation.
              </p>
            </div>

            <div className="actions">
              <Link className="primary-button" href="/migration">
                Open Migration Workspace
              </Link>
            </div>
          </div>

          <div className="timeline-grid">
            <div className="timeline-card">
              <span>Step 1</span>
              <h3>Select Data Sets</h3>
              <p>
                Investor master, capital calls, distributions, bank statements,
                debt loans, repayment schedules, portfolio data and documents.
              </p>
            </div>

            <div className="timeline-card">
              <span>Step 2</span>
              <h3>Upload Source Files</h3>
              <p>
                Client uploads files or marks data sets as not applicable for
                demo, sample-data pilot or limited real-data pilot.
              </p>
            </div>

            <div className="timeline-card">
              <span>Step 3</span>
              <h3>Review Mapping</h3>
              <p>
                VENTIQ reviews whether uploaded data can activate Debt LMS, Bank
                MIS, Investor Portal and Finance dashboards.
              </p>
            </div>

            <div className="timeline-card">
              <span>Step 4</span>
              <h3>Activate Modules</h3>
              <p>
                Once migration readiness is complete, modules can be activated
                for the selected client workspace.
              </p>
            </div>
          </div>
        </div>
        <div className="main-grid">
          <form className="form-card" onSubmit={submitClient}>
            <h2>Add Pilot Client</h2>
            <p>
              Create a client readiness workspace. Default checklist will be
              added automatically.
            </p>

            <div className="form-grid">
              <div className="field">
                <label>Client / Fund Name</label>
                <input
                  value={clientForm.clientName}
                  onChange={(event) =>
                    updateClientForm("clientName", event.target.value)
                  }
                  placeholder="Enter client or fund name"
                />
              </div>

              <div className="field">
                <label>Fund Type</label>
                <select
                  value={clientForm.fundType}
                  onChange={(event) =>
                    updateClientForm("fundType", event.target.value)
                  }
                >
                  <option>Category I AIF</option>
                  <option>Category II AIF</option>
                  <option>Category III AIF</option>
                  <option>GIFT City Fund</option>
                  <option>Private Credit Fund</option>
                  <option>Venture Debt Fund</option>
                  <option>Family Office</option>
                </select>
              </div>

              <div className="field">
                <label>Jurisdiction</label>
                <select
                  value={clientForm.jurisdiction}
                  onChange={(event) =>
                    updateClientForm("jurisdiction", event.target.value)
                  }
                >
                  <option>India</option>
                  <option>GIFT City</option>
                  <option>Offshore</option>
                  <option>Parallel Structure</option>
                </select>
              </div>

              <div className="field">
                <label>Pilot Stage</label>
                <select
                  value={clientForm.pilotStage}
                  onChange={(event) =>
                    updateClientForm("pilotStage", event.target.value)
                  }
                >
                  <option>Discovery</option>
                  <option>Guided Demo</option>
                  <option>Controlled Pilot</option>
                  <option>Paid Pilot</option>
                  <option>Production Onboarding</option>
                </select>
              </div>

              <div className="field">
                <label>Data Mode</label>
                <select
                  value={clientForm.dataMode}
                  onChange={(event) =>
                    updateClientForm("dataMode", event.target.value)
                  }
                >
                  <option>Demo Data</option>
                  <option>Sample Client Data</option>
                  <option>Limited Real Data</option>
                  <option>Production Data</option>
                </select>
              </div>

              <div className="field">
                <label>Target Onboarding Date</label>
                <input
                  type="date"
                  value={clientForm.targetOnboardingDate}
                  onChange={(event) =>
                    updateClientForm("targetOnboardingDate", event.target.value)
                  }
                />
              </div>

              <div className="field">
                <label>Risk Status</label>
                <select
                  value={clientForm.riskStatus}
                  onChange={(event) =>
                    updateClientForm("riskStatus", event.target.value)
                  }
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                  <option>Critical</option>
                </select>
              </div>

              <div className="field">
                <label>Primary Contact Name</label>
                <input
                  value={clientForm.primaryContactName}
                  onChange={(event) =>
                    updateClientForm("primaryContactName", event.target.value)
                  }
                  placeholder="Finance Head / Partner"
                />
              </div>

              <div className="field">
                <label>Primary Contact Email</label>
                <input
                  type="email"
                  value={clientForm.primaryContactEmail}
                  onChange={(event) =>
                    updateClientForm("primaryContactEmail", event.target.value)
                  }
                  placeholder="contact@example.com"
                />
              </div>

              <button
                className="primary-button"
                disabled={savingClient}
                type="submit"
              >
                {savingClient ? "Creating..." : "Create Client Workspace"}
              </button>

              {clientMessage && <div className="message">{clientMessage}</div>}
            </div>
          </form>

          <form className="form-card" onSubmit={submitReadinessItem}>
            <h2>Add Readiness Item</h2>
            <p>
              Add any missing legal, product, data, access or security item
              before pilot onboarding.
            </p>

            <div className="form-grid">
              <div className="field">
                <label>Readiness Area</label>
                <select
                  value={readinessForm.readinessArea}
                  onChange={(event) =>
                    updateReadinessForm("readinessArea", event.target.value)
                  }
                >
                  <option>Legal / Commercial</option>
                  <option>Client Data</option>
                  <option>Access</option>
                  <option>Security</option>
                  <option>Product</option>
                  <option>Controls</option>
                  <option>Operations</option>
                </select>
              </div>

              <div className="field">
                <label>Checklist Item</label>
                <input
                  value={readinessForm.checklistItem}
                  onChange={(event) =>
                    updateReadinessForm("checklistItem", event.target.value)
                  }
                  placeholder="Enter checklist item"
                />
              </div>

              <div className="field">
                <label>Owner Role</label>
                <input
                  value={readinessForm.ownerRole}
                  onChange={(event) =>
                    updateReadinessForm("ownerRole", event.target.value)
                  }
                  placeholder="Owner"
                />
              </div>

              <div className="field">
                <label>Priority</label>
                <select
                  value={readinessForm.priority}
                  onChange={(event) =>
                    updateReadinessForm("priority", event.target.value)
                  }
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                  <option>Critical</option>
                </select>
              </div>

              <div className="field">
                <label>Status</label>
                <select
                  value={readinessForm.readinessStatus}
                  onChange={(event) =>
                    updateReadinessForm("readinessStatus", event.target.value)
                  }
                >
                  <option>Pending</option>
                  <option>In Progress</option>
                  <option>Completed</option>
                  <option>Blocked</option>
                </select>
              </div>

              <div className="field">
                <label>Due Date</label>
                <input
                  type="date"
                  value={readinessForm.dueDate}
                  onChange={(event) =>
                    updateReadinessForm("dueDate", event.target.value)
                  }
                />
              </div>

              <div className="field">
                <label>Evidence Notes</label>
                <textarea
                  value={readinessForm.evidenceNotes}
                  onChange={(event) =>
                    updateReadinessForm("evidenceNotes", event.target.value)
                  }
                  placeholder="Add evidence or comment"
                />
              </div>

              <button
                className="primary-button"
                disabled={savingItem}
                type="submit"
              >
                {savingItem ? "Adding..." : "Add Readiness Item"}
              </button>

              {itemMessage && <div className="message">{itemMessage}</div>}
            </div>
          </form>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Client Readiness Checklist</h2>
              <p>
                This is the practical go-live checklist before taking a fund
                from demo to pilot.
              </p>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Area</th>
                  <th>Checklist Item</th>
                  <th>Owner</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Due Date</th>
                  <th>Evidence</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {selectedItems.map((item) => (
                  <tr key={item.id}>
                    <td>{item.readinessArea}</td>
                    <td>
                      <strong>{item.checklistItem}</strong>
                    </td>
                    <td>{item.ownerRole}</td>
                    <td>
                      <span
                        className={`status-pill status-${statusClass(
                          item.priority
                        )}`}
                      >
                        {item.priority}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`status-pill status-${statusClass(
                          item.readinessStatus
                        )}`}
                      >
                        {item.readinessStatus}
                      </span>
                    </td>
                    <td>{formatDate(item.dueDate)}</td>
                    <td>{item.evidenceNotes || "No evidence added"}</td>
                    <td>
                      <div className="actions">
                        <button
                          className="small-button"
                          type="button"
                          onClick={() => updateItemStatus(item, "In Progress")}
                        >
                          Start
                        </button>
                        <button
                          className="small-button"
                          type="button"
                          onClick={() => updateItemStatus(item, "Completed")}
                        >
                          Complete
                        </button>
                        <button
                          className="small-button"
                          type="button"
                          onClick={() => updateItemStatus(item, "Blocked")}
                        >
                          Block
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {selectedItems.length === 0 && (
                  <tr>
                    <td colSpan={8}>No checklist items yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>First Client Timeline</h2>
              <p>
                Use this timeline to plan your first onboarding conversation and
                pilot milestone.
              </p>
            </div>
          </div>

          <div className="timeline-grid">
            <div className="timeline-card">
              <span>7–10 days</span>
              <h3>Friendly demo client</h3>
              <p>
                Show guided demo using dummy data. Objective is feedback, pain
                validation and workflow confirmation.
              </p>
            </div>

            <div className="timeline-card">
              <span>2–3 weeks</span>
              <h3>Controlled sample-data pilot</h3>
              <p>
                Onboard one fund workspace with sample bank, debt and stakeholder
                records. No sensitive investor data.
              </p>
            </div>

            <div className="timeline-card">
              <span>4–6 weeks</span>
              <h3>Limited paid pilot</h3>
              <p>
                Needs auth, role access, audit logs, data policy, NDA and pilot
                agreement before using limited real data.
              </p>
            </div>

            <div className="timeline-card">
              <span>8–12 weeks</span>
              <h3>Production onboarding</h3>
              <p>
                Needs full tenant isolation, RLS, security review, backup plan,
                incident process and legal review.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}