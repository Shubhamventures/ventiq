"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useVentiqAuth } from "../../../lib/auth/AuthProvider";
import { useActiveFund } from "../../../lib/useActiveFund";

type LayerKey = "investor" | "pdf" | "portfolio" | "fund" | "compliance";
type LaunchStatus = "Ready" | "Partial" | "Not Started" | "Needs Review";

type GovernedFundOption = {
  fund_name: string;
  role: string;
  can_view: boolean;
  can_edit: boolean;
  can_approve: boolean;
};

type ApiLayer = {
  key: LayerKey;
  title: string;
  source_table: string;
  source_batch_id: string;
  batch_name: string;
  data_ready: boolean;
  approval_status: string;
  approved: boolean;
  operational: boolean;
  count: number;
  primary_metric: string;
  secondary_metric: string;
  warning_count: number;
  blockers: string[];
};

type LaunchSnapshot = {
  ok?: boolean;
  error?: string;
  fund?: GovernedFundOption;
  activation?: {
    status: string;
    readiness_score: number;
    activated_at: string;
    activated_by: string;
    is_active: boolean;
    using_frozen_batch_map: boolean;
  };
  layers?: ApiLayer[];
  summary?: {
    operational_layers: number;
    total_layers: number;
    launch_gate_open: boolean;
  };
};

type StakeholderCard = {
  id: string;
  title: string;
  description: string;
  route: string;
  requiredLayers: LayerKey[];
  status: LaunchStatus;
  missingLayers: LayerKey[];
  blockers: string[];
  metrics: {
    label: string;
    value: string;
  }[];
};

const DEFAULT_FUND_NAME = "VENTIQ Growth Fund II";

const layerLabels: Record<LayerKey, string> = {
  investor: "Investor Data",
  pdf: "PDF Intelligence",
  portfolio: "Portfolio Data",
  fund: "Fund Data",
  compliance: "Compliance Data",
};

const emptyLayers: ApiLayer[] = (
  ["investor", "pdf", "portfolio", "fund", "compliance"] as LayerKey[]
).map((key) => ({
  key,
  title: layerLabels[key],
  source_table: "",
  source_batch_id: "",
  batch_name: "No governed batch loaded",
  data_ready: false,
  approval_status: "Draft",
  approved: false,
  operational: false,
  count: 0,
  primary_metric: "No governed data",
  secondary_metric: "Not ready",
  warning_count: 0,
  blockers: ["SOURCE_BATCH_MISSING"],
}));

function getStatusClass(status: LaunchStatus) {
  if (status === "Ready") return "healthy";
  if (status === "Partial") return "watch";
  if (status === "Needs Review") return "at-risk";
  return "neutral";
}

function humanizeBlocker(code: string) {
  const labels: Record<string, string> = {
    SOURCE_BATCH_MISSING: "source batch missing",
    CHECKER_APPROVAL_REQUIRED: "checker approval required",
    FUND_ACTIVATION_REQUIRED: "fund activation required",
    INVESTOR_RECORDS_MISSING: "investor records missing",
    INVESTOR_COMMITMENT_MISSING: "investor commitment missing",
    INVESTOR_BATCH_NOT_FINAL: "investor batch not final",
    PDF_FILES_MISSING: "PDF files missing",
    PDF_REVIEW_REQUIRED: "PDF review required",
    PDF_UNMATCHED: "unmatched PDFs remain",
    PDF_CLASSIFICATION_INCOMPLETE: "PDF classification incomplete",
    PORTFOLIO_RECORDS_MISSING: "portfolio records missing",
    PORTFOLIO_VALUE_MISSING: "portfolio value missing",
    FUND_RECORD_MISSING: "fund record missing",
    FUND_COMMITMENT_MISSING: "fund commitment missing",
    COMPLIANCE_ITEMS_MISSING: "compliance items missing",
    COMPLIANCE_REVIEW_REQUIRED: "compliance review required",
    COMPLIANCE_HIGH_RISK_OPEN: "high-risk compliance items open",
    COMPLIANCE_EVIDENCE_MISSING: "compliance evidence missing",
  };

  return labels[code] ?? code.toLowerCase().replaceAll("_", " ");
}

function buildStakeholders(layers: ApiLayer[]): StakeholderCard[] {
  const byKey = new Map(layers.map((layer) => [layer.key, layer]));

  const definitions = [
    {
      id: "investor-portal",
      title: "Investor Portal",
      description:
        "Launch investor login with governed documents, financial position, capital account and notices.",
      route: "/investor-portal",
      requiredLayers: ["investor", "pdf"] as LayerKey[],
    },
    {
      id: "finance-head",
      title: "Finance Head Workspace",
      description:
        "Operate fund economics, investor data, compliance evidence and finance workflows.",
      route: "/finance-head-ai",
      requiredLayers: ["investor", "fund", "compliance"] as LayerKey[],
    },
    {
      id: "investment-team",
      title: "Investment Team Workspace",
      description:
        "Operate portfolio monitoring, repayment schedules, risk tracking and exit visibility.",
      route: "/investment-team-ai",
      requiredLayers: ["portfolio", "pdf"] as LayerKey[],
    },
    {
      id: "compliance",
      title: "Compliance Dashboard",
      description:
        "Operate filing status, due dates, risk items, evidence tracking and owner accountability.",
      route: "/compliance-ai",
      requiredLayers: ["fund", "compliance", "pdf"] as LayerKey[],
    },
    {
      id: "managing-partner",
      title: "Managing Partner Dashboard",
      description:
        "Leadership view across governed fund, investor, portfolio, PDF and compliance data.",
      route: "/managing-partner-ai",
      requiredLayers: [
        "investor",
        "pdf",
        "portfolio",
        "fund",
        "compliance",
      ] as LayerKey[],
    },
    {
      id: "investor-relations",
      title: "Investor Relations",
      description:
        "Operate LP communication, investor documents, pending items and reporting follow-ups.",
      route: "/fundraising-ai",
      requiredLayers: ["investor", "pdf", "compliance"] as LayerKey[],
    },
  ];

  return definitions.map((definition) => {
    const required = definition.requiredLayers
      .map((key) => byKey.get(key))
      .filter((layer): layer is ApiLayer => Boolean(layer));

    const missingLayers = required
      .filter((layer) => !layer.operational)
      .map((layer) => layer.key);

    const blockers = Array.from(
      new Set(
        required
          .filter((layer) => !layer.operational)
          .flatMap((layer) => layer.blockers)
      )
    );

    const operationalCount = required.filter((layer) => layer.operational).length;
    const anyEvidence = required.some(
      (layer) => layer.source_batch_id || layer.data_ready || layer.approved
    );

    let status: LaunchStatus = "Not Started";

    if (required.length > 0 && operationalCount === required.length) {
      status = "Ready";
    } else if (operationalCount > 0) {
      status = "Partial";
    } else if (anyEvidence) {
      status = "Needs Review";
    }

    const investor = byKey.get("investor");
    const pdf = byKey.get("pdf");
    const portfolio = byKey.get("portfolio");
    const compliance = byKey.get("compliance");
    const fund = byKey.get("fund");

    const metrics =
      definition.id === "investor-portal"
        ? [
            { label: "Investors", value: String(investor?.count ?? 0) },
            { label: "PDF documents", value: String(pdf?.count ?? 0) },
          ]
        : definition.id === "finance-head"
          ? [
              {
                label: "Commitment",
                value: investor?.primary_metric ?? "No governed data",
              },
              {
                label: "Compliance items",
                value: String(compliance?.count ?? 0),
              },
            ]
          : definition.id === "investment-team"
            ? [
                {
                  label: "Investments",
                  value: String(portfolio?.count ?? 0),
                },
                {
                  label: "Portfolio value",
                  value: portfolio?.primary_metric ?? "No governed data",
                },
              ]
            : definition.id === "compliance"
              ? [
                  {
                    label: "Compliance records",
                    value: String(compliance?.count ?? 0),
                  },
                  {
                    label: "Review signals",
                    value: String(compliance?.warning_count ?? 0),
                  },
                ]
              : definition.id === "managing-partner"
                ? [
                    {
                      label: "Operational layers",
                      value: String(layers.filter((layer) => layer.operational).length),
                    },
                    {
                      label: "Approved fund",
                      value: fund?.approved ? "Yes" : "No",
                    },
                  ]
                : [
                    {
                      label: "Investors",
                      value: String(investor?.count ?? 0),
                    },
                    {
                      label: "Review signals",
                      value: String(
                        (pdf?.warning_count ?? 0) +
                          (compliance?.warning_count ?? 0)
                      ),
                    },
                  ];

    return {
      ...definition,
      status,
      missingLayers,
      blockers,
      metrics,
    };
  });
}

export default function StakeholderLaunchCenterPage() {
  const { session } = useVentiqAuth();
  const {
    activeFundName,
    setActiveFundName,
    isReady: fundContextReady,
  } = useActiveFund(DEFAULT_FUND_NAME);

  const [authorisedFunds, setAuthorisedFunds] = useState<GovernedFundOption[]>([]);
  const [fundAccessReady, setFundAccessReady] = useState(false);
  const [fundAccessMessage, setFundAccessMessage] = useState("");
  const [snapshot, setSnapshot] = useState<LaunchSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const activeFundAccess = useMemo(() => {
    const normalized = activeFundName.trim().toLowerCase();
    return (
      authorisedFunds.find(
        (fund) => fund.fund_name.trim().toLowerCase() === normalized
      ) ?? null
    );
  }, [authorisedFunds, activeFundName]);

  useEffect(() => {
    const accessToken = session?.access_token?.trim() || "";

    if (!fundContextReady) return;

    if (!accessToken) {
      setAuthorisedFunds([]);
      setFundAccessMessage("Sign in to load your governed fund access.");
      setFundAccessReady(true);
      return;
    }

    let cancelled = false;

    async function loadGovernedFunds() {
      setFundAccessReady(false);
      setFundAccessMessage("");

      try {
        const response = await fetch("/api/fund-context", {
          method: "GET",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || "Unable to load governed VENTIQ fund context."
          );
        }

        if (cancelled) return;

        const funds = (result.funds ?? []) as GovernedFundOption[];
        setAuthorisedFunds(funds);

        if (funds.length === 0) {
          setFundAccessMessage(
            "No active fund access is available for this VENTIQ account."
          );
          setFundAccessReady(true);
          return;
        }

        const normalizedActiveFund = activeFundName.trim().toLowerCase();
        const currentFundIsAllowed = funds.some(
          (fund) => fund.fund_name.trim().toLowerCase() === normalizedActiveFund
        );

        if (!currentFundIsAllowed) {
          const nextFund = funds[0].fund_name;
          setActiveFundName(nextFund);
          setFundAccessMessage(
            `Stakeholder Launch moved to your first authorised fund: ${nextFund}.`
          );
        }

        setFundAccessReady(true);
      } catch (error) {
        if (cancelled) return;

        setAuthorisedFunds([]);
        setFundAccessMessage(
          error instanceof Error
            ? error.message
            : "Unable to load governed VENTIQ fund context."
        );
        setFundAccessReady(true);
      }
    }

    void loadGovernedFunds();

    return () => {
      cancelled = true;
    };
  }, [
    fundContextReady,
    session?.access_token,
    activeFundName,
    setActiveFundName,
  ]);

  const loadLaunchSnapshot = useCallback(async () => {
    const accessToken = session?.access_token?.trim() || "";

    if (
      !fundContextReady ||
      !fundAccessReady ||
      !activeFundAccess ||
      !activeFundName.trim()
    ) {
      return;
    }

    if (!accessToken) {
      setSnapshot(null);
      setMessage("A secure VENTIQ session is required.");
      return;
    }

    setLoading(true);
    setMessage("Loading governed stakeholder launch readiness...");

    try {
      const response = await fetch(
        `/api/migration/stakeholder-launch?fund_name=${encodeURIComponent(
          activeFundName
        )}`,
        {
          method: "GET",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const result = (await response.json()) as LaunchSnapshot;

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to load stakeholder launch readiness."
        );
      }

      setSnapshot(result);
      setMessage(
        result.activation?.is_active
          ? `Governed launch state loaded for ${activeFundName}.`
          : `${activeFundName} is not activated. Stakeholder launch remains locked.`
      );
    } catch (error) {
      setSnapshot(null);
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load stakeholder launch readiness."
      );
    } finally {
      setLoading(false);
    }
  }, [
    session?.access_token,
    fundContextReady,
    fundAccessReady,
    activeFundAccess,
    activeFundName,
  ]);

  useEffect(() => {
    void loadLaunchSnapshot();
  }, [loadLaunchSnapshot]);

  const layers = snapshot?.layers ?? emptyLayers;

  const stakeholders = useMemo(() => buildStakeholders(layers), [layers]);

  const launchSummary = useMemo(() => {
    const readyStakeholders = stakeholders.filter(
      (stakeholder) => stakeholder.status === "Ready"
    ).length;

    const reviewStakeholders = stakeholders.filter(
      (stakeholder) =>
        stakeholder.status === "Partial" ||
        stakeholder.status === "Needs Review"
    ).length;

    const notStartedStakeholders = stakeholders.filter(
      (stakeholder) => stakeholder.status === "Not Started"
    ).length;

    return {
      readyStakeholders,
      reviewStakeholders,
      notStartedStakeholders,
      readyLayers: layers.filter((layer) => layer.operational).length,
      launchScore:
        stakeholders.length === 0
          ? 0
          : Math.round((readyStakeholders / stakeholders.length) * 100),
    };
  }, [layers, stakeholders]);

  const activation = snapshot?.activation;
  const launchGateOpen = Boolean(snapshot?.summary?.launch_gate_open);

  return (
    <main className="activation-page">
      <section className="activation-shell">
        <div className="activation-panel">
          <div className="section-heading-row">
            <div>
              <p className="activation-eyebrow">
                <span>VENTIQ</span> Governed Fund Context
              </p>
              <h2>{activeFundName || "No authorised fund selected"}</h2>
              <p>
                Stakeholder launch now follows the same governed active fund used
                by Data Intake and Activation.
              </p>
            </div>

            <span className="activation-status-pill healthy">
              {activeFundAccess
                ? `${activeFundAccess.role} · ${
                    activeFundAccess.can_view ? "View" : "No View"
                  }`
                : fundAccessReady
                  ? "No Fund Access"
                  : "Loading Access"}
            </span>
          </div>

          <label htmlFor="stakeholder-launch-active-fund">
            <strong>Switch active fund</strong>
          </label>
          <select
            id="stakeholder-launch-active-fund"
            value={activeFundAccess ? activeFundName : ""}
            onChange={(event) => setActiveFundName(event.target.value)}
            disabled={!fundAccessReady || authorisedFunds.length === 0}
          >
            {authorisedFunds.length === 0 ? (
              <option value="">No authorised funds available</option>
            ) : (
              authorisedFunds.map((fund) => (
                <option key={fund.fund_name} value={fund.fund_name}>
                  {fund.fund_name}
                </option>
              ))
            )}
          </select>

          {fundAccessMessage && (
            <div className="activation-note">{fundAccessMessage}</div>
          )}
        </div>

        <div className="activation-hero">
          <div>
            <p className="activation-eyebrow">
              <span>VENTIQ</span> Migration Portal
            </p>

            <h1>Stakeholder Launch Center</h1>

            <p>
              Launch only from the fund&apos;s governed, checker-approved and
              activated migration state. Newer unapproved batches do not silently
              replace the frozen activation baseline.
            </p>

            <div className="activation-actions">
              <button
                className="activation-primary-button"
                disabled={loading || !activeFundAccess}
                onClick={() => void loadLaunchSnapshot()}
                type="button"
              >
                {loading ? "Refreshing..." : "Refresh Launch Readiness"}
              </button>

              <Link
                className="activation-secondary-button"
                href="/migration/activation"
              >
                Back to Activation Dashboard
              </Link>

              <Link
                className="activation-secondary-button"
                href="/migration/data-intake"
              >
                Back to Data Intake
              </Link>
            </div>
          </div>

          <div className="activation-score-card">
            <span>Launch Score</span>
            <strong>{launchSummary.launchScore}%</strong>
            <p>
              {launchSummary.readyStakeholders} ready ·{" "}
              {launchSummary.reviewStakeholders} review ·{" "}
              {launchSummary.notStartedStakeholders} not started
            </p>
            <span
              className={`activation-status-pill ${
                launchGateOpen ? "healthy" : "neutral"
              }`}
            >
              {launchGateOpen ? "Launch Gate Open" : "Launch Locked"}
            </span>
          </div>
        </div>

        {message && <div className="activation-note">{message}</div>}

        <div className="activation-kpi-grid">
          <div className="activation-kpi-card">
            <span>✓</span>
            <p>Ready stakeholders</p>
            <h3>{launchSummary.readyStakeholders}</h3>
          </div>

          <div className="activation-kpi-card">
            <span>◷</span>
            <p>Review stakeholders</p>
            <h3>{launchSummary.reviewStakeholders}</h3>
          </div>

          <div className="activation-kpi-card">
            <span>◇</span>
            <p>Operational layers</p>
            <h3>{launchSummary.readyLayers}/5</h3>
          </div>

          <div className="activation-kpi-card">
            <span>◎</span>
            <p>Fund activation</p>
            <h3>{activation?.is_active ? "Active" : "Locked"}</h3>
          </div>
        </div>

        <div className="stakeholder-layer-strip">
          {layers.map((layer) => (
            <div className="stakeholder-layer-card" key={layer.key}>
              <div>
                <span>{layer.title}</span>
                <strong>{layer.count}</strong>
              </div>

              <p>{layer.primary_metric}</p>
              <small>{layer.secondary_metric}</small>
              <small>
                Approval: {layer.approval_status} · Batch: {layer.batch_name}
              </small>

              <span
                className={`activation-status-pill ${
                  layer.operational ? "healthy" : "neutral"
                }`}
              >
                {layer.operational ? "Operational" : "Blocked"}
              </span>

              {!layer.operational && layer.blockers.length > 0 && (
                <small>
                  {layer.blockers.map(humanizeBlocker).join(" · ")}
                </small>
              )}
            </div>
          ))}
        </div>

        <div className="stakeholder-grid">
          {stakeholders.map((stakeholder) => (
            <div className="stakeholder-card" key={stakeholder.id}>
              <div className="stakeholder-card-top">
                <div>
                  <span>{stakeholder.id}</span>
                  <h2>{stakeholder.title}</h2>
                </div>

                <span
                  className={`activation-status-pill ${getStatusClass(
                    stakeholder.status
                  )}`}
                >
                  {stakeholder.status}
                </span>
              </div>

              <p>{stakeholder.description}</p>

              <div className="stakeholder-requirements">
                <small>Required governed layers</small>

                <div>
                  {stakeholder.requiredLayers.map((layerKey) => {
                    const layer = layers.find(
                      (candidate) => candidate.key === layerKey
                    );

                    return (
                      <span
                        className={
                          layer?.operational
                            ? "requirement-chip ready"
                            : "requirement-chip missing"
                        }
                        key={`${stakeholder.id}-${layerKey}`}
                      >
                        {layerLabels[layerKey]}
                      </span>
                    );
                  })}
                </div>
              </div>

              {stakeholder.missingLayers.length > 0 && (
                <div className="stakeholder-warning">
                  Blocked by:{" "}
                  {stakeholder.blockers.length > 0
                    ? stakeholder.blockers.map(humanizeBlocker).join(", ")
                    : stakeholder.missingLayers
                        .map((layerKey) => layerLabels[layerKey])
                        .join(", ")}
                </div>
              )}

              <div className="activation-metric-row">
                {stakeholder.metrics.map((metric) => (
                  <div key={`${stakeholder.id}-${metric.label}`}>
                    <small>{metric.label}</small>
                    <strong>{metric.value}</strong>
                  </div>
                ))}
              </div>

              {stakeholder.status === "Ready" ? (
                <Link className="activation-card-link" href={stakeholder.route}>
                  Open dashboard →
                </Link>
              ) : (
                <Link
                  className="activation-card-link"
                  href="/migration/activation"
                >
                  Resolve launch blockers →
                </Link>
              )}
            </div>
          ))}
        </div>

        <div className="activation-panel">
          <div>
            <p className="activation-eyebrow">Controlled launch sequence</p>
            <h2>Migration evidence → approval → activation → stakeholder access</h2>
          </div>

          <div className="activation-flow-grid">
            <div>
              <span>1</span>
              <strong>Upload once</strong>
              <p>
                Historical investor, PDF, portfolio, fund and compliance data is
                staged under the selected governed fund.
              </p>
            </div>

            <div>
              <span>2</span>
              <strong>Validate and approve</strong>
              <p>
                Each mandatory layer must satisfy its readiness checks and retain
                the exact checker-approved source batch.
              </p>
            </div>

            <div>
              <span>3</span>
              <strong>Activate the fund</strong>
              <p>
                Activation freezes the approved batch map so later unapproved
                migration activity cannot silently change stakeholder data.
              </p>
            </div>

            <div>
              <span>4</span>
              <strong>Launch by role</strong>
              <p>
                Only stakeholder workspaces whose required governed layers are
                operational are presented as ready to launch.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
