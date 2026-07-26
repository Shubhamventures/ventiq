import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

type IntakeFile = {
  id: string;
  batch_id: string;
  original_file_name: string | null;
  category: string | null;
  detected_type: string | null;
  file_size: number | string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  note: string | null;
};

type InvestorRow = {
  id: string;
  investor_code: string | null;
  investor_name: string | null;
  email: string | null;
  tax_id: string | null;
};

type ParsedRow = Record<string, unknown>;

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
}

function normalizeKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function getValue(row: ParsedRow, keys: string[]) {
  for (const key of keys) {
    const normalizedKey = normalizeKey(key);
    const value = row[normalizedKey];

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    ) {
      return value;
    }
  }

  return "";
}

function getText(row: ParsedRow, keys: string[]) {
  return normalizeText(getValue(row, keys));
}

function parseNumber(value: unknown) {
  const cleaned = String(value ?? "")
    .replace(/,/g, "")
    .replace(/₹/g, "")
    .replace(/%/g, "")
    .trim();

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getNumber(row: ParsedRow, keys: string[]) {
  return parseNumber(getValue(row, keys));
}

function parseDateValue(value: unknown) {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number" && value > 20000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const parsed = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
    return parsed.toISOString().slice(0, 10);
  }

  const text = String(value).trim();

  if (!text) return null;

  const parsed = new Date(text);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

function getDate(row: ParsedRow, keys: string[]) {
  return parseDateValue(getValue(row, keys));
}

function readWorkbookRows(buffer: Buffer, preferredSheets: string[] = []) {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
  });

  const availableSheets = workbook.SheetNames;

  const preferredSheet = preferredSheets.find((preferredName) =>
    availableSheets.some(
      (availableName) => normalizeKey(availableName) === normalizeKey(preferredName)
    )
  );

  const exactPreferredSheet = preferredSheet
    ? availableSheets.find(
        (availableName) => normalizeKey(availableName) === normalizeKey(preferredSheet)
      )
    : "";

  const fallbackSheet = availableSheets.find((sheetName) => {
    const normalized = normalizeKey(sheetName);

    return !["summary", "data_dictionary", "data_dictionary_"].includes(
      normalized
    );
  });

  const sheetName = exactPreferredSheet || fallbackSheet || availableSheets[0];

  if (!sheetName) {
    return [];
  }

  const worksheet = workbook.Sheets[sheetName];

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: "",
  });

  return rawRows.map((row) => {
    const normalizedRow: ParsedRow = {};

    Object.entries(row).forEach(([key, value]) => {
      normalizedRow[normalizeKey(key)] = value;
    });

    return normalizedRow;
  });
}

function detectPdfDocumentType(fileName: string) {
  const normalized = fileName.toLowerCase();

  if (normalized.includes("capital") || normalized.includes("drawdown")) {
    return "Capital Call Notice";
  }

  if (normalized.includes("distribution") || normalized.includes("payout")) {
    return "Distribution Notice";
  }

  if (normalized.includes("irr")) {
    return "IRR Statement";
  }

  if (
    normalized.includes("soa") ||
    normalized.includes("statement") ||
    normalized.includes("account")
  ) {
    return "SOA / Account Statement";
  }

  if (
    normalized.includes("tax") ||
    normalized.includes("64c") ||
    normalized.includes("64d") ||
    normalized.includes("tds")
  ) {
    return "Tax Document";
  }

  if (normalized.includes("portfolio") || normalized.includes("valuation")) {
    return "Portfolio Report";
  }

  if (normalized.includes("fund") || normalized.includes("quarterly")) {
    return "Fund Report";
  }

  return "Other / Review";
}

function detectPeriod(fileName: string) {
  const text = fileName.toLowerCase();

  const qMatch = text.match(/q[1-4][-_ ]?fy[-_ ]?[0-9]{2,4}/i);
  if (qMatch) return qMatch[0].toUpperCase().replace(/[-_]/g, " ");

  const fyMatch = text.match(/fy[-_ ]?[0-9]{2,4}/i);
  if (fyMatch) return fyMatch[0].toUpperCase().replace(/[-_]/g, " ");

  if (text.includes("march")) return "March";
  if (text.includes("june")) return "June";
  if (text.includes("september")) return "September";
  if (text.includes("december")) return "December";

  return "Period not detected";
}

function normalizeForMatch(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function compactForMatch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function extractInvestorCodeTokens(value: string) {
  const matches = value.match(/inv[-_\s]*0*\d+/gi) ?? [];

  return new Set(matches.map((match) => compactForMatch(match)));
}

function matchInvestorFromFileName(
  investors: InvestorRow[],
  fileName: string
): {
  investor: InvestorRow | null;
  investorScore: number;
  signals: string[];
} {
  const normalizedFile = normalizeForMatch(fileName);
  const compactFile = compactForMatch(fileName);
  const fileCodeTokens = extractInvestorCodeTokens(fileName);

  let bestInvestor: InvestorRow | null = null;
  let bestScore = 0;
  let signals: string[] = [];

  investors.forEach((investor) => {
    let score = 0;
    const currentSignals: string[] = [];

    const investorCode = investor.investor_code
      ? normalizeForMatch(investor.investor_code)
      : "";

    const compactInvestorCode = investor.investor_code
      ? compactForMatch(investor.investor_code)
      : "";

    const investorName = investor.investor_name
      ? normalizeForMatch(investor.investor_name)
      : "";

    const compactInvestorName = investor.investor_name
      ? compactForMatch(investor.investor_name)
      : "";

    const email = investor.email ? normalizeForMatch(investor.email) : "";

    if (compactInvestorCode && fileCodeTokens.has(compactInvestorCode)) {
      score += 65;
      currentSignals.push(
        `Investor code matched from filename: ${investor.investor_code}`
      );
    } else if (
      compactInvestorCode &&
      compactInvestorCode.length >= 6 &&
      compactFile.includes(compactInvestorCode)
    ) {
      score += 50;
      currentSignals.push(
        `Investor code matched after normalization: ${investor.investor_code}`
      );
    } else if (investorCode && normalizedFile.includes(investorCode)) {
      score += 45;
      currentSignals.push(`Investor code matched: ${investor.investor_code}`);
    }

    if (email && normalizedFile.includes(email)) {
      score += 25;
      currentSignals.push(`Email matched: ${investor.email}`);
    }

    if (compactInvestorName && compactFile.includes(compactInvestorName)) {
      score += 30;
      currentSignals.push(
        `Investor name matched after normalization: ${investor.investor_name}`
      );
    } else if (investorName && normalizedFile.includes(investorName)) {
      score += 20;
      currentSignals.push(`Investor name matched: ${investor.investor_name}`);
    }

    if (score > bestScore) {
      bestScore = score;
      bestInvestor = investor;
      signals = currentSignals;
    }
  });

  return {
    investor: bestInvestor,
    investorScore: Math.min(bestScore, 60),
    signals: signals.length
      ? signals
      : ["No investor match found from filename"],
  };
}

function calculatePdfConfidence(
  documentType: string,
  investorScore: number,
  period: string
) {
  let score = 0;

  if (documentType !== "Other / Review") score += 25;
  score += investorScore;
  if (period !== "Period not detected") score += 15;

  return Math.min(score, 100);
}

function getPdfStatus(score: number, documentType: string) {
  if (documentType === "Other / Review" && score < 60) return "Unmatched";
  if (score >= 85) return "Ready";
  if (score >= 60) return "Review";
  return "Unmatched";
}

async function downloadExcelBuffer(
  client: {
    storage: {
      from: (bucket: string) => {
        download: (path: string) => Promise<{
          data: Blob | null;
          error: { message: string } | null;
        }>;
      };
    };
  },
  file: IntakeFile
) {
  if (!file.storage_bucket || !file.storage_path) {
    throw new Error(`Missing storage path for ${file.original_file_name}`);
  }

  const { data, error } = await client.storage
    .from(file.storage_bucket)
    .download(file.storage_path);

  if (error || !data) {
    throw new Error(
      error?.message || `Unable to download ${file.original_file_name}`
    );
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase admin client is not configured." },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    let batchId = String(body.batchId || "");

    if (!batchId) {
      const { data: latestBatch, error } = await supabase
        .from("migration_intake_batches")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !latestBatch) {
        return NextResponse.json(
          { error: error?.message || "No migration intake batch found." },
          { status: 404 }
        );
      }

      batchId = latestBatch.id as string;
    }

    const { data: intakeFiles, error: intakeError } = await supabase
      .from("migration_file_uploads")
      .select(
        "id, batch_id, original_file_name, category, detected_type, file_size, storage_bucket, storage_path, note"
      )
      .eq("batch_id", batchId);

    if (intakeError) {
      return NextResponse.json({ error: intakeError.message }, { status: 500 });
    }

    const files = (intakeFiles as IntakeFile[] | null) ?? [];

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files found in this intake batch." },
        { status: 404 }
      );
    }

    const summary = {
      investorRows: 0,
      commitmentRows: 0,
      financialRows: 0,
      cashflowRows: 0,
      pdfRows: 0,
      portfolioRows: 0,
      fundRows: 0,
      complianceRows: 0,
    };

    const investorFiles = files.filter((file) => file.category === "investor");

    for (const file of investorFiles) {
      const buffer = await downloadExcelBuffer(supabase, file);
      const rows = readWorkbookRows(buffer, [
        "Investor_Master",
        "Investor Master",
        "Investors",
      ]);

      if (rows.length === 0) continue;

      const totalCommitment = rows.reduce(
        (sum, row) =>
          sum + getNumber(row, ["commitment_amount", "commitment"]),
        0
      );

      const investorRowsByCode = new Map<
        string,
        {
          batch_id?: string;
          investor_code: string;
          investor_name: string;
          email: string;
          investor_type: string;
          country: string;
          kyc_status: string;
          bank_status: string;
          tax_id: string;
          fund_name: string;
        }
      >();

      rows.forEach((row, index) => {
        const investorCode =
          getText(row, ["investor_code", "investor_id", "lp_code"]) ||
          `INV-MISSING-${String(index + 1).padStart(4, "0")}`;

        if (!investorRowsByCode.has(investorCode)) {
          investorRowsByCode.set(investorCode, {
            investor_code: investorCode,
            investor_name:
              getText(row, ["investor_name", "lp_name", "name"]) ||
              `Investor ${index + 1}`,
            email: getText(row, ["email", "email_id"]),
            investor_type: getText(row, ["investor_type", "lp_type"]),
            country: getText(row, ["country"]),
            kyc_status: getText(row, ["kyc_status"]),
            bank_status: getText(row, ["bank_status"]),
            tax_id: getText(row, [
              "tax_id",
              "pan_or_tax_id",
              "pan",
              "tax_number",
            ]),
            fund_name:
              getText(row, ["fund_name"]) || "VENTIQ Growth Fund II",
          });
        }
      });

      const { data: investorBatch, error: batchError } = await supabase
        .from("investor_import_batches")
        .insert({
          batch_name: `Processed from intake - ${file.original_file_name}`,
          fund_name: "VENTIQ Growth Fund II",
          total_records: investorRowsByCode.size,
          total_commitment: totalCommitment,
          status: "published",
        })
        .select("id")
        .single();

      if (batchError || !investorBatch) {
        throw new Error(
          batchError?.message || "Unable to create investor batch."
        );
      }

      const investorRows = Array.from(investorRowsByCode.values()).map(
        (row) => ({
          ...row,
          batch_id: investorBatch.id,
        })
      );

      const { data: insertedInvestors, error: investorError } = await supabase
        .from("investor_master")
        .insert(investorRows)
        .select("id, investor_code, investor_name, email, tax_id");

      if (investorError) {
        throw new Error(investorError.message);
      }

      const inserted = (insertedInvestors as InvestorRow[] | null) ?? [];

      const byCode = new Map(
        inserted.map((investor) => [investor.investor_code ?? "", investor])
      );

      const commitmentRows = rows.map((row) => {
        const investorCode =
          getText(row, ["investor_code", "investor_id", "lp_code"]) || "";
        const investor = byCode.get(investorCode);

        return {
          batch_id: investorBatch.id,
          investor_id: investor?.id ?? null,
          investor_code: investorCode,
          investor_name: getText(row, ["investor_name", "lp_name", "name"]),
          email: getText(row, ["email", "email_id"]),
          fund_name:
            getText(row, ["fund_name"]) || "VENTIQ Growth Fund II",
          class_name: getText(row, ["class_name", "class"]),
          commitment_amount: getNumber(row, [
            "commitment_amount",
            "commitment",
          ]),
          capital_called_till_date: getNumber(row, [
            "capital_called_till_date",
            "capital_called",
          ]),
          uncalled_capital: getNumber(row, [
            "uncalled_capital",
            "remaining_commitment",
          ]),
          distributions_till_date: getNumber(row, [
            "distributions_till_date",
            "distributed",
            "distributions",
          ]),
          setup_fee: getNumber(row, ["setup_fee"]),
          management_fee: getNumber(row, ["management_fee"]),
          status: "Active",
        };
      });

      const { error: commitmentError } = await supabase
        .from("fund_commitments")
        .insert(commitmentRows);

      if (commitmentError) {
        throw new Error(commitmentError.message);
      }

      const financialRows = rows.map((row) => {
        const investorCode =
          getText(row, ["investor_code", "investor_id", "lp_code"]) || "";
        const investor = byCode.get(investorCode);
        const commitmentAmount = getNumber(row, [
          "commitment_amount",
          "commitment",
        ]);
        const capitalCalled = getNumber(row, [
          "capital_called_till_date",
          "capital_called",
        ]);
        const distributions = getNumber(row, [
          "distributions_till_date",
          "distributed",
          "distributions",
        ]);
        const uncalledCapital =
          getNumber(row, ["uncalled_capital", "remaining_commitment"]) ||
          Math.max(commitmentAmount - capitalCalled, 0);
        const nav =
          getNumber(row, ["nav", "latest_nav"]) ||
          Math.max(capitalCalled - distributions, 0) * 1.22;
        const dpi = capitalCalled ? distributions / capitalCalled : 0;
        const tvpi = capitalCalled ? (distributions + nav) / capitalCalled : 0;

        return {
          investor_id: investor?.id ?? null,
          investor_code: investorCode,
          investor_name: getText(row, ["investor_name", "lp_name", "name"]),
          email: getText(row, ["email", "email_id"]),
          fund_name:
            getText(row, ["fund_name"]) || "VENTIQ Growth Fund II",
          commitment_amount: commitmentAmount,
          capital_called: capitalCalled,
          uncalled_capital: uncalledCapital,
          distributions,
          nav,
          dpi,
          tvpi,
          moic: getNumber(row, ["moic"]) || tvpi,
          gross_irr: getNumber(row, ["gross_irr", "irr"]) || 22,
          net_irr: getNumber(row, ["net_irr"]) || 18,
        };
      });

      const { error: financialError } = await supabase
        .from("investor_financial_positions")
        .insert(financialRows);

      if (financialError) {
        throw new Error(financialError.message);
      }

      const cashflowRows = rows
        .filter((row) => getDate(row, ["cashflow_date"]))
        .map((row) => {
          const investorCode =
            getText(row, ["investor_code", "investor_id", "lp_code"]) || "";
          const investor = byCode.get(investorCode);

          return {
            investor_id: investor?.id ?? null,
            investor_code: investorCode,
            investor_name: getText(row, ["investor_name", "lp_name", "name"]),
            fund_name:
              getText(row, ["fund_name"]) || "VENTIQ Growth Fund II",
            cashflow_date: getDate(row, ["cashflow_date"]),
            cashflow_type:
              getText(row, ["cashflow_type"]) || "Capital Activity",
            cashflow_amount: getNumber(row, ["cashflow_amount"]),
          };
        });

      if (cashflowRows.length > 0) {
        const { error: cashflowError } = await supabase
          .from("investor_cashflows")
          .insert(cashflowRows);

        if (cashflowError) {
          throw new Error(cashflowError.message);
        }
      }

      summary.investorRows += investorRows.length;
      summary.commitmentRows += commitmentRows.length;
      summary.financialRows += financialRows.length;
      summary.cashflowRows += cashflowRows.length;
    }

    const { data: investorMaster } = await supabase
      .from("investor_master")
      .select("id, investor_code, investor_name, email, tax_id")
      .order("investor_code", { ascending: true });

    const investors = (investorMaster as InvestorRow[] | null) ?? [];

    const pdfFiles = files.filter((file) => file.category === "pdf");

    if (pdfFiles.length > 0) {
      const { data: pdfBatch, error: pdfBatchError } = await supabase
        .from("pdf_intelligence_batches")
        .insert({
          batch_name: `Processed from intake - ${new Date().toLocaleString(
            "en-IN"
          )}`,
          fund_name: "VENTIQ Growth Fund II",
          total_files: pdfFiles.length,
          status: "completed",
        })
        .select("id")
        .single();

      if (pdfBatchError || !pdfBatch) {
        throw new Error(
          pdfBatchError?.message || "Unable to create PDF intelligence batch."
        );
      }

      const pdfRows = pdfFiles.map((file) => {
        const fileName = file.original_file_name ?? "Unknown PDF";
        const documentType = detectPdfDocumentType(fileName);
        const periodLabel = detectPeriod(fileName);
        const investorMatch = matchInvestorFromFileName(investors, fileName);
        const confidenceScore = calculatePdfConfidence(
          documentType,
          investorMatch.investorScore,
          periodLabel
        );
        const status = getPdfStatus(confidenceScore, documentType);
        const matchedInvestor = investorMatch.investor as InvestorRow | null;

        return {
          batch_id: pdfBatch.id,
          original_file_name: fileName,
          storage_bucket: file.storage_bucket,
          storage_path: file.storage_path,
          file_size: Number(file.file_size ?? 0),
          document_type: documentType,
          matched_investor_id: matchedInvestor?.id ?? null,
          investor_code: matchedInvestor?.investor_code ?? null,
          investor_name: matchedInvestor?.investor_name ?? null,
          email: matchedInvestor?.email ?? null,
          fund_name: "VENTIQ Growth Fund II",
          period_label: periodLabel,
          confidence_score: confidenceScore,
          status,
          match_signals: [
            ...investorMatch.signals,
            `Document type: ${documentType}`,
            `Period: ${periodLabel}`,
            `Confidence score: ${confidenceScore}`,
            "Created from migration intake upload",
          ],
          extracted_text_preview:
            "This PDF was imported from Migration Data Intake. Full text extraction will be added as the next processing layer.",
        };
      });

      const { error: pdfInsertError } = await supabase
        .from("pdf_intelligence_documents")
        .insert(pdfRows);

      if (pdfInsertError) {
        throw new Error(pdfInsertError.message);
      }

      const readyFiles = pdfRows.filter((row) => row.status === "Ready").length;
      const reviewFiles = pdfRows.filter(
        (row) => row.status === "Review"
      ).length;
      const unmatchedFiles = pdfRows.filter(
        (row) => row.status === "Unmatched"
      ).length;

      await supabase
        .from("pdf_intelligence_batches")
        .update({
          ready_files: readyFiles,
          review_files: reviewFiles,
          unmatched_files: unmatchedFiles,
          updated_at: new Date().toISOString(),
        })
        .eq("id", pdfBatch.id);

      summary.pdfRows += pdfRows.length;
    }

    const portfolioFiles = files.filter(
      (file) => file.category === "portfolio"
    );

    for (const file of portfolioFiles) {
      const buffer = await downloadExcelBuffer(supabase, file);
      const rows = readWorkbookRows(buffer, [
        "Portfolio_Investments",
        "Portfolio Investments",
        "Investments",
      ]);

      if (rows.length === 0) continue;

      const totalInvestmentCost = rows.reduce(
        (sum, row) =>
          sum + getNumber(row, ["investment_cost", "cost"]),
        0
      );

      const currentPortfolioValue = rows.reduce(
        (sum, row) =>
          sum + getNumber(row, ["current_value", "current_portfolio_value"]),
        0
      );

      const realisedValue = rows.reduce(
        (sum, row) =>
          sum + getNumber(row, ["realised_value", "realized_value"]),
        0
      );

      const expectedExitValue = rows.reduce(
        (sum, row) => sum + getNumber(row, ["expected_exit_value"]),
        0
      );

      const portfolioMoic = totalInvestmentCost
        ? (currentPortfolioValue + realisedValue) / totalInvestmentCost
        : 0;

      const atRiskCount = rows.filter((row) => {
        const risk = getText(row, ["risk_status"]).toLowerCase();
        return risk.includes("risk") || risk.includes("watch");
      }).length;

      const repaymentCount = rows.filter((row) =>
        getDate(row, ["repayment_due_date"])
      ).length;

      const { data: portfolioBatch, error: portfolioBatchError } =
        await supabase
          .from("portfolio_data_migration_batches")
          .insert({
            batch_name: `Processed from intake - ${file.original_file_name}`,
            fund_name: "VENTIQ Growth Fund II",
            total_records: rows.length,
            total_investment_cost: totalInvestmentCost,
            current_portfolio_value: currentPortfolioValue,
            realised_value: realisedValue,
            expected_exit_value: expectedExitValue,
            portfolio_moic: portfolioMoic,
            at_risk_count: atRiskCount,
            repayment_count: repaymentCount,
            status: "published",
          })
          .select("id")
          .single();

      if (portfolioBatchError || !portfolioBatch) {
        throw new Error(
          portfolioBatchError?.message || "Unable to create portfolio batch."
        );
      }

      const portfolioRows = rows.map((row, index) => ({
        batch_id: portfolioBatch.id,
        portfolio_code:
          getText(row, ["portfolio_code"]) ||
          `PORT-${String(index + 1).padStart(4, "0")}`,
        portfolio_company:
          getText(row, [
            "portfolio_company",
            "company_name",
            "investee_company",
          ]) || `Portfolio Company ${index + 1}`,
        fund_name:
          getText(row, ["fund_name"]) || "VENTIQ Growth Fund II",
        investment_date: getDate(row, ["investment_date"]),
        instrument_type: getText(row, ["instrument_type", "instrument"]),
        sector: getText(row, ["sector"]),
        investment_cost: getNumber(row, ["investment_cost", "cost"]),
        current_value: getNumber(row, [
          "current_value",
          "current_portfolio_value",
        ]),
        realised_value: getNumber(row, [
          "realised_value",
          "realized_value",
        ]),
        expected_exit_value: getNumber(row, ["expected_exit_value"]),
        expected_exit_date: getDate(row, [
          "expected_exit_date",
          "exit_date",
        ]),
        repayment_due_date: getDate(row, ["repayment_due_date"]),
        interest_rate: getNumber(row, [
          "interest_rate",
          "coupon_or_interest_rate",
        ]),
        security_or_charge: getText(row, ["security_or_charge"]),
        covenants: getText(row, ["covenants", "covenant_status"]),
        risk_status: getText(row, ["risk_status"]) || "Healthy",
        latest_update: getText(row, ["latest_update"]),
        migration_status: "Ready",
      }));

      const { error: portfolioInsertError } = await supabase
        .from("portfolio_investments")
        .insert(portfolioRows);

      if (portfolioInsertError) {
        throw new Error(portfolioInsertError.message);
      }

      summary.portfolioRows += portfolioRows.length;
    }

    const fundFiles = files.filter((file) => file.category === "fund");

    for (const file of fundFiles) {
      const buffer = await downloadExcelBuffer(supabase, file);
      const rows = readWorkbookRows(buffer, [
        "Fund_Master",
        "Fund Master",
        "Funds",
      ]);

      if (rows.length === 0) continue;

      const totalCommittedCapital = rows.reduce(
        (sum, row) => sum + getNumber(row, ["committed_capital"]),
        0
      );

      const { data: fundBatch, error: fundBatchError } = await supabase
        .from("fund_data_migration_batches")
        .insert({
          batch_name: `Processed from intake - ${file.original_file_name}`,
          total_funds: rows.length,
          total_target_corpus: rows.reduce(
            (sum, row) => sum + getNumber(row, ["target_corpus"]),
            0
          ),
          total_committed_capital: totalCommittedCapital,
          total_green_shoe: rows.reduce(
            (sum, row) => sum + getNumber(row, ["green_shoe"]),
            0
          ),
          total_sponsor_commitment: rows.reduce(
            (sum, row) => sum + getNumber(row, ["sponsor_commitment"]),
            0
          ),
          average_management_fee:
            rows.reduce(
              (sum, row) => sum + getNumber(row, ["management_fee_rate"]),
              0
            ) / rows.length,
          average_carry:
            rows.reduce(
              (sum, row) => sum + getNumber(row, ["carry_rate"]),
              0
            ) / rows.length,
          status: "published",
        })
        .select("id")
        .single();

      if (fundBatchError || !fundBatch) {
        throw new Error(
          fundBatchError?.message || "Unable to create fund batch."
        );
      }

      const fundRows = rows.map((row) => ({
        batch_id: fundBatch.id,
        fund_code: getText(row, ["fund_code"]),
        fund_name:
          getText(row, ["fund_name"]) || "VENTIQ Growth Fund II",
        fund_type: getText(row, ["fund_type"]),
        category: getText(row, ["category"]),
        jurisdiction: getText(row, ["jurisdiction"]),
        first_close_date: getDate(row, ["first_close_date"]),
        second_close_date: getDate(row, ["second_close_date"]),
        final_close_date: getDate(row, ["final_close_date"]),
        target_corpus: getNumber(row, ["target_corpus"]),
        committed_capital: getNumber(row, ["committed_capital"]),
        green_shoe: getNumber(row, ["green_shoe"]),
        management_fee_rate: getNumber(row, ["management_fee_rate"]),
        setup_cost_rate: getNumber(row, ["setup_cost_rate"]),
        carry_rate: getNumber(row, ["carry_rate"]),
        hurdle_rate: getNumber(row, ["hurdle_rate"]),
        waterfall_type: getText(row, ["waterfall_type"]),
        sponsor_commitment: getNumber(row, ["sponsor_commitment"]),
        trustee_name: getText(row, ["trustee_name"]),
        investment_manager: getText(row, ["investment_manager"]),
        migration_status: "Ready",
      }));

      const { error: fundInsertError } = await supabase
        .from("fund_master")
        .insert(fundRows);

      if (fundInsertError) {
        throw new Error(fundInsertError.message);
      }

      summary.fundRows += fundRows.length;
    }

    const complianceFiles = files.filter(
      (file) => file.category === "compliance"
    );

    for (const file of complianceFiles) {
      const fileName = file.original_file_name ?? "";
      const isExcel =
        fileName.toLowerCase().endsWith(".xlsx") ||
        fileName.toLowerCase().endsWith(".xls") ||
        fileName.toLowerCase().endsWith(".csv");

      if (!isExcel) continue;

      const buffer = await downloadExcelBuffer(supabase, file);
      const rows = readWorkbookRows(buffer, [
        "Compliance_Items",
        "Compliance Items",
        "Compliance",
      ]);

      if (rows.length === 0) continue;

      const highRiskCount = rows.filter((row) =>
        getText(row, ["risk_level"]).toLowerCase().includes("high")
      ).length;

      const evidenceAvailableCount = rows.filter((row) => {
        const value = getText(row, ["evidence_available"]).toLowerCase();
        return value === "yes" || value === "true" || value === "available";
      }).length;

      const pendingReviewCount = rows.filter((row) =>
        getText(row, ["filing_status", "migration_status"])
          .toLowerCase()
          .includes("pending")
      ).length;

      const { data: complianceBatch, error: complianceBatchError } =
        await supabase
          .from("compliance_data_migration_batches")
          .insert({
            batch_name: `Processed from intake - ${file.original_file_name}`,
            fund_name: "VENTIQ Growth Fund II",
            total_items: rows.length,
            evidence_available_count: evidenceAvailableCount,
            pending_review_count: pendingReviewCount,
            high_risk_count: highRiskCount,
            ready_count: rows.length - pendingReviewCount,
            status: "published",
          })
          .select("id")
          .single();

      if (complianceBatchError || !complianceBatch) {
        throw new Error(
          complianceBatchError?.message || "Unable to create compliance batch."
        );
      }

      const complianceRows = rows.map((row, index) => ({
        batch_id: complianceBatch.id,
        compliance_code:
          getText(row, ["compliance_code"]) ||
          `COMP-${String(index + 1).padStart(4, "0")}`,
        item_type: getText(row, ["item_type"]),
        document_name:
          getText(row, ["document_name"]) ||
          `Compliance Document ${index + 1}`,
        fund_name:
          getText(row, ["fund_name"]) || "VENTIQ Growth Fund II",
        period: getText(row, ["period"]),
        authority: getText(row, ["authority"]),
        due_date: getDate(row, ["due_date"]),
        filing_status: getText(row, ["filing_status"]) || "Review",
        evidence_available:
          getText(row, ["evidence_available"]).toLowerCase() === "yes" ||
          getText(row, ["evidence_available"]).toLowerCase() === "true",
        owner: getText(row, ["owner"]),
        category: getText(row, ["category"]),
        risk_level: getText(row, ["risk_level"]) || "Medium",
        remarks: getText(row, ["remarks"]),
        migration_status: "Ready",
      }));

      const { error: complianceInsertError } = await supabase
        .from("compliance_items")
        .insert(complianceRows);

      if (complianceInsertError) {
        throw new Error(complianceInsertError.message);
      }

      summary.complianceRows += complianceRows.length;
    }

    return NextResponse.json({
      batchId,
      message: "Migration intake processed successfully.",
      summary,
    });
  } catch (error) {
    console.error("Process intake failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Migration intake processing failed.",
      },
      { status: 500 }
    );
  }
}