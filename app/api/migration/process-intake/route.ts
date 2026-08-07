/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROCESS_ROLES = new Set(["fund_admin", "maker"]);
const PAGE_SIZE = 1000;
const INSERT_CHUNK_SIZE = 250;
const ISSUE_CHUNK_SIZE = 250;
const UPDATE_CONCURRENCY = 20;

type SupabaseAdmin = any;
type ParsedRow = Record<string, unknown>;
type DatabaseRow = Record<string, any>;

type AuthorisedUser = {
  userId: string;
  email: string;
  fullName: string;
  role: string;
};

type IntakeBatchRow = {
  id: string;
  fund_name: string | null;
  processing_status: string | null;
};

type IntakeFile = {
  id: string;
  batch_id: string;
  fund_name: string | null;
  original_file_name: string | null;
  category: string | null;
  dataset_key: string | null;
  detected_type: string | null;
  file_size: number | string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  upload_status: string | null;
  processing_status: string | null;
  note: string | null;
};

type InvestorReference = {
  id: string;
  investor_code: string | null;
  investor_name: string | null;
  email: string | null;
  tax_id: string | null;
};

type PortfolioReference = {
  id: string;
  portfolio_code: string | null;
  portfolio_company: string | null;
};

type ProcessingContext = {
  supabase: SupabaseAdmin;
  batchId: string;
  fundName: string;
  file: IntakeFile;
  investorIds: Map<string, string>;
  portfolioIds: Map<string, string>;
  fundMasterId: string | null;
};

type ValidationIssue = {
  batch_id: string;
  file_upload_id: string;
  fund_name: string;
  dataset_key: string;
  source_file_name: string;
  source_sheet_name: string | null;
  source_row_number: number | null;
  severity: "Error" | "Warning" | "Info";
  issue_code: string;
  field_name: string | null;
  message: string;
  raw_value: string | null;
  row_payload: Record<string, unknown>;
  resolution_status: "Open";
};

type FileStats = {
  totalRows: number;
  insertedRows: number;
  updatedRows: number;
  rejectedRows: number;
  warningRows: number;
  sourceSheetNames: string[];
  summary: Record<string, number>;
  issues: ValidationIssue[];
};

type SyncDefinition = {
  table: string;
  selectColumns: string;
  existingFilters: Record<string, unknown>;
  makeKey: (row: DatabaseRow) => string;
  datasetKey: string;
  summaryKey: string;
};

type DatasetDefinition = SyncDefinition & {
  sheetNames: string[];
  requiredSheet: boolean;
  requiredFields: string[];
  includeSourceFields?: boolean;
  mapRow: (
    row: ParsedRow,
    context: ProcessingContext,
    sourceRowNumber: number
  ) => DatabaseRow;
};

type WorkbookSheetResult = {
  sheetName: string | null;
  rows: ParsedRow[];
};

function getSupabaseAdmin(): SupabaseAdmin | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }) as any;
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return authorization.slice(7).trim();
}

async function authoriseRequest(
  request: NextRequest,
  supabase: SupabaseAdmin,
  fundName: string
): Promise<AuthorisedUser> {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    throw new Error("AUTHENTICATION_REQUIRED");
  }

  const {
    data: userResult,
    error: userError,
  } = await supabase.auth.getUser(accessToken);

  const user = userResult?.user;

  if (userError || !user) {
    throw new Error("INVALID_SESSION");
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("ventiq_user_profiles")
    .select("user_id, email, full_name, default_role, status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(
      `Unable to load VENTIQ profile: ${profileError.message}`
    );
  }

  if (!profile || profile.status !== "Active") {
    throw new Error("PROFILE_NOT_ACTIVE");
  }

  let role = String(profile.default_role || "").trim();

  if (!PROCESS_ROLES.has(role)) {
    const {
      data: membership,
      error: membershipError,
    } = await supabase
      .from("ventiq_organisation_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("status", "Active")
      .order("is_primary", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      throw new Error(
        `Unable to load organisation membership: ${membershipError.message}`
      );
    }

    role = String(membership?.role || "").trim();
  }

  if (!PROCESS_ROLES.has(role)) {
    throw new Error("ROLE_NOT_ALLOWED");
  }

  if (role !== "fund_admin") {
    const {
      data: fundAccess,
      error: fundAccessError,
    } = await supabase
      .from("ventiq_user_fund_access")
      .select("can_view, can_edit")
      .eq("user_id", user.id)
      .eq("status", "Active")
      .ilike("fund_name", fundName)
      .limit(1)
      .maybeSingle();

    if (fundAccessError) {
      throw new Error(
        `Unable to verify fund access: ${fundAccessError.message}`
      );
    }

    if (!fundAccess?.can_view || !fundAccess?.can_edit) {
      throw new Error("FUND_EDIT_ACCESS_REQUIRED");
    }
  }

  return {
    userId: String(user.id),
    email: String(profile.email || user.email || ""),
    fullName: String(
      profile.full_name || user.email || "VENTIQ User"
    ),
    role,
  };
}

function getAuthErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (
    message === "AUTHENTICATION_REQUIRED" ||
    message === "INVALID_SESSION"
  ) {
    return NextResponse.json(
      { error: "Please sign in before processing migration data." },
      { status: 401 }
    );
  }

  if (
    message === "PROFILE_NOT_ACTIVE" ||
    message === "ROLE_NOT_ALLOWED" ||
    message === "FUND_EDIT_ACCESS_REQUIRED"
  ) {
    return NextResponse.json(
      {
        error:
          "You do not have permission to process data for this fund.",
      },
      { status: 403 }
    );
  }

  return null;
}

function normalizeKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeIdentity(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function getValue(row: ParsedRow, keys: string[]) {
  for (const key of keys) {
    const value = row[normalizeKey(key)];

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
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const cleaned = String(value ?? "")
    .replace(/,/g, "")
    .replace(/₹/g, "")
    .replace(/%/g, "")
    .trim();

  if (!cleaned) {
    return 0;
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getNumber(row: ParsedRow, keys: string[]) {
  return parseNumber(getValue(row, keys));
}

function parseBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  const normalized = String(value ?? "").trim().toLowerCase();

  if (["true", "yes", "y", "1", "available", "final"].includes(normalized)) {
    return true;
  }

  if (["false", "no", "n", "0", "not available"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function getBoolean(
  row: ParsedRow,
  keys: string[],
  fallback = false
) {
  return parseBoolean(getValue(row, keys), fallback);
}

function formatIsoDateParts(
  year: number,
  month: number,
  day: number
) {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    year < 1900 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const validationDate = new Date(Date.UTC(year, month - 1, day));

  if (
    validationDate.getUTCFullYear() !== year ||
    validationDate.getUTCMonth() + 1 !== month ||
    validationDate.getUTCDate() !== day
  ) {
    return null;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(
    2,
    "0"
  )}-${String(day).padStart(2, "0")}`;
}

function excelSerialDateToIso(
  serialValue: number,
  date1904 = false
) {
  if (!Number.isFinite(serialValue)) {
    return null;
  }

  const parsed = XLSX.SSF.parse_date_code(serialValue, {
    date1904,
  });

  if (!parsed) {
    return null;
  }

  return formatIsoDateParts(parsed.y, parsed.m, parsed.d);
}

function parseDateValue(value: unknown) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatIsoDateParts(
      value.getFullYear(),
      value.getMonth() + 1,
      value.getDate()
    );
  }

  if (typeof value === "number") {
    return excelSerialDateToIso(value);
  }

  const text = String(value).trim();

  if (!text) {
    return null;
  }

  const isoDateMatch = text.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/
  );

  if (isoDateMatch) {
    return formatIsoDateParts(
      Number(isoDateMatch[1]),
      Number(isoDateMatch[2]),
      Number(isoDateMatch[3])
    );
  }

  const indianDateMatch = text.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/
  );

  if (indianDateMatch) {
    return formatIsoDateParts(
      Number(indianDateMatch[3]),
      Number(indianDateMatch[2]),
      Number(indianDateMatch[1])
    );
  }

  const parsed = new Date(text);

  if (!Number.isNaN(parsed.getTime())) {
    return formatIsoDateParts(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth() + 1,
      parsed.getUTCDate()
    );
  }

  return null;
}

function getDate(row: ParsedRow, keys: string[]) {
  return parseDateValue(getValue(row, keys));
}

function isMissing(value: unknown) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "")
  );
}

function serializeRowPayload(row: ParsedRow | DatabaseRow) {
  const payload: Record<string, unknown> = {};

  Object.entries(row).forEach(([key, value]) => {
    if (value instanceof Date) {
      payload[key] = value.toISOString();
      return;
    }

    if (
      value === null ||
      value === undefined ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      payload[key] = value ?? null;
      return;
    }

    payload[key] = String(value);
  });

  return payload;
}

function resolveFundName(
  row: ParsedRow,
  activeFundName: string
): { value: string; mismatch: boolean; sourceValue: string } {
  const sourceValue = getText(row, ["fund_name", "fund"]);

  if (!sourceValue) {
    return {
      value: activeFundName,
      mismatch: false,
      sourceValue: "",
    };
  }

  return {
    value: activeFundName,
    mismatch:
      normalizeIdentity(sourceValue) !==
      normalizeIdentity(activeFundName),
    sourceValue,
  };
}

function makeIssue(
  context: ProcessingContext,
  datasetKey: string,
  sheetName: string | null,
  rowNumber: number | null,
  severity: ValidationIssue["severity"],
  issueCode: string,
  message: string,
  options?: {
    fieldName?: string | null;
    rawValue?: unknown;
    rowPayload?: ParsedRow | DatabaseRow;
  }
): ValidationIssue {
  return {
    batch_id: context.batchId,
    file_upload_id: context.file.id,
    fund_name: context.fundName,
    dataset_key: datasetKey,
    source_file_name:
      context.file.original_file_name || "Unknown file",
    source_sheet_name: sheetName,
    source_row_number: rowNumber,
    severity,
    issue_code: issueCode,
    field_name: options?.fieldName ?? null,
    message,
    raw_value:
      options?.rawValue === undefined || options?.rawValue === null
        ? null
        : String(options.rawValue),
    row_payload: serializeRowPayload(options?.rowPayload || {}),
    resolution_status: "Open",
  };
}

function createFileStats(): FileStats {
  return {
    totalRows: 0,
    insertedRows: 0,
    updatedRows: 0,
    rejectedRows: 0,
    warningRows: 0,
    sourceSheetNames: [],
    summary: {},
    issues: [],
  };
}

function addSummary(
  summary: Record<string, number>,
  key: string,
  amount: number
) {
  summary[key] = (summary[key] || 0) + amount;
}

function normaliseWorkbookDateCells(
  workbook: XLSX.WorkBook
) {
  const date1904 = Boolean(
    workbook.Workbook?.WBProps?.date1904
  );

  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      return;
    }

    Object.keys(worksheet).forEach((cellAddress) => {
      if (cellAddress.startsWith("!")) {
        return;
      }

      const cell = worksheet[cellAddress] as
        | XLSX.CellObject
        | undefined;

      if (!cell) {
        return;
      }

      const isNumericExcelDate =
        cell.t === "n" &&
        typeof cell.v === "number" &&
        Boolean(cell.z) &&
        XLSX.SSF.is_date(String(cell.z));

      if (isNumericExcelDate) {
        const isoDate = excelSerialDateToIso(
          Number(cell.v),
          date1904
        );

        if (isoDate) {
          cell.t = "s";
          cell.v = isoDate;
          cell.w = isoDate;
          delete cell.z;
        }

        return;
      }

      if (
        cell.t === "d" &&
        cell.v instanceof Date &&
        !Number.isNaN(cell.v.getTime())
      ) {
        const isoDate = formatIsoDateParts(
          cell.v.getFullYear(),
          cell.v.getMonth() + 1,
          cell.v.getDate()
        );

        if (isoDate) {
          cell.t = "s";
          cell.v = isoDate;
          cell.w = isoDate;
          delete cell.z;
        }
      }
    });
  });

  return workbook;
}

function readWorkbook(buffer: Buffer) {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: false,
    cellNF: true,
    cellText: false,
  });

  return normaliseWorkbookDateCells(workbook);
}

function normalizeWorkbookRows(
  worksheet: XLSX.WorkSheet
): ParsedRow[] {
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    worksheet,
    { defval: "", raw: true }
  );

  return rawRows.map((row) => {
    const normalizedRow: ParsedRow = {};

    Object.entries(row).forEach(([key, value]) => {
      normalizedRow[normalizeKey(key)] = value;
    });

    return normalizedRow;
  });
}

function readNamedSheet(
  workbook: XLSX.WorkBook,
  preferredNames: string[]
): WorkbookSheetResult {
  const matchedSheetName = workbook.SheetNames.find((sheetName) =>
    preferredNames.some(
      (preferredName) =>
        normalizeKey(preferredName) === normalizeKey(sheetName)
    )
  );

  if (!matchedSheetName) {
    return { sheetName: null, rows: [] };
  }

  return {
    sheetName: matchedSheetName,
    rows: normalizeWorkbookRows(workbook.Sheets[matchedSheetName]),
  };
}

function readFirstDataSheet(
  workbook: XLSX.WorkBook,
  preferredNames: string[] = []
): WorkbookSheetResult {
  const preferred = readNamedSheet(workbook, preferredNames);

  if (preferred.sheetName) {
    return preferred;
  }

  const fallbackSheetName = workbook.SheetNames.find((sheetName) => {
    const normalized = normalizeKey(sheetName);
    return ![
      "summary",
      "instructions",
      "data_dictionary",
      "read_me",
      "readme",
    ].includes(normalized);
  });

  if (!fallbackSheetName) {
    return { sheetName: null, rows: [] };
  }

  return {
    sheetName: fallbackSheetName,
    rows: normalizeWorkbookRows(workbook.Sheets[fallbackSheetName]),
  };
}

async function downloadFileBuffer(
  supabase: SupabaseAdmin,
  file: IntakeFile
) {
  if (!file.storage_bucket || !file.storage_path) {
    throw new Error(
      `Missing storage path for ${file.original_file_name || "uploaded file"}.`
    );
  }

  const { data, error } = await supabase.storage
    .from(file.storage_bucket)
    .download(file.storage_path);

  if (error || !data) {
    throw new Error(
      error?.message ||
        `Unable to download ${file.original_file_name || "uploaded file"}.`
    );
  }

  return Buffer.from(await data.arrayBuffer());
}

function chunkRows<T>(rows: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }

  return chunks;
}

async function fetchAllRows(
  supabase: SupabaseAdmin,
  table: string,
  selectColumns: string,
  filters: Record<string, unknown>
) {
  const collected: DatabaseRow[] = [];
  let start = 0;

  while (true) {
    let query = supabase
      .from(table)
      .select(selectColumns)
      .range(start, start + PAGE_SIZE - 1);

    Object.entries(filters).forEach(([column, value]) => {
      query = query.eq(column, value);
    });

    const { data, error } = await query;

    if (error) {
      throw new Error(
        `Unable to read ${table} for duplicate control: ${error.message}`
      );
    }

    const page = Array.isArray(data) ? data : [];
    collected.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }

    start += PAGE_SIZE;
  }

  return collected;
}

async function insertRowsWithFallback(
  supabase: SupabaseAdmin,
  table: string,
  rows: DatabaseRow[],
  context: ProcessingContext,
  datasetKey: string,
  stats: FileStats,
  sheetName: string | null
): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }

  const { error } = await supabase.from(table).insert(rows);

  if (!error) {
    return rows.length;
  }

  if (rows.length === 1) {
    const row = rows[0];
    stats.rejectedRows += 1;
    stats.issues.push(
      makeIssue(
        context,
        datasetKey,
        sheetName,
        Number(row.source_row_number || 0) || null,
        "Error",
        "DATABASE_INSERT_FAILED",
        `Unable to insert this row into ${table}: ${error.message}`,
        { rowPayload: row }
      )
    );
    return 0;
  }

  const midpoint = Math.ceil(rows.length / 2);
  const left = await insertRowsWithFallback(
    supabase,
    table,
    rows.slice(0, midpoint),
    context,
    datasetKey,
    stats,
    sheetName
  );
  const right = await insertRowsWithFallback(
    supabase,
    table,
    rows.slice(midpoint),
    context,
    datasetKey,
    stats,
    sheetName
  );

  return left + right;
}

async function updateRowsSafely(
  supabase: SupabaseAdmin,
  table: string,
  rows: Array<{ id: string; payload: DatabaseRow }>,
  context: ProcessingContext,
  datasetKey: string,
  stats: FileStats,
  sheetName: string | null
) {
  let updated = 0;

  for (
    let start = 0;
    start < rows.length;
    start += UPDATE_CONCURRENCY
  ) {
    const chunk = rows.slice(start, start + UPDATE_CONCURRENCY);

    const results = await Promise.all(
      chunk.map(async ({ id, payload }) => {
        const { error } = await supabase
          .from(table)
          .update(payload)
          .eq("id", id);

        return { error, payload };
      })
    );

    results.forEach(({ error, payload }) => {
      if (!error) {
        updated += 1;
        return;
      }

      stats.rejectedRows += 1;
      stats.issues.push(
        makeIssue(
          context,
          datasetKey,
          sheetName,
          Number(payload.source_row_number || 0) || null,
          "Error",
          "DATABASE_UPDATE_FAILED",
          `Unable to update this row in ${table}: ${error.message}`,
          { rowPayload: payload }
        )
      );
    });
  }

  return updated;
}

async function syncRows(
  definition: SyncDefinition,
  rows: DatabaseRow[],
  context: ProcessingContext,
  stats: FileStats,
  sheetName: string | null
) {
  const deduplicated = new Map<string, DatabaseRow>();

  rows.forEach((row) => {
    const key = definition.makeKey(row);

    if (deduplicated.has(key)) {
      stats.warningRows += 1;
      stats.issues.push(
        makeIssue(
          context,
          definition.datasetKey,
          sheetName,
          Number(row.source_row_number || 0) || null,
          "Warning",
          "DUPLICATE_SOURCE_KEY",
          `Duplicate source key ${key} was found. The last row was retained.`,
          { rowPayload: row }
        )
      );
    }

    deduplicated.set(key, row);
  });

  const existingRows = await fetchAllRows(
    context.supabase,
    definition.table,
    definition.selectColumns,
    definition.existingFilters
  );

  const existingByKey = new Map<string, DatabaseRow>();

  existingRows.forEach((row) => {
    const key = definition.makeKey(row);
    if (key) {
      existingByKey.set(key, row);
    }
  });

  const insertRows: DatabaseRow[] = [];
  const updateRows: Array<{ id: string; payload: DatabaseRow }> = [];

  deduplicated.forEach((row, key) => {
    const existing = existingByKey.get(key);

    if (existing?.id) {
      updateRows.push({ id: String(existing.id), payload: row });
    } else {
      insertRows.push(row);
    }
  });

  let inserted = 0;

  for (const chunk of chunkRows(insertRows, INSERT_CHUNK_SIZE)) {
    inserted += await insertRowsWithFallback(
      context.supabase,
      definition.table,
      chunk,
      context,
      definition.datasetKey,
      stats,
      sheetName
    );
  }

  const updated = await updateRowsSafely(
    context.supabase,
    definition.table,
    updateRows,
    context,
    definition.datasetKey,
    stats,
    sheetName
  );

  stats.insertedRows += inserted;
  stats.updatedRows += updated;
  addSummary(stats.summary, definition.summaryKey, inserted + updated);
}

async function refreshReferenceCaches(context: ProcessingContext) {
  const {
    data: investorRows,
    error: investorError,
  } = await context.supabase
    .from("investor_master")
    .select("id, investor_code")
    .eq("fund_name", context.fundName);

  if (investorError) {
    throw new Error(
      `Unable to refresh investor references: ${investorError.message}`
    );
  }

  context.investorIds.clear();
  (investorRows || []).forEach((row: DatabaseRow) => {
    if (row.investor_code && row.id) {
      context.investorIds.set(
        normalizeIdentity(row.investor_code),
        String(row.id)
      );
    }
  });

  const {
    data: portfolioRows,
    error: portfolioError,
  } = await context.supabase
    .from("portfolio_investments")
    .select("id, portfolio_code")
    .eq("fund_name", context.fundName);

  if (portfolioError) {
    throw new Error(
      `Unable to refresh portfolio references: ${portfolioError.message}`
    );
  }

  context.portfolioIds.clear();
  (portfolioRows || []).forEach((row: DatabaseRow) => {
    if (row.portfolio_code && row.id) {
      context.portfolioIds.set(
        normalizeIdentity(row.portfolio_code),
        String(row.id)
      );
    }
  });

  const {
    data: fundRow,
    error: fundError,
  } = await context.supabase
    .from("fund_master")
    .select("id")
    .eq("fund_name", context.fundName)
    .limit(1)
    .maybeSingle();

  if (fundError) {
    throw new Error(
      `Unable to refresh fund reference: ${fundError.message}`
    );
  }

  context.fundMasterId = fundRow?.id ? String(fundRow.id) : null;
}

// Canonical intake traces records through source_batch_id.
// Legacy batch_id and fund_id columns point to older module-specific tables and
// must remain null unless a valid record from those legacy tables is available.
function sourceFields(
  context: ProcessingContext,
  sourceRowNumber: number
) {
  return {
    source_batch_id: context.batchId,
    source_file_name:
      context.file.original_file_name || "Unknown file",
    source_row_number: sourceRowNumber,
  };
}

function datasetDefinitions(
  context: ProcessingContext
): DatasetDefinition[] {
  const fundFilter = { fund_name: context.fundName };

  return [
    {
      datasetKey: "fund_master",
      sheetNames: ["Fund_Master", "Fund Master", "Funds"],
      requiredSheet: true,
      table: "fund_master",
      selectColumns: "id, fund_name",
      existingFilters: fundFilter,
      requiredFields: ["fund_name"],
      summaryKey: "fundMasterRows",
      makeKey: (row) => normalizeIdentity(row.fund_name),
      mapRow: (row, ctx, sourceRowNumber) => ({
        fund_code: getText(row, ["fund_code"]),
        fund_name: ctx.fundName,
        fund_type: getText(row, ["fund_type"]),
        category: getText(row, ["category"]),
        jurisdiction: getText(row, ["jurisdiction", "domicile"]),
        currency: getText(row, ["currency", "base_currency"]) || "INR",
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
        migration_status: getText(row, ["migration_status"]) || "Ready",
        ...sourceFields(ctx, sourceRowNumber),
      }),
    },
    {
      datasetKey: "investor_master",
      sheetNames: ["Investor_Master", "Investor Master", "Investors"],
      requiredSheet: true,
      table: "investor_master",
      selectColumns: "id, fund_name, investor_code",
      existingFilters: fundFilter,
      requiredFields: ["investor_code", "investor_name", "email"],
      summaryKey: "investorMasterRows",
      makeKey: (row) =>
        `${normalizeIdentity(row.fund_name)}|${normalizeIdentity(
          row.investor_code
        )}`,
      mapRow: (row, ctx, sourceRowNumber) => ({
        investor_code: getText(row, ["investor_code", "investor_id", "lp_code"]),
        investor_name: getText(row, ["investor_name", "lp_name", "name"]),
        email: getText(row, ["email", "email_id"]),
        investor_type:
          getText(row, ["investor_type", "lp_type"]) || "Individual",
        country: getText(row, ["country"]) || "India",
        tax_id: getText(row, ["tax_id", "pan_or_tax_id", "pan"]),
        kyc_status: getText(row, ["kyc_status"]) || "Pending",
        bank_status: getText(row, ["bank_status"]) || "Pending",
        onboarding_status:
          getText(row, ["onboarding_status", "status"]) || "Active",
        fund_name: ctx.fundName,
        ...sourceFields(ctx, sourceRowNumber),
      }),
    },
    {
      datasetKey: "commitments",
      sheetNames: ["Commitments", "Fund_Commitments", "Fund Commitments"],
      requiredSheet: true,
      table: "fund_commitments",
      selectColumns: "id, fund_name, commitment_code",
      existingFilters: fundFilter,
      requiredFields: ["commitment_code", "investor_code"],
      summaryKey: "commitmentRows",
      makeKey: (row) =>
        `${normalizeIdentity(row.fund_name)}|${normalizeIdentity(
          row.commitment_code
        )}`,
      mapRow: (row, ctx, sourceRowNumber) => {
        const investorCode = getText(row, [
          "investor_code",
          "investor_id",
          "lp_code",
        ]);
        const commitmentAmount = getNumber(row, [
          "commitment_amount",
          "commitment",
        ]);
        const capitalCalled = getNumber(row, [
          "capital_called_till_date",
          "capital_called",
        ]);
        const uncalled = getNumber(row, [
          "uncalled_capital",
          "unfunded_commitment",
          "remaining_commitment",
        ]);

        return {
          investor_id:
            ctx.investorIds.get(normalizeIdentity(investorCode)) || null,
          commitment_code: getText(row, ["commitment_code"]),
          fund_name: ctx.fundName,
          investor_code: investorCode,
          investor_name: getText(row, ["investor_name", "lp_name", "name"]),
          email: getText(row, ["email", "email_id"]),
          class_name: getText(row, ["class_name", "class"]) || "Class A",
          commitment_date: getDate(row, ["commitment_date"]),
          commitment_amount: commitmentAmount,
          unfunded_commitment: uncalled,
          capital_called_till_date: capitalCalled,
          uncalled_capital: uncalled,
          distributions_till_date: getNumber(row, [
            "distributions_till_date",
            "distributed",
            "distributions",
          ]),
          setup_fee: getNumber(row, ["setup_fee"]),
          management_fee: getNumber(row, ["management_fee"]),
          currency: getText(row, ["currency"]) || "INR",
          commitment_status:
            getText(row, ["commitment_status", "status"]) || "Active",
          status: getText(row, ["status"]) || "Active",
          migration_status: getText(row, ["migration_status"]) || "Ready",
          ...sourceFields(ctx, sourceRowNumber),
        };
      },
    },
    {
      datasetKey: "investor_cashflows",
      sheetNames: ["Investor_Cashflows", "Investor Cashflows"],
      requiredSheet: true,
      table: "investor_cashflows",
      selectColumns: "id, fund_name, cashflow_code",
      existingFilters: fundFilter,
      requiredFields: [
        "cashflow_code",
        "investor_code",
        "cashflow_date",
        "cashflow_type",
        "direction",
      ],
      summaryKey: "investorCashflowRows",
      makeKey: (row) =>
        `${normalizeIdentity(row.fund_name)}|${normalizeIdentity(
          row.cashflow_code
        )}`,
      mapRow: (row, ctx, sourceRowNumber) => {
        const investorCode = getText(row, [
          "investor_code",
          "investor_id",
          "lp_code",
        ]);
        const amount = getNumber(row, ["amount", "cashflow_amount"]);

        return {
          investor_id:
            ctx.investorIds.get(normalizeIdentity(investorCode)) || null,
          investor_code: investorCode,
          investor_name: getText(row, ["investor_name", "lp_name", "name"]),
          fund_name: ctx.fundName,
          cashflow_code: getText(row, ["cashflow_code"]),
          class_name: getText(row, ["class_name", "class"]),
          cashflow_date: getDate(row, ["cashflow_date"]),
          cashflow_type: getText(row, ["cashflow_type"]),
          amount,
          cashflow_amount: amount,
          direction: getText(row, ["direction"]),
          currency: getText(row, ["currency"]) || "INR",
          description: getText(row, ["description", "notes"]),
          status: getText(row, ["status"]) || "Confirmed",
          migration_status: getText(row, ["migration_status"]) || "Ready",
          ...sourceFields(ctx, sourceRowNumber),
        };
      },
    },
    {
      datasetKey: "capital_call_events",
      sheetNames: ["Capital_Call_Events", "Capital Call Events"],
      requiredSheet: true,
      table: "migration_capital_call_events",
      selectColumns: "id, fund_name, capital_call_code",
      existingFilters: fundFilter,
      requiredFields: [
        "capital_call_code",
        "call_name",
        "call_date",
        "due_date",
      ],
      summaryKey: "capitalCallEventRows",
      makeKey: (row) =>
        `${normalizeIdentity(row.fund_name)}|${normalizeIdentity(
          row.capital_call_code
        )}`,
      mapRow: (row, ctx, sourceRowNumber) => ({
        capital_call_code: getText(row, ["capital_call_code", "call_code"]),
        fund_name: ctx.fundName,
        call_name: getText(row, ["call_name", "capital_call_name"]),
        call_date: getDate(row, ["call_date"]),
        due_date: getDate(row, ["due_date"]),
        call_percentage: getNumber(row, ["call_percentage"]),
        base_call_amount: getNumber(row, ["base_call_amount", "call_amount"]),
        equalisation_interest: getNumber(row, ["equalisation_interest"]),
        fee_amount: getNumber(row, ["fee_amount"]),
        tax_amount: getNumber(row, ["tax_amount"]),
        other_amount: getNumber(row, ["other_amount"]),
        total_call_amount: getNumber(row, [
          "total_call_amount",
          "total_amount",
        ]),
        currency: getText(row, ["currency"]) || "INR",
        purpose: getText(row, ["purpose"]),
        allocation_method: getText(row, ["allocation_method"]),
        status: getText(row, ["status"]) || "Historical",
        migration_status: getText(row, ["migration_status"]) || "Ready",
        ...sourceFields(ctx, sourceRowNumber),
      }),
    },
    {
      datasetKey: "capital_call_allocations",
      sheetNames: ["Capital_Call_Allocations", "Capital Call Allocations"],
      requiredSheet: true,
      table: "capital_call_allocations",
      selectColumns: "id, fund_name, allocation_code",
      existingFilters: fundFilter,
      requiredFields: [
        "allocation_code",
        "capital_call_code",
        "investor_code",
      ],
      summaryKey: "capitalCallAllocationRows",
      makeKey: (row) =>
        `${normalizeIdentity(row.fund_name)}|${normalizeIdentity(
          row.allocation_code
        )}`,
      mapRow: (row, ctx, sourceRowNumber) => ({
        allocation_code: getText(row, ["allocation_code"]),
        fund_name: ctx.fundName,
        capital_call_id: getText(row, ["capital_call_id"]) || null,
        capital_call_code: getText(row, ["capital_call_code", "call_code"]),
        investor_code: getText(row, ["investor_code", "lp_code"]),
        investor_name: getText(row, ["investor_name", "lp_name"]),
        class_name: getText(row, ["class_name", "class"]),
        commitment_amount: getNumber(row, ["commitment_amount"]),
        call_percentage: getNumber(row, ["call_percentage"]),
        called_amount: getNumber(row, ["called_amount", "call_amount"]),
        equalisation_interest: getNumber(row, ["equalisation_interest"]),
        fee_amount: getNumber(row, ["fee_amount"]),
        tax_amount: getNumber(row, ["tax_amount"]),
        other_amount: getNumber(row, ["other_amount"]),
        total_due: getNumber(row, ["total_due"]),
        allocation_basis: getText(row, ["allocation_basis"]),
        due_date: getDate(row, ["due_date"]),
        currency: getText(row, ["currency"]) || "INR",
        status: getText(row, ["status"]) || "Draft",
        migration_status: getText(row, ["migration_status"]) || "Ready",
        ...sourceFields(ctx, sourceRowNumber),
      }),
    },
    {
      datasetKey: "capital_call_receipts",
      sheetNames: ["Capital_Call_Receipts", "Capital Call Receipts"],
      requiredSheet: true,
      table: "capital_call_receipts",
      selectColumns: "id, fund_name, receipt_code",
      existingFilters: fundFilter,
      requiredFields: [
        "receipt_code",
        "capital_call_code",
        "investor_code",
        "receipt_date",
      ],
      summaryKey: "capitalCallReceiptRows",
      makeKey: (row) =>
        `${normalizeIdentity(row.fund_name)}|${normalizeIdentity(
          row.receipt_code
        )}`,
      mapRow: (row, ctx, sourceRowNumber) => ({
        receipt_code: getText(row, ["receipt_code"]),
        fund_name: ctx.fundName,
        capital_call_id: getText(row, ["capital_call_id"]) || null,
        capital_call_code: getText(row, ["capital_call_code", "call_code"]),
        allocation_code: getText(row, ["allocation_code"]) || null,
        investor_code: getText(row, ["investor_code", "lp_code"]),
        investor_name: getText(row, ["investor_name", "lp_name"]),
        class_name: getText(row, ["class_name", "class"]),
        receipt_date: getDate(row, ["receipt_date"]),
        amount_received: getNumber(row, ["amount_received"]),
        contribution_amount: getNumber(row, ["contribution_amount"]),
        equalisation_interest_received: getNumber(row, [
          "equalisation_interest_received",
        ]),
        fee_received: getNumber(row, ["fee_received"]),
        tax_withheld: getNumber(row, ["tax_withheld"]),
        other_amount: getNumber(row, ["other_amount"]),
        net_contribution: getNumber(row, ["net_contribution"]),
        currency: getText(row, ["currency"]) || "INR",
        bank_reference: getText(row, ["bank_reference", "utr"]),
        payment_method: getText(row, ["payment_method"]),
        receipt_status: getText(row, ["receipt_status", "status"]) || "Received",
        days_late: getNumber(row, ["days_late"]),
        reversal_of_receipt_code:
          getText(row, ["reversal_of_receipt_code"]) || null,
        migration_status: getText(row, ["migration_status"]) || "Ready",
        ...sourceFields(ctx, sourceRowNumber),
      }),
    },
    {
      datasetKey: "distribution_events",
      sheetNames: ["Distribution_Events", "Distribution Events"],
      requiredSheet: true,
      table: "distributions",
      selectColumns: "id, fund_name, distribution_code",
      existingFilters: fundFilter,
      requiredFields: ["distribution_code", "distribution_name"],
      summaryKey: "distributionEventRows",
      makeKey: (row) =>
        `${normalizeIdentity(row.fund_name)}|${normalizeIdentity(
          row.distribution_code
        )}`,
      mapRow: (row, ctx, sourceRowNumber) => ({
        fund_id: null,
        distribution_code: getText(row, ["distribution_code"]),
        fund_name: ctx.fundName,
        distribution_name: getText(row, ["distribution_name"]),
        declaration_date: getDate(row, ["declaration_date"]),
        record_date: getDate(row, ["record_date"]),
        distribution_date: getDate(row, ["distribution_date"]),
        payment_date: getDate(row, ["payment_date"]),
        distribution_amount: getNumber(row, ["distribution_amount"]),
        distribution_type: getText(row, ["distribution_type"]),
        waterfall_method: getText(row, ["waterfall_method"]),
        currency: getText(row, ["currency"]) || "INR",
        status: getText(row, ["status"]) || "draft",
        migration_status: getText(row, ["migration_status"]) || "Ready",
        ...sourceFields(ctx, sourceRowNumber),
      }),
    },
    {
      datasetKey: "distribution_allocations",
      sheetNames: ["Distribution_Allocations", "Distribution Allocations"],
      requiredSheet: true,
      table: "distribution_allocations",
      selectColumns: "id, fund_name, distribution_allocation_code",
      existingFilters: fundFilter,
      requiredFields: [
        "distribution_allocation_code",
        "distribution_code",
        "investor_code",
      ],
      summaryKey: "distributionAllocationRows",
      makeKey: (row) =>
        `${normalizeIdentity(row.fund_name)}|${normalizeIdentity(
          row.distribution_allocation_code
        )}`,
      mapRow: (row, ctx, sourceRowNumber) => ({
        distribution_allocation_code: getText(row, [
          "distribution_allocation_code",
          "allocation_code",
        ]),
        fund_name: ctx.fundName,
        distribution_id: getText(row, ["distribution_id"]) || null,
        distribution_code: getText(row, ["distribution_code"]),
        investor_code: getText(row, ["investor_code", "lp_code"]),
        investor_name: getText(row, ["investor_name", "lp_name"]),
        class_name: getText(row, ["class_name", "class"]),
        declaration_date: getDate(row, ["declaration_date"]),
        record_date: getDate(row, ["record_date"]),
        payment_date: getDate(row, ["payment_date"]),
        allocation_percentage: getNumber(row, ["allocation_percentage"]),
        units_or_ratio: getNumber(row, ["units_or_ratio"]),
        gross_distribution: getNumber(row, ["gross_distribution"]),
        return_of_capital: getNumber(row, ["return_of_capital"]),
        income_distribution: getNumber(row, ["income_distribution"]),
        interest_distribution: getNumber(row, ["interest_distribution"]),
        dividend_distribution: getNumber(row, ["dividend_distribution"]),
        capital_gain_distribution: getNumber(row, [
          "capital_gain_distribution",
        ]),
        fee_rebate: getNumber(row, ["fee_rebate"]),
        tax_withheld: getNumber(row, ["tax_withheld"]),
        other_deductions: getNumber(row, ["other_deductions"]),
        net_distribution: getNumber(row, ["net_distribution"]),
        currency: getText(row, ["currency"]) || "INR",
        bank_reference: getText(row, ["bank_reference", "utr"]),
        payment_status: getText(row, ["payment_status", "status"]) || "Pending",
        migration_status: getText(row, ["migration_status"]) || "Ready",
        ...sourceFields(ctx, sourceRowNumber),
      }),
    },
    {
      datasetKey: "portfolio_master",
      sheetNames: [
        "Portfolio_Master",
        "Portfolio Master",
        "Portfolio_Investments",
        "Portfolio Investments",
        "Investments",
      ],
      requiredSheet: true,
      table: "portfolio_investments",
      selectColumns: "id, fund_name, portfolio_code",
      existingFilters: fundFilter,
      requiredFields: ["portfolio_code", "portfolio_company"],
      summaryKey: "portfolioMasterRows",
      makeKey: (row) =>
        `${normalizeIdentity(row.fund_name)}|${normalizeIdentity(
          row.portfolio_code
        )}`,
      mapRow: (row, ctx, sourceRowNumber) => ({
        portfolio_code: getText(row, ["portfolio_code"]),
        portfolio_company: getText(row, [
          "portfolio_company",
          "company_name",
          "investee_company",
        ]),
        fund_name: ctx.fundName,
        fund_type: getText(row, ["fund_type"]),
        sector: getText(row, ["sector"]),
        stage: getText(row, ["stage"]),
        instrument_code: getText(row, ["instrument_code"]),
        instrument_type: getText(row, ["instrument_type", "instrument"]),
        investment_date: getDate(row, ["investment_date", "entry_date"]),
        investment_cost: getNumber(row, ["investment_cost", "invested_cost", "cost"]),
        current_value: getNumber(row, ["current_value", "current_portfolio_value"]),
        realised_value: getNumber(row, ["realised_value", "realized_value"]),
        expected_exit_value: getNumber(row, ["expected_exit_value"]),
        expected_exit_date: getDate(row, ["expected_exit_date", "exit_date"]),
        ownership_percent: getNumber(row, ["ownership_percent"]),
        interest_rate: getNumber(row, [
          "interest_rate",
          "coupon_or_interest_rate",
        ]),
        repayment_due_date: getDate(row, ["repayment_due_date"]),
        security_or_charge: getText(row, ["security_or_charge"]),
        covenants: getText(row, ["covenants", "covenant_status"]),
        risk_status: getText(row, ["risk_status"]) || "Healthy",
        latest_update: getText(row, ["latest_update"]),
        migration_status: getText(row, ["migration_status"]) || "Ready",
        ...sourceFields(ctx, sourceRowNumber),
      }),
    },
    {
      datasetKey: "portfolio_cashflows",
      sheetNames: ["Portfolio_Cashflows", "Portfolio Cashflows"],
      requiredSheet: true,
      table: "portfolio_cashflows",
      selectColumns: "id, fund_name, cashflow_code",
      existingFilters: fundFilter,
      requiredFields: [
        "cashflow_code",
        "portfolio_code",
        "cashflow_date",
        "cashflow_type",
        "cashflow_direction",
      ],
      summaryKey: "portfolioCashflowRows",
      makeKey: (row) =>
        `${normalizeIdentity(row.fund_name)}|${normalizeIdentity(
          row.cashflow_code
        )}`,
      mapRow: (row, ctx, sourceRowNumber) => ({
        cashflow_code: getText(row, ["cashflow_code"]),
        fund_name: ctx.fundName,
        portfolio_code: getText(row, ["portfolio_code"]),
        portfolio_company: getText(row, ["portfolio_company", "company_name"]),
        instrument_code: getText(row, ["instrument_code"]),
        instrument_type: getText(row, ["instrument_type"]),
        cashflow_date: getDate(row, ["cashflow_date"]),
        cashflow_type: getText(row, ["cashflow_type"]),
        cashflow_direction: getText(row, [
          "cashflow_direction",
          "direction",
        ]),
        gross_amount: getNumber(row, ["gross_amount"]),
        principal_component: getNumber(row, ["principal_component"]),
        interest_component: getNumber(row, ["interest_component"]),
        fee_component: getNumber(row, ["fee_component"]),
        dividend_component: getNumber(row, ["dividend_component"]),
        tax_component: getNumber(row, ["tax_component"]),
        other_component: getNumber(row, ["other_component"]),
        net_amount: getNumber(row, ["net_amount", "amount"]),
        currency: getText(row, ["currency"]) || "INR",
        counterparty: getText(row, ["counterparty"]),
        bank_reference: getText(row, ["bank_reference", "utr"]),
        status: getText(row, ["status"]) || "Confirmed",
        notes: getText(row, ["notes", "description"]),
        migration_status: getText(row, ["migration_status"]) || "Ready",
        ...sourceFields(ctx, sourceRowNumber),
      }),
    },
    {
      datasetKey: "portfolio_valuations",
      sheetNames: ["Portfolio_Valuations", "Portfolio Valuations"],
      requiredSheet: true,
      table: "portfolio_valuations",
      selectColumns: "id, fund_name, portfolio_code, valuation_date",
      existingFilters: fundFilter,
      requiredFields: ["valuation_code", "portfolio_code", "valuation_date"],
      summaryKey: "portfolioValuationRows",
      makeKey: (row) =>
        `${normalizeIdentity(row.fund_name)}|${normalizeIdentity(
          row.portfolio_code
        )}|${normalizeIdentity(row.valuation_date)}`,
      mapRow: (row, ctx, sourceRowNumber) => ({
        valuation_code: getText(row, ["valuation_code"]),
        fund_name: ctx.fundName,
        portfolio_code: getText(row, ["portfolio_code"]),
        portfolio_company: getText(row, ["portfolio_company", "company_name"]),
        instrument_code: getText(row, ["instrument_code"]),
        instrument_type: getText(row, ["instrument_type"]),
        valuation_date: getDate(row, ["valuation_date", "reporting_date"]),
        reporting_period: getText(row, ["reporting_period", "period"]),
        valuation_method: getText(row, ["valuation_method"]),
        valuation_basis: getText(row, ["valuation_basis"]),
        currency: getText(row, ["currency"]) || "INR",
        investment_cost: getNumber(row, ["investment_cost", "invested_cost", "cost"]),
        fair_value: getNumber(row, ["fair_value", "current_value", "current_portfolio_value"]),
        realised_value_to_date: getNumber(row, [
          "realised_value_to_date",
          "realised_value",
          "realized_value",
        ]),
        accrued_interest: getNumber(row, ["accrued_interest"]),
        principal_outstanding: getNumber(row, ["principal_outstanding"]),
        impairment_amount: getNumber(row, ["impairment_amount"]),
        ownership_percent: getNumber(row, ["ownership_percent"]),
        expected_exit_value: getNumber(row, ["expected_exit_value"]),
        expected_exit_date: getDate(row, ["expected_exit_date", "exit_date"]),
        gross_moic_reference: getNumber(row, ["gross_moic_reference", "moic"]),
        valuation_status: getText(row, ["valuation_status", "status"]) || "Draft",
        is_final: getBoolean(row, ["is_final"], false),
        approved_by: getText(row, ["approved_by"]) || null,
        approved_at: null,
        migration_status: getText(row, ["migration_status"]) || "Ready",
        ...sourceFields(ctx, sourceRowNumber),
      }),
    },
    {
      datasetKey: "fund_nav_snapshots",
      sheetNames: ["Fund_NAV_Snapshots", "Fund NAV Snapshots"],
      requiredSheet: true,
      table: "fund_nav_snapshots",
      selectColumns: "id, fund_name, reporting_date",
      existingFilters: fundFilter,
      requiredFields: ["nav_code", "reporting_date"],
      summaryKey: "fundNavSnapshotRows",
      makeKey: (row) =>
        `${normalizeIdentity(row.fund_name)}|${normalizeIdentity(
          row.reporting_date
        )}`,
      mapRow: (row, ctx, sourceRowNumber) => ({
        nav_code: getText(row, ["nav_code"]),
        fund_name: ctx.fundName,
        reporting_date: getDate(row, ["reporting_date", "valuation_date"]),
        reporting_period: getText(row, ["reporting_period", "period"]),
        currency: getText(row, ["currency"]) || "INR",
        cash_and_equivalents: getNumber(row, ["cash_and_equivalents"]),
        investment_fair_value: getNumber(row, ["investment_fair_value"]),
        accrued_income: getNumber(row, ["accrued_income"]),
        receivables: getNumber(row, ["receivables"]),
        other_assets: getNumber(row, ["other_assets"]),
        total_assets: getNumber(row, ["total_assets"]),
        management_fee_payable: getNumber(row, ["management_fee_payable"]),
        carry_payable: getNumber(row, ["carry_payable"]),
        expenses_payable: getNumber(row, ["expenses_payable"]),
        other_liabilities: getNumber(row, ["other_liabilities"]),
        total_liabilities: getNumber(row, ["total_liabilities"]),
        gross_nav: getNumber(row, ["gross_nav"]),
        net_nav: getNumber(row, ["net_nav", "nav"]),
        units_outstanding: getNumber(row, ["units_outstanding"]),
        nav_per_unit: getNumber(row, ["nav_per_unit"]),
        commitments: getNumber(row, ["commitments", "committed_capital"]),
        paid_in_capital: getNumber(row, ["paid_in_capital"]),
        distributions_to_date: getNumber(row, ["distributions_to_date"]),
        uncalled_commitment: getNumber(row, ["uncalled_commitment"]),
        system_calculated: getBoolean(row, ["system_calculated"], false),
        calculation_version: getText(row, ["calculation_version"]),
        status: getText(row, ["status"]) || "Draft",
        approved_by: getText(row, ["approved_by"]) || null,
        approved_at: null,
        migration_status: getText(row, ["migration_status"]) || "Ready",
        ...sourceFields(ctx, sourceRowNumber),
      }),
    },
    {
      datasetKey: "fund_fee_expenses",
      sheetNames: ["Fund_Fee_Expenses", "Fund Fee Expenses", "Fees_Expenses"],
      requiredSheet: true,
      table: "fund_fee_expenses",
      selectColumns: "id, fund_name, fee_expense_code",
      existingFilters: fundFilter,
      requiredFields: ["fee_expense_code", "expense_date", "expense_category"],
      summaryKey: "fundFeeExpenseRows",
      makeKey: (row) =>
        `${normalizeIdentity(row.fund_name)}|${normalizeIdentity(
          row.fee_expense_code
        )}`,
      mapRow: (row, ctx, sourceRowNumber) => ({
        fee_expense_code: getText(row, ["fee_expense_code"]),
        fund_name: ctx.fundName,
        expense_date: getDate(row, ["expense_date"]),
        period_start: getDate(row, ["period_start"]),
        period_end: getDate(row, ["period_end"]),
        fee_type: getText(row, ["fee_type"]),
        expense_category: getText(row, ["expense_category"]),
        description: getText(row, ["description"]),
        basis_amount: getNumber(row, ["basis_amount"]),
        rate_percent: getNumber(row, ["rate_percent"]),
        gross_amount: getNumber(row, ["gross_amount"]),
        indirect_tax_amount: getNumber(row, ["indirect_tax_amount"]),
        withholding_tax_amount: getNumber(row, ["withholding_tax_amount"]),
        other_adjustment: getNumber(row, ["other_adjustment"]),
        net_amount: getNumber(row, ["net_amount"]),
        payable_to: getText(row, ["payable_to"]),
        payment_status: getText(row, ["payment_status"]) || "Pending",
        payment_date: getDate(row, ["payment_date"]),
        capitalised: getBoolean(row, ["capitalised"], false),
        allocation_basis: getText(row, ["allocation_basis"]),
        currency: getText(row, ["currency"]) || "INR",
        migration_status: getText(row, ["migration_status"]) || "Ready",
        ...sourceFields(ctx, sourceRowNumber),
      }),
    },
    {
      datasetKey: "debt_repayment_schedule",
      sheetNames: ["Debt_Repayment_Schedule", "Debt Repayment Schedule"],
      requiredSheet: false,
      table: "debt_repayment_schedules",
      selectColumns: "id, fund_name, schedule_code",
      existingFilters: fundFilter,
      requiredFields: ["schedule_code", "portfolio_code", "due_date"],
      summaryKey: "debtRepaymentRows",
      makeKey: (row) =>
        `${normalizeIdentity(row.fund_name)}|${normalizeIdentity(
          row.schedule_code
        )}`,
      mapRow: (row, ctx, sourceRowNumber) => {
        const portfolioCode = getText(row, ["portfolio_code"]);

        return {
          investment_id: null,
          portfolio_company_id: null,
          fund_id: null,
          schedule_code: getText(row, ["schedule_code"]),
          fund_name: ctx.fundName,
          portfolio_code: portfolioCode,
          portfolio_company: getText(row, ["portfolio_company", "company_name"]),
          due_date: getDate(row, ["due_date"]),
          repayment_type: getText(row, ["repayment_type"]) || "scheduled",
          principal_due: getNumber(row, ["principal_due"]),
          interest_due: getNumber(row, ["interest_due"]),
          fee_due: getNumber(row, ["fee_due"]),
          other_charges_due: getNumber(row, ["other_charges_due"]),
          total_due: getNumber(row, ["total_due"]),
          amount_received: getNumber(row, ["amount_received"]),
          paid_date: getDate(row, ["paid_date"]),
          payment_status: getText(row, ["payment_status"]) || "upcoming",
          notice_status: getText(row, ["notice_status"]) || "not_sent",
          reminder_count: getNumber(row, ["reminder_count"]),
          internal_note: getText(row, ["internal_note", "notes"]),
          currency: getText(row, ["currency"]) || "INR",
          migration_status: getText(row, ["migration_status"]) || "Ready",
          ...sourceFields(ctx, sourceRowNumber),
        };
      },
    },
    {
      datasetKey: "compliance_items",
      sheetNames: ["Compliance_Items", "Compliance Items", "Compliance"],
      requiredSheet: true,
      table: "compliance_items",
      selectColumns: "id, fund_name, compliance_code",
      existingFilters: fundFilter,
      requiredFields: ["compliance_code", "document_name"],
      summaryKey: "complianceRows",
      makeKey: (row) =>
        `${normalizeIdentity(row.fund_name)}|${normalizeIdentity(
          row.compliance_code
        )}`,
      mapRow: (row, ctx, sourceRowNumber) => ({
        compliance_code: getText(row, ["compliance_code"]),
        item_type: getText(row, ["item_type"]),
        document_name: getText(row, ["document_name", "compliance_name"]),
        fund_name: ctx.fundName,
        period: getText(row, ["period"]),
        authority: getText(row, ["authority"]),
        due_date: getDate(row, ["due_date"]),
        filing_status: getText(row, ["filing_status", "status"]) || "Review",
        evidence_available: getBoolean(row, ["evidence_available"], false),
        owner: getText(row, ["owner", "owner_name"]),
        category: getText(row, ["category"]),
        risk_level: getText(row, ["risk_level"]) || "Medium",
        remarks: getText(row, ["remarks"]),
        migration_status: getText(row, ["migration_status"]) || "Ready",
        ...sourceFields(ctx, sourceRowNumber),
      }),
    },
  ];
}

async function processDatasetRows(
  definition: DatasetDefinition,
  rows: ParsedRow[],
  sheetName: string | null,
  context: ProcessingContext,
  stats: FileStats,
  options?: {
    countRows?: boolean;
    onlyWhen?: (row: ParsedRow) => boolean;
  }
) {
  const sourceRows = rows
    .map((row, index) => ({ row, sourceRowNumber: index + 2 }))
    .filter(({ row }) => (options?.onlyWhen ? options.onlyWhen(row) : true));

  if (options?.countRows !== false) {
    stats.totalRows += sourceRows.length;
  }

  const mappedRows: DatabaseRow[] = [];

  sourceRows.forEach(({ row, sourceRowNumber }) => {
    const resolvedFund = resolveFundName(row, context.fundName);

    if (resolvedFund.mismatch) {
      stats.rejectedRows += 1;
      stats.issues.push(
        makeIssue(
          context,
          definition.datasetKey,
          sheetName,
          sourceRowNumber,
          "Error",
          "FUND_MISMATCH",
          `The row belongs to ${resolvedFund.sourceValue}, but the active fund is ${context.fundName}.`,
          {
            fieldName: "fund_name",
            rawValue: resolvedFund.sourceValue,
            rowPayload: row,
          }
        )
      );
      return;
    }

    const mapped = definition.mapRow(row, context, sourceRowNumber);
    const missingFields = definition.requiredFields.filter((field) =>
      isMissing(mapped[field])
    );

    if (missingFields.length > 0) {
      stats.rejectedRows += 1;
      stats.issues.push(
        makeIssue(
          context,
          definition.datasetKey,
          sheetName,
          sourceRowNumber,
          "Error",
          "REQUIRED_FIELD_MISSING",
          `Required field(s) missing: ${missingFields.join(", ")}.`,
          {
            fieldName: missingFields.join(", "),
            rowPayload: row,
          }
        )
      );
      return;
    }

    mappedRows.push(mapped);
  });

  await syncRows(definition, mappedRows, context, stats, sheetName);
}

async function processCanonicalWorkbook(
  workbook: XLSX.WorkBook,
  context: ProcessingContext,
  stats: FileStats
) {
  const definitions = datasetDefinitions(context);

  for (const definition of definitions) {
    const result = readNamedSheet(workbook, definition.sheetNames);

    if (!result.sheetName) {
      if (definition.requiredSheet) {
        stats.issues.push(
          makeIssue(
            context,
            definition.datasetKey,
            null,
            null,
            "Error",
            "REQUIRED_SHEET_MISSING",
            `Required sheet ${definition.sheetNames[0]} is missing from the canonical workbook.`
          )
        );
      }
      continue;
    }

    stats.sourceSheetNames.push(result.sheetName);

    await processDatasetRows(
      definition,
      result.rows,
      result.sheetName,
      context,
      stats
    );

    if (
      definition.datasetKey === "fund_master" ||
      definition.datasetKey === "investor_master" ||
      definition.datasetKey === "portfolio_master"
    ) {
      await refreshReferenceCaches(context);
    }
  }
}

function makeLegacyCode(
  prefix: string,
  context: ProcessingContext,
  rowNumber: number
) {
  return `${prefix}-${context.batchId.slice(0, 8).toUpperCase()}-${String(
    rowNumber
  ).padStart(5, "0")}`;
}

async function processLegacyInvestorWorkbook(
  workbook: XLSX.WorkBook,
  context: ProcessingContext,
  stats: FileStats
) {
  const result = readFirstDataSheet(workbook, [
    "Investor_Master",
    "Investor Master",
    "Investors",
  ]);

  if (!result.sheetName) {
    throw new Error("No readable investor worksheet was found.");
  }

  stats.sourceSheetNames.push(result.sheetName);
  const definitions = datasetDefinitions(context);
  const investorDefinition = definitions.find(
    (definition) => definition.datasetKey === "investor_master"
  );
  const commitmentDefinition = definitions.find(
    (definition) => definition.datasetKey === "commitments"
  );
  const cashflowDefinition = definitions.find(
    (definition) => definition.datasetKey === "investor_cashflows"
  );

  if (!investorDefinition || !commitmentDefinition || !cashflowDefinition) {
    throw new Error("Investor processing definitions are unavailable.");
  }

  await processDatasetRows(
    investorDefinition,
    result.rows,
    result.sheetName,
    context,
    stats
  );

  await refreshReferenceCaches(context);

  const legacyCommitmentDefinition: DatasetDefinition = {
    ...commitmentDefinition,
    mapRow: (row, ctx, sourceRowNumber) => {
      const mapped = commitmentDefinition.mapRow(
        row,
        ctx,
        sourceRowNumber
      );

      if (!mapped.commitment_code) {
        mapped.commitment_code = makeLegacyCode(
          "COM",
          ctx,
          sourceRowNumber
        );
      }

      return mapped;
    },
  };

  await processDatasetRows(
    legacyCommitmentDefinition,
    result.rows,
    result.sheetName,
    context,
    stats,
    { countRows: false }
  );

  const legacyCashflowDefinition: DatasetDefinition = {
    ...cashflowDefinition,
    mapRow: (row, ctx, sourceRowNumber) => {
      const mapped = cashflowDefinition.mapRow(row, ctx, sourceRowNumber);

      if (!mapped.cashflow_code) {
        mapped.cashflow_code = makeLegacyCode(
          "ICF",
          ctx,
          sourceRowNumber
        );
      }

      return mapped;
    },
  };

  await processDatasetRows(
    legacyCashflowDefinition,
    result.rows,
    result.sheetName,
    context,
    stats,
    {
      countRows: false,
      onlyWhen: (row) => Boolean(getDate(row, ["cashflow_date"])),
    }
  );

  const positionRows: DatabaseRow[] = [];

  result.rows.forEach((row, index) => {
    const sourceRowNumber = index + 2;
    const investorCode = getText(row, [
      "investor_code",
      "investor_id",
      "lp_code",
    ]);

    if (!investorCode) {
      return;
    }

    const investorId =
      context.investorIds.get(normalizeIdentity(investorCode)) || null;

    positionRows.push({
      import_batch_id: context.batchId,
      investor_id: investorId,
      investor_code: investorCode,
      investor_name: getText(row, ["investor_name", "lp_name", "name"]),
      email: getText(row, ["email", "email_id"]),
      fund_name: context.fundName,
      class_name: getText(row, ["class_name", "class"]),
      commitment_amount: getNumber(row, ["commitment_amount", "commitment"]),
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
      net_contributed: getNumber(row, ["net_contributed"]),
      current_nav: getNumber(row, ["current_nav", "nav", "latest_nav"]),
      investor_irr: getNumber(row, ["investor_irr", "net_irr"]),
      investor_moic: getNumber(row, ["investor_moic", "moic"]),
      investor_dpi: getNumber(row, ["investor_dpi", "dpi"]),
      investor_tvpi: getNumber(row, ["investor_tvpi", "tvpi"]),
      status: getText(row, ["status"]) || "Ready",
      capital_called: getNumber(row, [
        "capital_called",
        "capital_called_till_date",
      ]),
      distributions: getNumber(row, [
        "distributions",
        "distributions_till_date",
        "distributed",
      ]),
      nav: getNumber(row, ["nav", "latest_nav"]),
      dpi: getNumber(row, ["dpi"]),
      tvpi: getNumber(row, ["tvpi"]),
      moic: getNumber(row, ["moic"]),
      gross_irr: getNumber(row, ["gross_irr", "irr"]),
      net_irr: getNumber(row, ["net_irr"]),
      _source_row_number: sourceRowNumber,
    });
  });

  const positionDefinition: SyncDefinition = {
    datasetKey: "legacy_investor_positions",
    table: "investor_financial_positions",
    selectColumns: "id, fund_name, investor_code",
    existingFilters: { fund_name: context.fundName },
    summaryKey: "investorFinancialPositionRows",
    makeKey: (row) =>
      `${normalizeIdentity(row.fund_name)}|${normalizeIdentity(
        row.investor_code
      )}`,
  };

  const cleanedPositionRows = positionRows.map((row) => {
    const cleaned = { ...row };
    delete cleaned._source_row_number;
    return cleaned;
  });

  await syncRows(
    positionDefinition,
    cleanedPositionRows,
    context,
    stats,
    result.sheetName
  );
}

async function processLegacyPortfolioWorkbook(
  workbook: XLSX.WorkBook,
  context: ProcessingContext,
  stats: FileStats
) {
  const result = readFirstDataSheet(workbook, [
    "Portfolio_Investments",
    "Portfolio Investments",
    "Portfolio_Master",
    "Portfolio Master",
    "Investments",
  ]);

  if (!result.sheetName) {
    throw new Error("No readable portfolio worksheet was found.");
  }

  stats.sourceSheetNames.push(result.sheetName);
  const definitions = datasetDefinitions(context);
  const portfolioDefinition = definitions.find(
    (definition) => definition.datasetKey === "portfolio_master"
  );
  const valuationDefinition = definitions.find(
    (definition) => definition.datasetKey === "portfolio_valuations"
  );

  if (!portfolioDefinition || !valuationDefinition) {
    throw new Error("Portfolio processing definitions are unavailable.");
  }

  const legacyPortfolioDefinition: DatasetDefinition = {
    ...portfolioDefinition,
    mapRow: (row, ctx, sourceRowNumber) => {
      const mapped = portfolioDefinition.mapRow(row, ctx, sourceRowNumber);

      if (!mapped.portfolio_code) {
        mapped.portfolio_code = makeLegacyCode(
          "PORT",
          ctx,
          sourceRowNumber
        );
      }

      return mapped;
    },
  };

  await processDatasetRows(
    legacyPortfolioDefinition,
    result.rows,
    result.sheetName,
    context,
    stats
  );

  await refreshReferenceCaches(context);

  const valuationRows = result.rows.filter((row, index) => {
    const hasValue =
      getText(row, ["current_value", "current_portfolio_value", "fair_value"]) !==
      "";
    const hasValuationDate = Boolean(
      getDate(row, ["valuation_date", "reporting_date"])
    );

    if (hasValue && !hasValuationDate) {
      stats.warningRows += 1;
      stats.issues.push(
        makeIssue(
          context,
          "legacy_portfolio_valuation",
          result.sheetName,
          index + 2,
          "Warning",
          "VALUATION_DATE_MISSING",
          "Current value was present, but no valuation date was provided. The portfolio master was imported and the valuation snapshot was not created.",
          {
            fieldName: "valuation_date",
            rowPayload: row,
          }
        )
      );
    }

    return hasValue && hasValuationDate;
  });

  const legacyValuationDefinition: DatasetDefinition = {
    ...valuationDefinition,
    mapRow: (row, ctx, sourceRowNumber) => {
      const mapped = valuationDefinition.mapRow(row, ctx, sourceRowNumber);

      if (!mapped.portfolio_code) {
        mapped.portfolio_code = makeLegacyCode(
          "PORT",
          ctx,
          sourceRowNumber
        );
      }

      if (!mapped.valuation_code) {
        mapped.valuation_code = `VAL-${mapped.portfolio_code}-${mapped.valuation_date}`;
      }

      return mapped;
    },
  };

  await processDatasetRows(
    legacyValuationDefinition,
    valuationRows,
    result.sheetName,
    context,
    stats,
    { countRows: false }
  );
}

async function processLegacySingleDatasetWorkbook(
  workbook: XLSX.WorkBook,
  context: ProcessingContext,
  stats: FileStats,
  datasetKey: "fund_master" | "compliance_items"
) {
  const definitions = datasetDefinitions(context);
  const definition = definitions.find(
    (item) => item.datasetKey === datasetKey
  );

  if (!definition) {
    throw new Error(`Processing definition ${datasetKey} is unavailable.`);
  }

  const result = readFirstDataSheet(workbook, definition.sheetNames);

  if (!result.sheetName) {
    throw new Error(`No readable ${datasetKey} worksheet was found.`);
  }

  stats.sourceSheetNames.push(result.sheetName);

  const legacyDefinition: DatasetDefinition = {
    ...definition,
    mapRow: (row, ctx, sourceRowNumber) => {
      const mapped = definition.mapRow(row, ctx, sourceRowNumber);

      if (datasetKey === "compliance_items" && !mapped.compliance_code) {
        mapped.compliance_code = makeLegacyCode(
          "COMP",
          ctx,
          sourceRowNumber
        );
      }

      return mapped;
    },
  };

  await processDatasetRows(
    legacyDefinition,
    result.rows,
    result.sheetName,
    context,
    stats
  );

  if (datasetKey === "fund_master") {
    await refreshReferenceCaches(context);
  }
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
  const quarter = text.match(/q[1-4][-_ ]?fy[-_ ]?[0-9]{2,4}/i);

  if (quarter) {
    return quarter[0].toUpperCase().replace(/[-_]/g, " ");
  }

  const financialYear = text.match(/fy[-_ ]?[0-9]{2,4}/i);

  if (financialYear) {
    return financialYear[0].toUpperCase().replace(/[-_]/g, " ");
  }

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
  investors: InvestorReference[],
  fileName: string
) {
  const normalizedFile = normalizeForMatch(fileName);
  const compactFile = compactForMatch(fileName);
  const fileCodeTokens = extractInvestorCodeTokens(fileName);

  let bestInvestor: InvestorReference | null = null;
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
    const email = investor.email
      ? normalizeForMatch(investor.email)
      : "";

    if (compactInvestorCode && fileCodeTokens.has(compactInvestorCode)) {
      score += 65;
      currentSignals.push(`Investor code matched: ${investor.investor_code}`);
    } else if (
      compactInvestorCode &&
      compactInvestorCode.length >= 6 &&
      compactFile.includes(compactInvestorCode)
    ) {
      score += 50;
      currentSignals.push(`Investor code matched: ${investor.investor_code}`);
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
      currentSignals.push(`Investor name matched: ${investor.investor_name}`);
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

async function writeValidationIssues(
  context: ProcessingContext,
  stats: FileStats
) {
  const { error: deleteError } = await context.supabase
    .from("migration_validation_issues")
    .delete()
    .eq("file_upload_id", context.file.id)
    .eq("resolution_status", "Open");

  if (deleteError) {
    throw new Error(
      `Unable to reset validation issues: ${deleteError.message}`
    );
  }

  for (const chunk of chunkRows(stats.issues, ISSUE_CHUNK_SIZE)) {
    const { error } = await context.supabase
      .from("migration_validation_issues")
      .insert(chunk);

    if (error) {
      throw new Error(
        `Unable to save validation issues: ${error.message}`
      );
    }
  }
}

function issuePreview(
  issues: ValidationIssue[],
  severity: ValidationIssue["severity"]
) {
  return issues
    .filter((issue) => issue.severity === severity)
    .slice(0, 100)
    .map((issue) => ({
      datasetKey: issue.dataset_key,
      sheetName: issue.source_sheet_name,
      rowNumber: issue.source_row_number,
      issueCode: issue.issue_code,
      fieldName: issue.field_name,
      message: issue.message,
    }));
}

async function updateFileCompletion(
  context: ProcessingContext,
  stats: FileStats,
  forcedFailureMessage?: string
) {
  if (forcedFailureMessage) {
    const failureIssue = makeIssue(
      context,
      context.file.dataset_key || context.file.category || "unknown",
      null,
      null,
      "Error",
      "FILE_PROCESSING_FAILED",
      forcedFailureMessage
    );
    stats.issues.push(failureIssue);
  }

  await writeValidationIssues(context, stats);

  const errorCount = stats.issues.filter(
    (issue) => issue.severity === "Error"
  ).length;
  const warningCount = stats.issues.filter(
    (issue) => issue.severity === "Warning"
  ).length;
  const processingStatus = errorCount > 0 ? "Completed With Errors" : "Completed";
  const uploadStatus = errorCount > 0 ? "Processed With Errors" : "Processed";

  const { error } = await context.supabase
    .from("migration_file_uploads")
    .update({
      upload_status: uploadStatus,
      processing_status: processingStatus,
      source_sheet_names: Array.from(new Set(stats.sourceSheetNames)),
      total_rows: stats.totalRows,
      inserted_rows: stats.insertedRows,
      updated_rows: stats.updatedRows,
      rejected_rows: stats.rejectedRows,
      warning_rows: stats.warningRows,
      validation_errors: issuePreview(stats.issues, "Error"),
      validation_warnings: issuePreview(stats.issues, "Warning"),
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", context.file.id);

  if (error) {
    throw new Error(
      `Unable to update file processing status: ${error.message}`
    );
  }

  return { errorCount, warningCount, processingStatus };
}

async function createProcessingEvent(
  supabase: SupabaseAdmin,
  input: {
    batchId: string;
    fileId?: string | null;
    fundName: string;
    datasetKey?: string | null;
    eventType: string;
    eventTitle: string;
    eventDescription?: string;
    eventStatus?: string;
    actor: AuthorisedUser;
    recordsRead?: number;
    recordsInserted?: number;
    recordsUpdated?: number;
    recordsRejected?: number;
    metadata?: Record<string, unknown>;
  }
) {
  const { error } = await supabase
    .from("migration_processing_events")
    .insert({
      batch_id: input.batchId,
      file_upload_id: input.fileId || null,
      fund_name: input.fundName,
      dataset_key: input.datasetKey || null,
      event_type: input.eventType,
      event_title: input.eventTitle,
      event_description: input.eventDescription || null,
      actor_user_id: input.actor.userId,
      actor_name: input.actor.fullName,
      actor_role: input.actor.role,
      event_status: input.eventStatus || "Completed",
      records_read: input.recordsRead || 0,
      records_inserted: input.recordsInserted || 0,
      records_updated: input.recordsUpdated || 0,
      records_rejected: input.recordsRejected || 0,
      metadata: input.metadata || {},
    });

  if (error) {
    console.warn("Migration processing event was not created:", error.message);
  }
}

async function processPdfFiles(
  files: IntakeFile[],
  baseContext: Omit<ProcessingContext, "file">,
  actor: AuthorisedUser
) {
  const aggregate = {
    totalRows: 0,
    insertedRows: 0,
    updatedRows: 0,
    rejectedRows: 0,
    warningRows: 0,
    errorCount: 0,
    warningCount: 0,
    processedFiles: 0,
    summary: { pdfRows: 0 },
  };

  if (files.length === 0) {
    return aggregate;
  }

  const {
    data: investorsData,
    error: investorsError,
  } = await baseContext.supabase
    .from("investor_master")
    .select("id, investor_code, investor_name, email, tax_id")
    .eq("fund_name", baseContext.fundName)
    .order("investor_code", { ascending: true });

  if (investorsError) {
    throw new Error(
      `Unable to load investors for PDF matching: ${investorsError.message}`
    );
  }

  const investors = (investorsData || []) as InvestorReference[];

  const {
    data: pdfBatch,
    error: pdfBatchError,
  } = await baseContext.supabase
    .from("pdf_intelligence_batches")
    .insert({
      batch_name: `Processed from canonical intake - ${new Date().toLocaleString(
        "en-IN"
      )}`,
      fund_name: baseContext.fundName,
      total_files: files.length,
      status: "completed",
    })
    .select("id")
    .single();

  if (pdfBatchError || !pdfBatch) {
    throw new Error(
      pdfBatchError?.message || "Unable to create PDF intelligence batch."
    );
  }

  let readyFiles = 0;
  let reviewFiles = 0;
  let unmatchedFiles = 0;

  for (const file of files) {
    const context: ProcessingContext = { ...baseContext, file };
    const stats = createFileStats();
    stats.totalRows = 1;

    try {
      const fileName = file.original_file_name || "Unknown PDF";
      const documentType = detectPdfDocumentType(fileName);
      const periodLabel = detectPeriod(fileName);
      const investorMatch = matchInvestorFromFileName(investors, fileName);
      const confidenceScore = calculatePdfConfidence(
        documentType,
        investorMatch.investorScore,
        periodLabel
      );
      const status = getPdfStatus(confidenceScore, documentType);
      const matchedInvestor =
        investorMatch.investor as InvestorReference | null;

      if (status === "Ready") readyFiles += 1;
      if (status === "Review") reviewFiles += 1;
      if (status === "Unmatched") unmatchedFiles += 1;

      const documentPayload = {
        batch_id: pdfBatch.id,
        original_file_name: fileName,
        storage_bucket: file.storage_bucket,
        storage_path: file.storage_path,
        file_size: Number(file.file_size || 0),
        document_type: documentType,
        matched_investor_id: matchedInvestor?.id || null,
        investor_code: matchedInvestor?.investor_code || null,
        investor_name: matchedInvestor?.investor_name || null,
        email: matchedInvestor?.email || null,
        fund_name: baseContext.fundName,
        period_label: periodLabel,
        confidence_score: confidenceScore,
        status,
        match_signals: [
          ...investorMatch.signals,
          `Document type: ${documentType}`,
          `Period: ${periodLabel}`,
          `Confidence score: ${confidenceScore}`,
          "Created from canonical migration intake",
        ],
        extracted_text_preview:
          "This PDF was imported from Migration Data Intake. Full text extraction is handled by the PDF Intelligence layer.",
      };

      const {
        data: existingDocument,
        error: existingError,
      } = await baseContext.supabase
        .from("pdf_intelligence_documents")
        .select("id")
        .eq("storage_path", file.storage_path)
        .limit(1)
        .maybeSingle();

      if (existingError) {
        throw new Error(existingError.message);
      }

      if (existingDocument?.id) {
        const { error } = await baseContext.supabase
          .from("pdf_intelligence_documents")
          .update(documentPayload)
          .eq("id", existingDocument.id);

        if (error) throw new Error(error.message);
        stats.updatedRows = 1;
      } else {
        const { error } = await baseContext.supabase
          .from("pdf_intelligence_documents")
          .insert(documentPayload);

        if (error) throw new Error(error.message);
        stats.insertedRows = 1;
      }

      if (status !== "Ready") {
        stats.warningRows = 1;
        stats.issues.push(
          makeIssue(
            context,
            "pdf_dump",
            null,
            null,
            "Warning",
            "PDF_REVIEW_REQUIRED",
            `PDF Intelligence status is ${status}. Review the investor and document classification.`,
            { rowPayload: documentPayload }
          )
        );
      }

      stats.summary.pdfRows = 1;
      const completion = await updateFileCompletion(context, stats);

      aggregate.errorCount += completion.errorCount;
      aggregate.warningCount += completion.warningCount;
      aggregate.totalRows += stats.totalRows;
      aggregate.insertedRows += stats.insertedRows;
      aggregate.updatedRows += stats.updatedRows;
      aggregate.rejectedRows += stats.rejectedRows;
      aggregate.warningRows += stats.warningRows;
      aggregate.summary.pdfRows += 1;
      aggregate.processedFiles += 1;

      await createProcessingEvent(baseContext.supabase, {
        batchId: baseContext.batchId,
        fileId: file.id,
        fundName: baseContext.fundName,
        datasetKey: "pdf_dump",
        eventType: "File Processed",
        eventTitle: `${fileName} processed`,
        eventStatus: completion.errorCount > 0 ? "Completed With Errors" : "Completed",
        actor,
        recordsRead: 1,
        recordsInserted: stats.insertedRows,
        recordsUpdated: stats.updatedRows,
        recordsRejected: stats.rejectedRows,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "PDF processing failed.";
      stats.rejectedRows += 1;
      const completion = await updateFileCompletion(context, stats, message);

      aggregate.errorCount += completion.errorCount;
      aggregate.warningCount += completion.warningCount;
      aggregate.totalRows += stats.totalRows;
      aggregate.rejectedRows += stats.rejectedRows;
      aggregate.processedFiles += 1;

      await createProcessingEvent(baseContext.supabase, {
        batchId: baseContext.batchId,
        fileId: file.id,
        fundName: baseContext.fundName,
        datasetKey: "pdf_dump",
        eventType: "File Processing Failed",
        eventTitle: `${file.original_file_name || "PDF"} failed`,
        eventDescription: message,
        eventStatus: "Failed",
        actor,
        recordsRead: 1,
        recordsRejected: stats.rejectedRows,
      });
    }
  }

  await baseContext.supabase
    .from("pdf_intelligence_batches")
    .update({
      ready_files: readyFiles,
      review_files: reviewFiles,
      unmatched_files: unmatchedFiles,
      updated_at: new Date().toISOString(),
    })
    .eq("id", pdfBatch.id);

  return aggregate;
}

function fileSortOrder(file: IntakeFile) {
  const category = file.category || "";

  if (category === "canonical") return 1;
  if (category === "fund") return 2;
  if (category === "investor") return 3;
  if (category === "portfolio") return 4;
  if (category === "compliance") return 5;
  if (category === "pdf") return 6;
  return 99;
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  let activeBatchId = "";

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase admin client is not configured." },
      { status: 500 }
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const batchId = String(body.batchId || "").trim();
    const fundName = String(body.fundName || "").trim();

    if (!batchId) {
      return NextResponse.json(
        { error: "Migration batch ID is required." },
        { status: 400 }
      );
    }

    if (!fundName) {
      return NextResponse.json(
        { error: "Active fund name is required." },
        { status: 400 }
      );
    }

    const actor = await authoriseRequest(request, supabase, fundName);

    const {
      data: batchData,
      error: batchError,
    } = await supabase
      .from("migration_intake_batches")
      .select("id, fund_name, processing_status")
      .eq("id", batchId)
      .ilike("fund_name", fundName)
      .maybeSingle();

    if (batchError) {
      throw new Error(`Unable to load migration batch: ${batchError.message}`);
    }

    const batch = batchData as IntakeBatchRow | null;

    if (!batch) {
      return NextResponse.json(
        { error: "The migration batch could not be found." },
        { status: 404 }
      );
    }

    if (
      normalizeIdentity(batch.fund_name) !== normalizeIdentity(fundName)
    ) {
      return NextResponse.json(
        { error: "The active fund does not match the migration batch." },
        { status: 409 }
      );
    }

    if (batch.processing_status === "Processing") {
      return NextResponse.json(
        { error: "This migration batch is already being processed." },
        { status: 409 }
      );
    }

    if (batch.processing_status === "Completed") {
      return NextResponse.json(
        { error: "This migration batch has already been processed." },
        { status: 409 }
      );
    }

    const processingStartedAt = new Date().toISOString();

    const {
      data: lockedBatch,
      error: lockError,
    } = await supabase
      .from("migration_intake_batches")
      .update({
        status: "Processing",
        processing_status: "Processing",
        processing_started_at: processingStartedAt,
        processed_by: actor.userId,
        updated_at: processingStartedAt,
      })
      .eq("id", batchId)
      .ilike("fund_name", fundName)
      .neq("processing_status", "Processing")
      .neq("processing_status", "Completed")
      .select("id")
      .maybeSingle();

    if (lockError) {
      throw new Error(`Unable to lock migration batch: ${lockError.message}`);
    }

    if (!lockedBatch) {
      return NextResponse.json(
        {
          error:
            "This migration batch was locked or completed by another request before processing could begin.",
          code: "MIGRATION_BATCH_LOCK_CONFLICT",
        },
        {
          status: 409,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    activeBatchId = batchId;

    await createProcessingEvent(supabase, {
      batchId,
      fundName,
      eventType: "Batch Processing Started",
      eventTitle: "Canonical migration processing started",
      actor,
    });

    const {
      data: fileData,
      error: fileError,
    } = await supabase
      .from("migration_file_uploads")
      .select(
        "id, batch_id, fund_name, original_file_name, category, dataset_key, detected_type, file_size, storage_bucket, storage_path, upload_status, processing_status, note"
      )
      .eq("batch_id", batchId)
      .ilike("fund_name", fundName)
      .order("created_at", { ascending: true });

    if (fileError) {
      throw new Error(`Unable to load intake files: ${fileError.message}`);
    }

    const allFiles = ((fileData || []) as IntakeFile[]).sort(
      (left, right) => fileSortOrder(left) - fileSortOrder(right)
    );

    if (allFiles.length === 0) {
      throw new Error("No files were found in this migration batch.");
    }

    const pendingFiles = allFiles.filter(
      (file) => file.processing_status !== "Completed"
    );

    const baseContext: Omit<ProcessingContext, "file"> = {
      supabase,
      batchId,
      fundName,
      investorIds: new Map<string, string>(),
      portfolioIds: new Map<string, string>(),
      fundMasterId: null,
    };

    await refreshReferenceCaches({
      ...baseContext,
      file: pendingFiles[0] || allFiles[0],
    });

    const aggregate = {
      totalRows: 0,
      insertedRows: 0,
      updatedRows: 0,
      rejectedRows: 0,
      warningRows: 0,
      errorCount: 0,
      warningCount: 0,
      processedFiles: 0,
      summary: {} as Record<string, number>,
    };

    const nonPdfFiles = pendingFiles.filter(
      (file) => file.category !== "pdf"
    );

    for (const file of nonPdfFiles) {
      const context: ProcessingContext = { ...baseContext, file };
      const stats = createFileStats();

      try {
        const buffer = await downloadFileBuffer(supabase, file);
        const workbook = readWorkbook(buffer);

        if (file.category === "canonical") {
          await processCanonicalWorkbook(workbook, context, stats);
        } else if (file.category === "investor") {
          await processLegacyInvestorWorkbook(workbook, context, stats);
        } else if (file.category === "portfolio") {
          await processLegacyPortfolioWorkbook(workbook, context, stats);
        } else if (file.category === "fund") {
          await processLegacySingleDatasetWorkbook(
            workbook,
            context,
            stats,
            "fund_master"
          );
        } else if (file.category === "compliance") {
          await processLegacySingleDatasetWorkbook(
            workbook,
            context,
            stats,
            "compliance_items"
          );
        } else {
          throw new Error(
            `Unsupported migration category: ${file.category || "unknown"}.`
          );
        }

        const completion = await updateFileCompletion(context, stats);

        aggregate.totalRows += stats.totalRows;
        aggregate.insertedRows += stats.insertedRows;
        aggregate.updatedRows += stats.updatedRows;
        aggregate.rejectedRows += stats.rejectedRows;
        aggregate.warningRows += stats.warningRows;
        aggregate.errorCount += completion.errorCount;
        aggregate.warningCount += completion.warningCount;
        aggregate.processedFiles += 1;

        Object.entries(stats.summary).forEach(([key, value]) => {
          addSummary(aggregate.summary, key, value);
        });

        await createProcessingEvent(supabase, {
          batchId,
          fileId: file.id,
          fundName,
          datasetKey: file.dataset_key || file.category,
          eventType: "File Processed",
          eventTitle: `${file.original_file_name || "Migration file"} processed`,
          eventStatus:
            completion.errorCount > 0
              ? "Completed With Errors"
              : "Completed",
          actor,
          recordsRead: stats.totalRows,
          recordsInserted: stats.insertedRows,
          recordsUpdated: stats.updatedRows,
          recordsRejected: stats.rejectedRows,
          metadata: {
            summary: stats.summary,
            warnings: completion.warningCount,
          },
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Migration file processing failed.";
        stats.rejectedRows += 1;
        const completion = await updateFileCompletion(
          context,
          stats,
          message
        );

        aggregate.totalRows += stats.totalRows;
        aggregate.insertedRows += stats.insertedRows;
        aggregate.updatedRows += stats.updatedRows;
        aggregate.rejectedRows += stats.rejectedRows;
        aggregate.warningRows += stats.warningRows;
        aggregate.errorCount += completion.errorCount;
        aggregate.warningCount += completion.warningCount;
        aggregate.processedFiles += 1;

        await createProcessingEvent(supabase, {
          batchId,
          fileId: file.id,
          fundName,
          datasetKey: file.dataset_key || file.category,
          eventType: "File Processing Failed",
          eventTitle: `${file.original_file_name || "Migration file"} failed`,
          eventDescription: message,
          eventStatus: "Failed",
          actor,
          recordsRead: stats.totalRows,
          recordsInserted: stats.insertedRows,
          recordsUpdated: stats.updatedRows,
          recordsRejected: stats.rejectedRows,
        });
      }
    }

    const pdfAggregate = await processPdfFiles(
      pendingFiles.filter((file) => file.category === "pdf"),
      baseContext,
      actor
    );

    aggregate.totalRows += pdfAggregate.totalRows;
    aggregate.insertedRows += pdfAggregate.insertedRows;
    aggregate.updatedRows += pdfAggregate.updatedRows;
    aggregate.rejectedRows += pdfAggregate.rejectedRows;
    aggregate.warningRows += pdfAggregate.warningRows;
    aggregate.errorCount += pdfAggregate.errorCount;
    aggregate.warningCount += pdfAggregate.warningCount;
    aggregate.processedFiles += pdfAggregate.processedFiles;
    addSummary(
      aggregate.summary,
      "pdfRows",
      pdfAggregate.summary.pdfRows
    );

    const completedWithErrors = aggregate.errorCount > 0;
    const finalProcessingStatus = completedWithErrors
      ? "Completed With Errors"
      : "Completed";
    const finalStatus = completedWithErrors
      ? "Review Required"
      : "Processed";

    const { error: batchUpdateError } = await supabase
      .from("migration_intake_batches")
      .update({
        status: finalStatus,
        processing_status: finalProcessingStatus,
        processed_files: allFiles.length,
        total_rows: aggregate.totalRows,
        inserted_rows: aggregate.insertedRows,
        updated_rows: aggregate.updatedRows,
        rejected_rows: aggregate.rejectedRows,
        warning_rows: aggregate.warningRows,
        validation_error_count: aggregate.errorCount,
        validation_warning_count: aggregate.warningCount,
        validation_summary: {
          errors: aggregate.errorCount,
          warnings: aggregate.warningCount,
          rejectedRows: aggregate.rejectedRows,
          warningRows: aggregate.warningRows,
        },
        processing_summary: aggregate.summary,
        processed_at: new Date().toISOString(),
        processed_by: actor.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", batchId);

    if (batchUpdateError) {
      throw new Error(
        `Data was processed, but the batch summary could not be updated: ${batchUpdateError.message}`
      );
    }

    await createProcessingEvent(supabase, {
      batchId,
      fundName,
      eventType: "Batch Processing Completed",
      eventTitle: "Canonical migration processing completed",
      eventDescription: completedWithErrors
        ? "The batch completed with validation errors and requires review."
        : "The batch completed successfully.",
      eventStatus: finalProcessingStatus,
      actor,
      recordsRead: aggregate.totalRows,
      recordsInserted: aggregate.insertedRows,
      recordsUpdated: aggregate.updatedRows,
      recordsRejected: aggregate.rejectedRows,
      metadata: {
        summary: aggregate.summary,
        errors: aggregate.errorCount,
        warnings: aggregate.warningCount,
      },
    });

    return NextResponse.json({
      batchId,
      message: completedWithErrors
        ? "Migration intake processed with validation issues. Review the rejected rows before activation."
        : "Migration intake processed successfully.",
      processingStatus: finalProcessingStatus,
      summary: {
        ...aggregate.summary,
        insertedRows: aggregate.insertedRows,
        updatedRows: aggregate.updatedRows,
        rejectedRows: aggregate.rejectedRows,
        warningRows: aggregate.warningRows,
        processedFiles: aggregate.processedFiles,
      },
    });
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    const message =
      error instanceof Error
        ? error.message
        : "Migration intake processing failed.";

    console.error("Process intake failed:", error);

    if (activeBatchId) {
      await supabase
        .from("migration_intake_batches")
        .update({
          status: "Processing Failed",
          processing_status: "Failed",
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          processing_summary: { error: message },
        })
        .eq("id", activeBatchId)
        .eq("processing_status", "Processing");
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}