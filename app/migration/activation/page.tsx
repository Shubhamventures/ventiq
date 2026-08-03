"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

type LayerStatus = "Ready" | "Partial" | "Not Started" | "Needs Review";
type MakerStatus = "Not Submitted" | "Submitted";
type CheckerStatus = "Pending" | "Approved" | "Rejected";
type ActivationStatus = "Inactive" | "Ready for Activation" | "Activated";

type LayerCard = {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  route: string;
  status: LayerStatus;
  countLabel: string;
  countValue: string;
  batchName: string;
  requiredFor: string[];
  dashboardImpact: string[];
  workflowImpact: string[];
  metrics: {
    label: string;
    value: string;
  }[];
};

type ActivationReview = {
  layerId: string;
  layerTitle: string;
  makerStatus: MakerStatus;
  checkerStatus: CheckerStatus;
  activationStatus: ActivationStatus;
  makerNote: string;
  checkerNote: string;
  submittedAt: string;
  approvedAt: string;
  activatedAt: string;
};

type ActivationEvent = {
  id: string;
  eventType: string;
  layerId: string;
  layerTitle: string;
  eventTitle: string;
  eventDescription: string;
  actorName: string;
  createdAt: string;
};

type DataRow = Record<string, unknown>;

function formatCr(value: number) {
  return `₹${(value / 10000000).toFixed(2)} Cr`;
}

function safeString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function getStatusClass(status: string) {
  return status.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function getLayerHealth(status: LayerStatus) {
  if (status === "Ready") return "healthy";
  if (status === "Partial") return "watch";
  if (status === "Needs Review") return "at-risk";
  return "neutral";
}

const defaultLayers: LayerCard[] = [
  {
    id: "investor",
    title: "Investor Data",
    shortTitle: "Investor",
    description:
      "Investor master, commitments, KYC status, capital accounts, contacts and investor financial records.",
    route: "/investor-import",
    status: "Not Started",
    countLabel: "Investors",
    countValue: "0",
    batchName: "No batch loaded",
    requiredFor: [
      "Investor Portal",
      "Capital Call",
      "Distribution",
      "Investor Reporting",
    ],
    dashboardImpact: [
      "Finance Head Workspace",
      "Investor Portal",
      "Investor Relations",
      "Managing Partner Dashboard",
    ],
    workflowImpact: [
      "Capital Call Generator",
      "Distribution Waterfall",
      "Document Studio",
      "Investor Reporting",
    ],
    metrics: [
      { label: "Commitment", value: "₹0.00 Cr" },
      { label: "Status", value: "Not started" },
    ],
  },
  {
    id: "pdf",
    title: "PDF Dump & Intelligence",
    shortTitle: "PDF Dump",
    description:
      "Historical PDFs, investor documents, notices, statements, fund reports and PDF classification review.",
    route: "/migration/pdf-intelligence",
    status: "Not Started",
    countLabel: "PDFs",
    countValue: "0",
    batchName: "No batch loaded",
    requiredFor: [
      "Data Room",
      "Document Studio",
      "Investor Portal",
      "LP Deck Support",
    ],
    dashboardImpact: [
      "Investor Relations",
      "Investor Portal",
      "Compliance View",
      "Managing Partner Dashboard",
    ],
    workflowImpact: [
      "PDF Classification",
      "Investor Document Folders",
      "Data Room Publishing",
      "Document Evidence Pack",
    ],
    metrics: [
      { label: "Ready", value: "0" },
      { label: "Review", value: "0" },
    ],
  },
  {
    id: "portfolio",
    title: "Portfolio Data",
    shortTitle: "Portfolio",
    description:
      "Portfolio companies, borrowers, valuation records, repayment schedules, risk signals and exit assumptions.",
    route: "/migration/portfolio-data",
    status: "Not Started",
    countLabel: "Investments",
    countValue: "0",
    batchName: "No batch loaded",
    requiredFor: [
      "Portfolio Intelligence",
      "Investment Team",
      "Managing Partner",
      "Exit Strategy",
    ],
    dashboardImpact: [
      "Investment Team Workspace",
      "Managing Partner Dashboard",
      "Portfolio Intelligence",
      "Fundraising Workspace",
    ],
    workflowImpact: [
      "Exit Strategy",
      "LP Deck Generator",
      "Debt LMS",
      "Portfolio Risk Notes",
    ],
    metrics: [
      { label: "Current value", value: "₹0.00 Cr" },
      { label: "MOIC", value: "0.00x" },
    ],
  },
  {
    id: "fund",
    title: "Fund Data",
    shortTitle: "Fund",
    description:
      "Fund master, scheme details, corpus, commitments, fees, carry, hurdle, NAV support and operating metrics.",
    route: "/migration/fund-data",
    status: "Not Started",
    countLabel: "Funds",
    countValue: "0",
    batchName: "No batch loaded",
    requiredFor: [
      "Managing Partner",
      "Finance Head",
      "IRR / DPI / TVPI",
      "NAV Support",
    ],
    dashboardImpact: [
      "Managing Partner Dashboard",
      "Finance Head Workspace",
      "Investor Portal",
      "Fundraising Workspace",
    ],
    workflowImpact: [
      "Capital Call",
      "Distribution",
      "Fee & Carry Engine",
      "LP Deck Generator",
    ],
    metrics: [
      { label: "Committed", value: "₹0.00 Cr" },
      { label: "Carry", value: "0%" },
    ],
  },
  {
    id: "compliance",
    title: "Compliance Data",
    shortTitle: "Compliance",
    description:
      "Compliance calendar, filing history, evidence status, Form 64C/64D, QCR/TCR and regulatory exceptions.",
    route: "/migration/compliance-data",
    status: "Not Started",
    countLabel: "Items",
    countValue: "0",
    batchName: "No batch loaded",
    requiredFor: [
      "Compliance Dashboard",
      "Audit Workflow",
      "Knowledge Hub",
      "Evidence Pack",
    ],
    dashboardImpact: [
      "Compliance Officer View",
      "Managing Partner Dashboard",
      "Finance Head Workspace",
      "Audit Workflow",
    ],
    workflowImpact: [
      "Compliance Tracker",
      "Knowledge Hub",
      "Notice Generator",
      "Evidence Review",
    ],
    metrics: [
      { label: "Evidence", value: "0" },
      { label: "High risk", value: "0" },
    ],
  },
];

const defaultReviews: Record<string, ActivationReview> = defaultLayers.reduce(
  (accumulator, layer) => {
    accumulator[layer.id] = {
      layerId: layer.id,
      layerTitle: layer.title,
      makerStatus: "Not Submitted",
      checkerStatus: "Pending",
      activationStatus: "Inactive",
      makerNote: "",
      checkerNote: "",
      submittedAt: "",
      approvedAt: "",
      activatedAt: "",
    };

    return accumulator;
  },
  {} as Record<string, ActivationReview>
);

const dashboardImpactMap = [
  {
    title: "Managing Partner Dashboard",
    href: "/managing-partner-ai",
    layers: ["fund", "portfolio", "investor", "compliance"],
    output:
      "IRR, DPI, TVPI, dry powder, deployment, portfolio movement, exit visibility and LP narrative readiness.",
  },
  {
    title: "Finance Head Workspace",
    href: "/finance-head-ai",
    layers: ["fund", "investor", "compliance"],
    output:
      "Capital calls, distributions, notices, investor statements, finance queues and approval actions.",
  },
  {
    title: "Investment Team Workspace",
    href: "/investment-team-ai",
    layers: ["portfolio", "fund"],
    output:
      "Portfolio movement, valuation updates, repayment risk, follow-on watchlist and exit readiness.",
  },
  {
    title: "Compliance Officer View",
    href: "/compliance-ai",
    layers: ["compliance", "fund", "pdf"],
    output:
      "Filing calendar, evidence gaps, circular impact, QCR/TCR and Form 64C/64D readiness.",
  },
  {
    title: "IR, Fundraising & Data Room",
    href: "/data-room",
    layers: ["pdf", "investor", "fund", "portfolio"],
    output:
      "LP pipeline, DDQs, fundraising decks, investor files, data room readiness and engagement tracking.",
  },
  {
    title: "Investor Portal",
    href: "/investor-portal",
    layers: ["investor", "pdf", "fund"],
    output:
      "Investor-specific statements, notices, reports, capital account, fund updates and approved documents.",
  },
];

const workflowImpactMap = [
  {
    title: "Capital Call Generator",
    href: "/capital-call",
    layers: ["investor", "fund"],
  },
  {
    title: "Distribution Waterfall",
    href: "/distribution-waterfall",
    layers: ["investor", "fund"],
  },
  {
    title: "Document Studio",
    href: "/document-studio",
    layers: ["investor", "pdf", "fund", "compliance"],
  },
  {
    title: "Debt LMS",
    href: "/debt-lms",
    layers: ["portfolio", "fund"],
  },
  {
    title: "Bank MIS",
    href: "/bank-reconciliation",
    layers: ["fund", "investor"],
  },
  {
    title: "Knowledge Hub",
    href: "/knowledge-hub",
    layers: ["compliance"],
  },
  {
    title: "Activity Engine",
    href: "/activity-engine",
    layers: ["investor", "pdf", "portfolio", "fund", "compliance"],
  },
  {
    title: "Stakeholder Launch",
    href: "/migration/stakeholder-launch",
    layers: ["investor", "pdf", "portfolio", "fund", "compliance"],
  },
];

function mapReview(row: DataRow): ActivationReview {
  return {
    layerId: safeString(row.layer_id),
    layerTitle: safeString(row.layer_title),
    makerStatus: safeString(row.maker_status, "Not Submitted") as MakerStatus,
    checkerStatus: safeString(row.checker_status, "Pending") as CheckerStatus,
    activationStatus: safeString(
      row.activation_status,
      "Inactive"
    ) as ActivationStatus,
    makerNote: safeString(row.maker_note),
    checkerNote: safeString(row.checker_note),
    submittedAt: safeString(row.submitted_at),
    approvedAt: safeString(row.approved_at),
    activatedAt: safeString(row.activated_at),
  };
}

function mapEvent(row: DataRow): ActivationEvent {
  return {
    id: safeString(row.id, crypto.randomUUID()),
    eventType: safeString(row.event_type),
    layerId: safeString(row.layer_id),
    layerTitle: safeString(row.layer_title),
    eventTitle: safeString(row.event_title),
    eventDescription: safeString(row.event_description),
    actorName: safeString(row.actor_name, "VENTIQ Admin"),
    createdAt: safeString(row.created_at),
  };
}

export default function DataActivationDashboardPage() {
  const [layers, setLayers] = useState<LayerCard[]>(defaultLayers);
  const [reviews, setReviews] =
    useState<Record<string, ActivationReview>>(defaultReviews);
  const [events, setEvents] = useState<ActivationEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [message, setMessage] = useState("");

  async function addActivationEvent(
    eventType: string,
    layer: LayerCard | null,
    title: string,
    description: string
  ) {
    const eventPayload = {
      event_type: eventType,
      layer_id: layer?.id || null,
      layer_title: layer?.title || null,
      event_title: title,
      event_description: description,
      actor_name: "VENTIQ Admin",
    };

    const localEvent: ActivationEvent = {
      id: crypto.randomUUID(),
      eventType,
      layerId: layer?.id || "",
      layerTitle: layer?.title || "",
      eventTitle: title,
      eventDescription: description,
      actorName: "VENTIQ Admin",
      createdAt: new Date().toISOString(),
    };

    setEvents((currentEvents) => [localEvent, ...currentEvents].slice(0, 8));

    if (!isSupabaseConfigured || !supabase) return;

        await supabase.from("migration_activation_events").insert(eventPayload);

    await supabase.from("ventiq_enterprise_audit_logs").insert({
      source_module: "Migration Activation",
      linked_record_id: layer?.id || "fund-activation",
      linked_record_type: layer ? "Migration Data Layer" : "Fund Activation",
      event_type: eventType,
      event_title: title,
      event_description: description,
      actor_name: "VENTIQ Admin",
      actor_email: "admin@useventiq.com",
      actor_role:
        eventType === "Maker Submitted"
          ? "Maker"
          : eventType === "Checker Approved" || eventType === "Checker Rejected"
            ? "Checker"
            : "Fund Admin",
      event_status: "Recorded",
      risk_level:
        eventType === "Checker Rejected"
          ? "High"
          : eventType === "Fund Activated"
            ? "High"
            : "Medium",
    });
  }

  async function loadActivationSnapshot() {
    const client = supabase;

    if (!isSupabaseConfigured || !client) {
      setMessage("Supabase is not configured. Showing sample activation layer.");
      return;
    }

    setLoading(true);
    setMessage("Loading migration readiness from Supabase...");

    try {
      const nextLayers = [...defaultLayers];

      const { data: investorBatch } = await client
        .from("investor_import_batches")
        .select("id, batch_name, total_records, total_commitment, status")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (investorBatch) {
        const totalRecords = Number(investorBatch.total_records ?? 0);
        const totalCommitment = Number(investorBatch.total_commitment ?? 0);

        nextLayers[0] = {
          ...nextLayers[0],
          status: totalRecords > 0 ? "Ready" : "Partial",
          countValue: String(totalRecords),
          batchName: investorBatch.batch_name ?? "Latest investor batch",
          metrics: [
            { label: "Commitment", value: formatCr(totalCommitment) },
            { label: "Status", value: investorBatch.status ?? "published" },
          ],
        };
      }

      const { data: pdfBatch } = await client
        .from("pdf_intelligence_batches")
        .select(
          "id, batch_name, total_files, ready_files, review_files, unmatched_files, status"
        )
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pdfBatch) {
        const totalFiles = Number(pdfBatch.total_files ?? 0);
        const reviewFiles = Number(pdfBatch.review_files ?? 0);
        const unmatchedFiles = Number(pdfBatch.unmatched_files ?? 0);

        nextLayers[1] = {
          ...nextLayers[1],
          status:
            totalFiles === 0
              ? "Not Started"
              : reviewFiles > 0 || unmatchedFiles > 0
                ? "Needs Review"
                : "Ready",
          countValue: String(totalFiles),
          batchName: pdfBatch.batch_name ?? "Latest PDF batch",
          metrics: [
            { label: "Ready", value: String(pdfBatch.ready_files ?? 0) },
            {
              label: "Review / unmatched",
              value: String(reviewFiles + unmatchedFiles),
            },
          ],
        };
      }

      const { data: portfolioBatch } = await client
        .from("portfolio_data_migration_batches")
        .select(
          "id, batch_name, total_records, current_portfolio_value, portfolio_moic, at_risk_count, status"
        )
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (portfolioBatch) {
        const totalRecords = Number(portfolioBatch.total_records ?? 0);
        const atRiskCount = Number(portfolioBatch.at_risk_count ?? 0);

        nextLayers[2] = {
          ...nextLayers[2],
          status:
            totalRecords === 0
              ? "Not Started"
              : atRiskCount > 0
                ? "Partial"
                : "Ready",
          countValue: String(totalRecords),
          batchName: portfolioBatch.batch_name ?? "Latest portfolio batch",
          metrics: [
            {
              label: "Current value",
              value: formatCr(Number(portfolioBatch.current_portfolio_value ?? 0)),
            },
            {
              label: "MOIC",
              value: `${Number(portfolioBatch.portfolio_moic ?? 0).toFixed(2)}x`,
            },
          ],
        };
      }

      const { data: fundBatch } = await client
        .from("fund_data_migration_batches")
        .select(
          "id, batch_name, total_funds, total_committed_capital, average_carry, status"
        )
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fundBatch) {
        const totalFunds = Number(fundBatch.total_funds ?? 0);

        nextLayers[3] = {
          ...nextLayers[3],
          status: totalFunds > 0 ? "Ready" : "Not Started",
          countValue: String(totalFunds),
          batchName: fundBatch.batch_name ?? "Latest fund batch",
          metrics: [
            {
              label: "Committed",
              value: formatCr(Number(fundBatch.total_committed_capital ?? 0)),
            },
            {
              label: "Carry",
              value: `${Number(fundBatch.average_carry ?? 0).toFixed(0)}%`,
            },
          ],
        };
      }

      const { data: complianceBatch } = await client
        .from("compliance_data_migration_batches")
        .select(
          "id, batch_name, total_items, evidence_available_count, pending_review_count, high_risk_count, status"
        )
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (complianceBatch) {
        const totalItems = Number(complianceBatch.total_items ?? 0);
        const pendingReview = Number(complianceBatch.pending_review_count ?? 0);
        const highRisk = Number(complianceBatch.high_risk_count ?? 0);

        nextLayers[4] = {
          ...nextLayers[4],
          status:
            totalItems === 0
              ? "Not Started"
              : highRisk > 0
                ? "Needs Review"
                : pendingReview > 0
                  ? "Partial"
                  : "Ready",
          countValue: String(totalItems),
          batchName: complianceBatch.batch_name ?? "Latest compliance batch",
          metrics: [
            {
              label: "Evidence",
              value: String(complianceBatch.evidence_available_count ?? 0),
            },
            {
              label: "High risk",
              value: String(highRisk),
            },
          ],
        };
      }

      const { data: reviewData, error: reviewError } = await client
        .from("migration_activation_reviews")
        .select("*")
        .order("updated_at", { ascending: false });

      if (reviewError) throw new Error(reviewError.message);

      const nextReviews = { ...defaultReviews };
      if (reviewData) {
        (reviewData as DataRow[]).forEach((row) => {
          const mappedReview = mapReview(row);
          if (mappedReview.layerId) {
            nextReviews[mappedReview.layerId] = mappedReview;
          }
        });
      }

      const { data: eventData } = await client
        .from("migration_activation_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(8);

      setLayers(nextLayers);
      setReviews(nextReviews);
      setEvents(eventData ? (eventData as DataRow[]).map(mapEvent) : []);
      setMessage("Migration readiness and activation approvals loaded.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load activation dashboard."
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    loadActivationSnapshot();
  }, []);

  const readiness = useMemo(() => {
    const readyCount = layers.filter((layer) => layer.status === "Ready").length;
    const reviewCount = layers.filter(
      (layer) => layer.status === "Partial" || layer.status === "Needs Review"
    ).length;
    const notStartedCount = layers.filter(
      (layer) => layer.status === "Not Started"
    ).length;

    const approvedCount = layers.filter(
      (layer) => reviews[layer.id]?.checkerStatus === "Approved"
    ).length;

    const activatedCount = layers.filter(
      (layer) => reviews[layer.id]?.activationStatus === "Activated"
    ).length;

    const readinessScore = Math.round((readyCount / layers.length) * 100);
    const approvalScore = Math.round((approvedCount / layers.length) * 100);
    const activationScore = Math.round((activatedCount / layers.length) * 100);

    return {
      readyCount,
      reviewCount,
      notStartedCount,
      approvedCount,
      activatedCount,
      readinessScore,
      approvalScore,
      activationScore,
      canActivate:
        layers.every((layer) => layer.status === "Ready") &&
        layers.every((layer) => reviews[layer.id]?.checkerStatus === "Approved"),
      hasActivated:
        layers.length > 0 &&
        layers.every(
          (layer) => reviews[layer.id]?.activationStatus === "Activated"
        ),
    };
  }, [layers, reviews]);

  function isImpactReady(requiredLayers: string[]) {
    return requiredLayers.every(
      (layerId) => reviews[layerId]?.activationStatus === "Activated"
    );
  }

  async function submitLayer(layer: LayerCard) {
    if (layer.status === "Not Started") {
      setMessage(`${layer.title} cannot be submitted because no data is loaded.`);
      return;
    }

    setActionLoading(`submit-${layer.id}`);

    const now = new Date().toISOString();

    const payload = {
      layer_id: layer.id,
      layer_title: layer.title,
      readiness_status: layer.status,
      maker_status: "Submitted",
      checker_status: "Pending",
      activation_status: "Inactive",
      maker_note: `${layer.title} submitted for checker review from Migration Activation.`,
      submitted_at: now,
      updated_at: now,
    };

    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from("migration_activation_reviews")
          .upsert(payload, { onConflict: "layer_id" });

        if (error) throw new Error(error.message);
      }

      setReviews((currentReviews) => ({
        ...currentReviews,
        [layer.id]: {
          ...currentReviews[layer.id],
          makerStatus: "Submitted",
          checkerStatus: "Pending",
          activationStatus: "Inactive",
          makerNote: payload.maker_note,
          submittedAt: now,
        },
      }));

      await addActivationEvent(
        "Maker Submitted",
        layer,
        `${layer.title} submitted`,
        "Maker submitted this migration layer for checker approval."
      );

      setMessage(`${layer.title} submitted for checker approval.`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to submit layer."
      );
    } finally {
      setActionLoading("");
    }
  }

  async function approveLayer(layer: LayerCard) {
    const review = reviews[layer.id];

    if (review?.makerStatus !== "Submitted") {
      setMessage(`${layer.title} must be submitted by maker before approval.`);
      return;
    }

    setActionLoading(`approve-${layer.id}`);

    const now = new Date().toISOString();

    const payload = {
      checker_status: "Approved",
      activation_status: "Ready for Activation",
      checker_note: `${layer.title} approved by checker. Ready for fund activation.`,
      approved_at: now,
      rejected_at: null,
      updated_at: now,
    };

    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from("migration_activation_reviews")
          .update(payload)
          .eq("layer_id", layer.id);

        if (error) throw new Error(error.message);
      }

      setReviews((currentReviews) => ({
        ...currentReviews,
        [layer.id]: {
          ...currentReviews[layer.id],
          checkerStatus: "Approved",
          activationStatus: "Ready for Activation",
          checkerNote: payload.checker_note,
          approvedAt: now,
        },
      }));

      await addActivationEvent(
        "Checker Approved",
        layer,
        `${layer.title} approved`,
        "Checker approved this migration layer for fund activation."
      );

      setMessage(`${layer.title} approved. It is ready for activation.`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to approve layer."
      );
    } finally {
      setActionLoading("");
    }
  }

  async function rejectLayer(layer: LayerCard) {
    setActionLoading(`reject-${layer.id}`);

    const now = new Date().toISOString();

    const payload = {
      checker_status: "Rejected",
      activation_status: "Inactive",
      checker_note: `${layer.title} rejected. Review data gaps before resubmission.`,
      rejected_at: now,
      updated_at: now,
    };

    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from("migration_activation_reviews")
          .update(payload)
          .eq("layer_id", layer.id);

        if (error) throw new Error(error.message);
      }

      setReviews((currentReviews) => ({
        ...currentReviews,
        [layer.id]: {
          ...currentReviews[layer.id],
          checkerStatus: "Rejected",
          activationStatus: "Inactive",
          checkerNote: payload.checker_note,
        },
      }));

      await addActivationEvent(
        "Checker Rejected",
        layer,
        `${layer.title} rejected`,
        "Checker rejected this migration layer and requested review."
      );

      setMessage(`${layer.title} rejected. Maker should review the data.`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to reject layer."
      );
    } finally {
      setActionLoading("");
    }
  }

  async function activateFundData() {
    if (!readiness.canActivate) {
      setMessage(
        "Fund cannot be activated yet. All five layers must be Ready and Checker Approved."
      );
      return;
    }

    setActionLoading("activate-fund");

    const now = new Date().toISOString();

    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from("migration_activation_reviews")
          .update({
            activation_status: "Activated",
            activated_at: now,
            updated_at: now,
          })
          .in(
            "layer_id",
            layers.map((layer) => layer.id)
          );

        if (error) throw new Error(error.message);
      }

      setReviews((currentReviews) => {
        const nextReviews = { ...currentReviews };

        layers.forEach((layer) => {
          nextReviews[layer.id] = {
            ...nextReviews[layer.id],
            activationStatus: "Activated",
            activatedAt: now,
          };
        });

        return nextReviews;
      });

      await addActivationEvent(
        "Fund Activated",
        null,
        "Fund data activated",
        "All five migration layers were activated. Stakeholder dashboards and workflow engines can now consume approved data."
      );

      setMessage(
        "Fund activated. Approved data can now flow to stakeholder dashboards and workflow engines."
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to activate fund."
      );
    } finally {
      setActionLoading("");
    }
  }

  return (
    <main className="activation-page">
      <style>{`
        .activation-page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top left, rgba(37, 99, 235, 0.22), transparent 34rem),
            radial-gradient(circle at top right, rgba(245, 200, 91, 0.14), transparent 32rem),
            #070d1a;
          color: #f8fbff;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
          padding: 32px;
        }

        .activation-shell {
          max-width: 1280px;
          margin: 0 auto;
        }

        .activation-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 18px;
          margin-bottom: 24px;
        }

        .activation-brand {
          text-decoration: none;
          color: #ffffff;
          font-weight: 950;
          letter-spacing: 0.16em;
        }

        .activation-nav-links {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .activation-hero,
        .activation-card,
        .activation-panel,
        .activation-layer-card,
        .activation-kpi-card,
        .impact-card,
        .event-card {
          border: 1px solid rgba(147, 197, 253, 0.16);
          background: rgba(15, 23, 42, 0.74);
          box-shadow: 0 22px 70px rgba(0, 0, 0, 0.2);
        }

        .activation-hero {
          border-radius: 34px;
          padding: 34px;
          display: grid;
          grid-template-columns: 1.25fr 0.75fr;
          gap: 22px;
          align-items: stretch;
          margin-bottom: 18px;
        }

        .activation-eyebrow {
          color: #f5c85b;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          font-size: 12px;
          font-weight: 950;
          margin: 0 0 14px;
        }

        .activation-hero h1 {
          margin: 0;
          font-size: clamp(44px, 6vw, 76px);
          line-height: 0.96;
          letter-spacing: -0.06em;
        }

        .activation-hero p {
          margin: 20px 0 0;
          color: #c7d7f4;
          font-size: 18px;
          line-height: 1.65;
          max-width: 850px;
        }

        .activation-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 24px;
        }

        .activation-primary-button,
        .activation-secondary-button,
        .activation-small-button,
        .activation-danger-button {
          border-radius: 999px;
          border: 0;
          text-decoration: none;
          cursor: pointer;
          font-family: inherit;
          font-weight: 950;
          white-space: nowrap;
        }

        .activation-primary-button {
          background: #f5c85b;
          color: #07101f;
          padding: 13px 18px;
          font-size: 14px;
        }

        .activation-secondary-button {
          background: rgba(15, 23, 42, 0.72);
          color: #dbeafe;
          border: 1px solid rgba(147, 197, 253, 0.24);
          padding: 13px 18px;
          font-size: 14px;
        }

        .activation-small-button,
        .activation-danger-button {
          padding: 9px 12px;
          font-size: 12px;
        }

        .activation-small-button {
          background: rgba(245, 200, 91, 0.14);
          border: 1px solid rgba(245, 200, 91, 0.26);
          color: #fde68a;
        }

        .activation-danger-button {
          background: rgba(239, 68, 68, 0.16);
          border: 1px solid rgba(239, 68, 68, 0.26);
          color: #fecaca;
        }

        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .activation-score-card {
          border: 1px solid rgba(245, 200, 91, 0.22);
          background:
            linear-gradient(180deg, rgba(245, 200, 91, 0.12), rgba(15, 23, 42, 0.7)),
            rgba(15, 23, 42, 0.82);
          border-radius: 28px;
          padding: 28px;
          display: grid;
          align-content: center;
        }

        .activation-score-card span {
          color: #fde68a;
          font-size: 12px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }

        .activation-score-card strong {
          display: block;
          font-size: 70px;
          letter-spacing: -0.08em;
          margin: 10px 0;
        }

        .activation-score-card p {
          margin: 0;
          color: #dbeafe;
        }

        .activation-note {
          border: 1px solid rgba(96, 165, 250, 0.24);
          background: rgba(37, 99, 235, 0.13);
          color: #dbeafe;
          border-radius: 18px;
          padding: 14px 16px;
          font-weight: 850;
          margin-bottom: 18px;
          line-height: 1.5;
        }

        .activation-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .activation-kpi-card {
          border-radius: 22px;
          padding: 20px;
        }

        .activation-kpi-card span {
          color: #f5c85b;
          font-weight: 950;
          font-size: 18px;
        }

        .activation-kpi-card p {
          color: #9db3d7;
          margin: 10px 0 6px;
        }

        .activation-kpi-card h3 {
          margin: 0;
          font-size: 32px;
          letter-spacing: -0.04em;
        }

        .activation-panel {
          border-radius: 28px;
          padding: 26px;
          margin-bottom: 18px;
        }

        .activation-panel h2 {
          margin: 0;
          font-size: 31px;
          letter-spacing: -0.04em;
        }

        .activation-panel-copy {
          color: #c7d7f4;
          line-height: 1.6;
          margin: 10px 0 0;
        }

        .activation-layer-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .activation-layer-card {
          border-radius: 24px;
          padding: 18px;
          display: grid;
          gap: 14px;
        }

        .activation-layer-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        .activation-layer-id {
          display: inline-flex;
          border: 1px solid rgba(245, 200, 91, 0.24);
          background: rgba(245, 200, 91, 0.1);
          color: #fde68a;
          border-radius: 999px;
          padding: 6px 9px;
          font-size: 10px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 10px;
        }

        .activation-layer-card h2 {
          margin: 0;
          font-size: 20px;
          letter-spacing: -0.04em;
        }

        .activation-layer-description {
          color: #c7d7f4;
          line-height: 1.5;
          font-size: 13px;
          margin: 0;
        }

        .activation-status-pill {
          display: inline-flex;
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 11px;
          font-weight: 950;
          white-space: nowrap;
        }

        .healthy,
        .status-approved,
        .status-activated,
        .status-ready-for-activation {
          background: rgba(22, 163, 74, 0.22);
          color: #bbf7d0;
        }

        .watch,
        .status-submitted,
        .status-pending {
          background: rgba(245, 158, 11, 0.2);
          color: #fde68a;
        }

        .at-risk,
        .status-rejected {
          background: rgba(239, 68, 68, 0.2);
          color: #fecaca;
        }

        .neutral,
        .status-not-submitted,
        .status-inactive {
          background: rgba(59, 130, 246, 0.18);
          color: #bfdbfe;
        }

        .activation-count-row,
        .activation-metric-row {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }

        .activation-count-row div,
        .activation-metric-row div,
        .approval-state-card {
          border: 1px solid rgba(147, 197, 253, 0.12);
          background: rgba(2, 6, 23, 0.24);
          border-radius: 16px;
          padding: 11px;
        }

        .activation-count-row small,
        .activation-metric-row small,
        .approval-state-card small {
          display: block;
          color: #9db3d7;
          font-size: 11px;
          margin-bottom: 6px;
        }

        .activation-count-row strong,
        .activation-metric-row strong,
        .approval-state-card strong {
          display: block;
          color: #ffffff;
          font-size: 13px;
          word-break: break-word;
        }

        .approval-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
        }

        .approval-actions {
          display: grid;
          gap: 8px;
        }

        .activation-card-link {
          color: #93c5fd;
          text-decoration: none;
          font-weight: 950;
          font-size: 13px;
        }

        .impact-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          margin-top: 18px;
        }

        .impact-card {
          border-radius: 22px;
          padding: 18px;
        }

        .impact-card-top {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
        }

        .impact-card h3 {
          margin: 0;
          font-size: 20px;
          letter-spacing: -0.03em;
        }

        .impact-card p {
          color: #c7d7f4;
          line-height: 1.5;
          font-size: 13px;
        }

        .impact-layer-list {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 12px;
        }

        .impact-layer-list span {
          border: 1px solid rgba(147, 197, 253, 0.14);
          background: rgba(2, 6, 23, 0.24);
          border-radius: 999px;
          padding: 6px 9px;
          font-size: 11px;
          color: #dbeafe;
          font-weight: 850;
        }

        .activation-flow-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-top: 18px;
        }

        .activation-flow-grid div {
          border: 1px solid rgba(147, 197, 253, 0.14);
          background: rgba(2, 6, 23, 0.24);
          border-radius: 18px;
          padding: 16px;
        }

        .activation-flow-grid span {
          display: inline-grid;
          place-items: center;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(245, 200, 91, 0.14);
          color: #fde68a;
          font-weight: 950;
          margin-bottom: 10px;
        }

        .activation-flow-grid strong {
          display: block;
          font-size: 16px;
        }

        .activation-flow-grid p {
          color: #c7d7f4;
          font-size: 13px;
          line-height: 1.5;
        }

        .event-list {
          display: grid;
          gap: 10px;
          margin-top: 18px;
        }

        .event-card {
          border-radius: 18px;
          padding: 14px;
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
        }

        .event-card strong {
          display: block;
          color: #ffffff;
        }

        .event-card p {
          margin: 6px 0 0;
          color: #c7d7f4;
          line-height: 1.45;
          font-size: 13px;
        }

        .event-card span {
          color: #9db3d7;
          font-size: 12px;
          white-space: nowrap;
        }

        .activation-master-panel {
          border: 1px solid rgba(245, 200, 91, 0.28);
          background:
            linear-gradient(90deg, rgba(245, 200, 91, 0.14), rgba(37, 99, 235, 0.12)),
            rgba(15, 23, 42, 0.76);
          border-radius: 28px;
          padding: 26px;
          margin-bottom: 18px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 18px;
        }

        .activation-master-panel h2 {
          margin: 0;
          font-size: 30px;
          letter-spacing: -0.04em;
        }

        .activation-master-panel p {
          color: #fde68a;
          line-height: 1.55;
          margin: 8px 0 0;
        }

        @media (max-width: 1180px) {
          .activation-hero,
          .activation-layer-grid,
          .impact-grid,
          .activation-flow-grid {
            grid-template-columns: 1fr;
          }

          .activation-master-panel,
          .activation-nav {
            flex-direction: column;
            align-items: flex-start;
          }

          .activation-kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .activation-page {
            padding: 20px;
          }

          .activation-kpi-grid {
            grid-template-columns: 1fr;
          }

          .activation-actions,
          .activation-nav-links {
            width: 100%;
          }

          .activation-primary-button,
          .activation-secondary-button {
            width: 100%;
            text-align: center;
          }
        }
      `}</style>

      <section className="activation-shell">
        <nav className="activation-nav">
          <a className="activation-brand" href="/">
            VENTIQ
          </a>

          <div className="activation-nav-links">
            <a className="activation-secondary-button" href="/migration">
              Migration Home
            </a>
            <a
              className="activation-secondary-button"
              href="/migration/data-intake"
            >
              Data Intake
            </a>
            <a
              className="activation-secondary-button"
              href="/migration/stakeholder-launch"
            >
              Stakeholder Launch
            </a>
          </div>
        </nav>

        <div className="activation-hero">
          <div>
            <p className="activation-eyebrow">
              One Fund · Six Stakeholders · One Source of Truth
            </p>

            <h1>Data Readiness & Fund Activation</h1>

            <p>
              Before VENTIQ launches stakeholder dashboards, the five migration
              layers must be uploaded, validated, submitted by maker, approved by
              checker and activated into the operating layer.
            </p>

            <div className="activation-actions">
              <button
                className="activation-primary-button"
                disabled={loading}
                onClick={loadActivationSnapshot}
                type="button"
              >
                {loading ? "Refreshing..." : "Refresh Readiness"}
              </button>

              <a className="activation-secondary-button" href="/document-studio">
                Open Document Studio
              </a>

              <a className="activation-secondary-button" href="/fund-onboarding">
                Fund Onboarding
              </a>
            </div>
          </div>

          <div className="activation-score-card">
            <span>Fund Activation Score</span>
            <strong>{readiness.activationScore}%</strong>
            <p>
              Readiness {readiness.readinessScore}% · Approval{" "}
              {readiness.approvalScore}% · {readiness.activatedCount}/5
              activated
            </p>
          </div>
        </div>

        {message && <div className="activation-note">{message}</div>}

        <div className="activation-kpi-grid">
          <div className="activation-kpi-card">
            <span>✓</span>
            <p>Ready layers</p>
            <h3>{readiness.readyCount}</h3>
          </div>

          <div className="activation-kpi-card">
            <span>◷</span>
            <p>Review layers</p>
            <h3>{readiness.reviewCount}</h3>
          </div>

          <div className="activation-kpi-card">
            <span>◇</span>
            <p>Not started</p>
            <h3>{readiness.notStartedCount}</h3>
          </div>

          <div className="activation-kpi-card">
            <span>◎</span>
            <p>Checker approved</p>
            <h3>{readiness.approvedCount}</h3>
          </div>
        </div>

        <div className="activation-master-panel">
          <div>
            <p className="activation-eyebrow">Activation Control</p>
            <h2>
              {readiness.hasActivated
                ? "Fund data is activated"
                : "Activate only after maker-checker approval"}
            </h2>
            <p>
              Raw uploaded data should not update dashboards directly. Approved
              migration data becomes the source for dashboards, workflows,
              documents and investor access.
            </p>
          </div>

          <button
            className="activation-primary-button"
            disabled={!readiness.canActivate || actionLoading === "activate-fund"}
            onClick={activateFundData}
            type="button"
          >
            {actionLoading === "activate-fund"
              ? "Activating..."
              : "Activate Fund Data"}
          </button>
        </div>

        <div className="activation-layer-grid">
          {layers.map((layer) => {
            const review = reviews[layer.id];

            return (
              <div className="activation-layer-card" key={layer.id}>
                <div className="activation-layer-top">
                  <div>
                    <span className="activation-layer-id">{layer.shortTitle}</span>
                    <h2>{layer.title}</h2>
                  </div>

                  <span
                    className={`activation-status-pill ${getLayerHealth(
                      layer.status
                    )}`}
                  >
                    {layer.status}
                  </span>
                </div>

                <p className="activation-layer-description">
                  {layer.description}
                </p>

                <div className="activation-count-row">
                  <div>
                    <small>{layer.countLabel}</small>
                    <strong>{layer.countValue}</strong>
                  </div>

                  <div>
                    <small>Latest batch</small>
                    <strong>{layer.batchName}</strong>
                  </div>
                </div>

                <div className="activation-metric-row">
                  {layer.metrics.map((metric) => (
                    <div key={`${layer.id}-${metric.label}`}>
                      <small>{metric.label}</small>
                      <strong>{metric.value}</strong>
                    </div>
                  ))}
                </div>

                <div className="approval-grid">
                  <div className="approval-state-card">
                    <small>Maker</small>
                    <strong>
                      <span
                        className={`activation-status-pill status-${getStatusClass(
                          review?.makerStatus || "Not Submitted"
                        )}`}
                      >
                        {review?.makerStatus || "Not Submitted"}
                      </span>
                    </strong>
                  </div>

                  <div className="approval-state-card">
                    <small>Checker</small>
                    <strong>
                      <span
                        className={`activation-status-pill status-${getStatusClass(
                          review?.checkerStatus || "Pending"
                        )}`}
                      >
                        {review?.checkerStatus || "Pending"}
                      </span>
                    </strong>
                  </div>

                  <div className="approval-state-card">
                    <small>Activation</small>
                    <strong>
                      <span
                        className={`activation-status-pill status-${getStatusClass(
                          review?.activationStatus || "Inactive"
                        )}`}
                      >
                        {review?.activationStatus || "Inactive"}
                      </span>
                    </strong>
                  </div>
                </div>

                <div className="approval-actions">
                  <button
                    className="activation-small-button"
                    disabled={actionLoading === `submit-${layer.id}`}
                    onClick={() => submitLayer(layer)}
                    type="button"
                  >
                    {actionLoading === `submit-${layer.id}`
                      ? "Submitting..."
                      : "Maker Submit"}
                  </button>

                  <button
                    className="activation-small-button"
                    disabled={actionLoading === `approve-${layer.id}`}
                    onClick={() => approveLayer(layer)}
                    type="button"
                  >
                    {actionLoading === `approve-${layer.id}`
                      ? "Approving..."
                      : "Checker Approve"}
                  </button>

                  <button
                    className="activation-danger-button"
                    disabled={actionLoading === `reject-${layer.id}`}
                    onClick={() => rejectLayer(layer)}
                    type="button"
                  >
                    {actionLoading === `reject-${layer.id}`
                      ? "Rejecting..."
                      : "Reject"}
                  </button>
                </div>

                <a className="activation-card-link" href={layer.route}>
                  Open data workspace →
                </a>
              </div>
            );
          })}
        </div>

        <div className="activation-panel">
          <p className="activation-eyebrow">Dashboard Impact Map</p>
          <h2>Which stakeholder dashboards go live after activation?</h2>
          <p className="activation-panel-copy">
            This keeps the VENTIQ promise clear: the migration layer powers six
            role-specific dashboards from one fund data source.
          </p>

          <div className="impact-grid">
            {dashboardImpactMap.map((item) => {
              const ready = isImpactReady(item.layers);

              return (
                <div className="impact-card" key={item.title}>
                  <div className="impact-card-top">
                    <h3>{item.title}</h3>
                    <span
                      className={`activation-status-pill ${
                        ready ? "healthy" : "neutral"
                      }`}
                    >
                      {ready ? "Live" : "Waiting"}
                    </span>
                  </div>

                  <p>{item.output}</p>

                  <div className="impact-layer-list">
                    {item.layers.map((layerId) => (
                      <span key={`${item.title}-${layerId}`}>{layerId}</span>
                    ))}
                  </div>

                  <div className="activation-actions">
                    <a className="activation-card-link" href={item.href}>
                      Open dashboard →
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="activation-panel">
          <p className="activation-eyebrow">Workflow Activation Map</p>
          <h2>Which workflow engines become usable?</h2>
          <p className="activation-panel-copy">
            Workflows are not separate tools. They are execution engines that
            keep dashboards, approvals, documents and investor access current.
          </p>

          <div className="impact-grid">
            {workflowImpactMap.map((item) => {
              const ready = isImpactReady(item.layers);

              return (
                <div className="impact-card" key={item.title}>
                  <div className="impact-card-top">
                    <h3>{item.title}</h3>
                    <span
                      className={`activation-status-pill ${
                        ready ? "healthy" : "neutral"
                      }`}
                    >
                      {ready ? "Activated" : "Waiting"}
                    </span>
                  </div>

                  <div className="impact-layer-list">
                    {item.layers.map((layerId) => (
                      <span key={`${item.title}-${layerId}`}>{layerId}</span>
                    ))}
                  </div>

                  <div className="activation-actions">
                    <a className="activation-card-link" href={item.href}>
                      Open workflow →
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="activation-panel">
          <p className="activation-eyebrow">Activation Sequence</p>
          <h2>The commercial onboarding logic</h2>

          <div className="activation-flow-grid">
            <div>
              <span>1</span>
              <strong>Upload five data layers</strong>
              <p>
                Investor data, PDF dump, portfolio data, fund data and
                compliance data enter VENTIQ through migration.
              </p>
            </div>

            <div>
              <span>2</span>
              <strong>Maker submits</strong>
              <p>
                The operations owner confirms the uploaded layer is complete
                enough for checker review.
              </p>
            </div>

            <div>
              <span>3</span>
              <strong>Checker approves</strong>
              <p>
                Approved data becomes eligible for dashboard and workflow
                activation.
              </p>
            </div>

            <div>
              <span>4</span>
              <strong>Fund activates</strong>
              <p>
                Stakeholder dashboards, workflow engines, data room and investor
                portal consume approved data only.
              </p>
            </div>
          </div>
        </div>

        <div className="activation-panel">
          <p className="activation-eyebrow">Recent Activation Activity</p>
          <h2>Audit trail for migration activation</h2>

          <div className="event-list">
            {events.length === 0 && (
              <div className="event-card">
                <div>
                  <strong>No activation events yet</strong>
                  <p>
                    Submit, approve or activate a layer to create the first
                    activation audit event.
                  </p>
                </div>
              </div>
            )}

            {events.map((event) => (
              <div className="event-card" key={event.id}>
                <div>
                  <strong>{event.eventTitle}</strong>
                  <p>{event.eventDescription}</p>
                </div>

                <span>
                  {event.createdAt ? event.createdAt.slice(0, 10) : "Today"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}