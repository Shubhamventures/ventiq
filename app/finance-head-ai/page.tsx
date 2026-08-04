"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient";
import { useActiveFund } from "../../lib/useActiveFund";

type DataRow = Record<string, unknown>;

type FinanceActivityEvent = {
  id: string;
  time: string;
  module: string;
  title: string;
  description: string;
  status: string;
};

function getString(row: DataRow | undefined, keys: string[], fallback = "-") {
  if (!row) return fallback;

  for (const key of keys) {
    const value = row[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return fallback;
}

function getNumber(row: DataRow | undefined, keys: string[]) {
  if (!row) return 0;

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

  return 0;
}

function getId(row: DataRow | undefined) {
  return getString(row, ["id"], "");
}

function formatCurrencyCr(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "₹0 Cr";

  return `₹${(value / 10000000).toFixed(1)} Cr`;
}

function formatDate(value: unknown) {
  if (typeof value !== "string" || !value) return "-";

  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: unknown) {
  if (typeof value !== "string" || !value) return "-";

  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function rowStatus(row: DataRow) {
  return getString(row, ["status"], "").toLowerCase();
}

function isApproved(row: DataRow) {
  return rowStatus(row) === "approved";
}

function isDraft(row: DataRow) {
  const status = rowStatus(row);

  return status === "draft" || status === "pending" || status === "";
}

function getActivityIcon(status: string) {
  const value = status.toLowerCase();

  if (value.includes("approved")) return "🟢";
  if (value.includes("generated")) return "🔵";
  if (value.includes("available")) return "🟢";
  if (value.includes("stored")) return "🟣";
  if (value.includes("queued")) return "🟡";
  if (value.includes("sent")) return "🟢";
  if (value.includes("data room")) return "🗂️";
  if (value.includes("ddq")) return "❓";
  if (value.includes("readiness")) return "📊";
  if (value.includes("review")) return "🔴";
  if (value.includes("imported")) return "📥";
  if (value.includes("repayment")) return "💸";
  if (value.includes("compliance")) return "🧾";
  if (value.includes("allocation")) return "🧮";

  return "⚪";
}

function getFundName(row: DataRow) {
  return getString(
    row,
    ["fund_name", "scheme_name", "fund", "fund_title"],
    ""
  ).trim();
}

function filterRowsForFund(
  rows: DataRow[],
  fundName: string,
  includeGlobalRows = false
) {
  const normalizedFundName = fundName.trim().toLowerCase();

  return rows.filter((row) => {
    const rowFundName = getFundName(row).toLowerCase();

    if (!rowFundName) return includeGlobalRows;
    return rowFundName === normalizedFundName;
  });
}

function sumRows(rows: DataRow[], keys: string[]) {
  return rows.reduce((sum, row) => sum + getNumber(row, keys), 0);
}

function averageRows(rows: DataRow[], keys: string[]) {
  const values = rows
    .map((row) => getNumber(row, keys))
    .filter((value) => value > 0);

  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function latestTimestamp(rows: DataRow[]) {
  return rows
    .map((row) =>
      getString(row, ["updated_at", "created_at", "generated_at"], "")
    )
    .filter(Boolean)
    .sort()
    .at(-1) ?? "";
}

function latestRowFromRows(rows: DataRow[]) {
  if (rows.length === 0) return null;

  return [...rows].sort((left, right) => {
    const leftTime = new Date(
      getString(left, ["updated_at", "created_at"], "1970-01-01")
    ).getTime();
    const rightTime = new Date(
      getString(right, ["updated_at", "created_at"], "1970-01-01")
    ).getTime();

    return rightTime - leftTime;
  })[0];
}

function batchIdentity(rows: DataRow[], fallback: string) {
  const latestRow = latestRowFromRows(rows);
  return getString(latestRow ?? undefined, ["batch_id", "id"], fallback);
}

function uniqueFundNames(rowGroups: DataRow[][]) {
  return Array.from(
    new Set(
      rowGroups
        .flat()
        .map(getFundName)
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right));
}

export default function FinanceHeadAIPage() {
  const {
    activeFundName,
    setActiveFundName,
    isReady: fundContextReady,
  } = useActiveFund("VENTIQ Growth Fund II");
  const [availableFunds, setAvailableFunds] = useState<string[]>([
    "VENTIQ Growth Fund II",
  ]);
  const [fundActivationStatus, setFundActivationStatus] = useState("Checking");
  const [fundActivatedAt, setFundActivatedAt] = useState("");
  const [fundActivatedBy, setFundActivatedBy] = useState("");
  const [capitalCalls, setCapitalCalls] = useState<DataRow[]>([]);
  const [distributions, setDistributions] = useState<DataRow[]>([]);
  const [investorDocuments, setInvestorDocuments] = useState<DataRow[]>([]);
  const [regulatoryMatches, setRegulatoryMatches] = useState<DataRow[]>([]);
  const [regulatoryCirculars, setRegulatoryCirculars] = useState<DataRow[]>([]);

  const [latestInvestorBatch, setLatestInvestorBatch] =
    useState<DataRow | null>(null);
  const [latestPdfBatch, setLatestPdfBatch] = useState<DataRow | null>(null);
  const [latestPortfolioBatch, setLatestPortfolioBatch] =
    useState<DataRow | null>(null);
  const [latestFundBatch, setLatestFundBatch] = useState<DataRow | null>(null);
  const [latestComplianceBatch, setLatestComplianceBatch] =
    useState<DataRow | null>(null);
  const [latestCapitalCallAllocationBatch, setLatestCapitalCallAllocationBatch] =
    useState<DataRow | null>(null);

  const [migratedInvestorMaster, setMigratedInvestorMaster] = useState<
  DataRow[]
>([]);
const [migratedFundCommitments, setMigratedFundCommitments] = useState<
  DataRow[]
>([]);
const [migratedFinancialPositions, setMigratedFinancialPositions] = useState<
  DataRow[]
>([]);
const [migratedInvestorCashflows, setMigratedInvestorCashflows] = useState<
  DataRow[]
>([]);
const [migratedFundMasterRows, setMigratedFundMasterRows] = useState<
  DataRow[]
>([]);
const [migratedPortfolioInvestments, setMigratedPortfolioInvestments] =
  useState<DataRow[]>([]);
const [migratedComplianceItems, setMigratedComplianceItems] = useState<
  DataRow[]
>([]);
const [
  migratedPdfIntelligenceDocuments,
  setMigratedPdfIntelligenceDocuments,
] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!fundContextReady || !activeFundName) return;

    async function loadFinanceHeadWorkspace() {
      if (!isSupabaseConfigured || !supabase) {
        setErrorMessage(
          "The sample Finance Head workspace is temporarily unavailable. Please request a walkthrough."
        );
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMessage("");
      setFundActivationStatus("Checking");
      setFundActivatedAt("");
      setFundActivatedBy("");

      const db = supabase as any;

      async function selectRows(
        tableName: string,
        options?: {
          orderBy?: string;
          ascending?: boolean;
          eq?: {
            column: string;
            value: string;
          };
        }
      ) {
        try {
          let query = db.from(tableName).select("*");

          if (options?.eq) {
            query = query.eq(options.eq.column, options.eq.value);
          }

          if (options?.orderBy) {
            query = query.order(options.orderBy, {
              ascending: options.ascending ?? false,
            });
          }

          const { data, error } = await query;

          if (error) {
            console.warn(
              `VENTIQ finance dashboard skipped ${tableName}:`,
              error.message
            );
            return [] as DataRow[];
          }

          return (data ?? []) as DataRow[];
        } catch (error) {
          console.warn(`VENTIQ finance dashboard skipped ${tableName}:`, error);
          return [] as DataRow[];
        }
      }

      async function loadActivationRecord() {
        try {
          const { data, error } = await db
            .from("fund_activation_status")
            .select("status, activated_at, activated_by, readiness_score")
            .eq("fund_name", activeFundName)
            .maybeSingle();

          if (error) {
            console.warn(
              "VENTIQ finance dashboard could not read fund activation:",
              error.message
            );
            return null;
          }

          return (data as DataRow | null) ?? null;
        } catch (error) {
          console.warn(
            "VENTIQ finance dashboard could not read fund activation:",
            error
          );
          return null;
        }
      }

      try {
        const [
          capitalCallsData,
          distributionsData,
          documentsData,
          matchesData,
          circularsData,
          migratedInvestorMasterData,
          migratedFundCommitmentsData,
          migratedFinancialPositionsData,
          migratedInvestorCashflowsData,
          migratedFundMasterData,
          migratedPortfolioInvestmentsData,
          migratedComplianceItemsData,
          migratedPdfDocumentsData,
          allocationBatchRows,
          activationRecord,
        ] = await Promise.all([
          selectRows("capital_calls", {
            orderBy: "created_at",
            ascending: false,
          }),
          selectRows("distributions", {
            orderBy: "created_at",
            ascending: false,
          }),
          selectRows("investor_documents"),
          selectRows("regulatory_source_matches", {
            eq: {
              column: "status",
              value: "needs_review",
            },
          }),
          selectRows("regulatory_circulars", {
            eq: {
              column: "status",
              value: "active",
            },
          }),
          selectRows("investor_master", {
            orderBy: "investor_code",
            ascending: true,
          }),
          selectRows("fund_commitments"),
          selectRows("investor_financial_positions"),
          selectRows("investor_cashflows", {
            orderBy: "cashflow_date",
            ascending: false,
          }),
          selectRows("fund_master"),
          selectRows("portfolio_investments"),
          selectRows("compliance_items"),
          selectRows("pdf_intelligence_documents"),
          selectRows("capital_call_allocation_batches", {
            orderBy: "created_at",
            ascending: false,
          }),
          loadActivationRecord(),
        ]);

        const fundOptions = uniqueFundNames([
          migratedFundMasterData,
          migratedInvestorMasterData,
          migratedFundCommitmentsData,
          migratedFinancialPositionsData,
          migratedPortfolioInvestmentsData,
          migratedComplianceItemsData,
          migratedPdfDocumentsData,
          capitalCallsData,
          distributionsData,
          documentsData,
        ]);

        const nextFundOptions = fundOptions.length
          ? fundOptions
          : [activeFundName];

        setAvailableFunds(nextFundOptions);

        if (!nextFundOptions.includes(activeFundName)) {
          setActiveFundName(nextFundOptions[0]);
          return;
        }

        const scopedCapitalCalls = filterRowsForFund(
          capitalCallsData,
          activeFundName
        );
        const scopedDistributions = filterRowsForFund(
          distributionsData,
          activeFundName
        );
        const scopedDocuments = filterRowsForFund(
          documentsData,
          activeFundName
        );
        const scopedInvestorMaster = filterRowsForFund(
          migratedInvestorMasterData,
          activeFundName
        );
        const scopedCommitments = filterRowsForFund(
          migratedFundCommitmentsData,
          activeFundName
        );
        const scopedFinancialPositions = filterRowsForFund(
          migratedFinancialPositionsData,
          activeFundName
        );
        const scopedCashflows = filterRowsForFund(
          migratedInvestorCashflowsData,
          activeFundName
        );
        const scopedFundMaster = filterRowsForFund(
          migratedFundMasterData,
          activeFundName
        );
        const scopedPortfolio = filterRowsForFund(
          migratedPortfolioInvestmentsData,
          activeFundName
        );
        const scopedCompliance = filterRowsForFund(
          migratedComplianceItemsData,
          activeFundName
        );
        const scopedPdfDocuments = filterRowsForFund(
          migratedPdfDocumentsData,
          activeFundName
        );
        const scopedAllocationBatches = filterRowsForFund(
          allocationBatchRows,
          activeFundName
        );

        setCapitalCalls(scopedCapitalCalls);
        setDistributions(scopedDistributions);
        setInvestorDocuments(scopedDocuments);
        setRegulatoryMatches(
          filterRowsForFund(matchesData, activeFundName, true)
        );
        setRegulatoryCirculars(
          filterRowsForFund(circularsData, activeFundName, true)
        );
        setMigratedInvestorMaster(scopedInvestorMaster);
        setMigratedFundCommitments(scopedCommitments);
        setMigratedFinancialPositions(scopedFinancialPositions);
        setMigratedInvestorCashflows(scopedCashflows);
        setMigratedFundMasterRows(scopedFundMaster);
        setMigratedPortfolioInvestments(scopedPortfolio);
        setMigratedComplianceItems(scopedCompliance);
        setMigratedPdfIntelligenceDocuments(scopedPdfDocuments);

        const investorSourceRows = [
          ...scopedInvestorMaster,
          ...scopedCommitments,
          ...scopedFinancialPositions,
        ];
        const investorSummary = investorSourceRows.length
          ? {
              id: batchIdentity(
                investorSourceRows,
                `${activeFundName}-investor-data`
              ),
              fund_name: activeFundName,
              batch_name: `${activeFundName} investor dataset`,
              total_records: scopedInvestorMaster.length,
              total_commitment: sumRows(scopedCommitments, [
                "commitment_amount",
                "committed_amount",
                "commitment",
              ]),
              status: "activated",
              created_at: latestTimestamp(investorSourceRows),
            }
          : null;

        const pdfReadyFiles = scopedPdfDocuments.filter((row) => {
          const status = getString(row, ["status"], "").toLowerCase();
          return ["ready", "approved", "published", "available"].includes(
            status
          );
        }).length;
        const pdfUnmatchedFiles = scopedPdfDocuments.filter(
          (row) =>
            getString(row, ["status"], "").toLowerCase() === "unmatched"
        ).length;
        const pdfReviewFiles = Math.max(
          scopedPdfDocuments.length - pdfReadyFiles - pdfUnmatchedFiles,
          0
        );
        const pdfSummary = scopedPdfDocuments.length
          ? {
              id: batchIdentity(
                scopedPdfDocuments,
                `${activeFundName}-pdf-data`
              ),
              fund_name: activeFundName,
              batch_name: `${activeFundName} PDF intelligence dataset`,
              total_files: scopedPdfDocuments.length,
              ready_files: pdfReadyFiles,
              review_files: pdfReviewFiles,
              unmatched_files: pdfUnmatchedFiles,
              status: "activated",
              created_at: latestTimestamp(scopedPdfDocuments),
            }
          : null;

        const portfolioSummary = scopedPortfolio.length
          ? {
              id: batchIdentity(
                scopedPortfolio,
                `${activeFundName}-portfolio-data`
              ),
              fund_name: activeFundName,
              batch_name: `${activeFundName} portfolio dataset`,
              total_records: scopedPortfolio.length,
              current_portfolio_value: sumRows(scopedPortfolio, [
                "current_value",
                "current_portfolio_value",
              ]),
              at_risk_count: scopedPortfolio.filter((row) => {
                const risk = getString(row, ["risk_status"], "").toLowerCase();
                return risk.includes("risk") || risk.includes("watch");
              }).length,
              status: "activated",
              created_at: latestTimestamp(scopedPortfolio),
            }
          : null;

        const fundSummary = scopedFundMaster.length
          ? {
              id: batchIdentity(
                scopedFundMaster,
                `${activeFundName}-fund-data`
              ),
              fund_name: activeFundName,
              batch_name: `${activeFundName} fund master dataset`,
              total_funds: scopedFundMaster.length,
              total_committed_capital: sumRows(scopedFundMaster, [
                "committed_capital",
                "total_committed_capital",
                "commitment_amount",
              ]),
              total_sponsor_commitment: sumRows(scopedFundMaster, [
                "sponsor_commitment",
              ]),
              average_management_fee: averageRows(scopedFundMaster, [
                "management_fee_rate",
                "management_fee",
              ]),
              average_carry: averageRows(scopedFundMaster, [
                "carry_rate",
                "carry",
              ]),
              status: "activated",
              created_at: latestTimestamp(scopedFundMaster),
            }
          : null;

        const evidenceAvailableCount = scopedCompliance.filter((row) => {
          const evidence = getString(
            row,
            ["evidence_available", "evidence_status"],
            ""
          ).toLowerCase();
          return (
            row["evidence_available"] === true ||
            ["yes", "true", "available", "complete", "filed"].includes(
              evidence
            )
          );
        }).length;
        const pendingReviewCount = scopedCompliance.filter((row) => {
          const status = getString(
            row,
            ["filing_status", "migration_status"],
            ""
          ).toLowerCase();
          return ["pending", "review", "overdue", "draft"].includes(status);
        }).length;
        const highRiskCount = scopedCompliance.filter(
          (row) =>
            getString(row, ["risk_level"], "").toLowerCase() === "high"
        ).length;
        const complianceSummary = scopedCompliance.length
          ? {
              id: batchIdentity(
                scopedCompliance,
                `${activeFundName}-compliance-data`
              ),
              fund_name: activeFundName,
              batch_name: `${activeFundName} compliance dataset`,
              total_items: scopedCompliance.length,
              evidence_available_count: evidenceAvailableCount,
              pending_review_count: pendingReviewCount,
              high_risk_count: highRiskCount,
              status: "activated",
              created_at: latestTimestamp(scopedCompliance),
            }
          : null;

        setLatestInvestorBatch(investorSummary);
        setLatestPdfBatch(pdfSummary);
        setLatestPortfolioBatch(portfolioSummary);
        setLatestFundBatch(fundSummary);
        setLatestComplianceBatch(complianceSummary);
        setLatestCapitalCallAllocationBatch(
          latestRowFromRows(scopedAllocationBatches)
        );

        const activationStatus = getString(
          activationRecord ?? undefined,
          ["status"],
          "Setup Not Started"
        );
        setFundActivationStatus(activationStatus);
        setFundActivatedAt(
          getString(activationRecord ?? undefined, ["activated_at"], "")
        );
        setFundActivatedBy(
          getString(activationRecord ?? undefined, ["activated_by"], "")
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load Finance Head workspace."
        );
      } finally {
        setLoading(false);
      }
    }

    void loadFinanceHeadWorkspace();
  }, [
    activeFundName,
    fundContextReady,
    setActiveFundName,
  ]);

  const financeMetrics = useMemo(() => {
  const approvedCapitalCalls = capitalCalls.filter(isApproved);
  const draftCapitalCalls = capitalCalls.filter(isDraft);

  const approvedDistributions = distributions.filter(isApproved);
  const draftDistributions = distributions.filter(isDraft);

  const totalApprovedCapitalCallAmount = approvedCapitalCalls.reduce(
    (sum, row) =>
      sum +
      getNumber(row, [
        "call_amount",
        "capital_call_amount",
        "total_amount",
        "amount",
      ]),
    0
  );

  const totalDraftCapitalCallAmount = draftCapitalCalls.reduce(
    (sum, row) =>
      sum +
      getNumber(row, [
        "call_amount",
        "capital_call_amount",
        "total_amount",
        "amount",
      ]),
    0
  );

  const totalApprovedDistributionAmount = approvedDistributions.reduce(
    (sum, row) =>
      sum +
      getNumber(row, [
        "distribution_amount",
        "total_distribution_amount",
        "amount",
      ]),
    0
  );

  const migrationInvestorCount = getNumber(latestInvestorBatch ?? undefined, [
    "total_records",
  ]);

  const migrationInvestorCommitment = getNumber(
    latestInvestorBatch ?? undefined,
    ["total_commitment"]
  );

  const migrationPdfTotal = getNumber(latestPdfBatch ?? undefined, [
    "total_files",
  ]);

  const migrationPdfReady = getNumber(latestPdfBatch ?? undefined, [
    "ready_files",
  ]);

  const migrationPdfReview =
    getNumber(latestPdfBatch ?? undefined, ["review_files"]) +
    getNumber(latestPdfBatch ?? undefined, ["unmatched_files"]);

  const migrationFundCommitted = getNumber(latestFundBatch ?? undefined, [
    "total_committed_capital",
  ]);

  const migrationSponsorCommitment = getNumber(latestFundBatch ?? undefined, [
    "total_sponsor_commitment",
  ]);

  const migrationAverageManagementFee = getNumber(
    latestFundBatch ?? undefined,
    ["average_management_fee"]
  );

  const migrationAverageCarry = getNumber(latestFundBatch ?? undefined, [
    "average_carry",
  ]);

  const migrationFundCount = getNumber(latestFundBatch ?? undefined, [
    "total_funds",
  ]);

  const migratedInvestorCount = migratedInvestorMaster.length;

  const migratedCommitmentTotal = migratedFundCommitments.reduce(
    (sum, row) =>
      sum +
      getNumber(row, [
        "commitment_amount",
        "committed_amount",
        "commitment",
        "amount",
      ]),
    0
  );

  const migratedPositionCommitment = migratedFinancialPositions.reduce(
    (sum, row) =>
      sum +
      getNumber(row, ["commitment_amount", "committed_amount", "commitment"]),
    0
  );

  const migratedCapitalCalled = migratedFinancialPositions.reduce(
    (sum, row) =>
      sum +
      getNumber(row, [
        "capital_called_till_date",
        "capital_called",
        "called_capital",
        "called_amount",
      ]),
    0
  );

  const migratedUncalledCapital = migratedFinancialPositions.reduce(
    (sum, row) =>
      sum +
      getNumber(row, [
        "uncalled_capital",
        "unfunded_commitment",
        "remaining_commitment",
      ]),
    0
  );

  const migratedDistributions = migratedFinancialPositions.reduce(
    (sum, row) =>
      sum +
      getNumber(row, [
        "distributions_till_date",
        "distributions",
        "distributed_amount",
      ]),
    0
  );

  const migratedCurrentNav = migratedFinancialPositions.reduce(
    (sum, row) =>
      sum + getNumber(row, ["current_nav", "nav", "latest_nav"]),
    0
  );

  const migratedFundCommitted = migratedFundMasterRows.reduce(
    (sum, row) =>
      sum +
      getNumber(row, [
        "committed_capital",
        "total_committed_capital",
        "commitment_amount",
      ]),
    0
  );

  const managementFeeRows = migratedFundMasterRows
    .map((row) =>
      getNumber(row, [
        "management_fee_rate",
        "management_fee",
        "average_management_fee",
      ])
    )
    .filter((value) => value > 0);

  const carryRows = migratedFundMasterRows
    .map((row) => getNumber(row, ["carry_rate", "carry", "average_carry"]))
    .filter((value) => value > 0);

  const averageManagementFee =
    migrationAverageManagementFee ||
    (managementFeeRows.length
      ? managementFeeRows.reduce((sum, value) => sum + value, 0) /
        managementFeeRows.length
      : 0);

  const averageCarry =
    migrationAverageCarry ||
    (carryRows.length
      ? carryRows.reduce((sum, value) => sum + value, 0) / carryRows.length
      : 0);

  const committedCapital =
    migrationInvestorCommitment ||
    migratedCommitmentTotal ||
    migratedPositionCommitment ||
    migrationFundCommitted ||
    migratedFundCommitted;

  const calledCapital = migratedCapitalCalled || totalApprovedCapitalCallAmount;

  const uncalledCapital =
    migratedUncalledCapital || Math.max(committedCapital - calledCapital, 0);

  const distributedCapital =
    migratedDistributions || totalApprovedDistributionAmount;

  const migrationComplianceItems = getNumber(
    latestComplianceBatch ?? undefined,
    ["total_items"]
  );

  const migrationComplianceEvidence = getNumber(
    latestComplianceBatch ?? undefined,
    ["evidence_available_count"]
  );

  const migrationCompliancePending = getNumber(
    latestComplianceBatch ?? undefined,
    ["pending_review_count"]
  );

  const migrationComplianceHighRisk = getNumber(
    latestComplianceBatch ?? undefined,
    ["high_risk_count"]
  );

  const migratedCompliancePendingRows = migratedComplianceItems.filter((row) => {
    const status = getString(row, ["filing_status", "migration_status"], "")
      .toLowerCase();

    return status === "pending" || status === "review" || status === "overdue";
  }).length;

  const migratedComplianceHighRiskRows = migratedComplianceItems.filter(
    (row) => getString(row, ["risk_level"], "").toLowerCase() === "high"
  ).length;

  const migratedEvidenceAvailableRows = migratedComplianceItems.filter((row) => {
    const evidenceStatus = getString(
      row,
      ["evidence_available", "evidence_status"],
      ""
    ).toLowerCase();

    return (
      row["evidence_available"] === true ||
      evidenceStatus === "true" ||
      evidenceStatus === "yes" ||
      evidenceStatus === "available"
    );
  }).length;

  const portfolioRepaymentItems = migratedPortfolioInvestments.filter((row) =>
    Boolean(getString(row, ["repayment_due_date"], ""))
  ).length;

  const portfolioAtRiskItems = migratedPortfolioInvestments.filter((row) => {
    const riskStatus = getString(row, ["risk_status"], "").toLowerCase();

    return (
      riskStatus.includes("risk") ||
      riskStatus.includes("watch") ||
      riskStatus.includes("attention")
    );
  }).length;

  const allocationDraftAmount = getNumber(
    latestCapitalCallAllocationBatch ?? undefined,
    [
      "total_call_amount",
      "total_allocation_amount",
      "capital_call_amount",
      "call_amount",
      "amount",
    ]
  );

  const allocationReadyCount = getNumber(
    latestCapitalCallAllocationBatch ?? undefined,
    [
      "ready_allocations",
      "ready_count",
      "approved_allocations",
      "total_ready",
    ]
  );

  const allocationExceptionCount = getNumber(
    latestCapitalCallAllocationBatch ?? undefined,
    ["exception_count", "exceptions", "exception_queue", "review_count"]
  );

  const capitalCallAllocationDrafts = latestCapitalCallAllocationBatch ? 1 : 0;

  const storedDocuments = investorDocuments.filter((row) =>
    Boolean(getString(row, ["storage_url", "storage_path", "file_url"], ""))
  );

  const portalAvailableDocuments = investorDocuments.filter((row) => {
    const portalStatus = getString(row, ["portal_status"], "").toLowerCase();
    const migrationStatus = getString(row, ["migration_status"], "").toLowerCase();
    const status = getString(row, ["status"], "").toLowerCase();

    return (
      portalStatus.includes("available") ||
      portalStatus.includes("published") ||
      migrationStatus.includes("published") ||
      status.includes("published") ||
      status.includes("available")
    );
  });

  const queuedEmails = investorDocuments.filter(
    (row) => getString(row, ["email_status"], "") === "queued"
  );

  const sentEmails = investorDocuments.filter(
    (row) => getString(row, ["email_status"], "") === "sent"
  );

  const generatedDocuments = investorDocuments.filter((row) =>
    Boolean(getString(row, ["document_type", "document_name", "file_name"], ""))
  );

  const documentsNotStored = investorDocuments.filter(
    (row) => !getString(row, ["storage_url", "storage_path", "file_url"], "")
  );

  const migratedPdfReadyRows = migratedPdfIntelligenceDocuments.filter((row) => {
    const status = getString(row, ["status"], "").toLowerCase();

    return status === "ready" || status === "published";
  }).length;

  const migratedPdfReviewRows = migratedPdfIntelligenceDocuments.filter((row) => {
    const status = getString(row, ["status"], "").toLowerCase();

    return (
      status === "review" ||
      status === "unmatched" ||
      status === "failed" ||
      status.includes("review")
    );
  }).length;

  const investorReportingDocuments = generatedDocuments.filter((row) => {
    const documentType = getString(row, ["document_type"], "").toLowerCase();

    return (
      documentType.includes("notice") ||
      documentType.includes("report") ||
      documentType.includes("soa") ||
      documentType.includes("statement") ||
      documentType.includes("certificate")
    );
  });

  const finalGeneratedDocuments = Math.max(
    generatedDocuments.length,
    investorDocuments.length,
    migrationPdfTotal,
    migratedPdfIntelligenceDocuments.length
  );

  const finalStoredDocuments = Math.max(
    storedDocuments.length,
    migrationPdfReady,
    migratedPdfReadyRows
  );

  const finalDocumentsNotStored = Math.max(
    documentsNotStored.length,
    migrationPdfReview,
    migratedPdfReviewRows
  );

  const ddqSupportItems = Math.min(
    4,
    Math.max(1, Math.ceil(finalGeneratedDocuments / 5) || 1)
  );

  const investorDocumentReadinessScore = Math.min(
    95,
    55 +
      Math.min(20, finalStoredDocuments * 4) +
      Math.min(15, portalAvailableDocuments.length * 3) +
      (finalDocumentsNotStored === 0 && finalGeneratedDocuments > 0 ? 5 : 0)
  );

  const highImpactCirculars = regulatoryCirculars.filter(
    (row) => getString(row, ["impact"], "").toUpperCase() === "HIGH"
  );

  const pendingRegulatoryReviews = Math.max(
    regulatoryMatches.length,
    migrationCompliancePending,
    migratedCompliancePendingRows
  );

  const highRiskComplianceItems = Math.max(
    migrationComplianceHighRisk,
    migratedComplianceHighRiskRows
  );

  const evidenceAvailable = Math.max(
    migrationComplianceEvidence,
    migratedEvidenceAvailableRows
  );

  return {
    approvedCapitalCalls: approvedCapitalCalls.length,
    draftCapitalCalls: draftCapitalCalls.length,
    approvedDistributions: approvedDistributions.length,
    draftDistributions: draftDistributions.length,
    totalApprovedCapitalCallAmount,
    totalDraftCapitalCallAmount,
    totalApprovedDistributionAmount,

    investorCount: migratedInvestorCount || migrationInvestorCount,
    totalCommitment: committedCapital,
    calledCapital,
    distributedCapital,
    currentNav: migratedCurrentNav,
    uncalledCapital,
    committedCapital,
    fundCount: migrationFundCount || migratedFundMasterRows.length,
    sponsorCommitment: migrationSponsorCommitment,
    averageManagementFee,
    averageCarry,

    capitalCallAllocationDrafts,
    capitalCallAllocationAmount: allocationDraftAmount,
    capitalCallAllocationExceptions: allocationExceptionCount,
    readyAllocations: allocationReadyCount,

    generatedDocuments: finalGeneratedDocuments,
    storedDocuments: finalStoredDocuments,
    documentsNotStored: finalDocumentsNotStored,
    portalAvailableDocuments: portalAvailableDocuments.length,
    queuedEmails: queuedEmails.length,
    sentEmails: sentEmails.length,
    investorReportingDocuments: Math.max(
      investorReportingDocuments.length,
      migrationPdfReady,
      migratedPdfReadyRows
    ),
    ddqSupportItems,
    investorDocumentReadinessScore,

    pendingRegulatoryReviews,
    highImpactCirculars: Math.max(
      highImpactCirculars.length,
      highRiskComplianceItems
    ),
    complianceItems: migrationComplianceItems || migratedComplianceItems.length,
    evidenceAvailable,
    highRiskComplianceItems,

    portfolioRepaymentItems,
    portfolioAtRiskItems,
    cashflowRecords: migratedInvestorCashflows.length,
  };
}, [
  capitalCalls,
  distributions,
  investorDocuments,
  regulatoryMatches,
  regulatoryCirculars,
  latestInvestorBatch,
  latestPdfBatch,
  latestFundBatch,
  latestComplianceBatch,
  latestCapitalCallAllocationBatch,
  migratedInvestorMaster,
  migratedFundCommitments,
  migratedFinancialPositions,
  migratedInvestorCashflows,
  migratedFundMasterRows,
  migratedPortfolioInvestments,
  migratedComplianceItems,
  migratedPdfIntelligenceDocuments,
]);

  const financeActivityEvents = useMemo(() => {
    const events: FinanceActivityEvent[] = [];

    capitalCalls.forEach((call) => {
      const status = getString(call, ["status"], "draft");
      const amount = getNumber(call, [
        "call_amount",
        "capital_call_amount",
        "total_amount",
        "amount",
      ]);

      events.push({
        id: `capital-call-${getId(call)}`,
        time: getString(call, ["created_at", "call_date"], ""),
        module: "Capital Call",
        title:
          status === "approved"
            ? "Capital call approved"
            : "Capital call awaiting finance review",
        description: `${getString(
          call,
          ["call_name", "name"],
          "Capital Call"
        )} • ${formatCurrencyCr(amount)}`,
        status,
      });
    });

    distributions.forEach((distribution) => {
      const status = getString(distribution, ["status"], "draft");
      const amount = getNumber(distribution, [
        "distribution_amount",
        "total_distribution_amount",
        "amount",
      ]);

      events.push({
        id: `distribution-${getId(distribution)}`,
        time: getString(
          distribution,
          ["created_at", "distribution_date", "payment_date"],
          ""
        ),
        module: "Distribution",
        title:
          status === "approved"
            ? "Distribution approved"
            : "Distribution awaiting review",
        description: `${getString(
          distribution,
          ["distribution_name", "name"],
          "Distribution"
        )} • ${formatCurrencyCr(amount)}`,
        status,
      });
    });

    investorDocuments.forEach((documentRecord) => {
      const documentId = getId(documentRecord);
      const documentType = getString(
        documentRecord,
        ["document_type"],
        "Investor Document"
      );
      const documentName = getString(
        documentRecord,
        ["document_name"],
        "Investor Document"
      );
      const investorName = getString(
        documentRecord,
        ["investor_name"],
        "Investor"
      );
      const generatedAt = getString(
  documentRecord,
  ["published_at", "generated_at", "uploaded_at", "created_at"],
  ""
);

      events.push({
        id: `document-generated-${documentId}`,
        time: generatedAt,
        module: "Document Engine",
        title: `${documentType} generated`,
        description: `${documentName} for ${investorName}`,
        status: getString(documentRecord, ["status"], "generated"),
      });

      if (getString(documentRecord, ["portal_status"], "") === "available") {
        events.push({
          id: `portal-${documentId}`,
          time: generatedAt,
          module: "Investor Portal",
          title: "Investor portal updated",
          description: `${documentType} made available to ${investorName}`,
          status: "available",
        });
      }

      if (getString(documentRecord, ["storage_url", "storage_path"], "")) {
        events.push({
          id: `stored-${documentId}`,
          time: generatedAt,
          module: "Document Vault",
          title: "PDF stored",
          description: `${documentName} stored in the portal vault`,
          status: "stored",
        });
      }

      const emailStatus = getString(documentRecord, ["email_status"], "");

      if (emailStatus === "queued" || emailStatus === "sent") {
        events.push({
          id: `email-${documentId}`,
          time: generatedAt,
          module: "Email Dispatch",
          title:
            emailStatus === "sent"
              ? "Investor email marked sent"
              : "Investor email queued",
          description: `${documentName} email ${emailStatus}`,
          status: emailStatus,
        });
      }
    });

    const now = Date.now();

    events.push({
      id: "finance-data-room-readiness",
      time: new Date(now - 1000 * 60 * 18).toISOString(),
      module: "Investor Data Room Support",
      title: "Investor-facing document readiness reviewed",
      description: `${financeMetrics.generatedDocuments} investor / PDF records checked for portal access, stored PDFs and reporting support.`,
      status: "data room readiness",
    });

    events.push({
      id: "finance-ddq-support",
      time: new Date(now - 1000 * 60 * 34).toISOString(),
      module: "DDQ Support",
      title: "DDQ support documents identified",
      description:
        "Finance reviewed investor notices, statements, reports and certificates that can support LP DDQ responses.",
      status: "ddq support",
    });

    regulatoryMatches.forEach((match) => {
      events.push({
        id: `regulatory-${getId(match)}`,
        time: getString(match, ["created_at", "matched_at"], ""),
        module: "Knowledge Hub",
        title: "Regulatory item needs review",
        description: getString(
          match,
          ["title", "source_title", "match_reason"],
          "Regulatory source match requires finance/compliance review"
        ),
        status: "needs_review",
      });
    });

    if (latestInvestorBatch) {
      events.push({
        id: `investor-migration-${getId(latestInvestorBatch)}`,
        time: getString(latestInvestorBatch, ["created_at"], ""),
        module: "Investor Data Migration",
        title: "Investor data imported",
        description: `${getNumber(
          latestInvestorBatch,
          ["total_records"]
        )} investors imported with ${formatCurrencyCr(
          getNumber(latestInvestorBatch, ["total_commitment"])
        )} commitment.`,
        status: "imported",
      });
    }

    if (latestPdfBatch) {
      const reviewCount =
        getNumber(latestPdfBatch, ["review_files"]) +
        getNumber(latestPdfBatch, ["unmatched_files"]);

      events.push({
        id: `pdf-migration-${getId(latestPdfBatch)}`,
        time: getString(latestPdfBatch, ["created_at"], ""),
        module: "PDF Intelligence",
        title: "Investor PDF batch processed",
        description: `${getNumber(
          latestPdfBatch,
          ["total_files"]
        )} PDFs processed, ${reviewCount} requiring review.`,
        status: reviewCount > 0 ? "review" : "imported",
      });
    }

    if (latestFundBatch) {
      events.push({
        id: `fund-migration-${getId(latestFundBatch)}`,
        time: getString(latestFundBatch, ["created_at"], ""),
        module: "Fund Data Migration",
        title: "Fund economics loaded",
        description: `${getNumber(
          latestFundBatch,
          ["total_funds"]
        )} fund record(s), ${formatCurrencyCr(
          getNumber(latestFundBatch, ["total_committed_capital"])
        )} committed capital.`,
        status: "imported",
      });
    }

    if (latestCapitalCallAllocationBatch) {
      events.push({
        id: `capital-allocation-${getId(latestCapitalCallAllocationBatch)}`,
        time: getString(latestCapitalCallAllocationBatch, ["created_at"], ""),
        module: "Capital Call Allocation",
        title: "Capital call allocation draft available",
        description: `${getNumber(
          latestCapitalCallAllocationBatch,
          ["ready_allocations", "ready_count", "approved_allocations"]
        )} ready allocations and ${getNumber(
          latestCapitalCallAllocationBatch,
          ["exception_count", "exceptions", "review_count"]
        )} exceptions.`,
        status: "allocation review",
      });
    }

    migratedPortfolioInvestments
      .filter((row) => Boolean(getString(row, ["repayment_due_date"], "")))
      .slice(0, 5)
      .forEach((row) => {
        events.push({
          id: `portfolio-repayment-${getId(row)}`,
          time: getString(row, ["created_at", "repayment_due_date"], ""),
          module: "Portfolio Repayment",
          title: "Repayment schedule available",
          description: `${getString(
            row,
            ["portfolio_company"],
            "Portfolio company"
          )} has repayment due on ${formatDate(row["repayment_due_date"])}.`,
          status: "repayment tracking",
        });
      });

    migratedComplianceItems
      .filter((row) => {
        const status = getString(row, ["filing_status"], "").toLowerCase();
        const risk = getString(row, ["risk_level"], "").toLowerCase();

        return (
          status === "pending" ||
          status === "review" ||
          status === "overdue" ||
          risk === "high"
        );
      })
      .slice(0, 5)
      .forEach((row) => {
        events.push({
          id: `compliance-migration-${getId(row)}`,
          time: getString(row, ["created_at", "due_date"], ""),
          module: "Compliance Evidence",
          title: `${getString(
            row,
            ["document_name"],
            "Compliance item"
          )} needs attention`,
          description: `${getString(
            row,
            ["authority"],
            "Authority"
          )} • Owner: ${getString(row, ["owner"], "Not assigned")}`,
          status: "compliance review",
        });
      });

    return events.sort((a, b) => {
      const aTime = new Date(a.time || 0).getTime();
      const bTime = new Date(b.time || 0).getTime();

      return bTime - aTime;
    });
  }, [
    capitalCalls,
    distributions,
    investorDocuments,
    regulatoryMatches,
    financeMetrics.generatedDocuments,
    latestInvestorBatch,
    latestPdfBatch,
    latestFundBatch,
    latestCapitalCallAllocationBatch,
    migratedPortfolioInvestments,
    migratedComplianceItems,
  ]);

  const pendingFinanceActions = useMemo(() => {
    const actions = [
      {
        title: "Review capital call allocation draft",
        value: `${financeMetrics.readyAllocations} ready / ${financeMetrics.capitalCallAllocationExceptions} exceptions`,
        href: "/capital-call-allocation",
        priority:
          financeMetrics.capitalCallAllocationExceptions > 0
            ? "High"
            : financeMetrics.capitalCallAllocationDrafts > 0
            ? "On track"
            : "Not started",
      },
      {
        title: "Review capital call drafts",
        value: `${financeMetrics.draftCapitalCalls} pending`,
        href: "/capital-call",
        priority: financeMetrics.draftCapitalCalls > 0 ? "High" : "Clear",
      },
      {
        title: "Review migrated compliance evidence",
        value: `${financeMetrics.pendingRegulatoryReviews} review / ${financeMetrics.highRiskComplianceItems} high-risk`,
        href: "/migration/compliance-data",
        priority:
          financeMetrics.highRiskComplianceItems > 0
            ? "High"
            : financeMetrics.pendingRegulatoryReviews > 0
            ? "Medium"
            : "Clear",
      },
      {
        title: "Review fund economics",
        value: `${financeMetrics.fundCount} fund(s) · ${financeMetrics.averageManagementFee.toFixed(
          2
        )}% management fee`,
        href: "/migration/fund-data",
        priority: financeMetrics.fundCount > 0 ? "On track" : "Not started",
      },
      {
        title: "Monitor repayment schedules",
        value: `${financeMetrics.portfolioRepaymentItems} repayment item(s)`,
        href: "/migration/portfolio-data",
        priority:
          financeMetrics.portfolioAtRiskItems > 0 ? "Medium" : "On track",
      },
      {
        title: "Store PDFs for investor portal",
        value: `${financeMetrics.documentsNotStored} pending storage / review`,
        href: "/migration/pdf-intelligence",
        priority:
          financeMetrics.documentsNotStored > 0 ? "High" : "Clear",
      },
      {
  title: "Generate investor documents",
  value: `${financeMetrics.generatedDocuments} document records ready`,
  href: "/document-studio",
  priority:
    financeMetrics.generatedDocuments > 0 ? "On track" : "Start",
},
      {
        
        title: "Queue investor email dispatch",
        value: `${financeMetrics.queuedEmails} queued / ${financeMetrics.sentEmails} sent`,
        href: "/document-engine",
        priority:
          financeMetrics.generatedDocuments >
          financeMetrics.queuedEmails + financeMetrics.sentEmails
            ? "Medium"
            : "On track",
      },
      {
        title: "Monitor downstream audit trail",
        value: `${financeActivityEvents.length} evidence points`,
        href: "/activity-engine",
        priority: "Live",
      },
    ];

    return actions;
  }, [financeMetrics, financeActivityEvents.length]);

  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">VENTIQ AI Operating System</p>
            <h1>Finance Head Workspace</h1>
            <p>
              Live fund finance control room connected to migrated investor,
              PDF, fund, portfolio, compliance, capital call and investor
              communication data.
            </p>
          </div>

          <a className="back-link" href="/">
            Back to Home
          </a>
        </div>

        <div
          className="preview-card"
          style={{ marginBottom: 18, padding: 22 }}
        >
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Active Fund Context</p>
              <h2 style={{ marginBottom: 8 }}>{activeFundName}</h2>
              <p style={{ margin: 0 }}>
                Activation status: <strong>{fundActivationStatus}</strong>
                {fundActivatedAt
                  ? ` · Activated ${formatDateTime(fundActivatedAt)}`
                  : ""}
                {fundActivatedBy ? ` by ${fundActivatedBy}` : ""}
              </p>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <label style={{ display: "grid", gap: 6, minWidth: 270 }}>
                <span style={{ fontSize: 12, fontWeight: 800 }}>
                  Switch active fund
                </span>
                <select
                  aria-label="Select active fund"
                  disabled={!fundContextReady || loading}
                  onChange={(event) => setActiveFundName(event.target.value)}
                  style={{
                    background: "#0f172a",
                    border: "1px solid rgba(148, 163, 184, 0.35)",
                    borderRadius: 12,
                    color: "#f8fafc",
                    minHeight: 42,
                    padding: "0 12px",
                  }}
                  value={activeFundName}
                >
                  {availableFunds.map((fundName) => (
                    <option key={fundName} value={fundName}>
                      {fundName}
                    </option>
                  ))}
                </select>
              </label>

              <a
                className="monitor-btn monitor-btn-secondary"
                href="/migration/activation"
              >
                Open Fund Activation
              </a>
            </div>
          </div>
        </div>

        <div className="sample-data-ribbon">
          {activeFundName} · {fundActivationStatus} · Connected finance workspace
          reading only this fund&apos;s migrated and workflow records
        </div>

        {loading && (
          <div className="preview-card">
            <h2>Preparing Finance Head Workspace...</h2>
            <p>
              VENTIQ is reading capital calls, distributions, investor
              documents, migrated fund economics, compliance evidence, portfolio
              repayment schedules and allocation drafts.
            </p>
          </div>
        )}

        {!loading && errorMessage && (
          <div className="preview-card">
            <h2>Connection Issue</h2>
            <div className="explain-box">{errorMessage}</div>
          </div>
        )}

        {!loading &&
          !errorMessage &&
          fundActivationStatus !== "Active" && (
            <div className="preview-card">
              <p className="eyebrow">Activation Required</p>
              <h2>{activeFundName} is not active across VENTIQ</h2>
              <div className="explain-box">
                The Finance Head Workspace is locked because this fund has not
                completed the controlled activation process. Upload and validate
                all mandatory data layers, complete maker-checker approval, and
                activate the fund before operational dashboards consume the data.
              </div>
              <div className="action-row">
                <a
                  className="monitor-btn monitor-btn-primary"
                  href="/migration/activation"
                >
                  Complete Fund Activation
                </a>
                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/migration/data-intake"
                >
                  Open Data Intake
                </a>
              </div>
            </div>
          )}

       {!loading &&
         !errorMessage &&
         fundActivationStatus === "Active" && (
  <>
    <div className="preview-card">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow">Migration Data Connected</p>
          <h2>{activeFundName} finance data is powering this dashboard</h2>
        </div>
      </div>

      <div className="impact-grid">
        <div className="impact-card">
          <h3>{migratedInvestorMaster.length}</h3>
          <p>Investor records</p>
        </div>

        <div className="impact-card">
          <h3>{migratedFundCommitments.length}</h3>
          <p>Commitment records</p>
        </div>

        <div className="impact-card">
          <h3>{migratedFinancialPositions.length}</h3>
          <p>Financial position records</p>
        </div>

        <div className="impact-card">
          <h3>{migratedInvestorCashflows.length}</h3>
          <p>Cashflow records</p>
        </div>
      </div>

      <div className="impact-grid">
        <div className="impact-card">
          <h3>{formatCurrencyCr(financeMetrics.calledCapital)}</h3>
          <p>Capital called</p>
        </div>

        <div className="impact-card">
          <h3>{formatCurrencyCr(financeMetrics.distributedCapital)}</h3>
          <p>Distributions</p>
        </div>

        <div className="impact-card">
          <h3>{formatCurrencyCr(financeMetrics.currentNav)}</h3>
          <p>Current NAV</p>
        </div>

        <div className="impact-card">
          <h3>{migratedPdfIntelligenceDocuments.length}</h3>
          <p>PDF intelligence records</p>
        </div>
      </div>

      <div className="explain-box">
        This Finance Head dashboard now reads only activated records for
        {activeFundName} from investor_master, fund_commitments,
        investor_financial_positions, investor_cashflows, investor_documents,
        pdf_intelligence_documents, fund_master, portfolio_investments and
        compliance_items.
      </div>
    </div>

    <div className="preview-card">
      <h2>Finance Head Workspace Preview</h2>

              <div className="explain-box">
                VENTIQ reviewed {financeMetrics.investorCount} migrated
                investors, {financeMetrics.fundCount} fund record(s),{" "}
                {financeMetrics.generatedDocuments} PDF / investor documents,{" "}
                {financeMetrics.portfolioRepaymentItems} repayment schedule
                item(s), {financeMetrics.complianceItems} compliance item(s)
                and {financeMetrics.pendingRegulatoryReviews} finance /
                compliance review signal(s).
              </div>

              <div className="action-row">
                <a className="monitor-btn monitor-btn-primary" href="/capital-call">
                  Open Capital Calls
                </a>
                <a
  className="monitor-btn monitor-btn-primary"
  href="/document-studio"
>
  Generate Investor Documents
</a>

                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/capital-call-allocation"
                >
                  Review Allocation Draft
                </a>

                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/document-engine"
                >
                  Review Documents
                </a>

                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/migration/activation"
                >
                  View Migration Readiness
                </a>

                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/migration/fund-data"
                >
                  Review Fund Data
                </a>

                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/migration/compliance-data"
                >
                  Review Compliance Data
                </a>

                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/activity-engine"
                >
                  Open Activity Engine
                </a>
              </div>
            </div>

            <div className="impact-grid">
              <div className="impact-card">
                <h3>{formatCurrencyCr(financeMetrics.totalCommitment)}</h3>
                <p>Total commitment</p>
              </div>

              <div className="impact-card">
                <h3>{formatCurrencyCr(financeMetrics.uncalledCapital)}</h3>
                <p>Uncalled capital</p>
              </div>

              <div className="impact-card">
                <h3>{financeMetrics.capitalCallAllocationDrafts}</h3>
                <p>Allocation drafts</p>
              </div>

              <div className="impact-card">
                <h3>{financeMetrics.capitalCallAllocationExceptions}</h3>
                <p>Allocation exceptions</p>
              </div>
            </div>

            <div className="impact-grid">
              <div className="impact-card">
                <h3>{financeMetrics.generatedDocuments}</h3>
                <p>PDF / investor documents</p>
              </div>

              <div className="impact-card">
                <h3>{financeMetrics.documentsNotStored}</h3>
                <p>PDF review / storage queue</p>
              </div>

              <div className="impact-card">
                <h3>{financeMetrics.complianceItems}</h3>
                <p>Compliance records</p>
              </div>

              <div className="impact-card">
                <h3>{financeMetrics.highRiskComplianceItems}</h3>
                <p>High-risk compliance</p>
              </div>
            </div>

            <div className="preview-card">
              <h2>Migrated Fund Finance Snapshot</h2>

              <div className="journal-preview">
                <div className="journal-row">
                  <span>Migrated investors</span>
                  <strong>{financeMetrics.investorCount}</strong>
                </div>

                <div className="journal-row">
                  <span>Fund committed capital</span>
                  <strong>{formatCurrencyCr(financeMetrics.committedCapital)}</strong>
                </div>

                <div className="journal-row">
                  <span>Sponsor commitment</span>
                  <strong>
                    {formatCurrencyCr(financeMetrics.sponsorCommitment)}
                  </strong>
                </div>

                <div className="journal-row">
                  <span>Average management fee</span>
                  <strong>
                    {financeMetrics.averageManagementFee.toFixed(2)}%
                  </strong>
                </div>

                <div className="journal-row">
                  <span>Average carry</span>
                  <strong>{financeMetrics.averageCarry.toFixed(2)}%</strong>
                </div>

                <div className="journal-row">
                  <span>Evidence available</span>
                  <strong>{financeMetrics.evidenceAvailable}</strong>
                </div>

                <div className="journal-row">
                  <span>Portfolio repayment items</span>
                  <strong>{financeMetrics.portfolioRepaymentItems}</strong>
                </div>

                <div className="journal-row">
                  <span>Portfolio at-risk items</span>
                  <strong>{financeMetrics.portfolioAtRiskItems}</strong>
                </div>
              </div>

              <div className="action-row">
                <a
                  className="monitor-btn monitor-btn-primary"
                  href="/migration/data-intake"
                >
                  Open Data Intake
                </a>

                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/migration/fund-data"
                >
                  Review Fund Data
                </a>

                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/migration/compliance-data"
                >
                  Review Compliance Data
                </a>

                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/migration/portfolio-data"
                >
                  Review Portfolio Data
                </a>
              </div>
            </div>

            <div className="preview-card">
              <h2>Today&apos;s Finance Control Queue</h2>

              <div className="queue-grid">
                {pendingFinanceActions.map((action) => (
                  <a
                    key={action.title}
                    className="queue-item"
                    href={action.href}
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <strong>{action.title}</strong>
                    <br />
                    {action.value}
                    <br />
                    Priority: {action.priority}
                  </a>
                ))}
              </div>
            </div>

            <div className="knowledge-grid">
              <div className="preview-card">
                <h2>Live Finance Activity Feed</h2>

                {financeActivityEvents.length === 0 && (
                  <div className="explain-box">
                    No connected finance activity found yet. Import fund data,
                    publish compliance evidence, process PDFs, approve a capital
                    call or create allocation drafts to generate the first
                    finance trail.
                  </div>
                )}

                {financeActivityEvents.length > 0 && (
                  <div className="audit-timeline">
                    {financeActivityEvents.slice(0, 12).map((event) => (
                      <div className="audit-item" key={event.id}>
                        <strong>{formatDateTime(event.time)}</strong>{" "}
                        {getActivityIcon(event.status)} {event.title}
                        <br />
                        <span>
                          {event.module} — {event.description}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="ai-side-panel">
                <h2>Ask Finance AI</h2>

                <div className="chat-message">
                  Ask: “What should I complete first today?”
                </div>

                <div className="chat-message">
                  Ask: “Which capital call allocations have exceptions?”
                </div>

                <div className="chat-message">
                  Ask: “Which compliance items are high risk?”
                </div>

                <div className="chat-message">
                  Ask: “Which repayment schedules need finance attention?”
                </div>

                <div className="chat-message">
                  Ask: “Which PDFs are missing before LP access?”
                </div>
              </div>
            </div>

            <div className="preview-card">
              <h2>Investor Data Room Support</h2>

              <div className="explain-box">
                Finance supports the investor data room by making sure
                investor-facing notices, SOAs, reports, tax documents and stored
                PDFs are complete before they are used in LP diligence or DDQ
                responses.
              </div>

              <div className="impact-grid">
                <div className="impact-card">
                  <h3>{financeMetrics.investorDocumentReadinessScore}%</h3>
                  <p>Document readiness</p>
                </div>

                <div className="impact-card">
                  <h3>{financeMetrics.portalAvailableDocuments}</h3>
                  <p>Portal-ready records</p>
                </div>

                <div className="impact-card">
                  <h3>{financeMetrics.investorReportingDocuments}</h3>
                  <p>Reporting support files</p>
                </div>

                <div className="impact-card">
                  <h3>{financeMetrics.ddqSupportItems}</h3>
                  <p>DDQ support items</p>
                </div>
              </div>

              <div className="queue-grid">
                <div className="queue-item">
                  🗂️ <strong>Data room support</strong>
                  <br />
                  Finance validates investor-facing records before LP sharing.
                </div>

                <div className="queue-item">
                  📄 <strong>Reporting evidence</strong>
                  <br />
                  Notices, SOAs, reports and certificates support investor DDQs.
                </div>

                <div className="queue-item">
                  🟣 <strong>PDF storage</strong>
                  <br />
                  {financeMetrics.storedDocuments} stored PDFs,{" "}
                  {financeMetrics.documentsNotStored} pending storage / review
                </div>

                <div className="queue-item">
                  🟢 <strong>Investor portal</strong>
                  <br />
                  {financeMetrics.portalAvailableDocuments} records available to
                  investors
                </div>
              </div>

              <div className="action-row">
                <a className="monitor-btn monitor-btn-primary" href="/data-room">
                  Open Data Room
                </a>

                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/document-engine"
                >
                  Open Document Engine
                </a>

                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/activity-engine"
                >
                  View Activity Trail
                </a>
              </div>
            </div>

            <div className="preview-card">
              <h2>Document and Investor Communication Status</h2>

              <div className="journal-preview">
                <div className="journal-row">
                  <span>Generated investor / PDF documents</span>
                  <strong>{financeMetrics.generatedDocuments}</strong>
                </div>

                <div className="journal-row">
                  <span>Available in investor portal</span>
                  <strong>{financeMetrics.portalAvailableDocuments}</strong>
                </div>

                <div className="journal-row">
                  <span>Stored PDFs</span>
                  <strong>{financeMetrics.storedDocuments}</strong>
                </div>

                <div className="journal-row">
                  <span>PDFs pending storage / review</span>
                  <strong>{financeMetrics.documentsNotStored}</strong>
                </div>

                <div className="journal-row">
                  <span>Email queued</span>
                  <strong>{financeMetrics.queuedEmails}</strong>
                </div>

                <div className="journal-row">
                  <span>Email sent</span>
                  <strong>{financeMetrics.sentEmails}</strong>
                </div>
              </div>

              <div className="action-row">
                <a
                  className="monitor-btn monitor-btn-primary"
                  href="/document-engine"
                >
                  Open Document Engine
                </a>

                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/investor-portal"
                >
                  Open Investor Portal
                </a>

                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/migration/pdf-intelligence"
                >
                  Open PDF Intelligence
                </a>
              </div>
            </div>

            <div className="preview-card">
              <h2>Capital Call and Distribution Status</h2>

              <div className="journal-preview">
                <div className="journal-row">
                  <span>Allocation drafts</span>
                  <strong>{financeMetrics.capitalCallAllocationDrafts}</strong>
                </div>

                <div className="journal-row">
                  <span>Ready allocations</span>
                  <strong>{financeMetrics.readyAllocations}</strong>
                </div>

                <div className="journal-row">
                  <span>Allocation exceptions</span>
                  <strong>{financeMetrics.capitalCallAllocationExceptions}</strong>
                </div>

                <div className="journal-row">
                  <span>Allocation draft amount</span>
                  <strong>
                    {formatCurrencyCr(financeMetrics.capitalCallAllocationAmount)}
                  </strong>
                </div>

                <div className="journal-row">
                  <span>Draft capital calls</span>
                  <strong>{financeMetrics.draftCapitalCalls}</strong>
                </div>

                <div className="journal-row">
                  <span>Approved capital calls</span>
                  <strong>{financeMetrics.approvedCapitalCalls}</strong>
                </div>

                <div className="journal-row">
                  <span>Approved capital call amount</span>
                  <strong>
                    {formatCurrencyCr(
                      financeMetrics.totalApprovedCapitalCallAmount
                    )}
                  </strong>
                </div>

                <div className="journal-row">
                  <span>Approved distribution amount</span>
                  <strong>
                    {formatCurrencyCr(
                      financeMetrics.totalApprovedDistributionAmount
                    )}
                  </strong>
                </div>
              </div>

              <div className="action-row">
                <a
                  className="monitor-btn monitor-btn-primary"
                  href="/capital-call-allocation"
                >
                  Review Allocation Draft
                </a>

                <a className="monitor-btn monitor-btn-secondary" href="/capital-call">
                  Review Capital Calls
                </a>

                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/distribution-waterfall"
                >
                  Review Distributions
                </a>
              </div>
            </div>

            <div className="preview-card">
              <h2>Finance AI Answer Preview</h2>

              <div className="explain-box">
                <strong>Question:</strong> What should I complete first today?
                <br />
                <br />
                <strong>VENTIQ AI:</strong>{" "}
                {financeMetrics.capitalCallAllocationExceptions > 0
                  ? `Review ${financeMetrics.capitalCallAllocationExceptions} capital call allocation exception(s) before generating investor notices.`
                  : financeMetrics.highRiskComplianceItems > 0
                  ? `Review ${financeMetrics.highRiskComplianceItems} high-risk compliance item(s) and assign owners before audit or filing review.`
                  : financeMetrics.documentsNotStored > 0
                  ? `Review or store ${financeMetrics.documentsNotStored} pending PDF / investor document(s) so investors can access final notices in the portal.`
                  : financeMetrics.draftCapitalCalls > 0
                  ? `Review ${financeMetrics.draftCapitalCalls} capital call draft workflow(s) before dispatch.`
                  : financeMetrics.pendingRegulatoryReviews > 0
                  ? `Review ${financeMetrics.pendingRegulatoryReviews} regulatory / compliance source match(es).`
                  : "Finance workflows are currently on track. Continue monitoring Activity Engine and investor communication status."}
              </div>
            </div>

            <div className="preview-card">
              <h2>Connected Finance Loop</h2>

              <div className="queue-grid">
                <div className="queue-item">Data Imported</div>
                <div className="queue-item">Fund Economics Reviewed</div>
                <div className="queue-item">Capital Allocation Prepared</div>
                <div className="queue-item">Finance Review Completed</div>
                <div className="queue-item">Document Engine Generated Notices</div>
                <div className="queue-item">PDF Stored in Vault</div>
                <div className="queue-item">Investor Portal Updated</div>
                <div className="queue-item">Compliance Evidence Checked</div>
                <div className="queue-item">Activity Engine Recorded Evidence</div>
                <div className="queue-item">Managing Partner View Updated</div>
              </div>

              <div className="explain-box">
                This is the Finance Head view of the same connected VENTIQ
                operating loop. The finance team can now see migrated fund
                economics, investor data, PDF readiness, repayment schedules,
                compliance evidence, allocation drafts and document workflow
                status in one place.
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}