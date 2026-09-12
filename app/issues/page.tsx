"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useVentiqAuth } from "../../lib/auth/AuthProvider";
import { useActiveFund } from "../../lib/useActiveFund";

type IssueSeverity = "Blocking" | "Review";
type IssueSource = "Data Intake" | "Calculation" | "Activation";

type IssueRecord = {
  id: string;
  source: IssueSource;
  severity: IssueSeverity;
  code: string;
  title: string;
  message: string;
  repairHref: string;
  context: Record<string, string | number | null>;
};

type IssueApiResponse = {
  ok?: boolean;
  error?: string;
  latestBatch?: null | {
    id: string;
    batch_name: string;
    status: string;
    processing_status: string;
    total_rows: number;
    validation_error_count: number;
    validation_warning_count: number;
    updated_at: string;
  };
  latestCalculation?: null | {
    id: string;
    as_of_date: string;
    calculation_status: string;
    completed_at: string;
  };
  issues?: IssueRecord[];
};

type LayerKey = "investor" | "pdf" | "portfolio" | "fund" | "compliance";

type LaunchLayer = {
  key: LayerKey;
  title: string;
  source_batch_id: string;
  batch_name: string;
  data_ready: boolean;
  approval_status: string;
  approved: boolean;
  operational: boolean;
  warning_count: number;
  blockers: string[];
};

type LaunchApiResponse = {
  ok?: boolean;
  error?: string;
  activation?: {
    status: string;
    readiness_score: number;
    is_active: boolean;
    calculation_run_id: string;
    calculation_ready: boolean;
    reconciliation_controls: number;
    reconciliation_passed: number;
  };
  layers?: LaunchLayer[];
  summary?: {
    operational_layers: number;
    total_layers: number;
    calculation_ready: boolean;
    launch_gate_open: boolean;
  };
};

const blockerLabels: Record<string, string> = {
  SOURCE_BATCH_MISSING: "Source batch is missing",
  CHECKER_APPROVAL_REQUIRED: "Checker approval is required",
  FUND_ACTIVATION_REQUIRED: "Fund activation is required",
  INVESTOR_RECORDS_MISSING: "Investor records are missing",
  INVESTOR_COMMITMENT_MISSING: "Investor commitments are missing",
  INVESTOR_BATCH_NOT_FINAL: "Investor batch is not final",
  PDF_FILES_MISSING: "PDF files are missing",
  PDF_REVIEW_REQUIRED: "PDF review is required",
  PDF_UNMATCHED: "Unmatched PDFs remain",
  PDF_CLASSIFICATION_INCOMPLETE: "PDF classification is incomplete",
  PORTFOLIO_RECORDS_MISSING: "Portfolio records are missing",
  PORTFOLIO_VALUE_MISSING: "Portfolio value is missing",
  FUND_RECORD_MISSING: "Fund record is missing",
  FUND_COMMITMENT_MISSING: "Fund commitment is missing",
  COMPLIANCE_ITEMS_MISSING: "Compliance items are missing",
  COMPLIANCE_REVIEW_REQUIRED: "Compliance review is required",
  COMPLIANCE_HIGH_RISK_OPEN: "High-risk compliance items remain open",
  COMPLIANCE_EVIDENCE_MISSING: "Compliance evidence is missing",
  CALCULATION_RECONCILIATION_REQUIRED:
    "Canonical calculation reconciliation is required",
};

const layerRepairRoutes: Record<LayerKey, string> = {
  investor: "/migration/data-intake",
  pdf: "/migration/pdf-intelligence",
  portfolio: "/migration/portfolio-data",
  fund: "/migration/fund-data",
  compliance: "/migration/compliance-data",
};

const severeLaunchBlockers = new Set([
  "PDF_REVIEW_REQUIRED",
  "PDF_UNMATCHED",
  "COMPLIANCE_REVIEW_REQUIRED",
  "COMPLIANCE_HIGH_RISK_OPEN",
  "CALCULATION_RECONCILIATION_REQUIRED",
]);

function repairHrefForBlocker(blocker: string, layer: LaunchLayer) {
  if (
    blocker === "CHECKER_APPROVAL_REQUIRED" ||
    blocker === "FUND_ACTIVATION_REQUIRED"
  ) {
    return "/migration/activation";
  }

  if (blocker === "CALCULATION_RECONCILIATION_REQUIRED") {
    return "/migration/performance-calculations";
  }

  return layerRepairRoutes[layer.key];
}

function buildLaunchIssues(
  snapshot: LaunchApiResponse | null,
  canonicalIssues: IssueRecord[]
) {
  const result: IssueRecord[] = [];
  const seen = new Set<string>();
  const calculationIssueExists = canonicalIssues.some(
    (issue) => issue.source === "Calculation"
  );

  for (const layer of snapshot?.layers ?? []) {
    for (const blocker of layer.blockers ?? []) {
      if (
        blocker === "CALCULATION_RECONCILIATION_REQUIRED" &&
        calculationIssueExists
      ) {
        continue;
      }

      const globalBlocker =
        blocker === "FUND_ACTIVATION_REQUIRED" ||
        blocker === "CALCULATION_RECONCILIATION_REQUIRED";
      const identity = globalBlocker ? blocker : `${layer.key}:${blocker}`;

      if (seen.has(identity)) continue;
      seen.add(identity);

      const label =
        blockerLabels[blocker] ??
        blocker.toLowerCase().replaceAll("_", " ");

      result.push({
        id: `activation:${identity}`,
        source: "Activation",
        severity: severeLaunchBlockers.has(blocker) ? "Blocking" : "Review",
        code: blocker,
        title: globalBlocker ? label : `${layer.title} · ${label}`,
        message: globalBlocker
          ? "This control prevents the governed fund from completing the activation and stakeholder-launch sequence."
          : `The ${layer.title} layer is not operational. Repair the governed source or approval state in its owning workspace.`,
        repairHref: repairHrefForBlocker(blocker, layer),
        context: {
          layer: layer.title,
          sourceBatchId: layer.source_batch_id || null,
          approvalStatus: layer.approval_status || null,
          batchName: layer.batch_name || null,
        },
      });
    }
  }

  return result;
}

function severityClass(severity: IssueSeverity) {
  return severity === "Blocking" ? "issue-blocking" : "issue-review";
}

function visibleContext(context: Record<string, string | number | null>) {
  return Object.entries(context).filter(
    ([, value]) => value !== null && value !== "" && value !== undefined
  );
}

export default function IssueCenterPage() {
  const { session } = useVentiqAuth();
  const {
    activeFundName,
    availableFundNames,
    setActiveFundName,
    isReady: fundContextReady,
  } = useActiveFund("");

  const [loadState, setLoadState] = useState<{
    fundName: string;
    canonicalResult: IssueApiResponse | null;
    launchResult: LaunchApiResponse | null;
    message: string;
  } | null>(null);
  const [severityFilter, setSeverityFilter] =
    useState<"All" | IssueSeverity>("All");
  const [sourceFilter, setSourceFilter] =
    useState<"All" | IssueSource>("All");

  const accessToken = session?.access_token?.trim() || "";
  const fundName = activeFundName.trim();
  const canLoadIssues =
    fundContextReady && Boolean(accessToken) && Boolean(fundName);

  const activeLoadState =
    loadState?.fundName === fundName ? loadState : null;

  const canonicalResult = activeLoadState?.canonicalResult ?? null;
  const launchResult = activeLoadState?.launchResult ?? null;

  const loading = canLoadIssues && activeLoadState === null;

  const loadMessage = !fundContextReady
    ? ""
    : !accessToken
    ? "Sign in to load governed issue data."
    : !fundName
    ? "Select a governed fund before opening the Issue Center."
    : activeLoadState?.message ?? "";

  useEffect(() => {
    if (!canLoadIssues) return;

    let cancelled = false;

    const headers = {
      Authorization: `Bearer ${accessToken}`,
    };

    void Promise.allSettled([
      fetch(`/api/issues?fundName=${encodeURIComponent(fundName)}`, {
        method: "GET",
        cache: "no-store",
        headers,
      }),
      fetch(
        `/api/migration/stakeholder-launch?fund_name=${encodeURIComponent(
          fundName
        )}`,
        {
          method: "GET",
          cache: "no-store",
          headers,
        }
      ),
    ]).then(async ([canonicalFetch, launchFetch]) => {
      const messages: string[] = [];
      let nextCanonicalResult: IssueApiResponse | null = null;
      let nextLaunchResult: LaunchApiResponse | null = null;

      if (canonicalFetch.status === "fulfilled") {
        const response = canonicalFetch.value;
        const result = (await response.json()) as IssueApiResponse;

        if (response.ok) {
          nextCanonicalResult = result;
        } else {
          messages.push(
            result.error ||
              "Canonical validation and reconciliation issues could not be loaded."
          );
        }
      } else {
        messages.push(
          "Canonical validation and reconciliation issues could not be loaded."
        );
      }

      if (launchFetch.status === "fulfilled") {
        const response = launchFetch.value;
        const result = (await response.json()) as LaunchApiResponse;

        if (response.ok) {
          nextLaunchResult = result;
        } else {
          messages.push(
            result.error || "Activation and launch blockers could not be loaded."
          );
        }
      } else {
        messages.push("Activation and launch blockers could not be loaded.");
      }

      if (cancelled) return;

      setLoadState({
        fundName,
        canonicalResult: nextCanonicalResult,
        launchResult: nextLaunchResult,
        message: messages.join(" "),
      });
    });

    return () => {
      cancelled = true;
    };
  }, [accessToken, canLoadIssues, fundName]);

  const issues = useMemo(() => {
    const canonicalIssues = canonicalResult?.issues ?? [];
    const launchIssues = buildLaunchIssues(launchResult, canonicalIssues);

    return [...canonicalIssues, ...launchIssues].sort((left, right) => {
      if (left.severity !== right.severity) {
        return left.severity === "Blocking" ? -1 : 1;
      }

      return left.source.localeCompare(right.source);
    });
  }, [canonicalResult, launchResult]);

  const summary = useMemo(() => {
    const blocking = issues.filter(
      (issue) => issue.severity === "Blocking"
    ).length;
    const review = issues.filter(
      (issue) => issue.severity === "Review"
    ).length;
    const sources = new Set(issues.map((issue) => issue.source)).size;

    return {
      total: issues.length,
      blocking,
      review,
      sources,
    };
  }, [issues]);

  const visibleIssues = useMemo(
    () =>
      issues.filter(
        (issue) =>
          (severityFilter === "All" || issue.severity === severityFilter) &&
          (sourceFilter === "All" || issue.source === sourceFilter)
      ),
    [issues, severityFilter, sourceFilter]
  );

  return (
    <main className="issue-page">
      <section className="issue-shell">
        <div className="issue-topbar">
          <Link className="issue-brand" href="/">
            VENTIQ
          </Link>

          <div className="issue-fund-context">
            <span>Governed fund</span>
            <select
              aria-label="Select governed fund"
              disabled={!fundContextReady}
              onChange={(event) => setActiveFundName(event.target.value)}
              value={activeFundName}
            >
              {!activeFundName && <option value="">Select fund</option>}
              {availableFundNames.map((fundName) => (
                <option key={fundName} value={fundName}>
                  {fundName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="issue-hero">
          <div>
            <p className="issue-eyebrow">Governed exception control</p>
            <h1>Issue Center</h1>
            <p>
              One fund-scoped view of canonical intake exceptions, calculation
              reconciliation controls and activation or launch blockers. VENTIQ
              does not resolve issues here silently; each item links back to its
              owning repair workspace.
            </p>
          </div>

          <div className="issue-actions">
            <button
              className="issue-primary-button"
              disabled={loading}
              onClick={() => window.location.reload()}
              type="button"
            >
              {loading ? "Refreshing..." : "Refresh Issues"}
            </button>
            <Link
              className="issue-secondary-button"
              href="/migration/activation"
            >
              Activation
            </Link>
            <Link
              className="issue-secondary-button"
              href="/migration/data-intake"
            >
              Data Intake
            </Link>
          </div>
        </div>

        {loadMessage && <div className="issue-notice">{loadMessage}</div>}

        <div className="issue-kpi-grid">
          <div className="issue-kpi-card">
            <span>01</span>
            <p>Open issues</p>
            <h3>{summary.total}</h3>
          </div>
          <div className="issue-kpi-card issue-kpi-blocking">
            <span>02</span>
            <p>Blocking</p>
            <h3>{summary.blocking}</h3>
          </div>
          <div className="issue-kpi-card issue-kpi-review">
            <span>03</span>
            <p>Review</p>
            <h3>{summary.review}</h3>
          </div>
          <div className="issue-kpi-card">
            <span>04</span>
            <p>Sources affected</p>
            <h3>{summary.sources}</h3>
          </div>
        </div>

        <div className="issue-context-grid">
          <div className="issue-context-card">
            <span>Latest canonical intake</span>
            <strong>
              {canonicalResult?.latestBatch?.batch_name || "No canonical batch"}
            </strong>
            <small>
              {canonicalResult?.latestBatch
                ? `${canonicalResult.latestBatch.processing_status || "Unknown"} · ${canonicalResult.latestBatch.total_rows} rows`
                : "No canonical intake batch was returned."}
            </small>
          </div>

          <div className="issue-context-card">
            <span>Latest calculation</span>
            <strong>
              {canonicalResult?.latestCalculation?.id ||
                "No completed calculation"}
            </strong>
            <small>
              {canonicalResult?.latestCalculation?.as_of_date
                ? `As of ${canonicalResult.latestCalculation.as_of_date}`
                : "No completed canonical calculation was returned."}
            </small>
          </div>

          <div className="issue-context-card">
            <span>Activation</span>
            <strong>{launchResult?.activation?.status || "Not available"}</strong>
            <small>
              {launchResult?.summary
                ? `${launchResult.summary.operational_layers}/${launchResult.summary.total_layers} operational layers`
                : "Activation readiness was not returned."}
            </small>
          </div>
        </div>

        <div className="issue-panel">
          <div className="issue-panel-heading">
            <div>
              <p className="issue-eyebrow">Open queue</p>
              <h2>Repair from the source workspace</h2>
              <p>
                Filters do not change issue state. Resolution must occur in the
                governed source workflow and will disappear here after the source
                record is corrected and refreshed.
              </p>
            </div>

            <div className="issue-filters">
              <select
                aria-label="Filter issue severity"
                onChange={(event) =>
                  setSeverityFilter(
                    event.target.value as "All" | IssueSeverity
                  )
                }
                value={severityFilter}
              >
                <option value="All">All severities</option>
                <option value="Blocking">Blocking</option>
                <option value="Review">Review</option>
              </select>

              <select
                aria-label="Filter issue source"
                onChange={(event) =>
                  setSourceFilter(event.target.value as "All" | IssueSource)
                }
                value={sourceFilter}
              >
                <option value="All">All sources</option>
                <option value="Data Intake">Data Intake</option>
                <option value="Calculation">Calculation</option>
                <option value="Activation">Activation</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="issue-empty">Loading governed issue records…</div>
          ) : visibleIssues.length === 0 ? (
            <div className="issue-empty">
              <strong>No open issues match the current filters.</strong>
              <span>
                This view covers canonical intake validation, calculation
                reconciliation, activation and stakeholder-launch blockers for
                the selected governed fund.
              </span>
            </div>
          ) : (
            <div className="issue-list">
              {visibleIssues.map((issue) => (
                <article
                  className={`issue-card ${severityClass(issue.severity)}`}
                  key={issue.id}
                >
                  <div className="issue-card-head">
                    <div>
                      <div className="issue-badges">
                        <span>{issue.severity}</span>
                        <span>{issue.source}</span>
                      </div>
                      <h3>{issue.title}</h3>
                    </div>
                    <code>{issue.code}</code>
                  </div>

                  <p>{issue.message}</p>

                  {visibleContext(issue.context).length > 0 && (
                    <dl className="issue-context-list">
                      {visibleContext(issue.context).map(([key, value]) => (
                        <div key={`${issue.id}-${key}`}>
                          <dt>{key}</dt>
                          <dd>{String(value)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  <Link className="issue-repair-link" href={issue.repairHref}>
                    Open repair workspace →
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="issue-governance-note">
          <strong>Issue Center scope</strong>
          <span>
            Read-only aggregation. VENTIQ never changes validation,
            reconciliation, approval or activation state from this page.
          </span>
        </div>
      </section>

      <style jsx>{`
        .issue-page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(191, 149, 63, 0.08), transparent 32%),
            #f5f7fb;
          color: #102044;
          padding: 28px;
        }

        .issue-shell {
          width: min(1320px, 100%);
          margin: 0 auto;
        }

        .issue-topbar,
        .issue-hero,
        .issue-panel-heading,
        .issue-card-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        .issue-brand {
          color: #0b2148;
          font-size: 1.05rem;
          font-weight: 900;
          letter-spacing: 0.14em;
          text-decoration: none;
        }

        .issue-fund-context {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #62708a;
          font-size: 0.82rem;
          font-weight: 700;
        }

        select {
          border: 1px solid #d5ddeb;
          border-radius: 10px;
          background: #ffffff;
          color: #102044;
          padding: 9px 11px;
          font: inherit;
        }

        .issue-hero {
          align-items: flex-end;
          margin-top: 28px;
          padding: 30px;
          border: 1px solid #dce3ef;
          border-radius: 20px;
          background: #ffffff;
          box-shadow: 0 16px 50px rgba(20, 38, 76, 0.06);
        }

        .issue-hero h1,
        .issue-panel h2 {
          margin: 4px 0 8px;
          color: #0b2148;
        }

        .issue-hero h1 {
          font-size: clamp(2rem, 4vw, 3.4rem);
          line-height: 1;
        }

        .issue-hero p,
        .issue-panel-heading p,
        .issue-card p,
        .issue-empty span {
          color: #62708a;
          line-height: 1.6;
        }

        .issue-hero > div:first-child {
          max-width: 760px;
        }

        .issue-eyebrow {
          margin: 0;
          color: #9a6d18 !important;
          font-size: 0.76rem;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .issue-actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 9px;
        }

        .issue-primary-button,
        .issue-secondary-button {
          border-radius: 10px;
          padding: 10px 14px;
          font-weight: 800;
          text-decoration: none;
          cursor: pointer;
        }

        .issue-primary-button {
          border: 1px solid #0b2148;
          background: #0b2148;
          color: #ffffff;
        }

        .issue-primary-button:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .issue-secondary-button {
          border: 1px solid #d5ddeb;
          background: #ffffff;
          color: #0b2148;
        }

        .issue-notice {
          margin-top: 14px;
          border: 1px solid #efd8a8;
          border-radius: 12px;
          background: #fff9eb;
          color: #72551f;
          padding: 12px 14px;
          line-height: 1.5;
        }

        .issue-kpi-grid,
        .issue-context-grid {
          display: grid;
          gap: 14px;
          margin-top: 16px;
        }

        .issue-kpi-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .issue-context-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .issue-kpi-card,
        .issue-context-card,
        .issue-panel,
        .issue-governance-note {
          border: 1px solid #dce3ef;
          border-radius: 16px;
          background: #ffffff;
        }

        .issue-kpi-card {
          padding: 18px;
        }

        .issue-kpi-card span {
          color: #9a6d18;
          font-size: 0.75rem;
          font-weight: 900;
        }

        .issue-kpi-card p {
          margin: 12px 0 4px;
          color: #62708a;
        }

        .issue-kpi-card h3 {
          margin: 0;
          color: #0b2148;
          font-size: 1.9rem;
        }

        .issue-kpi-blocking {
          border-color: #e5b8b8;
        }

        .issue-kpi-review {
          border-color: #efd8a8;
        }

        .issue-context-card {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 16px;
          min-width: 0;
        }

        .issue-context-card span,
        .issue-context-card small {
          color: #6e7b91;
        }

        .issue-context-card strong {
          overflow-wrap: anywhere;
          color: #102044;
        }

        .issue-panel {
          margin-top: 16px;
          padding: 24px;
        }

        .issue-panel-heading {
          align-items: flex-end;
          padding-bottom: 18px;
          border-bottom: 1px solid #edf1f6;
        }

        .issue-panel-heading > div:first-child {
          max-width: 720px;
        }

        .issue-filters {
          display: flex;
          gap: 8px;
        }

        .issue-list {
          display: grid;
          gap: 12px;
          margin-top: 18px;
        }

        .issue-card {
          border: 1px solid #dce3ef;
          border-left-width: 4px;
          border-radius: 14px;
          padding: 18px;
        }

        .issue-blocking {
          border-left-color: #a93838;
          background: #fffafa;
        }

        .issue-review {
          border-left-color: #c28a24;
          background: #fffdf8;
        }

        .issue-card-head {
          align-items: flex-start;
        }

        .issue-card h3 {
          margin: 8px 0 0;
          color: #102044;
        }

        .issue-card code {
          max-width: 32%;
          color: #68758a;
          font-size: 0.75rem;
          overflow-wrap: anywhere;
          text-align: right;
        }

        .issue-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .issue-badges span {
          border: 1px solid #dce3ef;
          border-radius: 999px;
          background: #ffffff;
          color: #4e5d75;
          padding: 4px 8px;
          font-size: 0.72rem;
          font-weight: 800;
        }

        .issue-context-list {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          margin: 14px 0;
        }

        .issue-context-list div {
          min-width: 0;
          border: 1px solid #e7ebf2;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.72);
          padding: 9px 10px;
        }

        .issue-context-list dt {
          color: #7a8698;
          font-size: 0.7rem;
          text-transform: uppercase;
        }

        .issue-context-list dd {
          margin: 4px 0 0;
          color: #102044;
          font-size: 0.82rem;
          overflow-wrap: anywhere;
        }

        .issue-repair-link {
          color: #0b4f9f;
          font-weight: 800;
          text-decoration: none;
        }

        .issue-empty {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: 18px;
          border: 1px dashed #ccd5e4;
          border-radius: 14px;
          padding: 24px;
          text-align: center;
        }

        .issue-governance-note {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          margin-top: 16px;
          padding: 14px 16px;
          color: #65738a;
          font-size: 0.82rem;
        }

        .issue-governance-note strong {
          color: #102044;
        }

        @media (max-width: 900px) {
          .issue-page {
            padding: 16px;
          }

          .issue-topbar,
          .issue-hero,
          .issue-panel-heading,
          .issue-governance-note {
            align-items: stretch;
            flex-direction: column;
          }

          .issue-actions {
            justify-content: flex-start;
          }

          .issue-kpi-grid,
          .issue-context-grid,
          .issue-context-list {
            grid-template-columns: 1fr;
          }

          .issue-filters {
            flex-direction: column;
          }

          .issue-card-head {
            flex-direction: column;
          }

          .issue-card code {
            max-width: none;
            text-align: left;
          }
        }
      `}</style>
    </main>
  );
}
