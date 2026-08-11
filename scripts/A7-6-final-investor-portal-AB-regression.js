const { createClient } = require("@supabase/supabase-js");
const crypto = require("node:crypto");

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "";

const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  "";

const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";

const SITE_LOCK_TOKEN =
  process.env.SITE_LOCK_TOKEN ||
  process.env.VENTIQ_SITE_LOCK_TOKEN ||
  "";

const APP_URL = process.env.VENTIQ_APP_URL || "http://localhost:3000";

const ORGANISATION_ID = "2febaacd-ef58-4444-8715-9bbd0d38238d";
const FUND_NAME = "VENTIQ Access Test Fund";
const SOURCE_BATCH_ID = "293e683d-dde0-4c56-a534-697e8405fe37";

const INVESTOR_A_CODE = "A3TEST001";
const INVESTOR_B_CODE = "A7-FINAL-ISOLATION-NO-A3";

const EXPECTED_RUN_ID = "e51cd827-a9cd-4bd5-bd3f-fd7ac5f9670e";
const PORTAL_DOCUMENT_ID = "487c8e72-3c90-40ac-a01c-4ac19f1f98ac";
const DATA_ROOM_DOCUMENT_ID = "34a4a92f-d899-4639-be32-4af9d5ff2b5e";
const DATA_ROOM_DOCUMENT_NAME = "A7 QA Fund Overview - A3TEST001";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
  console.error("FAIL - Missing required Supabase environment variables.");
  process.exit(1);
}

if (!SITE_LOCK_TOKEN) {
  console.error("FAIL - SITE_LOCK_TOKEN is missing from .env.local.");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

const createdUserIds = [];

function pass(message) {
  console.log(`PASS - ${message}`);
}

function fail(message, detail = "") {
  console.error(`FAIL - ${message}`);
  if (detail) console.error(detail);
  throw new Error(message);
}

function makeAccount(label, investorCode) {
  const nonce = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

  return {
    label,
    investorCode,
    email: `a7.final.${label.toLowerCase()}.${nonce}@ventiq.test`,
    password: `Ventiq-A7-${crypto.randomUUID()}!`,
    fullName: `A7 Final Portal Test ${label}`,
  };
}

async function createQaInvestor(account) {
  const { data: authData, error: authError } =
    await admin.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: {
        full_name: account.fullName,
        ventiq_test_only: true,
        ventiq_test_stage: "A7-6",
      },
    });

  if (authError || !authData?.user) {
    fail(`${account.label} auth user provisioning`, authError?.message);
  }

  account.userId = authData.user.id;
  createdUserIds.push(account.userId);
  pass(`${account.label} temporary auth user created`);

  const { error: profileError } = await admin
    .from("ventiq_user_profiles")
    .upsert(
      {
        user_id: account.userId,
        email: account.email,
        full_name: account.fullName,
        default_role: "investor",
        active_organisation_id: ORGANISATION_ID,
        investor_id: account.investorCode,
        status: "Active",
      },
      { onConflict: "user_id" }
    );

  if (profileError) {
    fail(`${account.label} profile provisioning`, profileError.message);
  }
  pass(`${account.label} Active Investor profile -> ${account.investorCode}`);

  const { error: membershipError } = await admin
    .from("ventiq_organisation_members")
    .insert({
      organisation_id: ORGANISATION_ID,
      user_id: account.userId,
      role: "investor",
      status: "Active",
      is_primary: true,
    });

  if (membershipError) {
    fail(`${account.label} organisation membership`, membershipError.message);
  }

  const { error: fundAccessError } = await admin
    .from("ventiq_user_fund_access")
    .upsert(
      {
        organisation_id: ORGANISATION_ID,
        user_id: account.userId,
        fund_name: FUND_NAME,
        role: "investor",
        can_view: true,
        can_edit: false,
        can_approve: false,
        investor_id: account.investorCode,
        status: "Active",
      },
      { onConflict: "organisation_id,user_id,fund_name" }
    );

  if (fundAccessError) {
    fail(`${account.label} fund access provisioning`, fundAccessError.message);
  }

  const { error: entitlementError } = await admin
    .from("ventiq_user_investor_access")
    .insert({
      organisation_id: ORGANISATION_ID,
      user_id: account.userId,
      fund_name: FUND_NAME,
      investor_code: account.investorCode,
      status: "Active",
      can_view_profile: true,
      can_view_financials: true,
      can_view_documents: true,
      can_download_documents: true,
      can_use_data_room: true,
      can_submit_questions: true,
    });

  if (entitlementError) {
    fail(`${account.label} investor entitlement`, entitlementError.message);
  }

  pass(`${account.label} full A7 LP entitlement ready`);
}

async function signIn(account) {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });

  if (error || !data?.session?.access_token) {
    fail(`${account.label} JWT authentication`, error?.message);
  }

  pass(`${account.label} authenticated with real Investor JWT`);
  return data.session.access_token;
}

function jwtClient(token) {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

function requestHeaders(token, json = false) {
  return {
    Authorization: `Bearer ${token}`,
    Cookie: `ventiq_site_access=${encodeURIComponent(SITE_LOCK_TOKEN)}`,
    Accept: "application/json",
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function getRequest(path, token, params = {}) {
  const url = new URL(path, APP_URL);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    method: "GET",
    headers: requestHeaders(token),
  });

  return { response, body: await readJson(response) };
}

async function postRequest(path, token, body) {
  const response = await fetch(new URL(path, APP_URL), {
    method: "POST",
    headers: requestHeaders(token, true),
    body: JSON.stringify(body),
  });

  return { response, body: await readJson(response) };
}

async function callFinancialPosition(token, investorCodeParam) {
  return getRequest("/api/investor-portal/financial-position", token, {
    fundName: FUND_NAME,
    investorCode: investorCodeParam,
  });
}

async function callCashflows(token, investorCodeParam) {
  return getRequest("/api/investor-portal/cashflows", token, {
    fundName: FUND_NAME,
    investorCode: investorCodeParam,
  });
}

async function callPortalDocuments(token, investorCodeParam) {
  return getRequest("/api/investor-portal/documents", token, {
    fundName: FUND_NAME,
    investorCode: investorCodeParam,
  });
}

async function callPortalDocumentAccess(token, mode) {
  return postRequest("/api/investor-portal/document-access", token, {
    document_id: PORTAL_DOCUMENT_ID,
    access_mode: mode,
  });
}

async function callDataRoomDocuments(token, investorCodeParam) {
  return getRequest("/api/data-room/documents", token, {
    fundName: FUND_NAME,
    sourceBatchId: SOURCE_BATCH_ID,
    investorCode: investorCodeParam,
    limit: 100,
  });
}

async function callDataRoomDocumentAccess(token) {
  return getRequest("/api/data-room/documents", token, {
    fundName: FUND_NAME,
    sourceBatchId: SOURCE_BATCH_ID,
    documentId: DATA_ROOM_DOCUMENT_ID,
  });
}

async function workflowGet(token, investorCodeParam) {
  return getRequest("/api/data-room/workflow", token, {
    fundName: FUND_NAME,
    sourceBatchId: SOURCE_BATCH_ID,
    investorCode: investorCodeParam,
    limit: 100,
  });
}

async function workflowPost(token, body) {
  return postRequest("/api/data-room/workflow", token, body);
}

async function countRows(table, column, value) {
  const { count, error } = await admin
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(column, value);

  if (error) {
    fail(`count ${table}`, error.message);
  }

  return Number(count || 0);
}

async function getFinancialAuditRows(userIds) {
  const { data, error } = await admin
    .from("ventiq_investor_financial_access_events")
    .select(
      "actor_user_id,actor_role,investor_code,calculation_run_id,entitlement_basis,created_at"
    )
    .eq("fund_name", FUND_NAME)
    .in("actor_user_id", userIds)
    .order("created_at", { ascending: true });

  if (error) fail("financial audit verification", error.message);
  return data || [];
}

async function getCashflowAuditRows(userIds) {
  const { data, error } = await admin
    .from("ventiq_investor_cashflow_access_events")
    .select(
      "actor_user_id,actor_role,investor_code,entitlement_basis,capital_call_count,receipt_count,distribution_count,created_at"
    )
    .eq("fund_name", FUND_NAME)
    .in("actor_user_id", userIds)
    .order("created_at", { ascending: true });

  if (error) fail("cashflow audit verification", error.message);
  return data || [];
}

async function getDocumentAuditRows(userIds) {
  const { data, error } = await admin
    .from("ventiq_investor_document_access_events")
    .select(
      "actor_user_id,actor_role,investor_code,investor_document_id,access_mode,entitlement_basis,created_at"
    )
    .eq("investor_document_id", PORTAL_DOCUMENT_ID)
    .in("actor_user_id", userIds)
    .order("created_at", { ascending: true });

  if (error) fail("document audit verification", error.message);
  return data || [];
}

function assertNoStorageCoordinates(document, label) {
  const forbidden = [
    "storage_bucket",
    "storage_path",
    "storage_url",
    "file_url",
    "signed_url",
  ];

  for (const key of forbidden) {
    if (Object.prototype.hasOwnProperty.call(document || {}, key)) {
      fail(
        `${label} unexpectedly exposes ${key}`,
        JSON.stringify(document, null, 2)
      );
    }
  }
}

async function verifyPreconditions() {
  console.log("");
  console.log("A7-6 Preconditions");
  console.log("------------------");

  const moduleKeys = [
    "investor_financials_portal",
    "investor_cashflows_portal",
    "investor_documents_portal",
    "investor_data_room_portal",
  ];

  const { data: modules, error: moduleError } = await admin
    .from("ventiq_module_activation_status")
    .select("module_key,status,readiness_score")
    .eq("organisation_id", ORGANISATION_ID)
    .eq("fund_name", FUND_NAME)
    .in("module_key", moduleKeys);

  if (moduleError) fail("module activation precondition", moduleError.message);

  for (const moduleKey of moduleKeys) {
    const row = (modules || []).find((item) => item.module_key === moduleKey);

    if (
      !row ||
      row.status !== "Active" ||
      Number(row.readiness_score) !== 100
    ) {
      fail(
        `${moduleKey} must be Active / 100`,
        JSON.stringify(row || null, null, 2)
      );
    }

    pass(`${moduleKey} = Active / 100`);
  }

  const { data: metricRun, error: metricRunError } = await admin
    .from("metric_calculation_runs")
    .select("id,fund_name,calculation_status")
    .eq("id", EXPECTED_RUN_ID)
    .maybeSingle();

  if (
    metricRunError ||
    !metricRun ||
    metricRun.fund_name !== FUND_NAME ||
    metricRun.calculation_status !== "Completed"
  ) {
    fail(
      "verified metric calculation run",
      metricRunError?.message || JSON.stringify(metricRun, null, 2)
    );
  }
  pass("verified metric calculation run exists");

  const { data: metric, error: metricError } = await admin
    .from("investor_performance_metrics")
    .select(
      "investor_code,commitment_amount,paid_in_capital,total_distributions,uncalled_commitment,allocated_nav,dpi,rvpi,tvpi,net_irr,calculation_status"
    )
    .eq("calculation_run_id", EXPECTED_RUN_ID)
    .eq("investor_code", INVESTOR_A_CODE)
    .maybeSingle();

  if (
    metricError ||
    !metric ||
    metric.calculation_status !== "Calculated" ||
    Number(metric.commitment_amount) !== 1000000 ||
    Number(metric.paid_in_capital) !== 400000 ||
    Number(metric.total_distributions) !== 100000 ||
    Number(metric.uncalled_commitment) !== 600000 ||
    Number(metric.allocated_nav) !== 300000 ||
    Number(metric.dpi) !== 0.25 ||
    Number(metric.rvpi) !== 0.75 ||
    Number(metric.tvpi) !== 1 ||
    Number(metric.net_irr) !== 0
  ) {
    fail(
      "A3 verified financial metric precondition",
      metricError?.message || JSON.stringify(metric, null, 2)
    );
  }
  pass("A3 verified financial metrics match canonical baseline");

  const { data: callAllocation, error: callAllocationError } = await admin
    .from("capital_call_allocations")
    .select("allocation_code,investor_code,called_amount,total_due,status")
    .eq("fund_name", FUND_NAME)
    .eq("investor_code", INVESTOR_A_CODE)
    .eq("allocation_code", "A7QA-CCA-001-A3TEST001")
    .maybeSingle();

  if (
    callAllocationError ||
    !callAllocation ||
    Number(callAllocation.called_amount) !== 400000 ||
    Number(callAllocation.total_due) !== 400000
  ) {
    fail(
      "A3 capital-call allocation precondition",
      callAllocationError?.message ||
        JSON.stringify(callAllocation, null, 2)
    );
  }

  const { data: receipt, error: receiptError } = await admin
    .from("capital_call_receipts")
    .select("receipt_code,investor_code,amount_received,receipt_status")
    .eq("fund_name", FUND_NAME)
    .eq("investor_code", INVESTOR_A_CODE)
    .eq("receipt_code", "A7QA-CCR-001-A3TEST001")
    .maybeSingle();

  if (
    receiptError ||
    !receipt ||
    Number(receipt.amount_received) !== 400000
  ) {
    fail(
      "A3 capital-call receipt precondition",
      receiptError?.message || JSON.stringify(receipt, null, 2)
    );
  }

  const { data: distribution, error: distributionError } = await admin
    .from("distribution_allocations")
    .select(
      "distribution_allocation_code,investor_code,net_distribution,payment_status"
    )
    .eq("fund_name", FUND_NAME)
    .eq("investor_code", INVESTOR_A_CODE)
    .eq("distribution_allocation_code", "A7QA-DA-001-A3TEST001")
    .maybeSingle();

  if (
    distributionError ||
    !distribution ||
    Number(distribution.net_distribution) !== 100000
  ) {
    fail(
      "A3 distribution precondition",
      distributionError?.message || JSON.stringify(distribution, null, 2)
    );
  }
  pass("A3 capital call / receipt / distribution baseline verified");

  const { data: portalDoc, error: portalDocError } = await admin
    .from("investor_documents")
    .select(
      "id,fund_name,investor_code,status,portal_status,storage_bucket,storage_path,publish_source"
    )
    .eq("id", PORTAL_DOCUMENT_ID)
    .maybeSingle();

  if (
    portalDocError ||
    !portalDoc ||
    portalDoc.fund_name !== FUND_NAME ||
    portalDoc.investor_code !== INVESTOR_A_CODE ||
    String(portalDoc.status || "").toLowerCase() !== "published" ||
    String(portalDoc.portal_status || "").toLowerCase() !== "available" ||
    !portalDoc.storage_bucket ||
    !portalDoc.storage_path
  ) {
    fail(
      "A3 canonical portal document precondition",
      portalDocError?.message || JSON.stringify(portalDoc, null, 2)
    );
  }
  pass("A3 canonical SOA is Published, available and privately stored");

  const { data: dataRoomDoc, error: dataRoomDocError } = await admin
    .from("data_room_documents")
    .select(
      "id,fund_name,source_batch_id,investor_code,document_name,access_level,storage_bucket,storage_path"
    )
    .eq("id", DATA_ROOM_DOCUMENT_ID)
    .maybeSingle();

  if (
    dataRoomDocError ||
    !dataRoomDoc ||
    dataRoomDoc.fund_name !== FUND_NAME ||
    dataRoomDoc.source_batch_id !== SOURCE_BATCH_ID ||
    dataRoomDoc.investor_code !== INVESTOR_A_CODE ||
    dataRoomDoc.access_level !== "Restricted LP Access" ||
    !dataRoomDoc.storage_bucket ||
    !dataRoomDoc.storage_path
  ) {
    fail(
      "A3 restricted Data Room document precondition",
      dataRoomDocError?.message || JSON.stringify(dataRoomDoc, null, 2)
    );
  }
  pass("A3 restricted Data Room document is privately stored");
}

async function verifyRlsIdentity(tokenA, tokenB) {
  console.log("");
  console.log("Identity / RLS");
  console.log("--------------");

  const clientA = jwtClient(tokenA);
  const clientB = jwtClient(tokenB);

  const { data: ownA, error: ownAError } = await clientA
    .from("investor_master")
    .select("id,investor_code,investor_name,fund_name")
    .eq("fund_name", FUND_NAME)
    .eq("investor_code", INVESTOR_A_CODE);

  if (ownAError) fail("Investor A investor_master RLS query", ownAError.message);

  if (
    !Array.isArray(ownA) ||
    ownA.length !== 1 ||
    ownA[0]?.investor_code !== INVESTOR_A_CODE
  ) {
    fail("Investor A must see exactly its A3 investor_master row");
  }

  const { data: blockedB, error: blockedBError } = await clientB
    .from("investor_master")
    .select("id,investor_code,investor_name,fund_name")
    .eq("fund_name", FUND_NAME)
    .eq("investor_code", INVESTOR_A_CODE);

  if (blockedBError) {
    fail("Investor B investor_master RLS query", blockedBError.message);
  }

  if (Array.isArray(blockedB) && blockedB.length !== 0) {
    fail(
      "Investor B RLS disclosed A3 investor identity",
      JSON.stringify(blockedB, null, 2)
    );
  }

  pass("Investor A can read its A3 investor_master identity");
  pass("Investor B cannot read the A3 investor_master identity");
}

async function verifyInvestorA(investorA, tokenA) {
  console.log("");
  console.log("Investor A â€” Full LP Surface");
  console.log("----------------------------");

  const financial = await callFinancialPosition(tokenA, INVESTOR_B_CODE);

  if (
    financial.response.status !== 200 ||
    financial.body?.available !== true ||
    financial.body?.investor_code !== INVESTOR_A_CODE
  ) {
    fail(
      "Investor A financial position release",
      JSON.stringify(financial.body, null, 2)
    );
  }

  const fp = financial.body?.financial_position || {};
  const financeChecks = {
    commitment_amount: 1000000,
    paid_in_capital: 400000,
    total_distributions: 100000,
    uncalled_commitment: 600000,
    allocated_nav: 300000,
    dpi: 0.25,
    rvpi: 0.75,
    tvpi: 1,
    net_irr: 0,
  };

  for (const [key, expected] of Object.entries(financeChecks)) {
    if (Number(fp[key]) !== expected) {
      fail(`Investor A financial ${key} mismatch`);
    }
  }

  if (
    Number(financial.body?.verification?.controls_passed) !== 11 ||
    Number(financial.body?.verification?.controls_total) !== 11 ||
    financial.body?.verification?.reconciliation_status !== "Pass"
  ) {
    fail(
      "Investor A financial verification controls mismatch",
      JSON.stringify(financial.body, null, 2)
    );
  }
  pass("Financials: A3 exact metrics + 11/11 verification PASS");
  pass("Financials: tampered investorCode ignored");

  const cashflows = await callCashflows(tokenA, INVESTOR_B_CODE);

  if (
    cashflows.response.status !== 200 ||
    cashflows.body?.available !== true ||
    cashflows.body?.investor_code !== INVESTOR_A_CODE
  ) {
    fail(
      "Investor A cashflow release",
      JSON.stringify(cashflows.body, null, 2)
    );
  }

  const summary = cashflows.body?.summary || {};
  const cashflowChecks = {
    capital_call_count: 1,
    receipt_count: 1,
    distribution_count: 1,
    total_called: 400000,
    total_due: 400000,
    total_received: 400000,
    total_outstanding: 0,
    total_distributed: 100000,
  };

  for (const [key, expected] of Object.entries(cashflowChecks)) {
    if (Number(summary[key]) !== expected) {
      fail(
        `Investor A cashflow ${key} mismatch`,
        JSON.stringify(cashflows.body, null, 2)
      );
    }
  }

  const calls = Array.isArray(cashflows.body?.capital_calls)
    ? cashflows.body.capital_calls
    : [];
  const distributions = Array.isArray(cashflows.body?.distributions)
    ? cashflows.body.distributions
    : [];

  if (
    calls.length !== 1 ||
    calls[0]?.capital_call_code !== "A7QA-CC-001" ||
    Number(calls[0]?.called_amount) !== 400000 ||
    Number(calls[0]?.amount_received) !== 400000 ||
    Number(calls[0]?.outstanding_amount) !== 0 ||
    distributions.length !== 1 ||
    distributions[0]?.distribution_code !== "A7QA-DIST-001" ||
    Number(distributions[0]?.net_distribution) !== 100000
  ) {
    fail(
      "Investor A capital call/distribution payload mismatch",
      JSON.stringify(cashflows.body, null, 2)
    );
  }
  pass("Cashflows: â‚¹4L called / â‚¹4L received / â‚¹0 outstanding / â‚¹1L distributed PASS");
  pass("Cashflows: tampered investorCode ignored");

  const portalDocs = await callPortalDocuments(tokenA, INVESTOR_B_CODE);

  if (
    portalDocs.response.status !== 200 ||
    portalDocs.body?.available !== true ||
    portalDocs.body?.investor_code !== INVESTOR_A_CODE
  ) {
    fail(
      "Investor A portal document listing",
      JSON.stringify(portalDocs.body, null, 2)
    );
  }

  const documents = Array.isArray(portalDocs.body?.documents)
    ? portalDocs.body.documents
    : [];

  if (
    documents.length !== 1 ||
    documents[0]?.id !== PORTAL_DOCUMENT_ID ||
    documents[0]?.investor_code !== INVESTOR_A_CODE ||
    documents[0]?.download_ready !== true ||
    documents[0]?.canonical !== true
  ) {
    fail(
      "Investor A portal document payload mismatch",
      JSON.stringify(portalDocs.body, null, 2)
    );
  }

  assertNoStorageCoordinates(documents[0], "Investor A portal document listing");

  const portalView = await callPortalDocumentAccess(tokenA, "view");
  if (
    portalView.response.status !== 200 ||
    !portalView.body?.signed_url
  ) {
    fail(
      "Investor A portal document View",
      JSON.stringify(portalView.body, null, 2)
    );
  }

  const portalDownload = await callPortalDocumentAccess(tokenA, "download");
  if (
    portalDownload.response.status !== 200 ||
    !portalDownload.body?.signed_url
  ) {
    fail(
      "Investor A portal document Download",
      JSON.stringify(portalDownload.body, null, 2)
    );
  }

  pass("Documents: own canonical SOA only; no permanent storage metadata PASS");
  pass("Documents: View + Download short-lived signed access PASS");

  const dataRoomList = await callDataRoomDocuments(tokenA, INVESTOR_B_CODE);

  if (dataRoomList.response.status !== 200) {
    fail(
      "Investor A Data Room listing",
      JSON.stringify(dataRoomList.body, null, 2)
    );
  }

  const dataRoomDocuments = Array.isArray(dataRoomList.body?.documents)
    ? dataRoomList.body.documents
    : [];

  if (
    dataRoomDocuments.length !== 1 ||
    dataRoomDocuments[0]?.id !== DATA_ROOM_DOCUMENT_ID ||
    dataRoomDocuments[0]?.investor_code !== INVESTOR_A_CODE ||
    dataRoomDocuments[0]?.document_name !== DATA_ROOM_DOCUMENT_NAME ||
    dataRoomDocuments[0]?.download_ready !== true
  ) {
    fail(
      "Investor A Data Room document payload mismatch",
      JSON.stringify(dataRoomList.body, null, 2)
    );
  }

  assertNoStorageCoordinates(
    dataRoomDocuments[0],
    "Investor A Data Room listing"
  );

  const dataRoomAccess = await callDataRoomDocumentAccess(tokenA);

  if (
    dataRoomAccess.response.status !== 200 ||
    !dataRoomAccess.body?.signedUrl ||
    Number(dataRoomAccess.body?.expiresInSeconds) <= 0
  ) {
    fail(
      "Investor A Data Room signed access",
      JSON.stringify(dataRoomAccess.body, null, 2)
    );
  }

  assertNoStorageCoordinates(
    dataRoomAccess.body?.document || {},
    "Investor A Data Room signed response"
  );

  pass("Data Room: own restricted document only; no storage coordinates PASS");
  pass("Data Room: short-lived signed access PASS");

  const viewEvent = await workflowPost(tokenA, {
    operation: "record_engagement",
    fundName: FUND_NAME,
    sourceBatchId: SOURCE_BATCH_ID,
    investorCode: INVESTOR_B_CODE,
    documentId: DATA_ROOM_DOCUMENT_ID,
    action: "Viewed",
    note: "A7-6 final full portal regression view",
  });

  if (
    viewEvent.response.status !== 201 ||
    viewEvent.body?.engagementEvent?.investor_code !== INVESTOR_A_CODE ||
    viewEvent.body?.engagementEvent?.action !== "Viewed"
  ) {
    fail(
      "Investor A Data Room engagement",
      JSON.stringify(viewEvent.body, null, 2)
    );
  }

  const qaQuestion =
    "A7-6 final regression: please confirm this document is available to my entitled investor account.";

  const question = await workflowPost(tokenA, {
    operation: "create_question",
    fundName: FUND_NAME,
    sourceBatchId: SOURCE_BATCH_ID,
    investorCode: INVESTOR_B_CODE,
    documentId: DATA_ROOM_DOCUMENT_ID,
    category: "Fund Overview",
    question: qaQuestion,
    status: "Open",
  });

  if (
    question.response.status !== 201 ||
    question.body?.question?.investor_code !== INVESTOR_A_CODE ||
    question.body?.question?.question !== qaQuestion
  ) {
    fail(
      "Investor A DDQ creation",
      JSON.stringify(question.body, null, 2)
    );
  }

  investorA.questionId = question.body.question.id;

  const workflow = await workflowGet(tokenA, INVESTOR_B_CODE);

  if (workflow.response.status !== 200) {
    fail(
      "Investor A DDQ/history retrieval",
      JSON.stringify(workflow.body, null, 2)
    );
  }

  const workflowQuestions = Array.isArray(workflow.body?.questions)
    ? workflow.body.questions
    : [];
  const workflowEvents = Array.isArray(workflow.body?.engagementEvents)
    ? workflow.body.engagementEvents
    : [];

  const ownQuestion = workflowQuestions.find(
    (row) => row?.id === investorA.questionId
  );
  const ownView = workflowEvents.find(
    (row) =>
      row?.action === "Viewed" &&
      row?.document_id === DATA_ROOM_DOCUMENT_ID
  );
  const ownAsked = workflowEvents.find(
    (row) =>
      row?.action === "Asked Question" &&
      row?.document_id === DATA_ROOM_DOCUMENT_ID
  );

  if (
    !ownQuestion ||
    ownQuestion.investor_code !== INVESTOR_A_CODE ||
    !ownView ||
    ownView.investor_code !== INVESTOR_A_CODE ||
    !ownAsked ||
    ownAsked.investor_code !== INVESTOR_A_CODE
  ) {
    fail(
      "Investor A DDQ/history isolation mismatch",
      JSON.stringify(workflow.body, null, 2)
    );
  }

  pass("DDQ: real question + Viewed + Asked Question history PASS");
  pass("DDQ: URL/body investorCode tampering ignored");
}

async function verifyInvestorB(investorB, tokenB) {
  console.log("");
  console.log("Investor B â€” Cross-Investor Denial");
  console.log("----------------------------------");

  const financial = await callFinancialPosition(tokenB, INVESTOR_A_CODE);

  if (
    financial.response.status !== 404 ||
    financial.body?.available === true ||
    financial.body?.financial_position ||
    financial.body?.investor_code === INVESTOR_A_CODE
  ) {
    fail(
      "Investor B financial isolation",
      JSON.stringify(financial.body, null, 2)
    );
  }
  pass("Financials: A3 tampering -> 404 / no payload");

  const cashflows = await callCashflows(tokenB, INVESTOR_A_CODE);

  if (
    cashflows.response.status !== 404 ||
    cashflows.body?.available === true ||
    cashflows.body?.investor_code === INVESTOR_A_CODE ||
    Array.isArray(cashflows.body?.capital_calls) ||
    Array.isArray(cashflows.body?.distributions)
  ) {
    fail(
      "Investor B cashflow isolation",
      JSON.stringify(cashflows.body, null, 2)
    );
  }
  pass("Cashflows: A3 tampering -> 404 / no payload");

  const portalDocs = await callPortalDocuments(tokenB, INVESTOR_A_CODE);

  if (
    portalDocs.response.status !== 404 ||
    portalDocs.body?.available === true ||
    portalDocs.body?.investor_code === INVESTOR_A_CODE ||
    Array.isArray(portalDocs.body?.documents)
  ) {
    fail(
      "Investor B portal document listing isolation",
      JSON.stringify(portalDocs.body, null, 2)
    );
  }

  const portalView = await callPortalDocumentAccess(tokenB, "view");
  const portalDownload = await callPortalDocumentAccess(tokenB, "download");

  if (
    portalView.response.status !== 404 ||
    portalView.body?.signed_url ||
    portalDownload.response.status !== 404 ||
    portalDownload.body?.signed_url
  ) {
    fail(
      "Investor B portal document signed access isolation",
      JSON.stringify(
        { view: portalView.body, download: portalDownload.body },
        null,
        2
      )
    );
  }
  pass("Documents: A3 listing/View/Download -> 404 / no signed URL");

  const dataRoomList = await callDataRoomDocuments(tokenB, INVESTOR_A_CODE);

  if (dataRoomList.response.status !== 200) {
    fail(
      "Investor B own-context Data Room listing",
      JSON.stringify(dataRoomList.body, null, 2)
    );
  }

  const dataRoomDocuments = Array.isArray(dataRoomList.body?.documents)
    ? dataRoomList.body.documents
    : [];

  if (
    dataRoomDocuments.some(
      (row) =>
        row?.id === DATA_ROOM_DOCUMENT_ID ||
        row?.investor_code === INVESTOR_A_CODE
    )
  ) {
    fail(
      "Investor B Data Room listing disclosed A3 metadata",
      JSON.stringify(dataRoomList.body, null, 2)
    );
  }

  const dataRoomAccess = await callDataRoomDocumentAccess(tokenB);

  if (
    dataRoomAccess.response.status !== 404 ||
    dataRoomAccess.body?.signedUrl
  ) {
    fail(
      "Investor B Data Room signed access isolation",
      JSON.stringify(dataRoomAccess.body, null, 2)
    );
  }
  pass("Data Room: tampered A3 listing reveals nothing; direct A3 access -> 404");

  const workflow = await workflowGet(tokenB, INVESTOR_A_CODE);

  if (workflow.response.status !== 200) {
    fail(
      "Investor B own-context workflow GET",
      JSON.stringify(workflow.body, null, 2)
    );
  }

  const questions = Array.isArray(workflow.body?.questions)
    ? workflow.body.questions
    : [];
  const events = Array.isArray(workflow.body?.engagementEvents)
    ? workflow.body.engagementEvents
    : [];

  if (
    questions.some((row) => row?.investor_code === INVESTOR_A_CODE) ||
    events.some((row) => row?.investor_code === INVESTOR_A_CODE)
  ) {
    fail(
      "Investor B workflow disclosed A3 history",
      JSON.stringify(workflow.body, null, 2)
    );
  }

  const questionsBefore = await countRows(
    "data_room_questions",
    "created_by",
    investorB.userId
  );
  const eventsBefore = await countRows(
    "data_room_engagement_events",
    "recorded_by",
    investorB.userId
  );

  const crossQuestion = await workflowPost(tokenB, {
    operation: "create_question",
    fundName: FUND_NAME,
    sourceBatchId: SOURCE_BATCH_ID,
    investorCode: INVESTOR_A_CODE,
    documentId: DATA_ROOM_DOCUMENT_ID,
    category: "Fund Overview",
    question: "A7-6 attempted cross-investor question",
    status: "Open",
  });

  if (crossQuestion.response.status !== 404) {
    fail(
      "Investor B cross-investor DDQ must return 404",
      JSON.stringify(crossQuestion.body, null, 2)
    );
  }

  const questionsAfter = await countRows(
    "data_room_questions",
    "created_by",
    investorB.userId
  );
  const eventsAfter = await countRows(
    "data_room_engagement_events",
    "recorded_by",
    investorB.userId
  );

  if (
    questionsAfter !== questionsBefore ||
    eventsAfter !== eventsBefore
  ) {
    fail("Investor B denied DDQ attempt created workflow rows");
  }

  pass("DDQ: A3 history hidden; cross-investor question -> 404 / no rows");
}

async function verifyAuditEvidence(investorA, investorB) {
  console.log("");
  console.log("Governed Audit Evidence");
  console.log("-----------------------");

  const financialAudit = await getFinancialAuditRows(createdUserIds);
  const cashflowAudit = await getCashflowAuditRows(createdUserIds);
  const documentAudit = await getDocumentAuditRows(createdUserIds);

  const financeA = financialAudit.filter(
    (row) => row.actor_user_id === investorA.userId
  );
  const financeB = financialAudit.filter(
    (row) => row.actor_user_id === investorB.userId
  );

  if (
    financeA.length !== 1 ||
    financeA[0].investor_code !== INVESTOR_A_CODE ||
    financeA[0].calculation_run_id !== EXPECTED_RUN_ID ||
    financeA[0].actor_role !== "investor" ||
    financeA[0].entitlement_basis !==
      `ventiq_user_investor_access:${INVESTOR_A_CODE}:financials` ||
    financeB.length !== 0
  ) {
    fail(
      "financial audit evidence mismatch",
      JSON.stringify(financialAudit, null, 2)
    );
  }
  pass("Financial audit: 1 successful A3 release / 0 denied-user releases");

  const cashA = cashflowAudit.filter(
    (row) => row.actor_user_id === investorA.userId
  );
  const cashB = cashflowAudit.filter(
    (row) => row.actor_user_id === investorB.userId
  );

  if (
    cashA.length !== 1 ||
    cashA[0].investor_code !== INVESTOR_A_CODE ||
    cashA[0].actor_role !== "investor" ||
    cashA[0].entitlement_basis !==
      `ventiq_user_investor_access:${INVESTOR_A_CODE}:financials` ||
    Number(cashA[0].capital_call_count) !== 1 ||
    Number(cashA[0].receipt_count) !== 1 ||
    Number(cashA[0].distribution_count) !== 1 ||
    cashB.length !== 0
  ) {
    fail(
      "cashflow audit evidence mismatch",
      JSON.stringify(cashflowAudit, null, 2)
    );
  }
  pass("Cashflow audit: 1 successful A3 release / 0 denied-user releases");

  const documentA = documentAudit.filter(
    (row) => row.actor_user_id === investorA.userId
  );
  const documentB = documentAudit.filter(
    (row) => row.actor_user_id === investorB.userId
  );

  if (documentA.length !== 2 || documentB.length !== 0) {
    fail(
      "document audit row-count mismatch",
      JSON.stringify(documentAudit, null, 2)
    );
  }

  const modes = new Set(
    documentA.map((row) => String(row.access_mode || "").toLowerCase())
  );

  if (!modes.has("view") || !modes.has("download")) {
    fail(
      "document audit must include View + Download",
      JSON.stringify(documentA, null, 2)
    );
  }

  for (const row of documentA) {
    if (
      row.investor_code !== INVESTOR_A_CODE ||
      row.investor_document_id !== PORTAL_DOCUMENT_ID ||
      row.actor_role !== "investor"
    ) {
      fail(
        "document audit evidence mismatch",
        JSON.stringify(row, null, 2)
      );
    }
  }

  pass("Document audit: View + Download only for entitled A3 Investor");

  const questionCountA = await countRows(
    "data_room_questions",
    "created_by",
    investorA.userId
  );
  const eventCountA = await countRows(
    "data_room_engagement_events",
    "recorded_by",
    investorA.userId
  );
  const questionCountB = await countRows(
    "data_room_questions",
    "created_by",
    investorB.userId
  );
  const eventCountB = await countRows(
    "data_room_engagement_events",
    "recorded_by",
    investorB.userId
  );

  if (
    questionCountA !== 1 ||
    eventCountA !== 2 ||
    questionCountB !== 0 ||
    eventCountB !== 0
  ) {
    fail(
      "Data Room/DDQ workflow audit counts mismatch",
      JSON.stringify(
        {
          questionCountA,
          eventCountA,
          questionCountB,
          eventCountB,
        },
        null,
        2
      )
    );
  }

  pass("Data Room/DDQ audit: A3 = 1 question + 2 events; denied user = 0");
}

async function cleanup() {
  for (const userId of [...createdUserIds].reverse()) {
    try {
      await admin
        .from("data_room_engagement_events")
        .delete()
        .eq("recorded_by", userId);

      await admin
        .from("data_room_questions")
        .delete()
        .eq("created_by", userId);

      await admin
        .from("ventiq_investor_document_access_events")
        .delete()
        .eq("actor_user_id", userId);

      await admin
        .from("ventiq_investor_cashflow_access_events")
        .delete()
        .eq("actor_user_id", userId);

      await admin
        .from("ventiq_investor_financial_access_events")
        .delete()
        .eq("actor_user_id", userId);

      await admin
        .from("ventiq_user_investor_access")
        .delete()
        .eq("user_id", userId);

      await admin
        .from("ventiq_user_fund_access")
        .delete()
        .eq("user_id", userId);

      await admin
        .from("ventiq_organisation_members")
        .delete()
        .eq("user_id", userId);

      await admin
        .from("ventiq_user_profiles")
        .delete()
        .eq("user_id", userId);

      const { error: authDeleteError } =
        await admin.auth.admin.deleteUser(userId);

      if (authDeleteError) {
        console.warn(
          `WARN - auth cleanup failed for ${userId}: ${authDeleteError.message}`
        );
      }
    } catch (error) {
      console.warn(
        `WARN - cleanup failed for ${userId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}

async function verifyCleanup() {
  for (const userId of createdUserIds) {
    const checks = [
      ["ventiq_user_investor_access", "user_id"],
      ["ventiq_user_fund_access", "user_id"],
      ["ventiq_organisation_members", "user_id"],
      ["ventiq_user_profiles", "user_id"],
      ["data_room_questions", "created_by"],
      ["data_room_engagement_events", "recorded_by"],
      ["ventiq_investor_financial_access_events", "actor_user_id"],
      ["ventiq_investor_cashflow_access_events", "actor_user_id"],
      ["ventiq_investor_document_access_events", "actor_user_id"],
    ];

    for (const [table, column] of checks) {
      const remaining = await countRows(table, column, userId);

      if (remaining !== 0) {
        fail(
          `cleanup incomplete for ${table}/${userId}: ${remaining} row(s)`
        );
      }
    }

    const { data: authUser } =
      await admin.auth.admin.getUserById(userId);

    if (authUser?.user) {
      fail(`cleanup incomplete: auth user still exists ${userId}`);
    }
  }

  pass("temporary A7-6 users, entitlements, workflow rows and audit rows cleaned");
}

async function main() {
  console.log("");
  console.log("VENTIQ A7-6 FINAL INVESTOR PORTAL A/B REGRESSION");
  console.log("================================================");
  console.log(`Fund: ${FUND_NAME}`);
  console.log(`Investor A: ${INVESTOR_A_CODE}`);
  console.log(`Investor B: ${INVESTOR_B_CODE}`);
  console.log("One A/B identity pair is reused across the entire LP surface.");
  console.log("Temporary users/test workflow/audit rows are cleaned automatically.");
  console.log("");

  const investorA = makeAccount("Investor-A", INVESTOR_A_CODE);
  const investorB = makeAccount("Investor-B", INVESTOR_B_CODE);

  let succeeded = false;

  try {
    await verifyPreconditions();

    console.log("");
    console.log("Provisioning Final A/B Pair");
    console.log("---------------------------");

    await createQaInvestor(investorA);
    await createQaInvestor(investorB);

    const tokenA = await signIn(investorA);
    const tokenB = await signIn(investorB);

    await verifyRlsIdentity(tokenA, tokenB);
    await verifyInvestorA(investorA, tokenA);
    await verifyInvestorB(investorB, tokenB);
    await verifyAuditEvidence(investorA, investorB);

    console.log("");
    console.log("================================================");
    console.log("PASS - A7-6 FINAL INVESTOR PORTAL A/B REGRESSION");
    console.log("================================================");
    console.log("Identity / RLS:      PASS");
    console.log("Financial position:  PASS");
    console.log("Capital calls:       PASS");
    console.log("Distributions:       PASS");
    console.log("Investor documents:  PASS");
    console.log("Data Room:           PASS");
    console.log("DDQ / Q&A:           PASS");
    console.log("URL/body tampering:  PASS");
    console.log("Cross-investor 404:  PASS");
    console.log("Governed audit:      PASS");
    console.log("");
    console.log("A7 INVESTOR BACKEND FINAL GATE PASSED.");
    succeeded = true;
  } finally {
    await cleanup();

    if (createdUserIds.length > 0) {
      console.log("");
      await verifyCleanup();
    }

    if (succeeded) {
      console.log("PASS - A7-6 TEMPORARY TEST STATE CLEANED");
    }
  }
}

main().catch((error) => {
  console.error("");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

