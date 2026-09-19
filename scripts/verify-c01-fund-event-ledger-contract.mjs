import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(resolve("lib/server/fundEventLedger.ts"), "utf8");
const sql = readFileSync(resolve("database/migrations/20260919_001_c01_fund_operational_events.sql"), "utf8")
  .replace(/--[^\n]*/g, "").replace(/\s+/g, " ").toLowerCase();
// Transpile the actual helper in memory. All I/O imports are replaced; no DB/network.
let responses = [];
let calls = [];
let validUser = true;
const client = {
  auth: { getUser: async () => ({ data: { user: validUser ? { id: "user" } : null }, error: null }) },
  from(table) {
    calls.push(["from", table]);
    const chain = {};
    for (const method of ["insert", "select", "eq", "order", "limit"]) {
      chain[method] = (...args) => { calls.push([method, ...args]); return chain; };
    }
    chain.single = chain.maybeSingle = async () => responses.shift();
    chain.then = (done, fail) => Promise.resolve(responses.shift()).then(done, fail);
    return chain;
  },
};
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const helperModule = { exports: {} };
vm.runInThisContext(`(function(require,module,exports,process){${output}\n})`)(
  (name) => {
    if (name === "server-only") return {};
    if (name === "node:crypto") return require(name);
    if (name === "../supabaseAdmin") return { supabaseAdmin: client };
    if (name === "@supabase/supabase-js") return { createClient: () => client };
    throw new Error(`Unexpected import: ${name}`);
  }, helperModule, helperModule.exports,
  { env: { NEXT_PUBLIC_SUPABASE_URL: "https://offline.invalid", NEXT_PUBLIC_SUPABASE_ANON_KEY: "offline" } },
);
const { buildFundEventIdempotencyKey: key, validateFundEventInput: validate, recordFundEvent, listFundEvents } = helperModule.exports;
const base = {
  organisationId: "11111111-1111-4111-8111-111111111111", fundName: "Fund A",
  sourceModule: "capital_call", sourceRecordType: "call", sourceRecordId: "Record-A",
  sourceSubkey: "part-1", eventType: "CAPITAL_CALL_APPROVED", eventTitle: "Call approved",
  eventDate: "2026-09-19", effectiveDate: "2026-09-19",
};
let count = 0;
async function check(name, run) { await run(); console.log(`PASS ${++count}: ${name}`); }
await check("deterministic SHA-256 key", () => {
  assert.equal(key(base), key({ ...base })); assert.match(key(base), /^[a-f0-9]{64}$/);
});
await check("whitespace normalization", () => assert.equal(key(base), key(Object.fromEntries(
  Object.entries(base).map(([name, value]) => [name, ` \t${value}\n`]),
))));
for (const field of ["sourceRecordId", "sourceSubkey", "eventType", "organisationId", "fundName"]) {
  await check(`${field} changes key`, () => assert.notEqual(key(base), key({ ...base,
    [field]: field === "organisationId" ? "22222222-2222-4222-8222-222222222222" : "different",
  })));
}
for (const field of ["organisationId", "fundName", "sourceModule", "sourceRecordType", "sourceRecordId", "eventType", "eventDate", "effectiveDate", "eventTitle"]) {
  await check(`missing ${field} rejected`, () => {
    for (const value of [undefined, null, "", " \t"]) assert.throws(() => validate({ ...base, [field]: value }));
  });
}
await check("non-finite amount rejected", () => {
  for (const amount of [NaN, Infinity, -Infinity, "12"]) assert.throws(() => validate({ ...base, amount, currency: "USD" }));
});
await check("amount requires currency", () => {
  for (const currency of [undefined, null, "", " "]) assert.throws(() => validate({ ...base, amount: 0, currency }));
});
await check("mutually exclusive corrections", () => assert.throws(() => validate({ ...base,
  reversesEventId: base.organisationId, supersedesEventId: base.organisationId,
})));
await check("casing and optional subkey contract", () => {
  assert.equal(key(base), key({ ...base, fundName: "FUND A", sourceModule: "CAPITAL_CALL", sourceRecordType: "CALL", eventType: "capital_call_approved" }));
  assert.notEqual(key(base), key({ ...base, sourceRecordId: "record-a" }));
  assert.notEqual(key(base), key({ ...base, sourceSubkey: "PART-1" }));
  assert.equal(key({ ...base, sourceSubkey: null }), key({ ...base, sourceSubkey: " " }));
});
await check("canonical label casing does not change identity", () => {
  const input = { ...base, fundName: "Fund Alpha", sourceModule: "Capital Call", sourceRecordType: "Capital Call" };
  for (const field of ["fundName", "sourceModule", "sourceRecordType"]) {
    assert.equal(key(input), key({ ...input, [field]: input[field].toLowerCase() }));
  }
  const organisationId = "abcdefab-abcd-4abc-8abc-abcdefabcdef";
  assert.equal(key({ ...input, organisationId }), key({ ...input, organisationId: ` ${organisationId.toUpperCase()} ` }));
});
const canonicalInput = { ...base, fundName: "  Fund Alpha  ", sourceModule: "  Capital Call  ",
  sourceRecordType: "  Capital Call  ", sourceRecordId: "  Record-A  ", sourceSubkey: "  Part-A  ",
  eventType: "  capital_call_approved  " };
for (const [field, expected] of [["fund_name", "Fund Alpha"], ["source_module", "Capital Call"],
  ["source_record_type", "Capital Call"], ["source_record_id", "Record-A"],
  ["source_subkey", "Part-A"], ["event_type", "CAPITAL_CALL_APPROVED"]]) {
  await check(`validate preserves canonical ${field}`, () => assert.equal(validate(canonicalInput)[field], expected));
}
await check("blank or absent subkey persists as null", () => {
  for (const sourceSubkey of [undefined, null, " \t"]) assert.equal(validate({ ...base, sourceSubkey }).source_subkey, null);
});
await check("strict dates, UUIDs and metadata", () => {
  for (const eventDate of ["2026-02-30", "2026-13-01", "19/09/2026"]) assert.throws(() => validate({ ...base, eventDate }));
  assert.throws(() => validate({ ...base, fundId: "bad" }));
  for (const metadata of [null, [], { value: Infinity }, { value: undefined }]) assert.throws(() => validate({ ...base, metadata }));
  assert.equal(validate({ ...base, amount: 0, currency: " usd " }).currency, "USD");
});
const contracts = [
  ["creates ledger", /create table public\.fund_operational_events \(/],
  ["required organisation", /organisation_id uuid not null/],
  ["trimmed nonblank canonical fund storage", /fund_name text not null check \(fund_name = btrim\(fund_name\) and fund_name <> ''\)/],
  ["organisation FK", /organisation_id uuid not null references public\.ventiq_organisations\(id\)/],
  ["RLS enabled", /alter table public\.fund_operational_events enable row level security/],
  ["authenticated SELECT", /grant select on table public\.fund_operational_events to authenticated/],
  ["write privileges revoked", /revoke all on table public\.fund_operational_events from public, anon, authenticated, service_role/],
  ["service insert posture", /grant select, insert on table public\.fund_operational_events to service_role/],
  ["active organisation membership", /member\.user_id = auth\.uid\(\).*member\.organisation_id = fund_operational_events\.organisation_id.*lower\(btrim\(member\.status\)\) = 'active'/],
  ["active fund entitlement", /access_record\.user_id = auth\.uid\(\).*lower\(btrim\(access_record\.status\)\) = 'active'.*access_record\.can_view is true/],
  ["row organisation scoped", /access_record\.organisation_id = fund_operational_events\.organisation_id/],
  ["normalized fund scoped", /lower\(btrim\(access_record\.fund_name\)\) = lower\(btrim\(fund_operational_events\.fund_name\)\)/],
  ["composite idempotency", /create unique index fund_operational_events_idempotency_idx on public\.fund_operational_events \(organisation_id, lower\(btrim\(fund_name\)\), idempotency_key\)/],
  ["currency constraint", /amount is null or \(currency is not null and btrim\(currency\) <> ''\)/],
  ["correction constraint", /reverses_event_id is null or supersedes_event_id is null/],
];
for (const [name, pattern] of contracts) await check(name, () => assert.match(sql, pattern));
await check("fund storage does not require lowercase", () => {
  assert.doesNotMatch(sql, /fund_name\s*=\s*lower\(/);
});
await check("no extra grants or write policies", () => {
  assert.equal((sql.match(/grant /g) ?? []).length, 2);
  assert.equal((sql.match(/create policy /g) ?? []).length, 1);
  assert.match(sql, /for select to authenticated/);
  assert.doesNotMatch(sql, /\b(update|delete|truncate|drop)\b/);
});
await check("server-only; no update/delete/upsert helper", () => {
  assert.match(source, /import "server-only"/);
  assert.doesNotMatch(source.slice(source.indexOf("export async function recordFundEvent")), /\.(update|delete|upsert)\s*\(/);
  assert.deepEqual(Object.keys(helperModule.exports).sort(), ["buildFundEventIdempotencyKey", "listFundEvents", "recordFundEvent", "validateFundEventInput"].sort());
});
const saved = { ...validate(base), id: base.organisationId, created_at: "2026-09-19T00:00:00Z" };
await check("insert returns canonical row", async () => {
  calls = []; responses = [{ data: saved, error: null }];
  assert.equal(await recordFundEvent(base), saved);
  assert.equal(calls.filter(([method]) => method === "insert").length, 1);
});
await check("duplicate reuses original without overwrite", async () => {
  calls = []; responses = [{ data: null, error: { code: "23505" } }, { data: [saved], error: null }];
  assert.equal(await recordFundEvent({ ...base, eventTitle: "Changed title" }), saved);
  for (const field of ["organisation_id", "idempotency_key"]) {
    assert.ok(calls.some(([method, name, value]) => method === "eq" && name === field && value === saved[field]));
  }
  assert.equal(calls.filter(([method]) => method === "insert").length, 1);
  assert.ok(!calls.some(([method, name]) => method === "eq" && name === "fund_name"));
  assert.ok(calls.some(([method, value]) => method === "limit" && value === 2));
});
await check("case-variant duplicate returns original canonical event", async () => {
  const original = { ...validate(canonicalInput), id: saved.id, created_at: saved.created_at };
  calls = []; responses = [{ error: { code: "23505" } }, { data: [original], error: null }];
  const retry = { ...canonicalInput, fundName: " fund alpha ", sourceModule: "capital call", sourceRecordType: "capital call" };
  assert.equal(key(retry), original.idempotency_key);
  assert.equal(await recordFundEvent(retry), original);
  assert.equal(original.fund_name, "Fund Alpha");
  for (const field of ["organisation_id", "idempotency_key"]) {
    assert.ok(calls.some(([method, name, value]) => method === "eq" && name === field && value === original[field]));
  }
  assert.ok(!calls.some(([method, name]) => method === "eq" && name === "fund_name"));
});
await check("duplicate recovery verifies normalized fund identity", async () => {
  responses = [{ error: { code: "23505" } }, { data: [{ ...saved, fund_name: " Fund B " }], error: null }];
  await assert.rejects(recordFundEvent(base), /fund identity mismatch/);
  const normalized = { ...saved, fund_name: " FUND A " };
  responses = [{ error: { code: "23505" } }, { data: [normalized], error: null }];
  assert.equal(await recordFundEvent(base), normalized);
});
await check("ambiguous or missing duplicate recovery fails closed", async () => {
  for (const data of [null, [], [saved, saved]]) {
    responses = [{ error: { code: "23505" } }, { data, error: null }];
    await assert.rejects(recordFundEvent(base), /not found or ambiguous/);
  }
  responses = [{ error: { code: "23505" } }, { data: [saved], error: { message: "read denied" } }];
  await assert.rejects(recordFundEvent(base), /read denied/);
});
await check("insert/read errors fail closed", async () => {
  responses = [{ error: { code: "42501", message: "denied" } }];
  await assert.rejects(recordFundEvent(base), /denied/);
  responses = [{ error: { code: "23505" } }, { data: null, error: null }];
  await assert.rejects(recordFundEvent(base), /not found/);
});
await check("governed list scope and verified session", async () => {
  calls = []; responses = [{ data: [saved], error: null }];
  assert.deepEqual(await listFundEvents({ ...base, fundName: "  Fund A  ", accessToken: "offline", eventId: saved.id }), [saved]);
  for (const [field, value] of [["organisation_id", saved.organisation_id], ["fund_name", saved.fund_name], ["id", saved.id]]) {
    assert.ok(calls.some(([method, name, actual]) => method === "eq" && name === field && actual === value));
  }
  validUser = false; calls = [];
  await assert.rejects(listFundEvents({ ...base, accessToken: "invalid" }), /INVALID_SESSION/);
  assert.equal(calls.length, 0);
});
console.log(`C01-A: ${count} offline contract groups passed.`);
