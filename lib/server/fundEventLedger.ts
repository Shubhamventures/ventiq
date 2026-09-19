import "server-only";
import { createHash } from "node:crypto";

export type FundEventKeyInput = {
  organisationId: string;
  fundName: string;
  sourceModule: string;
  sourceRecordType: string;
  sourceRecordId: string;
  sourceSubkey?: string | null;
  eventType: string;
};

export type FundEventInput = FundEventKeyInput & {
  eventTitle: string;
  eventDate: string;
  effectiveDate: string;
  fundId?: string | null;
  eventDescription?: string | null;
  accountingDate?: string | null;
  amount?: number | null;
  currency?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  counterparty?: string | null;
  sourceDocumentId?: string | null;
  sourceDocumentPath?: string | null;
  approvalRequestId?: string | null;
  governanceStatus?: string | null;
  createdBy?: string | null;
  createdByName?: string | null;
  createdByRole?: string | null;
  reversesEventId?: string | null;
  supersedesEventId?: string | null;
  metadata?: Record<string, unknown>;
};

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
  return value.trim();
}

function optionalText(value: unknown, field: string): string | null {
  return value == null ? null : text(value, field);
}

function uuid(value: unknown, field: string): string {
  const result = text(value, field).toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(result)) {
    throw new Error(`${field} must be a UUID`);
  }
  return result;
}

function date(value: unknown, field: string): string {
  const result = text(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || result.startsWith("0000") ||
      !Number.isFinite(Date.parse(result)) || new Date(result).toISOString().slice(0, 10) !== result) {
    throw new Error(`${field} must be a valid YYYY-MM-DD date`);
  }
  return result;
}

function lineageFields(input: FundEventKeyInput) {
  return {
    organisation_id: uuid(input.organisationId, "organisationId"),
    fund_name: text(input.fundName, "fundName"),
    source_module: text(input.sourceModule, "sourceModule"),
    source_record_type: text(input.sourceRecordType, "sourceRecordType"),
    source_record_id: text(input.sourceRecordId, "sourceRecordId"),
    source_subkey: input.sourceSubkey == null ? "" : input.sourceSubkey.trim(),
    event_type: text(input.eventType, "eventType").toUpperCase(),
  };
}

/** v1: trim all components; lower-case scope/module/type, upper-case event type.
 * Opaque record IDs/subkeys preserve case. JSON framing prevents delimiter collisions.
 */
export function buildFundEventIdempotencyKey(input: FundEventKeyInput): string {
  const canonical = lineageFields(input);
  const fields = {
    ...canonical,
    fund_name: canonical.fund_name.toLowerCase(),
    source_module: canonical.source_module.toLowerCase(),
    source_record_type: canonical.source_record_type.toLowerCase(),
  };
  return createHash("sha256").update(JSON.stringify(["v1", ...Object.values(fields)])).digest("hex");
}

function assertJson(value: unknown, ancestors = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (typeof value !== "object" || ancestors.has(value)) throw new Error("metadata must be JSON");
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error("metadata must contain plain JSON objects");
  }
  ancestors.add(value);
  for (const item of Object.values(value)) assertJson(item, ancestors);
  ancestors.delete(value);
}

export function validateFundEventInput(input: FundEventInput) {
  const fields = lineageFields(input);
  const amount = input.amount ?? null;
  if (amount !== null && (typeof amount !== "number" || !Number.isFinite(amount))) {
    throw new Error("amount must be finite");
  }
  const currency = optionalText(input.currency, "currency")?.toUpperCase() ?? null;
  if (amount !== null && !currency) throw new Error("currency is required with amount");
  const optionalUuid = (value: unknown, field: string) => value == null ? null : uuid(value, field);
  const reverses = optionalUuid(input.reversesEventId, "reversesEventId");
  const supersedes = optionalUuid(input.supersedesEventId, "supersedesEventId");
  if (reverses && supersedes) throw new Error("reversal and supersession are mutually exclusive");
  const metadata = input.metadata === undefined ? {} : input.metadata;
  if (!metadata || Array.isArray(metadata) || typeof metadata !== "object") throw new Error("metadata must be an object");
  assertJson(metadata);
  return {
    ...fields,
    source_subkey: fields.source_subkey || null,
    idempotency_key: buildFundEventIdempotencyKey(input),
    event_title: text(input.eventTitle, "eventTitle"),
    event_date: date(input.eventDate, "eventDate"),
    effective_date: date(input.effectiveDate, "effectiveDate"),
    fund_id: optionalUuid(input.fundId, "fundId"),
    event_description: optionalText(input.eventDescription, "eventDescription"),
    accounting_date: input.accountingDate == null ? null : date(input.accountingDate, "accountingDate"),
    amount, currency,
    entity_type: optionalText(input.entityType, "entityType"),
    entity_id: optionalText(input.entityId, "entityId"),
    counterparty: optionalText(input.counterparty, "counterparty"),
    source_document_id: optionalUuid(input.sourceDocumentId, "sourceDocumentId"),
    source_document_path: optionalText(input.sourceDocumentPath, "sourceDocumentPath"),
    approval_request_id: optionalUuid(input.approvalRequestId, "approvalRequestId"),
    governance_status: optionalText(input.governanceStatus, "governanceStatus"),
    created_by: optionalUuid(input.createdBy, "createdBy"),
    created_by_name: optionalText(input.createdByName, "createdByName"),
    created_by_role: optionalText(input.createdByRole, "createdByRole"),
    reverses_event_id: reverses,
    supersedes_event_id: supersedes,
    metadata: JSON.parse(JSON.stringify(metadata)) as Record<string, unknown>,
  };
}

export type FundOperationalEvent = ReturnType<typeof validateFundEventInput> & {
  id: string;
  created_at: string;
};

/** Trusted server callers only. Duplicate payloads never replace canonical history. */
export async function recordFundEvent(input: FundEventInput): Promise<FundOperationalEvent> {
  const row = validateFundEventInput(input);
  const { supabaseAdmin } = await import("../supabaseAdmin");
  const result = await supabaseAdmin.from("fund_operational_events").insert(row).select("*").single();
  if (!result.error && result.data) return result.data as FundOperationalEvent;
  if (result.error?.code !== "23505") throw new Error(result.error?.message ?? "Event insert returned no row");
  const existing = await supabaseAdmin.from("fund_operational_events").select("*")
    .eq("organisation_id", row.organisation_id)
    .eq("idempotency_key", row.idempotency_key).limit(2);
  if (existing.error || !existing.data || existing.data.length !== 1) {
    throw new Error(existing.error?.message ?? "Conflicting event not found or ambiguous");
  }
  const event = existing.data[0] as FundOperationalEvent;
  if (text(event.fund_name, "fund_name").toLowerCase() !== row.fund_name.toLowerCase()) {
    throw new Error("Conflicting event fund identity mismatch");
  }
  return event;
}

/** Uses the verified user's JWT and database RLS, never the service-role reader.
 * Scope is mandatory; callers can request a single event with eventId.
 */
export async function listFundEvents(input: {
  accessToken: string;
  organisationId: string;
  fundName: string;
  eventId?: string;
  limit?: number;
}): Promise<FundOperationalEvent[]> {
  const organisationId = uuid(input.organisationId, "organisationId");
  const fundName = text(input.fundName, "fundName");
  const token = text(input.accessToken, "accessToken");
  const eventId = input.eventId === undefined ? null : uuid(input.eventId, "eventId");
  const limit = input.limit ?? 100;
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error("limit must be 1..500");
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(
    text(process.env.NEXT_PUBLIC_SUPABASE_URL, "Supabase URL"),
    text(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "Supabase anon key"),
    { global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
  const auth = await client.auth.getUser(token);
  if (auth.error || !auth.data.user) throw new Error("INVALID_SESSION");
  let query = client.from("fund_operational_events").select("*")
    .eq("organisation_id", organisationId).eq("fund_name", fundName);
  if (eventId) query = query.eq("id", eventId);
  const result = await query.order("event_date", { ascending: false })
    .order("id", { ascending: false }).limit(limit);
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []) as FundOperationalEvent[];
}
